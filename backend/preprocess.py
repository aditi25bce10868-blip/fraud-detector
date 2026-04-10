import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
import pickle

print("Loading final_dataset.csv...")
df = pd.read_csv("final_dataset.csv")
print(f"Loaded: {df.shape}")

# ══════════════════════════════════════════════════════════════════════════════
# COLUMNS THAT MUST NEVER GO INTO MODEL
# ══════════════════════════════════════════════════════════════════════════════
drop_cols = [
    # IDs
    'src', 'dest', 'account_number',
    'src_institution_id', 'dest_institution_id',
    'txn_id',
    # Target — kept separately
    'is_fraudulent',
    # Raw datetime
    'timestamp',
    # PII
    'name', 'mobile_number', 'src_name', 'dest_name',
    # Free text
    'narration',
    # Zero variance
    'currency', 'edge_type',
    # Fraud category — leaks label
    'fraud_category',
    # Raw dates
    'src_creation_date', 'dest_creation_date',
    # Intermediate columns
    'is_just_below_threshold',
    # Leakage — directly derived from label
    'src_is_fraudulent', 'dest_is_fraudulent',
    # Display only
    'city', 'pincode', 'account_type',
]

# Only drop what exists
drop_cols  = [c for c in drop_cols if c in df.columns]
feature_df = df.drop(columns=drop_cols).copy()

print(f"\nFeatures selected: {len(feature_df.columns)}")
print(feature_df.columns.tolist())

# ══════════════════════════════════════════════════════════════════════════════
# ENCODE CATEGORICAL COLUMNS
# ══════════════════════════════════════════════════════════════════════════════
cat_cols = feature_df.select_dtypes(include=['object', 'category']).columns.tolist()
cat_cols = [c for c in cat_cols if c != 'is_fraudulent']
print(f"\nEncoding {len(cat_cols)} categorical columns: {cat_cols}")

encoders = {}
for col in cat_cols:
    le = LabelEncoder()
    feature_df[col] = feature_df[col].astype(str)
    feature_df[col] = le.fit_transform(feature_df[col])
    encoders[col]   = le

# ══════════════════════════════════════════════════════════════════════════════
# FILL NULLS
# ══════════════════════════════════════════════════════════════════════════════
null_count = feature_df.isnull().sum().sum()
if null_count > 0:
    print(f"\nFilling {null_count} nulls with median")
    for col in feature_df.select_dtypes(include=[np.number]).columns:
        feature_df[col] = feature_df[col].fillna(feature_df[col].median())
else:
    print("\nNo nulls ✓")

# ══════════════════════════════════════════════════════════════════════════════
# ADD TARGET BACK
# ══════════════════════════════════════════════════════════════════════════════
feature_df['is_fraudulent'] = df['is_fraudulent'].astype(int).values

# ══════════════════════════════════════════════════════════════════════════════
# SAVE
# ══════════════════════════════════════════════════════════════════════════════
feature_df.to_csv("model_input.csv", index=False)

with open("encoders.pkl", "wb") as f:
    pickle.dump(encoders, f)

print(f"\n✅ model_input.csv saved  — {feature_df.shape}")
print(f"✅ encoders.pkl saved     — {len(encoders)} encoders")
print(f"\nFraud rows: {feature_df['is_fraudulent'].sum()}")
print(f"Features:   {[c for c in feature_df.columns if c != 'is_fraudulent']}")