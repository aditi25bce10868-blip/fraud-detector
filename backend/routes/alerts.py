from fastapi import APIRouter, Query
from backend.data.loader import get_data

router = APIRouter()

ALERT_MESSAGES = {
    "mule_network":     "Linked to known mule cluster",
    "structuring":      "Structuring pattern detected",
    "cross_channel":    "Cross-channel fraud detected",
    "routing_layering": "Suspicious routing behaviour",
    "spray_attack":     "Rapid fund dispersal pattern",
    "simple_fraud":     "Unusual transaction pattern",
}

ALERT_REASONS = {
    "mule_network":     "Unusual geographic pattern",
    "structuring":      "Multiple transactions below threshold",
    "cross_channel":    "Multiple channel usage detected",
    "routing_layering": "Dormant account suddenly active",
    "spray_attack":     "High-velocity transactions detected",
    "simple_fraud":     "Unusual transaction pattern",
}

@router.get("/")
def get_alerts(limit: int = Query(20, ge=1, le=100)):
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True].copy()
    fraud_df = fraud_df.sort_values('src_risk_score', ascending=False).head(limit)

    return {
        "total": int(df['is_fraudulent'].sum()),
        "alerts": [
            {
                "txn_id":         int(r['txn_id']),
                "account":        r['account_number'],
                "src":            r['src'],
                "name":           r['name'],
                "message":        ALERT_MESSAGES.get(r['fraud_category'], "Suspicious activity"),
                "alert_reason":   ALERT_REASONS.get(r['fraud_category'],  "Unusual activity"),
                "risk_score":     min(100, round(float(r['src_risk_score']) * 100)),
                "amount":         round(float(r['amount']), 2),
                "city":           r['city'],
                "fraud_category": r['fraud_category'],
                "is_odd_hour":    bool(r['is_odd_hour']),
                "is_fast":        bool(r['is_fast_transaction']),
                "account_type":   r['account_type'],
            }
            for _, r in fraud_df.iterrows()
        ]
    }

@router.get("/investigate/alert/{txn_id}")
def investigate_alert(txn_id: int):
    df  = get_data()
    row = df[df['txn_id'] == txn_id]

    if row.empty:
        return {"error": "Transaction not found"}

    r = row.iloc[0]
    return {
        "txn_id":       int(r['txn_id']),
        "account":      r['account_number'],
        "src":          r['src'],
        "name":         r['name'],
        "risk_score":   min(100, round(float(r['src_risk_score']) * 100)),
        "amount":       round(float(r['amount']), 2),
        "alert_reason": ALERT_REASONS.get(r['fraud_category'], "Unusual activity"),
        "fraud_category": r['fraud_category'],
        "city":         r['city'],
        "pincode":      r['pincode'],
        "account_type": r['account_type'],
        "narration":    r['narration'],
        "transaction_hour": int(r['transaction_hour']),
        "is_odd_hour":  bool(r['is_odd_hour']),
        "is_weekend":   bool(r['is_weekend']),
        "fraud_signals": {
            "is_fast_transaction":  bool(r['is_fast_transaction']),
            "is_structuring":       bool(r['is_structuring']),
            "is_mule_node":         bool(r['is_mule_node']),
            "is_cross_channel":     bool(r['is_cross_channel']),
            "amount_deviation":     round(float(r['amount_deviation']), 3),
            "routing_depth":        int(r['routing_depth']),
            "structuring_count":    int(r['structuring_count']),
            "unique_dest_count":    int(r['unique_dest_count']),
        }
    }
