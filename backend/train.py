import pandas as pd
import numpy as np
import pickle
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, precision_recall_curve, auc
)
from imblearn.over_sampling import SMOTE
import warnings
warnings.filterwarnings('ignore')

np.random.seed(42)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: LOAD PREPROCESSED DATA
# ══════════════════════════════════════════════════════════════════════════════
print("Loading model_input.csv...")
df = pd.read_csv("model_input.csv")
print(f"Shape: {df.shape}")
print(f"Fraud rows:  {df['is_fraudulent'].sum()}")
print(f"Normal rows: {(df['is_fraudulent'] == 0).sum()}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: SPLIT X AND y
# ══════════════════════════════════════════════════════════════════════════════
X = df.drop(columns=['is_fraudulent'])
y = df['is_fraudulent'].astype(int)

print(f"\nFeatures: {X.columns.tolist()}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: TRAIN TEST SPLIT — stratified
# ══════════════════════════════════════════════════════════════════════════════
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)
print(f"\nTrain: {len(X_train)} | Fraud: {y_train.sum()}")
print(f"Test:  {len(X_test)}  | Fraud: {y_test.sum()}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: SMOTE — fix 505 vs 519K imbalance
# ══════════════════════════════════════════════════════════════════════════════
print(f"\nBefore SMOTE: {dict(y_train.value_counts())}")
smote = SMOTE(random_state=42, k_neighbors=5)
X_train_bal, y_train_bal = smote.fit_resample(X_train, y_train)
print(f"After SMOTE:  {dict(pd.Series(y_train_bal).value_counts())}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: TRAIN
# ══════════════════════════════════════════════════════════════════════════════
print("\nTraining Random Forest...")
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=20,
    min_samples_leaf=5,
    min_samples_split=10,
    class_weight='balanced',
    random_state=42,
    n_jobs=-1
)
model.fit(X_train_bal, y_train_bal)
print("Training complete ✓")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6: EVALUATE
# ══════════════════════════════════════════════════════════════════════════════
y_pred      = model.predict(X_test)
y_pred_prob = model.predict_proba(X_test)[:, 1]

print("\n=== CLASSIFICATION REPORT ===")
print(classification_report(y_test, y_pred, target_names=['Normal', 'Fraud'], digits=4))

cm = confusion_matrix(y_test, y_pred)
tn, fp, fn, tp = cm.ravel()
print("=== CONFUSION MATRIX ===")
print(f"True Normal  (correct): {tn}")
print(f"False Alarm  (wrong):   {fp}")
print(f"Missed Fraud (wrong):   {fn}  ← should be LOW")
print(f"Caught Fraud (correct): {tp}  ← should be HIGH")

roc_auc              = roc_auc_score(y_test, y_pred_prob)
precision, recall, _ = precision_recall_curve(y_test, y_pred_prob)
pr_auc               = auc(recall, precision)

print(f"\nROC-AUC: {roc_auc:.4f}")
print(f"PR-AUC:  {pr_auc:.4f}  ← most important for fraud")

print(f"\nFraud caught:  {tp} / {y_test.sum()} ({tp/y_test.sum()*100:.1f}%)")
print(f"Fraud missed:  {fn} / {y_test.sum()} ({fn/y_test.sum()*100:.1f}%)")
print(f"False alarms:  {fp}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7: THRESHOLD ANALYSIS
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n=== THRESHOLD ANALYSIS ===")
print(f"{'Threshold':<12} {'Caught':<10} {'Missed':<10} {'False Alarms':<14} {'Precision':<12} {'Recall'}")
print("-" * 70)
for thresh in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]:
    yp    = (y_pred_prob >= thresh).astype(int)
    cm_t  = confusion_matrix(y_test, yp)
    tn_t, fp_t, fn_t, tp_t = cm_t.ravel()
    prec  = tp_t / (tp_t + fp_t) if (tp_t + fp_t) > 0 else 0
    rec   = tp_t / (tp_t + fn_t) if (tp_t + fn_t) > 0 else 0
    print(f"{thresh:<12} {tp_t:<10} {fn_t:<10} {fp_t:<14} {prec:<12.3f} {rec:.3f}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8: FEATURE IMPORTANCE
# ══════════════════════════════════════════════════════════════════════════════
importance_df = pd.DataFrame({
    'feature':    X.columns,
    'importance': model.feature_importances_
}).sort_values('importance', ascending=False)

print(f"\n=== TOP 15 FEATURES ===")
print(importance_df.head(15).to_string(index=False))

print(f"\n=== BOTTOM 5 (consider removing) ===")
print(importance_df.tail(5).to_string(index=False))

# ══════════════════════════════════════════════════════════════════════════════
# STEP 9: SAVE MODEL + ARTIFACTS
# ══════════════════════════════════════════════════════════════════════════════
with open("fraud_model.pkl", "wb") as f:
    pickle.dump(model, f)

importance_df.to_csv("feature_importance.csv", index=False)

results_df = X_test.copy()
results_df['actual']            = y_test.values
results_df['predicted']         = y_pred
results_df['fraud_probability'] = y_pred_prob.round(4)
results_df.to_csv("test_predictions.csv", index=False)

print("\n✅ fraud_model.pkl saved")
print("✅ feature_importance.csv saved")
print("✅ test_predictions.csv saved")

print("\n" + "="*50)
print("SUMMARY")
print("="*50)
print(f"Fraud caught:  {tp} / {y_test.sum()} ({tp/y_test.sum()*100:.1f}%)")
print(f"PR-AUC Score:  {pr_auc:.4f}")
print(f"Model saved:   fraud_model.pkl")
print("\nRun order:")
print("  1. python prepare.py")
print("  2. python preprocess.py")
print("  3. python train.py")
print("  4. uvicorn backend.main:app --reload --port 8000")