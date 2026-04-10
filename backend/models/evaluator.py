import pandas as pd
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score
)


class ModelEvaluator:
    def __init__(self, model, encoders):
        self.model = model
        self.encoders = encoders

    @staticmethod
    def _strip_enum_prefixes(df: pd.DataFrame) -> pd.DataFrame:
        """'TransactionType.TRANSFER' → 'TRANSFER'"""
        for col in df.select_dtypes(include="object").columns:
            df[col] = df[col].apply(
                lambda x: x.split(".")[-1] if isinstance(x, str) and "." in x else x
            )
        return df

    def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Step 1 — strip enum prefixes
        df = self._strip_enum_prefixes(df)

        # Step 2 — drop target columns before anything else
        drop_cols = [c for c in ["is_fraudulent", "label"] if c in df.columns]
        df = df.drop(columns=drop_cols)

        # Step 3 — encode categoricals
        # Try encoders dict first, then fall back to pd.factorize
        # for any remaining string columns the model can't handle
        if self.encoders:
            for col, encoder in self.encoders.items():
                if col in df.columns:
                    known = set(encoder.classes_)
                    df[col] = df[col].apply(
                        lambda x: x if x in known else encoder.classes_[0]
                    )
                    df[col] = encoder.transform(df[col])

        # Step 4 — force-encode ANY remaining object columns
        # (catches columns the encoders dict missed)
        for col in df.select_dtypes(include="object").columns:
            print(f"[Evaluator] WARNING: '{col}' still a string after encoding — factorizing")
            df[col], _ = pd.factorize(df[col])

        # Step 5 — align to model's expected feature set
        if hasattr(self.model, "feature_names_in_"):
            expected = list(self.model.feature_names_in_)
            for c in expected:
                if c not in df.columns:
                    print(f"[Evaluator] WARNING: missing feature '{c}' — filling with 0")
                    df[c] = 0
            df = df[expected]

        return df

    def evaluate(self, df: pd.DataFrame) -> dict:
        if "is_fraudulent" not in df.columns:
            return {
                "accuracy": 0.0, "precision": 0.0,
                "recall": 0.0, "f1_score": 0.0, "auc_roc": 0.0,
                "error": "No 'is_fraudulent' column found in dataset.",
            }

        try:
            y_true = df["is_fraudulent"].astype(int)
            X = self._prepare_features(df)

            # Log what's going into the model
            print(f"[Evaluator] Feature dtypes:\n{X.dtypes}")
            print(f"[Evaluator] Any remaining object cols: "
                  f"{X.select_dtypes(include='object').columns.tolist()}")

            y_pred = self.model.predict(X)

            if hasattr(self.model, "predict_proba"):
                y_prob = self.model.predict_proba(X)[:, 1]
            else:
                y_prob = y_pred.astype(float)

            return {
                "accuracy":  round(float(accuracy_score(y_true, y_pred)), 4),
                "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
                "recall":    round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
                "f1_score":  round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
                "auc_roc":   round(float(roc_auc_score(y_true, y_prob)), 4),
            }

        except Exception as e:
            return {
                "accuracy": 0.0, "precision": 0.0,
                "recall": 0.0, "f1_score": 0.0, "auc_roc": 0.0,
                "error": str(e),
            }

    def feature_importance(self, top_n: int = 10) -> list:
        try:
            if hasattr(self.model, "feature_importances_"):
                importances = self.model.feature_importances_
            elif hasattr(self.model, "coef_"):
                importances = np.abs(self.model.coef_[0])
            else:
                return []

            if hasattr(self.model, "feature_names_in_"):
                feature_names = list(self.model.feature_names_in_)
            else:
                feature_names = [f"feature_{i}" for i in range(len(importances))]

            paired = sorted(
                zip(feature_names, importances),
                key=lambda x: x[1],
                reverse=True,
            )
            return [
                {"feature": name, "importance": round(float(imp), 6)}
                for name, imp in paired[:top_n]
            ]
        except Exception:
            return []