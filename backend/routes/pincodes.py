from fastapi import APIRouter
from backend.data.loader import get_data

router = APIRouter()

PINCODE_STATE = {
    '110': 'Delhi',        '400': 'Maharashtra',
    '500': 'Telangana',    '560': 'Karnataka',
    '700': 'West Bengal',  '600': 'Tamil Nadu',
    '411': 'Maharashtra',  '380': 'Gujarat',
}


def _risk_tier(avg_risk: float, suspicious_count: int, p75: float, p50: float) -> str:
    """
    Dynamic thresholds based on the actual distribution of avg_risk_score
    in the fraud dataset, so HIGH pincodes always emerge even when all scores
    are clustered in a narrow band (e.g. 0.35–0.55).

    HIGH   : top quartile of risk  OR  suspicious_count >= 30
    MEDIUM : above median risk     OR  suspicious_count >= 15
    LOW    : everything else
    """
    if avg_risk >= p75 or suspicious_count >= 30:
        return "high"
    elif avg_risk >= p50 or suspicious_count >= 15:
        return "medium"
    return "low"


@router.get("/suspicious")
def get_suspicious_pincodes():
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True]

    grouped = fraud_df.groupby('pincode').agg(
        suspicious_count = ('txn_id',         'count'),
        total_amount     = ('amount',          'sum'),
        city             = ('city',            'first'),
        avg_risk_score   = ('src_risk_score',  'mean'),
        unique_accounts  = ('account_number',  'nunique'),
    ).reset_index().sort_values('suspicious_count', ascending=False)

    # ── Dynamic percentile thresholds across all pincodes ──────────────────
    p75 = float(grouped['avg_risk_score'].quantile(0.75))
    p50 = float(grouped['avg_risk_score'].quantile(0.50))

    return {
        "pincodes": [
            {
                "pincode":          str(r['pincode']),
                "city":             r['city'],
                "state":            PINCODE_STATE.get(str(r['pincode'])[:3], 'India'),
                "suspicious_count": int(r['suspicious_count']),
                "total_amount":     round(float(r['total_amount']), 2),
                "cluster_size":     int(r['unique_accounts']),
                "avg_risk_score":   round(float(r['avg_risk_score']), 3),
                "risk_level":       _risk_tier(r['avg_risk_score'], r['suspicious_count'], p75, p50),
            }
            for _, r in grouped.iterrows()
        ],
        # expose thresholds so the frontend can render a legend if needed
        "thresholds": { "high": round(p75, 3), "medium": round(p50, 3) },
    }


@router.get("/investigate/{pincode}")
def investigate_pincode(pincode: str):
    df     = get_data()
    pin_df = df[df['pincode'] == pincode]

    if pin_df.empty:
        return {"error": "Pincode not found"}

    fraud_df = pin_df[pin_df['is_fraudulent'] == True]
    r        = pin_df.iloc[0]
    prefix   = pincode[:3]

    # ── Same dynamic threshold logic, scoped to fraud_df avg risk ──────────
    all_fraud    = df[df['is_fraudulent'] == True]
    all_grouped  = all_fraud.groupby('pincode')['src_risk_score'].mean()
    p75_global   = float(all_grouped.quantile(0.75))
    p50_global   = float(all_grouped.quantile(0.50))

    pin_avg_risk     = float(fraud_df['src_risk_score'].mean()) if len(fraud_df) else 0.0
    pin_fraud_count  = len(fraud_df)
    risk_level       = _risk_tier(pin_avg_risk, pin_fraud_count, p75_global, p50_global).upper()

    # ── Linked accounts sample ──────────────────────────────────────────────
    linked_accounts = (
        fraud_df.groupby('account_number').agg(
            txn_count  = ('txn_id',         'count'),
            amount     = ('amount',          'sum'),
            risk_score = ('src_risk_score',  'mean'),
            name       = ('name',            'first'),
        ).reset_index()
        .sort_values('risk_score', ascending=False)
        .head(5)
    )

    return {
        "pincode":  pincode,
        "city":     r['city'],
        "state":    PINCODE_STATE.get(prefix, 'India'),
        "location": f"{r['city']}, {PINCODE_STATE.get(prefix, 'India')}",
        "risk_level": risk_level,           # now "HIGH" / "MEDIUM" / "LOW"
        "cluster_information": {
            "cluster_size":              int(fraud_df['account_number'].nunique()),
            "suspicious_transactions":   int(pin_fraud_count),
            "total_fraud_amount":        round(float(fraud_df['amount'].sum()), 2),
            "avg_risk_score":            round(pin_avg_risk, 3),
        },
        "fraud_categories": fraud_df['fraud_category'].value_counts().to_dict(),
        "linked_accounts": [
            {
                "account_number": row['account_number'],
                "name":           row['name'],
                "txn_count":      int(row['txn_count']),
                "total_amount":   round(float(row['amount']), 2),
                "risk_score":     min(100, round(float(row['risk_score']) * 100)),
            }
            for _, row in linked_accounts.iterrows()
        ],
    }