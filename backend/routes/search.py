from fastapi import APIRouter, Query
from backend.data.loader import get_data

router = APIRouter()

@router.get("/")
def search(q: str = Query(..., min_length=2)):
    df      = get_data()
    q_lower = q.lower().strip()
    results = {"accounts": [], "transactions": [], "pincodes": []}

    # Search by account number
    acc_match = df[df['account_number'].str.lower().str.contains(q_lower, na=False)]
    if not acc_match.empty:
        grouped = acc_match.groupby('account_number').agg(
            name        = ('name',           'first'),
            city        = ('city',           'first'),
            account_type = ('account_type',  'first'),
            txn_count   = ('txn_id',         'count'),
            is_fraud    = ('is_fraudulent',  'any'),
            risk_score  = ('src_risk_score', 'mean'),
        ).reset_index().head(5)

        results["accounts"] = [
            {
                "account_number": r['account_number'],
                "name":           r['name'],
                "city":           r['city'],
                "account_type":   r['account_type'],
                "txn_count":      int(r['txn_count']),
                "is_fraud":       bool(r['is_fraud']),
                "risk_score":     min(100, round(float(r['risk_score']) * 100)),
            }
            for _, r in grouped.iterrows()
        ]

    # Search by name
    name_match = df[df['name'].str.lower().str.contains(q_lower, na=False)]
    if not name_match.empty and not acc_match.empty:
        # Merge with account results
        extra = name_match[~name_match['account_number'].isin(acc_match['account_number'])]
        grouped2 = extra.groupby('account_number').agg(
            name        = ('name',           'first'),
            city        = ('city',           'first'),
            account_type = ('account_type',  'first'),
            txn_count   = ('txn_id',         'count'),
            is_fraud    = ('is_fraudulent',  'any'),
            risk_score  = ('src_risk_score', 'mean'),
        ).reset_index().head(5)
        results["accounts"] += [
            {
                "account_number": r['account_number'],
                "name":           r['name'],
                "city":           r['city'],
                "account_type":   r['account_type'],
                "txn_count":      int(r['txn_count']),
                "is_fraud":       bool(r['is_fraud']),
                "risk_score":     min(100, round(float(r['risk_score']) * 100)),
            }
            for _, r in grouped2.iterrows()
        ]

    # Search by txn_id (numeric)
    if q.isdigit():
        txn_match = df[df['txn_id'] == int(q)]
        if not txn_match.empty:
            r = txn_match.iloc[0]
            results["transactions"].append({
                "txn_id":        int(r['txn_id']),
                "amount":        round(float(r['amount']), 2),
                "is_fraudulent": bool(r['is_fraudulent']),
                "fraud_category": r['fraud_category'],
                "city":          r['city'],
                "account_number": r['account_number'],
            })

    # Search by pincode
    pin_match = df[df['pincode'].str.contains(q_lower, na=False)]
    if not pin_match.empty:
        grouped3 = pin_match.groupby('pincode').agg(
            city         = ('city',           'first'),
            fraud_count  = ('is_fraudulent',  'sum'),
            total_txns   = ('txn_id',         'count'),
        ).reset_index().head(5)
        results["pincodes"] = [
            {
                "pincode":      r['pincode'],
                "city":         r['city'],
                "fraud_count":  int(r['fraud_count']),
                "total_txns":   int(r['total_txns']),
            }
            for _, r in grouped3.iterrows()
        ]

    # Search by city
    city_match = df[df['city'].str.lower().str.contains(q_lower, na=False)]
    if not city_match.empty and not results["pincodes"]:
        fraud_in_city = city_match[city_match['is_fraudulent'] == True]
        results["pincodes"] = [
            {
                "pincode":     p,
                "city":        city_match[city_match['pincode'] == p]['city'].iloc[0],
                "fraud_count": int(fraud_in_city[fraud_in_city['pincode'] == p]['txn_id'].count()),
                "total_txns":  int(city_match[city_match['pincode'] == p]['txn_id'].count()),
            }
            for p in city_match['pincode'].unique()[:5]
        ]

    total = sum(len(v) for v in results.values())
    return {
        "query":   q,
        "total":   total,
        "results": results,
    }
