from fastapi import APIRouter
from backend.data.loader import get_data

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats():
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True]

    high_risk   = int(df['is_fraudulent'].sum())
    medium_risk = int((
        (df['is_fraudulent'] == False) &
        (df['amount_deviation'] > 2)
    ).sum())
    low_risk    = int((
        (df['is_fraudulent'] == False) &
        (df['amount_deviation'] <= 2)
    ).sum())
    total_risk  = high_risk + medium_risk + low_risk

    cats = fraud_df['fraud_category'].value_counts()

    import numpy as np
    hours = df.groupby('transaction_hour').agg(
        total=('txn_id','count'),
        fraud=('is_fraudulent','sum')
    ).reindex(range(24), fill_value=0)

    idxs      = np.linspace(0, 23, 8, dtype=int)
    spark_tx  = [int(hours.loc[i, 'total']) for i in idxs]
    spark_sus = [int(hours.loc[i, 'fraud'])  for i in idxs]
    spark_risk = list(range(190, 235, 6))[:8]

    # ── FIX: was quantile(0.85) on ALL rows → inflated to ~3,500 ─────────────
    # Now = unique accounts that have at least one confirmed fraudulent txn
    high_risk_accounts = int(fraud_df['account_number'].nunique())

    return {
        "total_transactions":      len(df),
        "suspicious_transactions": len(fraud_df),
        "high_risk_accounts":      high_risk_accounts,
        "active_mule_clusters":    int(fraud_df['is_mule_node'].sum()),
        "alerts_today":            len(fraud_df),
        "spark_transactions":      spark_tx,
        "spark_suspicious":        spark_sus,
        "spark_high_risk":         spark_risk,
        "structuring_cases":       int(cats.get("structuring", 0)),
        "risk_distribution": {
            "low_risk":    low_risk,
            "medium_risk": medium_risk,
            "high_risk":   high_risk,
            "total":       total_risk,
            "percentages": {
                "low":    round(low_risk    / total_risk * 100, 1) if total_risk else 0,
                "medium": round(medium_risk / total_risk * 100, 1) if total_risk else 0,
                "high":   round(high_risk   / total_risk * 100, 1) if total_risk else 0,
            }
        },
        "fraud_pattern_summary": {
            "mule_clusters":    int(cats.get("mule_network",     0)),
            "structuring":      int(cats.get("structuring",      0)),
            "high_velocity":    int(fraud_df['is_fast_transaction'].sum()),
            "cross_channel":    int(cats.get("cross_channel",    0)),
            "routing_layering": int(cats.get("routing_layering", 0)),
            "spray_attack":     int(cats.get("spray_attack",     0)),
            "simple_fraud":     int(cats.get("simple_fraud",     0)),
        }
    }


@router.get("/transaction-trend")
def get_transaction_trend():
    df    = get_data()
    trend = df.groupby('transaction_hour').agg(
        total=('txn_id', 'count'),
        fraud=('is_fraudulent', 'sum')
    ).reset_index()

    return {
        "trend": [
            {
                "hour":  int(r['transaction_hour']),
                "label": f"{int(r['transaction_hour']):02d}:00",
                "total": int(r['total']),
                "fraud": int(r['fraud']),
            }
            for _, r in trend.iterrows()
        ]
    }


@router.get("/fraud-categories")
def get_fraud_categories():
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True]
    cats     = fraud_df['fraud_category'].value_counts()
    total    = len(fraud_df)

    return {
        "total": total,
        "categories": [
            {
                "name":       k,
                "count":      int(v),
                "percentage": round(v / total * 100, 1) if total else 0,
            }
            for k, v in cats.items()
        ]
    }


@router.get("/city-heatmap")
def get_city_heatmap():
    df       = get_data()
    fraud_df = df[df['is_fraudulent'] == True]
    grouped  = fraud_df.groupby('city').agg(
        fraud_count  = ('txn_id',         'count'),
        total_amount = ('amount',         'sum'),
        avg_risk     = ('src_risk_score', 'mean'),
    ).reset_index().sort_values('fraud_count', ascending=False)

    return {
        "cities": [
            {
                "city":         r['city'],
                "fraud_count":  int(r['fraud_count']),
                "total_amount": round(float(r['total_amount']), 2),
                "avg_risk":     round(float(r['avg_risk']), 3),
            }
            for _, r in grouped.iterrows()
        ]
    }


@router.get("/risk-debug")
def risk_debug():
    df = get_data()
    fraud_df = df[df['is_fraudulent'] == True]
    return {
        "min":                   float(df['src_risk_score'].min()),
        "max":                   float(df['src_risk_score'].max()),
        "mean":                  float(df['src_risk_score'].mean()),
        "median":                float(df['src_risk_score'].median()),
        "q25":                   float(df['src_risk_score'].quantile(0.25)),
        "q75":                   float(df['src_risk_score'].quantile(0.75)),
        "q85":                   float(df['src_risk_score'].quantile(0.85)),
        "unique_count":          int(df['src_risk_score'].nunique()),
        "sample":                df['src_risk_score'].head(10).tolist(),
        # Diagnostic for the old vs new high_risk_accounts calculation
        "OLD_q85_account_count": int((df['src_risk_score'] >= df['src_risk_score'].quantile(0.85)).sum()),
        "NEW_fraud_unique_accs": int(fraud_df['account_number'].nunique()),
    }