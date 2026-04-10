import pandas as pd
import os

_df = None

def get_data() -> pd.DataFrame:
    global _df
    if _df is None:
        # Look for dataset in parent directory (Tide/)
        paths = [
            "backend_dataset.csv",
            "../backend_dataset.csv",
            os.path.join(os.path.dirname(__file__), "../../backend_dataset.csv")
        ]
        loaded = False
        for path in paths:
            if os.path.exists(path):
                _df = pd.read_csv(path)
                loaded = True
                print(f"Dataset loaded from: {path} — {len(_df)} rows")
                break
        if not loaded:
            raise FileNotFoundError("backend_dataset.csv not found")

        # ── Strip enum-style prefixes on ALL string columns ──────────────
        # Converts 'TransactionType.TRANSFER' → 'TRANSFER',
        #          'AccountType.SAVINGS'      → 'SAVINGS', etc.
        for col in _df.select_dtypes(include="object").columns:
            _df[col] = _df[col].str.split(".").str[-1]
        # ─────────────────────────────────────────────────────────────────

        # Ensure correct types
        _df['is_fraudulent']    = _df['is_fraudulent'].astype(bool)
        _df['amount']           = _df['amount'].astype(float)
        _df['transaction_hour'] = _df['transaction_hour'].astype(int)
        _df['txn_id']           = _df['txn_id'].astype(int)
        _df['src_risk_score']   = pd.to_numeric(_df['src_risk_score'],  errors='coerce').fillna(0.0)
        _df['dest_risk_score']  = pd.to_numeric(_df['dest_risk_score'], errors='coerce').fillna(0.0)
        _df['pincode']          = _df['pincode'].astype(str)
        _df['mobile_number']    = _df['mobile_number'].astype(str)

    return _df


def reload_data():
    global _df
    _df = None
    return get_data()