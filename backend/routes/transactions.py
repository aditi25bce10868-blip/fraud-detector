from fastapi import APIRouter, Query
from backend.data.loader import get_data

router = APIRouter()

@router.get("/")
def get_transactions(
    page:       int  = Query(1,     ge=1),
    limit:      int  = Query(20,    ge=1, le=100),
    fraud_only: bool = Query(False),
    city:       str  = Query(None),
    category:   str  = Query(None),
    account_type: str = Query(None),
    min_amount: float = Query(None),
    max_amount: float = Query(None),
):
    df = get_data()

    if fraud_only:                  df = df[df['is_fraudulent'] == True]
    if city:                        df = df[df['city'].str.lower() == city.lower()]
    if category:                    df = df[df['fraud_category'] == category]
    if account_type:                df = df[df['account_type'] == account_type]
    if min_amount is not None:      df = df[df['amount'] >= min_amount]
    if max_amount is not None:      df = df[df['amount'] <= max_amount]

    total   = len(df)
    start   = (page - 1) * limit
    page_df = df.iloc[start:start + limit]

    return {
        "total": total,
        "page":  page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "transactions": [
            {
                "txn_id":           int(r['txn_id']),
                "src":              r['src'],
                "dest":             r['dest'],
                "name":             r['name'],
                "amount":           round(float(r['amount']), 2),
                "currency":         r['currency'],
                "city":             r['city'],
                "pincode":          r['pincode'],
                "account_type":     r['account_type'],
                "account_number":   r['account_number'],
                "transaction_type": r['transaction_type'],
                "transaction_hour": int(r['transaction_hour']),
                "is_weekend":       bool(r['is_weekend']),
                "is_fraudulent":    bool(r['is_fraudulent']),
                "fraud_category":   r['fraud_category'],
                "narration":        r['narration'],
                "risk_score":       min(100, round(float(r['src_risk_score']) * 100)),
            }
            for _, r in page_df.iterrows()
        ]
    }

@router.get("/{txn_id}")
def get_transaction_detail(txn_id: int):
    df  = get_data()
    row = df[df['txn_id'] == txn_id]

    if row.empty:
        return {"error": "Transaction not found"}

    r = row.iloc[0]
    return {
        "txn_id":           int(r['txn_id']),
        "src":              r['src'],
        "dest":             r['dest'],
        "name":             r['name'],
        "mobile_number":    r['mobile_number'],
        "amount":           round(float(r['amount']), 2),
        "currency":         r['currency'],
        "narration":        r['narration'],
        "city":             r['city'],
        "pincode":          r['pincode'],
        "account_type":     r['account_type'],
        "account_number":   r['account_number'],
        "transaction_type": r['transaction_type'],
        "transaction_hour": int(r['transaction_hour']),
        "is_weekend":       bool(r['is_weekend']),
        "is_odd_hour":      bool(r['is_odd_hour']),
        "is_fraudulent":    bool(r['is_fraudulent']),
        "fraud_category":   r['fraud_category'],
        "fraud_signals": {
            "is_fast_transaction":  bool(r['is_fast_transaction']),
            "is_structuring":       bool(r['is_structuring']),
            "is_mule_node":         bool(r['is_mule_node']),
            "is_cross_channel":     bool(r['is_cross_channel']),
            "dest_is_routing_node": bool(r['dest_is_routing_node']),
            "amount_deviation":     round(float(r['amount_deviation']), 3),
            "tx_count_last_1hr":    round(float(r['tx_count_last_1hr']), 1),
            "routing_depth":        int(r['routing_depth']),
            "unique_dest_count":    int(r['unique_dest_count']),
            "structuring_count":    int(r['structuring_count']),
            "dest_count_ratio":     round(float(r['dest_count_ratio']), 3),
        },
        "src_profile": {
            "risk_score":       min(100, round(float(r['src_risk_score']) * 100)),
            "age_group":        r['src_age_group'],
            "gender":           r['src_gender'],
            "occupation":       r['src_occupation'],
            "account_category": r['src_account_category'],
            "node_type":        r['src_node_type'],
            "is_high_risk":     bool(r['src_is_high_risk_category']),
        },
        "dest_profile": {
            "risk_score":       min(100, round(float(r['dest_risk_score']) * 100)),
            "account_category": r['dest_account_category'],
            "node_type":        r['dest_node_type'],
            "is_high_risk":     bool(r['dest_is_high_risk_category']),
        }
    }
