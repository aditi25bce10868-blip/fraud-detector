from fastapi import APIRouter, Query
from backend.data.loader import get_data

router = APIRouter()

# ── Human-readable flag reasons per fraud category ───────────────────────────
FLAG_REASONS = {
    "structuring":      "Multiple threshold structuring detected",
    "mule_network":     "Linked to known mule network",
    "cross_channel":    "Cross-channel activity detected",
    "routing_layering": "Suspicious routing behaviour",
    "spray_attack":     "High-velocity spray pattern",
    "simple_fraud":     "Flagged by fraud model",
}

def risk_to_status(score: int) -> str:
    if score >= 90: return "Escalated"
    if score >= 80: return "Under Review"
    return "Flagged"


# ── GET /accounts/risky ───────────────────────────────────────────────────────
@router.get("/risky")
def get_risky_accounts(limit: int = Query(10, ge=1, le=50)):
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True]

    grouped = fraud_df.groupby('account_number').agg(
        transaction_count = ('txn_id',        'count'),
        total_amount      = ('amount',         'sum'),
        avg_risk_score    = ('src_risk_score', 'mean'),
        city              = ('city',           'first'),
        fraud_category    = ('fraud_category', 'first'),
        src               = ('src',            'first'),
        name              = ('name',           'first'),
        account_type      = ('account_type',   'first'),
    ).reset_index()

    grouped = (
        grouped
        .sort_values('avg_risk_score', ascending=False)
        .head(limit)
        .reset_index(drop=True)          # ← gives us clean 0-based index for rank
    )

    accounts = []
    for i, r in grouped.iterrows():
        score = min(100, round(float(r['avg_risk_score']) * 100))
        accounts.append({
            # ── existing fields (unchanged) ──────────────────────────────────
            "account_number":      r['account_number'],
            "name":                r['name'],
            "src":                 r['src'],
            "city":                r['city'],
            "account_type":        r['account_type'],
            "transaction_count":   int(r['transaction_count']),
            "total_amount":        round(float(r['total_amount']), 2),
            "flagged_amount_lakh": round(float(r['total_amount']) / 100000, 1),
            "risk_score":          score,
            "fraud_category":      r['fraud_category'],
            # ── NEW fields required by frontend ──────────────────────────────
            "rank":                i + 1,
            "status":              risk_to_status(score),
            "flag_reason":         FLAG_REASONS.get(r['fraud_category'], "Anomalous transaction pattern"),
        })

    return {"accounts": accounts}


# ── GET /accounts/investigate/{account_number} ────────────────────────────────
@router.get("/investigate/{account_number}")
def investigate_account(account_number: str):
    df     = get_data()
    acc_df = df[df['account_number'] == account_number]

    if acc_df.empty:
        return {"error": "Account not found"}

    fraud_txns = acc_df[acc_df['is_fraudulent'] == True]
    r          = acc_df.iloc[0]

    # Build detected patterns list
    patterns = []
    if fraud_txns['is_structuring'].any():
        patterns.append({
            "icon":        "structuring",
            "description": "Structuring — multiple transactions below threshold",
        })
    if fraud_txns['is_fast_transaction'].any():
        patterns.append({
            "icon":        "velocity",
            "description": f"High velocity — {len(fraud_txns)} transactions in 24 hours",
        })
    if 'is_high_risk_city' in fraud_txns.columns and fraud_txns['is_high_risk_city'].any():
        patterns.append({
            "icon":        "geo",
            "description": "Geographic anomaly detected",
        })
    if fraud_txns['is_mule_node'].any():
        patterns.append({
            "icon":        "mule",
            "description": "Linked to known mule network",
        })
    if fraud_txns['is_cross_channel'].any():
        patterns.append({
            "icon":        "channel",
            "description": "Cross-channel activity detected",
        })
    if fraud_txns['dest_is_routing_node'].any():
        patterns.append({
            "icon":        "routing",
            "description": "Suspicious routing behaviour",
        })

    score = min(100, round(float(r['src_risk_score']) * 100))

    return {
        "account_id":    account_number,
        "name":          r['name'],
        "mobile_number": r['mobile_number'],
        "account_type":  r['account_type'],
        "city":          r['city'],
        "pincode":       r['pincode'],
        "risk_score":    score,
        "status":        risk_to_status(score),
        "transaction_summary": {
            "total_transactions":  len(acc_df),
            "fraud_transactions":  len(fraud_txns),
            "normal_transactions": len(acc_df) - len(fraud_txns),
            "total_amount":        round(float(acc_df['amount'].sum()), 2),
            "flagged_amount":      round(float(fraud_txns['amount'].sum()), 2),
            "flagged_amount_lakh": round(float(fraud_txns['amount'].sum()) / 100000, 1),
        },
        "detected_patterns": patterns,
        "fraud_categories":  fraud_txns['fraud_category'].value_counts().to_dict(),
        "recent_transactions": [
            {
                "txn_id":           int(row['txn_id']),
                "amount":           round(float(row['amount']), 2),
                "is_fraudulent":    bool(row['is_fraudulent']),
                "fraud_category":   row['fraud_category'],
                "city":             row['city'],
                "narration":        row['narration'],
                "transaction_hour": int(row['transaction_hour']),
            }
            for _, row in acc_df.head(10).iterrows()
        ],
    }