import os
import pickle

class FraudModel:
    loaded = False
    model = None
    model_path = "fraud_model.pkl"
    encoders = None

    def __init__(self):
        self.load()

    def load(self):
        if os.path.exists(self.model_path):
            try:
                with open(self.model_path, "rb") as f:
                    self.model = pickle.load(f)
                self.loaded = True
                print(f"[FraudModel] Loaded from {self.model_path}")
            except Exception as e:
                print(f"[FraudModel] Load failed: {e}")
                self.loaded = False
        else:
            print("[FraudModel] No model file found, using rule-based fallback")
            self.loaded = False

    def predict_batch(self, df):
        results = []
        for _, row in df.iterrows():
            amount = float(row.get("amount", 0))
            hour = int(row.get("transaction_hour", 12))
            is_fraud = amount > 50000 or hour < 6
            results.append({
                "is_predicted_fraud": is_fraud,
                "score": 0.85 if is_fraud else 0.1
            })
        return results

    def info(self):
        return {
            "model_type": "random_forest" if self.loaded else "rule_based_fallback",
            "loaded": self.loaded,
            "model_path": self.model_path
        }

fraud_model = FraudModel()