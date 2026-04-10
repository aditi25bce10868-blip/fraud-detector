from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from backend.data.loader import get_data
from typing import Optional
from datetime import datetime
import pandas as pd
import numpy as np

router = APIRouter()

# ─────────────────────────────────────────────
# In-memory stores (swap for DB in production)
# ─────────────────────────────────────────────

_investigation_notes: dict = {}   # case_id → list of note dicts
_case_actions:        dict = {}   # case_id → list of action dicts
_case_registry:       dict = {}   # case_id → metadata


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _risk_label(score: float) -> str:
    """score is always 0-1 fraction"""
    if score >= 0.75: return "High Risk"
    if score >= 0.45: return "Medium Risk"
    return "Low Risk"

def _mask_account(acct: str) -> str:
    s = str(acct)
    return f"XXXX XXXX {s[-4:]}" if len(s) >= 4 else "XXXX"

def _tail(acct: str) -> str:
    s = str(acct)
    return f"XXXX{s[-4:]}" if len(s) >= 4 else "XXXX"

def _build_case_id(account_number: str) -> str:
    tail = str(account_number)[-4:]
    return f"MUL-2026-{tail}"

def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def _audit(case_id: str, event: str, source: str, level: str = "warning"):
    _case_actions.setdefault(case_id, []).append({
        "event":      event,
        "source":     source,
        "level":      level,
        "timestamp":  _now(),
    })


# ─────────────────────────────────────────────
# Suspicious accounts sidebar
# ─────────────────────────────────────────────

@router.get("/suspicious-accounts")
def get_suspicious_accounts(limit: int = Query(10, ge=1, le=50)):
    """
    Returns top suspicious accounts derived from the real dataset.
    FIX: risk_score is stored as 0-1; display as ×100 and label uses raw 0-1.
    """
    df       = get_data()
    df       = df.copy()
    df['is_fraudulent'] = df['is_fraudulent'].astype(bool)
    fraud_df = df[df['is_fraudulent'] == True].copy()

    if fraud_df.empty:
        return {"total_flagged": 0, "accounts": []}

    agg_dict = {
        'risk_score':   ('src_risk_score', 'max'),
        'fraud_count':  ('txn_id',         'count'),
        'total_amount': ('amount',          'sum'),
    }
    if 'bank_name'     in fraud_df.columns: agg_dict['bank'] = ('bank_name',      'first')
    else:                                    agg_dict['bank'] = ('account_type',   'first')
    if 'customer_name' in fraud_df.columns: agg_dict['name'] = ('customer_name',  'first')
    else:                                    agg_dict['name'] = ('account_number', 'first')

    if 'dst_account' in fraud_df.columns:
        agg_dict['linked_count'] = ('dst_account', 'nunique')

    grouped = (
        fraud_df
        .groupby('account_number')
        .agg(**agg_dict)
        .reset_index()
    )

    if 'linked_count' in grouped.columns:
        grouped = grouped.sort_values(['linked_count', 'risk_score'], ascending=[False, False])
    else:
        grouped = grouped.sort_values('risk_score', ascending=False)

    grouped = grouped.head(limit)

    accounts = []
    for _, r in grouped.iterrows():
        raw_score = float(r['risk_score'])          # 0-1 fraction from dataset
        # FIX: always multiply by 100 for display; clamp to 0-100
        display_score = min(round(raw_score * 100, 1), 100.0)
        accounts.append({
            "account_number":     _mask_account(r['account_number']),
            "raw_account_number": str(r['account_number']),
            "case_id":            _build_case_id(r['account_number']),
            "name":               str(r['name']) if 'customer_name' in fraud_df.columns else f"Account {_tail(r['account_number'])}",
            "bank":               str(r['bank']),
            "risk_score":         display_score,            # 0-100 for UI
            "risk_label":         _risk_label(raw_score),   # 0-1 for label
            "fraud_count":        int(r['fraud_count']),
            "total_amount":       round(float(r['total_amount']), 2),
        })

    return {
        "total_flagged": len(grouped),
        "accounts":      accounts,
    }


# ─────────────────────────────────────────────
# Case overview — main investigation view
# ─────────────────────────────────────────────

@router.get("/case/{account_number}")
def get_case_investigation(account_number: str):
    df      = get_data()
    df      = df.copy()
    df['is_fraudulent'] = df['is_fraudulent'].astype(bool)
    acct_df = df[df['account_number'].astype(str) == str(account_number)].copy()

    if acct_df.empty:
        raise HTTPException(status_code=404, detail=f"Account {account_number} not found in dataset.")

    case_id    = _build_case_id(account_number)
    fraud_rows = acct_df[acct_df['is_fraudulent'] == True]

    # raw 0-1 score; derive display % separately
    raw_risk_score = float(acct_df['src_risk_score'].max())   # 0-1
    risk_pct       = round(raw_risk_score * 100, 1)           # 0-100 for UI

    # ── Account holder details ──────────────────
    account_details = {
        "case_id":         case_id,
        "risk_label":      _risk_label(raw_risk_score),
        "risk_score":      risk_pct,
        "account_number":  _mask_account(account_number),
        "bank_name":       str(acct_df['bank_name'].iloc[0])    if 'bank_name'      in acct_df.columns else "Unknown Bank",
        "account_type":    str(acct_df['account_type'].iloc[0]) if 'account_type'   in acct_df.columns else "Unknown",
        "name":            str(acct_df['customer_name'].iloc[0]) if 'customer_name' in acct_df.columns else f"Account {_tail(account_number)}",
        "linked_accounts": int(acct_df['dst_account'].nunique()) if 'dst_account'   in acct_df.columns else 0,
        "city":            str(acct_df['city'].iloc[0])          if 'city'           in acct_df.columns else "Unknown",
    }

    # ── Risk score breakdown ────────────────────
    tx_velocity = min(round(
        len(fraud_rows) / max(len(acct_df), 1) * 100 +
        (float(acct_df['is_fast_transaction'].mean()) * 40 if 'is_fast_transaction' in acct_df.columns else 0),
        100
    ), 100)

    cross_acct = min(round(
        (float(acct_df['is_mule_node'].mean()) * 60 if 'is_mule_node' in acct_df.columns else 0) +
        (int(acct_df['dst_account'].nunique()) / max(len(acct_df), 1) * 40 if 'dst_account' in acct_df.columns else 0),
        100
    ), 100)

    behavioral = min(round(
        (float(acct_df['is_structuring'].mean()) * 50 if 'is_structuring' in acct_df.columns else 0) +
        (float(acct_df['is_odd_hour'].mean()) * 30 if 'is_odd_hour' in acct_df.columns else 0) +
        (float(acct_df['amount_deviation'].mean()) / 10 * 20 if 'amount_deviation' in acct_df.columns else 0),
        100
    ), 100)

    risk_breakdown = {
        "transaction_velocity":   round(tx_velocity, 1),
        "cross_account_activity": round(cross_acct,  1),
        "behavioral_pattern":     round(behavioral,  1),
    }

    # ── Recent activity ─────────────────────────
    sort_col  = 'timestamp' if 'timestamp' in acct_df.columns else acct_df.columns[0]
    recent_df = acct_df.sort_values(sort_col, ascending=False).head(10)
    recent_activity = []

    for _, row in recent_df.iterrows():
        ts       = str(row.get('timestamp', ''))[-8:][:5] if 'timestamp' in row.index else "--:--"
        dst      = _tail(str(row['dst_account'])) if 'dst_account' in row.index else "XXXX"
        txn_type = str(row.get('transaction_type', 'Transfer')) if 'transaction_type' in row.index else "Transfer"
        description = (
            f"{txn_type} received from {dst}"
            if txn_type.lower() in ('credit', 'receive', 'neft_in', 'upi_in')
            else f"{txn_type} to {dst}"
        )
        recent_activity.append({
            "time":        ts,
            "description": description,
            "amount":      round(float(row.get('amount', 0)), 2),
            "is_fraud":    bool(row.get('is_fraudulent', False)),
            "risk_level":  (
                "high"   if row.get('src_risk_score', 0) >= 0.7 else
                "medium" if row.get('src_risk_score', 0) >= 0.4 else
                "low"
            ),
        })

    # ── Cross-channel activity graph ────────────
    nodes = [{"id": "primary", "label": f"Primary Account\n{_tail(account_number)}", "type": "primary"}]
    edges = []

    has_dst = (
        'dst_account' in acct_df.columns
        and acct_df['dst_account'].notna().any()
        and acct_df['dst_account'].astype(str).str.strip().ne('').any()
        and acct_df['dst_account'].astype(str).str.strip().ne('nan').any()
    )

    if has_dst:
        linked = (
            acct_df[acct_df['dst_account'].notna()]
            ['dst_account']
            .value_counts()
            .head(4)
        )
        for dst_acct, _ in linked.items():
            node_id = f"acct_{_tail(str(dst_acct))}"
            nodes.append({"id": node_id, "label": f"Account {_tail(str(dst_acct))}", "type": "high_risk"})
            edges.append({
                "from":   "primary",
                "to":     node_id,
                "amount": round(float(acct_df[acct_df['dst_account'] == dst_acct]['amount'].sum()), 2),
                "type":   "transfer",
            })
    else:
        if 'dst_account' in df.columns:
            reverse_df = df[df['dst_account'].astype(str) == str(account_number)].copy()
            rev_linked = reverse_df['account_number'].value_counts().head(4)
            for src_acct, _ in rev_linked.items():
                node_id = f"acct_{_tail(str(src_acct))}"
                nodes.append({"id": node_id, "label": f"Account {_tail(str(src_acct))}", "type": "high_risk"})
                edges.append({
                    "from":   node_id,
                    "to":     "primary",
                    "amount": round(float(reverse_df[reverse_df['account_number'] == src_acct]['amount'].sum()), 2),
                    "type":   "transfer",
                })

        if len(nodes) == 1 and 'city' in acct_df.columns:
            city = acct_df['city'].iloc[0]
            city_fraud = (
                df[
                    (df['is_fraudulent'] == True) &
                    (df['city'] == city) &
                    (df['account_number'].astype(str) != str(account_number))
                ]
                .groupby('account_number')
                .agg(total=('amount', 'sum'), risk=('src_risk_score', 'max'))
                .sort_values('risk', ascending=False)
                .head(4)
            )
            for ca, r in city_fraud.iterrows():
                node_id = f"acct_{_tail(str(ca))}"
                nodes.append({"id": node_id, "label": f"Account {_tail(str(ca))}", "type": "suspicious"})
                edges.append({
                    "from":   "primary",
                    "to":     node_id,
                    "amount": round(float(r['total']), 2),
                    "type":   "cluster",
                })

    # UPI / device / IP auxiliary nodes
    if 'upi_id' in acct_df.columns and not acct_df['upi_id'].isna().all():
        upi = str(acct_df['upi_id'].iloc[0])
        nodes.append({"id": "upi", "label": f"UPI: {upi}", "type": "suspicious"})
        edges.append({"from": "primary", "to": "upi", "amount": None, "type": "upi"})

    if 'device_id' in acct_df.columns and not acct_df['device_id'].isna().all():
        dev = str(acct_df['device_id'].iloc[0])
        nodes.append({"id": "device", "label": f"Device {dev[:8]}", "type": "safe"})
        edges.append({"from": "primary", "to": "device", "amount": None, "type": "device"})

    if 'ip_address' in acct_df.columns and not acct_df['ip_address'].isna().all():
        ip = str(acct_df['ip_address'].iloc[0])
        nodes.append({"id": "ip", "label": f"IP: {ip}", "type": "suspicious"})
        edges.append({
            "from":   "device" if any(n['id'] == 'device' for n in nodes) else "primary",
            "to":     "ip",
            "amount": None,
            "type":   "ip",
        })

    graph = {"nodes": nodes, "edges": edges}

    # ── Behavioral pattern summary ──────────────
    signals = []
    if 'is_fast_transaction' in acct_df.columns and acct_df['is_fast_transaction'].mean() > 0.3:
        signals.append("Rapid fund movement detected across multiple linked accounts within 30-minute window.")
    if 'is_mule_node' in acct_df.columns and acct_df['is_mule_node'].mean() > 0.2:
        signals.append("Pattern consistent with money mule behaviour.")
    if 'device_id' in acct_df.columns and acct_df['device_id'].nunique() > 1:
        signals.append("Device location inconsistencies observed.")
    if 'is_structuring' in acct_df.columns and acct_df['is_structuring'].mean() > 0.2:
        signals.append("Structuring pattern: multiple sub-threshold transactions detected.")

    behavioral_summary = {
        "title":   "Behavioral Pattern Summary",
        "summary": " ".join(signals) if signals else "No significant behavioral anomalies detected.",
        "signals": signals,
        "key_observations": [
            f"Rapid fund movement across {int(acct_df['dst_account'].nunique()) if 'dst_account' in acct_df.columns else 'N/A'}+ accounts",
            "New device login preceding suspicious activity",
            f"Transaction amounts exceed typical patterns by {round(float(acct_df['amount_deviation'].mean()) * 100, 0) if 'amount_deviation' in acct_df.columns else 'N/A'}%",
            "Geographic location inconsistencies detected" if 'city' in acct_df.columns and acct_df['city'].nunique() > 1 else "Single city detected",
        ],
        "recommendation": "Immediate freeze pending further investigation." if raw_risk_score >= 0.75 else "Monitor closely and review manually.",
    }

    # ── Transaction anomalies ───────────────────
    anomalies  = []
    avg_amount = float(acct_df['amount'].mean())

    large = acct_df[acct_df['amount'] > avg_amount * 3].sort_values('amount', ascending=False)
    for _, row in large.head(2).iterrows():
        ts = str(row.get('timestamp', ''))
        anomalies.append({
            "type":        "Large Transfer",
            "severity":    "Critical",
            "amount":      round(float(row['amount']), 2),
            "time":        ts[-8:][:8] if ts else "--:--:--",
            "description": f"Amount exceeds {round(row['amount'] / max(avg_amount, 1), 0):.0f}x average transaction",
        })

    if 'is_fast_transaction' in acct_df.columns:
        fast_rows = acct_df[acct_df['is_fast_transaction'] == 1]
        if len(fast_rows) >= 2:
            anomalies.append({
                "type":        "Rapid Transactions",
                "severity":    "Critical",
                "amount":      round(float(fast_rows['amount'].sum()), 2),
                "time":        "Multiple",
                "description": f"{len(fast_rows)} large transfers within short window",
            })

    if 'is_structuring' in acct_df.columns and acct_df['is_structuring'].sum() > 0:
        struct_rows = acct_df[acct_df['is_structuring'] == 1]
        anomalies.append({
            "type":        "Structuring",
            "severity":    "High",
            "amount":      round(float(struct_rows['amount'].sum()), 2),
            "time":        "Multiple",
            "description": f"{len(struct_rows)} transactions structured below reporting threshold",
        })

    # ── Risk overview ───────────────────────────
    risk_overview = {
        "risk_score":  risk_pct,
        "risk_label":  _risk_label(raw_risk_score),
        "trend":       "Risk Increasing" if raw_risk_score >= 0.7 else "Stable",
        "risk_factors": {
            "Behavioral Anomaly":  round(behavioral,  1),
            "Transaction Pattern": round(tx_velocity, 1),
            "Network Analysis":    round(cross_acct,  1),
            "Device Intelligence": round(
                float(acct_df['device_id'].nunique() / max(len(acct_df), 1) * 100)
                if 'device_id' in acct_df.columns else 50,
                1
            ),
        },
    }

    # ── Audit trail ─────────────────────────────
    if case_id not in _case_actions:
        if 'is_fast_transaction' in acct_df.columns and acct_df['is_fast_transaction'].sum() > 0:
            _audit(case_id, "Transaction anomalies detected", "Risk Engine", "warning")
        if 'dst_account' in acct_df.columns and acct_df['dst_account'].nunique() > 1:
            _audit(case_id, f"Cross-account links identified: {acct_df['dst_account'].nunique()} accounts", "Intelligence Layer", "info")
        if 'city' in acct_df.columns and acct_df['city'].nunique() > 1:
            _audit(case_id, "Geographic inconsistency logged", "Device Monitor", "warning")
        if 'device_id' in acct_df.columns and acct_df['device_id'].nunique() > 1:
            _audit(case_id, f"New device login detected ({str(acct_df['device_id'].iloc[0])[:8]})", "Auth System", "danger")
        if len(fraud_rows) > 0:
            _audit(case_id, f"Case opened — {len(fraud_rows)} fraud transactions flagged", "Risk Engine", "danger")

    audit_trail = list(reversed(_case_actions.get(case_id, [])))
    notes       = _investigation_notes.get(case_id, [])

    return {
        "case_id":             case_id,
        "account_details":     account_details,
        "risk_breakdown":      risk_breakdown,
        "recent_activity":     recent_activity,
        "graph":               graph,
        "behavioral_summary":  behavioral_summary,
        "anomalies":           anomalies,
        "anomaly_count":       len(anomalies),
        "risk_overview":       risk_overview,
        "audit_trail":         audit_trail,
        "audit_count":         len(audit_trail),
        "investigation_notes": notes,
    }


# ─────────────────────────────────────────────
# Quick Actions
# ─────────────────────────────────────────────

@router.post("/case/{account_number}/flag")
def flag_account(account_number: str, reason: Optional[str] = Query(None)):
    case_id = _build_case_id(account_number)
    _audit(case_id, f"Account flagged{f': {reason}' if reason else ''}", "Investigator", "danger")
    _case_registry.setdefault(case_id, {})["flagged"] = True
    return {"status": "flagged", "case_id": case_id, "timestamp": _now()}


@router.post("/case/{account_number}/freeze")
def freeze_account(account_number: str, reason: Optional[str] = Query(None)):
    case_id = _build_case_id(account_number)
    _audit(case_id, f"Account frozen{f': {reason}' if reason else ''}", "Investigator", "danger")
    _case_registry.setdefault(case_id, {})["frozen"] = True
    return {"status": "frozen", "case_id": case_id, "timestamp": _now()}


@router.post("/case/{account_number}/mark-transaction")
def mark_transaction(
    account_number: str,
    txn_description: str = Query(..., description="Description of the transaction to mark"),
    reason: Optional[str] = Query(None),
):
    case_id = _build_case_id(account_number)
    _audit(
        case_id,
        f"Transaction marked — {txn_description}{f': {reason}' if reason else ''}",
        "Investigator",
        "warning",
    )
    return {"status": "marked", "case_id": case_id, "timestamp": _now()}


@router.post("/case/{account_number}/clear-flags")
def clear_flags(account_number: str, reason: Optional[str] = Query(None)):
    case_id = _build_case_id(account_number)
    _audit(case_id, f"Flags cleared{f': {reason}' if reason else ''}", "Investigator", "success")
    _case_registry.setdefault(case_id, {}).update({"flagged": False, "frozen": False})
    return {"status": "cleared", "case_id": case_id}


@router.post("/case/{account_number}/escalate")
def escalate_case(account_number: str, reason: Optional[str] = Query(None)):
    case_id = _build_case_id(account_number)
    _audit(case_id, f"Case escalated{f': {reason}' if reason else ''}", "Investigator", "danger")
    _case_registry.setdefault(case_id, {})["escalated"] = True

    try:
        from routes.reports import log_action
        log_action(
            user     = "investigator",
            action   = "CASE_ESCALATE",
            resource = case_id,
            details  = reason or "Case escalated for senior review",
            status   = "Warning",
        )
    except Exception:
        pass

    return {"status": "escalated", "case_id": case_id, "timestamp": _now()}


# ─────────────────────────────────────────────
# Investigation Notes
# ─────────────────────────────────────────────

@router.post("/case/{account_number}/notes")
def save_investigation_note(
    account_number: str,
    note:   str = Query(..., description="Note text to save"),
    author: str = Query("investigator"),
):
    case_id = _build_case_id(account_number)
    entry = {
        "id":        len(_investigation_notes.get(case_id, [])) + 1,
        "note":      note,
        "author":    author,
        "timestamp": _now(),
    }
    _investigation_notes.setdefault(case_id, []).append(entry)
    _audit(case_id, "Investigation note added", author, "info")
    return {"status": "saved", "note": entry}


@router.delete("/case/{account_number}/notes")
def clear_investigation_notes(account_number: str):
    case_id = _build_case_id(account_number)
    _investigation_notes[case_id] = []
    _audit(case_id, "Investigation notes cleared", "investigator", "info")
    return {"status": "cleared", "case_id": case_id}


# ─────────────────────────────────────────────
# Case status summary
# ─────────────────────────────────────────────

@router.get("/case/{account_number}/status")
def get_case_status(account_number: str):
    case_id = _build_case_id(account_number)
    state   = _case_registry.get(case_id, {})
    return {
        "case_id":     case_id,
        "flagged":     state.get("flagged",   False),
        "frozen":      state.get("frozen",    False),
        "escalated":   state.get("escalated", False),
        "audit_count": len(_case_actions.get(case_id,        [])),
        "note_count":  len(_investigation_notes.get(case_id, [])),
    }