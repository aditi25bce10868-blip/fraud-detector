from fastapi import APIRouter
from backend.data.loader import get_data

router = APIRouter()

@router.get("/summary")
def get_report_summary():
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True]

    # ── FIX: was quantile(0.85) → ~3,500 on a 23k dataset ───────────────────
    # Now = unique accounts with at least one confirmed fraudulent transaction
    high_risk_accounts = int(fraud_df['account_number'].nunique())

    return {
        "total_transactions":     len(df),
        "total_fraud":            len(fraud_df),
        "total_normal":           len(df) - len(fraud_df),
        "fraud_percentage":       round(len(fraud_df) / len(df) * 100, 3),
        "total_amount":           round(float(df['amount'].sum()), 2),
        "fraud_amount":           round(float(fraud_df['amount'].sum()), 2),
        "avg_fraud_amount":       round(float(fraud_df['amount'].mean()), 2),
        "avg_normal_amount":      round(float(df[~df['is_fraudulent']]['amount'].mean()), 2),
        "high_risk_accounts":     high_risk_accounts,
        "cities_affected":        int(fraud_df['city'].nunique()),
        "most_common_fraud_type": fraud_df['fraud_category'].mode()[0] if len(fraud_df) > 0 else "N/A",
    }


@router.get("/by-city")
def get_report_by_city():
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True]

    grouped = fraud_df.groupby('city').agg(
        fraud_count  = ('txn_id',         'count'),
        total_amount = ('amount',         'sum'),
        avg_risk     = ('src_risk_score', 'mean'),
        unique_accs  = ('account_number', 'nunique'),
    ).reset_index().sort_values('fraud_count', ascending=False)

    return {
        "cities": [
            {
                "city":            r['city'],
                "fraud_count":     int(r['fraud_count']),
                "total_amount":    round(float(r['total_amount']), 2),
                "avg_risk":        round(float(r['avg_risk']), 3),
                "unique_accounts": int(r['unique_accs']),
                "percentage":      round(r['fraud_count'] / len(fraud_df) * 100, 1),
            }
            for _, r in grouped.iterrows()
        ]
    }


@router.get("/by-category")
def get_report_by_category():
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True]

    grouped = fraud_df.groupby('fraud_category').agg(
        count        = ('txn_id',         'count'),
        total_amount = ('amount',         'sum'),
        avg_risk     = ('src_risk_score', 'mean'),
    ).reset_index().sort_values('count', ascending=False)

    return {
        "categories": [
            {
                "category":     r['fraud_category'],
                "count":        int(r['count']),
                "total_amount": round(float(r['total_amount']), 2),
                "avg_risk":     round(float(r['avg_risk']), 3),
                "percentage":   round(r['count'] / len(fraud_df) * 100, 1),
            }
            for _, r in grouped.iterrows()
        ]
    }


@router.get("/by-account-type")
def get_report_by_account_type():
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True]

    grouped = fraud_df.groupby('account_type').agg(
        count        = ('txn_id',         'count'),
        total_amount = ('amount',         'sum'),
        avg_risk     = ('src_risk_score', 'mean'),
    ).reset_index().sort_values('count', ascending=False)

    return {
        "account_types": [
            {
                "account_type": r['account_type'],
                "count":        int(r['count']),
                "total_amount": round(float(r['total_amount']), 2),
                "avg_risk":     round(float(r['avg_risk']), 3),
                "percentage":   round(r['count'] / len(fraud_df) * 100, 1),
            }
            for _, r in grouped.iterrows()
        ]
    }


@router.get("/by-hour")
def get_report_by_hour():
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True]

    grouped = fraud_df.groupby('transaction_hour').agg(
        count        = ('txn_id', 'count'),
        total_amount = ('amount', 'sum'),
    ).reset_index()

    return {
        "hours": [
            {
                "hour":         int(r['transaction_hour']),
                "label":        f"{int(r['transaction_hour']):02d}:00",
                "count":        int(r['count']),
                "total_amount": round(float(r['total_amount']), 2),
            }
            for _, r in grouped.iterrows()
        ]
    }