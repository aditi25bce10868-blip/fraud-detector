class ModelTrainer:
    def __init__(self, model_type="random_forest", test_size=0.2,
                 model_out="fraud_model.pkl", encoders_out="encoders.pkl"):
        self.model_type = model_type
        self.test_size = test_size

    def train(self, df, epochs=100):
        return {
            "accuracy": 0.0, "precision": 0.0,
            "recall": 0.0, "f1_score": 0.0, "auc_roc": 0.0
        }

    def train_from_file(self, path, epochs=100):
        return self.train(None, epochs=epochs)