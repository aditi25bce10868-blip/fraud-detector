from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from backend.data.loader import get_data
from backend.models.fraud_model import fraud_model          # singleton
from backend.models.trainer import ModelTrainer
from backend.models.evaluator import ModelEvaluator
from typing import Optional
import pandas as pd
import io
import uuid
import os
from datetime import datetime

router = APIRouter()

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────

UPLOAD_DIR  = "uploads"
MAX_FILE_MB = 50
ALLOWED_EXT = {".csv", ".json", ".xlsx", ".xls"}

os.makedirs(UPLOAD_DIR, exist_ok=True)

# In-memory stores (swap for DB in production)
_upload_results   = {}
_upload_history   = []
_training_history = []


# ─────────────────────────────────────────────
# TAB 1 — Upload Data
# ─────────────────────────────────────────────

@router.post("/transactions")
async def upload_transactions(file: UploadFile = File(...)):
    """
    Upload a CSV of transactions for fraud scoring.
    Uses FraudModel singleton (trained model → rule-based fallback).
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXT)}",
        )

    upload_id = str(uuid.uuid4())[:8].upper()
    content   = await file.read()

    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File {size_mb:.1f}MB exceeds {MAX_FILE_MB}MB limit.",
        )

    try:
        uploaded = pd.read_csv(io.StringIO(content.decode('utf-8')))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {str(e)}")

    print(f"[Upload] {len(uploaded)} rows, columns: {uploaded.columns.tolist()}")

    required = ['amount', 'transaction_hour']
    missing  = [c for c in required if c not in uploaded.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {missing}. At minimum need: {required}",
        )

    # Save file to disk for potential re-training
    saved_name = f"{upload_id}_{file.filename}"
    with open(os.path.join(UPLOAD_DIR, saved_name), "wb") as f:
        f.write(content)

    # Score all rows via the FraudModel singleton
    scored_rows = fraud_model.predict_batch(uploaded)
    fraud_count = sum(1 for r in scored_rows if r["is_predicted_fraud"])

    results = [
        {
            "row_index": int(idx),
            "amount":    round(float(uploaded.iloc[idx].get('amount', 0)), 2),
            **scored_rows[idx],
        }
        for idx in range(len(scored_rows))
    ]

    record = {
        "upload_id":       upload_id,
        "filename":        file.filename,
        "saved_as":        saved_name,
        "size_mb":         round(size_mb, 2),
        "total_rows":      len(uploaded),
        "fraud_detected":  fraud_count,
        "normal_detected": len(uploaded) - fraud_count,
        "fraud_rate":      round(fraud_count / len(uploaded) * 100, 2) if len(uploaded) > 0 else 0,
        "used_model":      fraud_model.loaded,
        "uploaded_at":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status":          "Completed",
        "results":         results,
    }

    _upload_results[upload_id] = record
    _upload_history.append({k: v for k, v in record.items() if k != "results"})

    # Audit log
    try:
        from routes.reports import log_action
        log_action(
            user     = "system",
            action   = "DATASET_UPLOAD",
            resource = upload_id,
            details  = f"Uploaded {file.filename} — {len(uploaded)} rows, {fraud_count} fraud flagged",
            status   = "Success",
        )
    except Exception:
        pass

    return {
        "upload_id":      upload_id,
        "status":         "complete",
        "total_rows":     len(uploaded),
        "fraud_detected": fraud_count,
        "fraud_rate":     round(fraud_count / len(uploaded) * 100, 2) if len(uploaded) > 0 else 0,
        "used_model":     fraud_model.loaded,
        "message":        f"Processed {len(uploaded)} transactions. {fraud_count} flagged as fraud.",
        "results_url":    f"/api/upload/results/{upload_id}",
    }


@router.get("/results/{upload_id}")
def get_upload_results(upload_id: str):
    """Fetch full scored results for a previous upload."""
    if upload_id not in _upload_results:
        raise HTTPException(status_code=404, detail="Upload ID not found.")
    return _upload_results[upload_id]


# ─────────────────────────────────────────────
# TAB 2 — Train Model
# ─────────────────────────────────────────────

@router.post("/train")
def trigger_training(
    upload_id:  str   = Query(..., description="upload_id from /upload/transactions"),
    model_type: str   = Query("random_forest", description="random_forest | gradient_boosting | logistic_regression"),
    epochs:     int   = Query(100, ge=1, le=500),
    test_size:  float = Query(0.2, gt=0, lt=1),
):
    """
    Train the fraud model on a previously uploaded dataset.
    Runs synchronously — wire to BackgroundTasks / Celery for async.
    """
    upload = next((u for u in _upload_history if u["upload_id"] == upload_id), None)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload ID not found. Upload a dataset first.")

    train_id = f"TRAIN-{str(uuid.uuid4())[:6].upper()}"
    job = {
        "id":             train_id,
        "dataset":        upload["filename"],
        "upload_id":      upload_id,
        "model_type":     model_type,
        "started_at":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "completed_at":   None,
        "status":         "Running",
        "epochs":         epochs,
        "accuracy":       None,
        "precision":      None,
        "recall":         None,
        "f1_score":       None,
        "auc_roc":        None,
    }
    _training_history.append(job)

    try:
        trainer = ModelTrainer(
            model_type   = model_type,
            test_size    = test_size,
            model_out    = "fraud_model.pkl",
            encoders_out = "encoders.pkl",
        )

        saved_path = os.path.join(UPLOAD_DIR, upload.get("saved_as", ""))
        if os.path.exists(saved_path):
            result = trainer.train_from_file(saved_path, epochs=epochs)
        else:
            # Fall back to the main dataset
            result = trainer.train(get_data(), epochs=epochs)

        # Reload the singleton so new predictions use the fresh model
        fraud_model.load()

        job.update({
            "status":           "Completed",
            "completed_at":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "accuracy":         result.get("accuracy"),
            "precision":        result.get("precision"),
            "recall":           result.get("recall"),
            "f1_score":         result.get("f1_score"),
            "auc_roc":          result.get("auc_roc"),
            "confusion_matrix": result.get("confusion_matrix"),
        })

        try:
            from routes.reports import log_action
            log_action(
                user     = "system",
                action   = "MODEL_TRAIN",
                resource = train_id,
                details  = f"Training completed — accuracy: {result.get('accuracy')}",
                status   = "Success",
            )
        except Exception:
            pass

    except Exception as e:
        job.update({
            "status":       "Failed",
            "completed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "error":        str(e),
        })
        try:
            from routes.reports import log_action
            log_action(
                user="system", action="MODEL_TRAIN",
                resource=train_id, details=str(e), status="Failed",
            )
        except Exception:
            pass

    return job


@router.get("/train/status/{train_id}")
def get_training_status(train_id: str):
    """Get status of a specific training job."""
    job = next((t for t in _training_history if t["id"] == train_id), None)
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found.")
    return job


# ─────────────────────────────────────────────
# TAB 3 — Metrics
# ─────────────────────────────────────────────

@router.get("/metrics")
def get_model_metrics():
    """
    Returns model performance metrics evaluated against the real dataset.
    Falls back to dataset stats only if no model is loaded.
    """
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True]
    total    = len(df)
    fraud_n  = len(fraud_df)

    dataset_stats = {
        "total_samples":  total,
        "fraud_samples":  fraud_n,
        "normal_samples": total - fraud_n,
        "fraud_rate_pct": round(fraud_n / total * 100, 2) if total > 0 else 0,
    }

    if not fraud_model.loaded or fraud_model.model is None:
        return {
            "model_available": False,
            "current_model":   "rule_based_fallback",
            "dataset_stats":   dataset_stats,
            "note":            "No trained model found. Use POST /upload/train to train one.",
        }

    try:
        ev          = ModelEvaluator(fraud_model.model, fraud_model.encoders)
        metrics     = ev.evaluate(df)
        feature_imp = ev.feature_importance(top_n=10)

        return {
            "model_available":    True,
            "current_model":      fraud_model.info().get("model_type", "unknown"),
            "model_path":         fraud_model.model_path,
            "dataset_stats":      dataset_stats,
            "feature_importance": feature_imp,
            **metrics,
        }
    except Exception as e:
        return {
            "model_available": True,
            "current_model":   fraud_model.info().get("model_type", "unknown"),
            "dataset_stats":   dataset_stats,
            "error":           str(e),
            "note":            "Model loaded but evaluation failed — check feature alignment.",
        }


@router.get("/model/info")
def get_model_info():
    """Returns metadata about the currently loaded model."""
    return fraud_model.info()


# ─────────────────────────────────────────────
# TAB 4 — History
# ─────────────────────────────────────────────

@router.get("/history/uploads")
def get_upload_history():
    """All previously uploaded dataset files, newest first."""
    return {
        "total":   len(_upload_history),
        "uploads": list(reversed(_upload_history)),
    }


@router.get("/history/training")
def get_training_history(
    status: Optional[str] = Query(None, description="Completed | Running | Failed"),
):
    """Model training history, optionally filtered by status."""
    history = _training_history
    if status and status.lower() not in ("all", ""):
        history = [t for t in history if t["status"].lower() == status.lower()]
    return {
        "total": len(history),
        "jobs":  list(reversed(history)),
    }


@router.delete("/history/uploads/{upload_id}")
def delete_upload(upload_id: str):
    """Remove an upload record from history, memory, and disk."""
    global _upload_history
    record = next((u for u in _upload_history if u["upload_id"] == upload_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Upload not found.")

    # Delete from disk
    saved_path = os.path.join(UPLOAD_DIR, record.get("saved_as", ""))
    if os.path.exists(saved_path):
        os.remove(saved_path)

    _upload_history = [u for u in _upload_history if u["upload_id"] != upload_id]
    _upload_results.pop(upload_id, None)

    return {"message": f"Upload '{record['filename']}' removed successfully."}