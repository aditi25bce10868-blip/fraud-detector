import pandas as pd
import numpy as np
import random
from faker import Faker

fake = Faker('en_IN')
random.seed(42)
np.random.seed(42)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: LOAD RAW FILES
# ══════════════════════════════════════════════════════════════════════════════
transactions = pd.read_csv("generated_transactions.csv")
nodes        = pd.read_csv("generated_nodes.csv")

print(f"✅ Loaded transactions: {len(transactions)} rows")
print(f"✅ Loaded nodes:        {len(nodes)} rows")
print(f"✅ Fraud rows (raw):    {transactions['is_fraudulent'].sum()}")

EXPECTED_ROWS  = len(transactions)
EXPECTED_FRAUD = transactions['is_fraudulent'].sum()

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: DROP UNNECESSARY COLUMNS
# ══════════════════════════════════════════════════════════════════════════════
transactions.drop(
    columns=['ownership_percentage', 'ownership_start_date'],
    inplace=True, errors='ignore'
)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: PREPROCESSING
# ══════════════════════════════════════════════════════════════════════════════
transactions['timestamp'] = pd.to_datetime(transactions['timestamp'], errors='coerce')
transactions['time_since_previous_transaction'] = pd.to_numeric(
    transactions['time_since_previous_transaction'], errors='coerce'
)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: FRAUD MASK
# ══════════════════════════════════════════════════════════════════════════════
fraud_mask  = transactions['is_fraudulent'] == True
normal_mask = ~fraud_mask
n           = len(transactions)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: ADD NAME, MOBILE, PINCODE PLACEHOLDER
# ══════════════════════════════════════════════════════════════════════════════
transactions['name']          = [fake.name() for _ in range(n)]
transactions['mobile_number'] = [f"9{random.randint(100000000, 999999999)}" for _ in range(n)]
transactions['pincode']       = '000000'  # placeholder — set in step 9

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6: NARRATION — aligned with fraud label
# ══════════════════════════════════════════════════════════════════════════════
normal_narrations = [
    "UPI payment to {}", "NEFT transfer - {}",
    "Salary credit from {}", "Bill payment - {}",
    "EMI deduction - {}", "Online purchase at {}"
]
fraud_narrations = [
    "IMPS txn ref {}", "Cash withdrawal at ATM {}",
    "Urgent transfer to {}", "Quick payment {}",
    "Immediate txn ref {}", "Refund from {}"
]
transactions['narration'] = [
    random.choice(fraud_narrations).format(fake.company()[:20])
    if is_fraud else
    random.choice(normal_narrations).format(fake.company()[:20])
    for is_fraud in fraud_mask
]

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7: TIME FEATURES — aligned with fraud label
# ══════════════════════════════════════════════════════════════════════════════
transactions['transaction_hour'] = [
    random.randint(22, 23) if random.random() < 0.5 else random.randint(0, 5)
    if is_fraud else random.randint(8, 20)
    for is_fraud in fraud_mask
]
transactions['is_weekend'] = [
    int(random.random() < 0.55) if is_fraud else int(random.random() < 0.25)
    for is_fraud in fraud_mask
]
transactions['is_odd_hour'] = transactions['transaction_hour'].apply(
    lambda x: 1 if (x >= 22 or x <= 5) else 0
)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8: VELOCITY FEATURES — aligned with fraud label
# ══════════════════════════════════════════════════════════════════════════════
transactions['tx_count_last_1hr'] = 0.0
transactions.loc[fraud_mask,  'tx_count_last_1hr'] = [
    random.uniform(1, 55)    for _ in range(fraud_mask.sum())
]
transactions.loc[normal_mask, 'tx_count_last_1hr'] = [
    random.uniform(600, 3600) for _ in range(normal_mask.sum())
]
transactions['is_fast_transaction']          = (transactions['tx_count_last_1hr'] < 60).astype(int)
transactions['time_since_previous_transaction'] = transactions['tx_count_last_1hr']

# ══════════════════════════════════════════════════════════════════════════════
# STEP 9: PINCODE + CITY — aligned with fraud label
# ══════════════════════════════════════════════════════════════════════════════
high_risk_pincode_city = {
    '110001': 'Delhi',     '110002': 'Delhi',     '110051': 'Delhi',     '110092': 'Delhi',
    '400001': 'Mumbai',    '400010': 'Mumbai',    '400051': 'Mumbai',    '400093': 'Mumbai',
    '500001': 'Hyderabad', '500010': 'Hyderabad', '500038': 'Hyderabad', '500072': 'Hyderabad',
    '560001': 'Bangalore', '560010': 'Bangalore', '560040': 'Bangalore', '560078': 'Bangalore',
    '700001': 'Kolkata',   '700010': 'Kolkata',   '700046': 'Kolkata',   '700091': 'Kolkata',
    '600001': 'Chennai',   '600010': 'Chennai',   '600040': 'Chennai',   '600078': 'Chennai',
    '411001': 'Pune',      '411010': 'Pune',      '411040': 'Pune',      '411057': 'Pune',
    '380001': 'Ahmedabad', '380010': 'Ahmedabad', '380051': 'Ahmedabad', '380058': 'Ahmedabad',
}
low_risk_pincode_city = {
    '456001': 'Ujjain',      '456010': 'Ujjain',      '456550': 'Shajapur',    '456335': 'Nagda',
    '341001': 'Nagaur',      '341022': 'Nagaur',      '341306': 'Didwana',     '341502': 'Nawa',
    '244001': 'Moradabad',   '244221': 'Amroha',      '244410': 'Hasanpur',    '244601': 'Rampur',
    '841001': 'Chhapra',     '841101': 'Chhapra',     '841226': 'Siwan',       '841301': 'Siwan',
    '751001': 'Bhubaneswar', '751010': 'Bhubaneswar', '751024': 'Bhubaneswar', '751030': 'Bhubaneswar',
}
all_pincode_city = {**high_risk_pincode_city, **low_risk_pincode_city}

transactions['pincode'] = transactions['pincode'].astype(str)
transactions.loc[fraud_mask,  'pincode'] = [
    random.choice(list(high_risk_pincode_city.keys())) for _ in range(fraud_mask.sum())
]
transactions.loc[normal_mask, 'pincode'] = [
    random.choice(list(low_risk_pincode_city.keys()))  for _ in range(normal_mask.sum())
]
transactions['city'] = transactions['pincode'].map(all_pincode_city)

high_risk_cities = ['Delhi','Mumbai','Hyderabad','Bangalore','Kolkata','Chennai','Pune','Ahmedabad']
transactions['is_high_risk_city'] = transactions['city'].isin(high_risk_cities).astype(int)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 10: ACCOUNT TYPE & NUMBER — aligned with fraud label
# ══════════════════════════════════════════════════════════════════════════════
src_fraud_map = transactions.groupby('src')['is_fraudulent'].any()
prefix_map    = {
    'Savings':       'INSAV',
    'Wallet':        'INWLT',
    'Current':       'INCUR',
    'Salary':        'INSAL',
    'Fixed Deposit': 'INFD0',
}
src_account_type   = {}
src_account_number = {}

for src, is_fraud_src in src_fraud_map.items():
    if is_fraud_src:
        acc_type = random.choices(['Savings','Wallet','Current'], weights=[45,35,20])[0]
        number   = random.randint(80000000, 99999999)
    else:
        acc_type = random.choices(['Salary','Fixed Deposit','Current'], weights=[40,30,30])[0]
        number   = random.randint(10000000, 50000000)
    branch = random.randint(1000, 9999)
    src_account_type[src]   = acc_type
    src_account_number[src] = f"{prefix_map[acc_type]}-{branch}-{number}"

transactions['account_type']   = transactions['src'].map(src_account_type)
transactions['account_number'] = transactions['src'].map(src_account_number)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 11: CURRENCY CONVERSION TO INR — safe, no rows dropped
# ══════════════════════════════════════════════════════════════════════════════
exchange_rates = {
    'EUR': 89.50, 'GBP': 104.80, 'CHF': 92.30,
    'USD': 83.50, 'VUV': 0.70,   'BSD': 83.50,
    'HKD': 10.70, 'JPY': 0.56,   'BMD': 83.50,
    'AED': 22.72, 'SGD': 62.10,  'SCR': 6.20,
    'XCD': 30.90, 'BZD': 41.30,  'BBD': 41.75,
    'INR': 1.00
}
unknown_currencies = transactions[~transactions['currency'].isin(exchange_rates)]['currency'].unique()
if len(unknown_currencies) > 0:
    print(f"⚠️ Unknown currencies — using rate 1.0: {unknown_currencies}")

transactions['rate']   = transactions['currency'].map(exchange_rates).fillna(1.0)
transactions['amount'] = (transactions['amount'] * transactions['rate']).round(2)
transactions['currency'] = 'INR'
transactions.drop(columns=['rate'], inplace=True)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 12: AMOUNT FEATURES — in INR
# ══════════════════════════════════════════════════════════════════════════════
transactions['avg_amount_per_user'] = transactions.groupby('src')['amount'].transform('mean')
transactions['amount_deviation']    = transactions['amount'] / (transactions['avg_amount_per_user'] + 1)
transactions.loc[fraud_mask, 'amount_deviation'] = transactions.loc[fraud_mask, 'amount_deviation'].apply(
    lambda x: x * random.uniform(3.0, 8.0)
)

avg_dest     = transactions.groupby('src')['dest'].transform('nunique')
overall_mean = avg_dest.mean()
transactions['dest_count_ratio'] = avg_dest / overall_mean
transactions.loc[fraud_mask,  'dest_count_ratio'] = transactions.loc[fraud_mask,  'dest_count_ratio'].apply(lambda x: x * random.uniform(2.0, 4.0))
transactions.loc[normal_mask, 'dest_count_ratio'] = transactions.loc[normal_mask, 'dest_count_ratio'].apply(lambda x: x * random.uniform(0.3, 0.8))

transactions['tx_count_per_user'] = transactions.groupby('src')['src'].transform('count')

# Structuring in INR
STRUCTURING_THRESHOLD_INR         = 50000
transactions['is_just_below_threshold'] = (
    (transactions['amount'] > 40000) & (transactions['amount'] < STRUCTURING_THRESHOLD_INR)
).astype(int)
transactions['structuring_count'] = transactions.groupby('src')['is_just_below_threshold'].transform('sum')
transactions.loc[fraud_mask,  'structuring_count'] = [random.randint(3, 15) for _ in range(fraud_mask.sum())]
transactions.loc[normal_mask, 'structuring_count'] = [random.randint(0, 1)  for _ in range(normal_mask.sum())]
transactions['is_structuring'] = (transactions['structuring_count'] >= 3).astype(int)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 13: FRAUD PATTERN FEATURES
# ══════════════════════════════════════════════════════════════════════════════
all_src    = set(transactions['src'].unique())
all_dest   = set(transactions['dest'].unique())
mule_nodes = all_src & all_dest

transactions['unique_dest_count'] = 0
transactions.loc[fraud_mask,  'unique_dest_count'] = [random.randint(5, 25) for _ in range(fraud_mask.sum())]
transactions.loc[normal_mask, 'unique_dest_count'] = [random.randint(1, 3)  for _ in range(normal_mask.sum())]

transactions['is_mule_node'] = transactions['src'].isin(mule_nodes).astype(int)
transactions.loc[fraud_mask,  'is_mule_node'] = [int(random.random() < 0.80) for _ in range(fraud_mask.sum())]
transactions.loc[normal_mask, 'is_mule_node'] = [int(random.random() < 0.05) for _ in range(normal_mask.sum())]

transactions['unique_tx_types'] = 0
transactions.loc[fraud_mask,  'unique_tx_types'] = [random.randint(2, 3) for _ in range(fraud_mask.sum())]
transactions.loc[normal_mask, 'unique_tx_types'] = [1] * normal_mask.sum()
transactions['is_cross_channel'] = (transactions['unique_tx_types'] > 1).astype(int)

routing_nodes = all_src & all_dest
transactions['dest_is_routing_node'] = transactions['dest'].isin(routing_nodes).astype(int)
transactions.loc[fraud_mask,  'dest_is_routing_node'] = [int(random.random() < 0.85) for _ in range(fraud_mask.sum())]
transactions.loc[normal_mask, 'dest_is_routing_node'] = [int(random.random() < 0.10) for _ in range(normal_mask.sum())]

transactions['routing_depth'] = 0
transactions.loc[fraud_mask,  'routing_depth'] = [random.randint(3, 8) for _ in range(fraud_mask.sum())]
transactions.loc[normal_mask, 'routing_depth'] = [random.randint(1, 2) for _ in range(normal_mask.sum())]

# ══════════════════════════════════════════════════════════════════════════════
# STEP 14: FRAUD CATEGORY LABEL
# ══════════════════════════════════════════════════════════════════════════════
fraud_categories = ['structuring','mule_network','cross_channel','routing_layering','spray_attack','simple_fraud']
weights          = [20, 25, 15, 20, 12, 8]

transactions['fraud_category'] = 'normal'
transactions.loc[fraud_mask, 'fraud_category'] = random.choices(
    fraud_categories, weights=weights, k=fraud_mask.sum()
)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 15: MERGE WITH NODES
# ══════════════════════════════════════════════════════════════════════════════
transactions['src']  = transactions['src'].astype(str)
transactions['dest'] = transactions['dest'].astype(str)
nodes['node_id']     = nodes['node_id'].astype(str)

df = transactions.merge(
    nodes.add_prefix('src_'),
    left_on='src', right_on='src_node_id',
    how='left'
)
df = df.merge(
    nodes.add_prefix('dest_'),
    left_on='dest', right_on='dest_node_id',
    how='left'
)
df.drop(columns=['src_node_id', 'dest_node_id'], inplace=True, errors='ignore')

# ══════════════════════════════════════════════════════════════════════════════
# STEP 16: DELETE ZERO VARIANCE + UNWANTED COLUMNS
# ══════════════════════════════════════════════════════════════════════════════
cols_to_delete = [col for col in df.columns if
    'country_code'       in col.lower() or
    'high_risk_country'  in col.lower() or
    col in ['amount_original', 'currency_original', 'src_currency', 'dest_currency']
]
df.drop(columns=cols_to_delete, inplace=True, errors='ignore')
print(f"Deleted zero variance columns: {cols_to_delete}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 17: FILL MISSING VALUES SMARTLY
# ══════════════════════════════════════════════════════════════════════════════
for col in df.select_dtypes(include='object').columns:
    df[col] = df[col].fillna('unknown')

for col in df.select_dtypes(include=[np.number]).columns:
    if col == 'is_fraudulent':
        continue
    df[col] = df[col].fillna(df[col].median())

# Fix timestamp
df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
df['timestamp'] = df['timestamp'].ffill().bfill()

# Fix dest_risk_score — fully null for account nodes
src_median = df['src_risk_score'].median()
df['dest_risk_score'] = df['dest_risk_score'].fillna(src_median)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 18: SAFETY CHECK
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "="*50)
print("SAFETY CHECK")
print("="*50)
print(f"Expected rows:  {EXPECTED_ROWS}  | Got: {len(df)}")
print(f"Expected fraud: {EXPECTED_FRAUD} | Got: {df['is_fraudulent'].sum()}")

assert len(df) == EXPECTED_ROWS,             f"❌ ROWS LOST — expected {EXPECTED_ROWS}, got {len(df)}"
assert df['is_fraudulent'].sum() == EXPECTED_FRAUD, f"❌ FRAUD LOST — expected {EXPECTED_FRAUD}, got {df['is_fraudulent'].sum()}"

print(f"Missing values: {df.isnull().sum().sum()}")
print(f"Total columns:  {len(df.columns)}")
print("\nFraud categories:")
print(df['fraud_category'].value_counts())

# ══════════════════════════════════════════════════════════════════════════════
# STEP 19: SAVE FINAL DATASET
# ══════════════════════════════════════════════════════════════════════════════
df.to_csv("final_dataset.csv", index=False)
print(f"\n✅ final_dataset.csv saved — {df.shape}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 20: SAVE BACKEND DATASET — smart sample
# ══════════════════════════════════════════════════════════════════════════════
fraud_df  = df[df['is_fraudulent'] == True].copy()
normal_df = df[df['is_fraudulent'] == False].copy()

smart_normal = pd.concat([
    normal_df[normal_df['is_high_risk_city'] == 1].sample(
        n=min(500, len(normal_df[normal_df['is_high_risk_city'] == 1])), random_state=42),
    normal_df[normal_df['is_fast_transaction'] == 1].sample(
        n=min(500, len(normal_df[normal_df['is_fast_transaction'] == 1])), random_state=42),
    normal_df.nlargest(500, 'amount'),
    normal_df[normal_df['is_weekend'] == 1].sample(
        n=min(500, len(normal_df[normal_df['is_weekend'] == 1])), random_state=42),
    normal_df.sample(n=2000, random_state=42),
]).drop_duplicates()

backend_df = pd.concat([fraud_df, smart_normal]).sample(
    frac=1, random_state=42
).reset_index(drop=True)
backend_df.insert(0, 'txn_id', range(1, len(backend_df) + 1))
backend_df.to_csv("backend_dataset.csv", index=False)

print(f"✅ backend_dataset.csv saved — {backend_df.shape}")
print(f"   Fraud: {backend_df['is_fraudulent'].sum()} | Normal: {(~backend_df['is_fraudulent']).sum()}")

print("\n" + "="*50)
print("ALL DONE — run order:")
print("  1. python prepare.py")
print("  2. python preprocess.py")
print("  3. python train.py")
print("  4. uvicorn backend.main:app --reload --port 8000")
print("="*50)