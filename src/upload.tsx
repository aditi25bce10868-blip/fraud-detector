import { useState, DragEvent, useEffect } from "react";

// ─────────────────────────────────────────────
// Types matching upload.py responses
// ─────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface UploadResult {
  upload_id: string;
  status: string;
  total_rows: number;
  fraud_detected: number;
  fraud_rate: number;
  used_model: boolean;
  message: string;
  results_url: string;
}

interface TrainJob {
  id: string;
  dataset: string;
  upload_id: string;
  model_type: string;
  started_at: string;
  completed_at: string | null;
  status: "Running" | "Completed" | "Failed";
  epochs: number;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  auc_roc: number | null;
  error?: string;
}

interface DatasetStats {
  total_samples: number;
  fraud_samples: number;
  normal_samples: number;
  fraud_rate_pct: number;
}

interface MetricsResponse {
  model_available: boolean;
  current_model: string;
  dataset_stats: DatasetStats;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  auc_roc?: number;
  feature_importance?: { feature: string; importance: number }[];
  note?: string;
  error?: string;
}

interface UploadHistoryItem {
  upload_id: string;
  filename: string;
  size_mb: number;
  total_rows: number;
  fraud_detected: number;
  fraud_rate: number;
  uploaded_at: string;
  status: string;
}

type StyleRecord = Record<string, React.CSSProperties>;

// ─────────────────────────────────────────────
// API base — adjust if your backend runs elsewhere
// ─────────────────────────────────────────────
const API_BASE = "http://localhost:8000/api/upload";

// ─────────────────────────────────────────────
// Nav items (unchanged from original)
// ─────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  {
    id: "upload",
    label: "Upload Data",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    id: "train",
    label: "Train Model",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
      </svg>
    ),
  },
  {
    id: "metrics",
    label: "Metrics",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "History",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function MuleTransactionDetection(): JSX.Element {
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [dragOver, setDragOver] = useState<boolean>(false);

  // ── Tab 1: Upload state ──
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── Tab 2: Train state ──
  const [trainModelType, setTrainModelType] = useState<string>("random_forest");
  const [trainEpochs, setTrainEpochs] = useState<number>(100);
  const [trainTestSize, setTrainTestSize] = useState<number>(0.2);
  const [training, setTraining] = useState<boolean>(false);
  const [trainResult, setTrainResult] = useState<TrainJob | null>(null);
  const [trainError, setTrainError] = useState<string | null>(null);

  // ── Tab 3: Metrics state ──
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // ── Tab 4: History state ──
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // ─────────────────────────────────────────────
  // Fetch metrics when tab becomes active
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === "metrics") fetchMetrics();
    if (activeTab === "history") fetchHistory();
  }, [activeTab]);

  // ─────────────────────────────────────────────
  // TAB 1 — Upload handlers
  // ─────────────────────────────────────────────

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (): void => setDragOver(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleFileSelected = (file: File): void => {
    setSelectedFile(file);
    setUploadResult(null);
    setUploadError(null);
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${API_BASE}/transactions`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setUploadResult(data as UploadResult);
    } catch (err: any) {
      setUploadError(err.message ?? "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  // ─────────────────────────────────────────────
  // TAB 2 — Train handlers
  // Maps to: POST /api/upload/train?upload_id=&model_type=&epochs=&test_size=
  // ─────────────────────────────────────────────

  const handleTrain = async (): Promise<void> => {
    if (!uploadResult?.upload_id) return;
    setTraining(true);
    setTrainError(null);
    setTrainResult(null);

    const params = new URLSearchParams({
      upload_id: uploadResult.upload_id,
      model_type: trainModelType,
      epochs: String(trainEpochs),
      test_size: String(trainTestSize),
    });

    try {
      const res = await fetch(`${API_BASE}/train?${params}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Training failed");
      setTrainResult(data as TrainJob);
    } catch (err: any) {
      setTrainError(err.message ?? "Unknown error");
    } finally {
      setTraining(false);
    }
  };

  // ─────────────────────────────────────────────
  // TAB 3 — Metrics fetch
  // Maps to: GET /api/upload/metrics
  // ─────────────────────────────────────────────

  const fetchMetrics = async (): Promise<void> => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const res = await fetch(`${API_BASE}/metrics`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load metrics");
      setMetrics(data as MetricsResponse);
    } catch (err: any) {
      setMetricsError(err.message ?? "Unknown error");
    } finally {
      setMetricsLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // TAB 4 — History fetch
  // Maps to: GET /api/upload/history/uploads  +  GET /api/upload/history/training
  // ─────────────────────────────────────────────

  const fetchHistory = async (): Promise<void> => {
    setHistoryLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([
        fetch(`${API_BASE}/history/uploads`),
        fetch(`${API_BASE}/history/training`),
      ]);
      const uData = await uRes.json();
      const tData = await tRes.json();
      setUploadHistory(uData.uploads ?? []);
      setTrainingHistory(tData.jobs ?? []);
    } catch {
      // silently fail — history is non-critical
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteUpload = async (uploadId: string): Promise<void> => {
    try {
      await fetch(`${API_BASE}/history/uploads/${uploadId}`, { method: "DELETE" });
      setUploadHistory((prev) => prev.filter((u) => u.upload_id !== uploadId));
    } catch {
      // ignore
    }
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Header — unchanged */}
      <header style={styles.header}>
        <div style={styles.logoWrapper}>
          <div style={styles.logoIcon}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00cfff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div style={styles.appTitle}>Mule Transaction Detection System</div>
            <div style={styles.appSubtitle}>AI-Powered Fraud Analytics Platform</div>
          </div>
        </div>
      </header>

      {/* Nav — unchanged */}
      <nav style={styles.nav}>
        {NAV_ITEMS.map((item: NavItem) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              ...styles.navBtn,
              ...(activeTab === item.id ? styles.navBtnActive : {}),
            }}
          >
            <span style={{ ...styles.navIcon, color: activeTab === item.id ? "#00cfff" : "#8899aa" }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
            {activeTab === item.id && <span style={styles.navUnderline} />}
          </button>
        ))}
        <div style={styles.navDivider} />
      </nav>

      {/* Content */}
      <main style={styles.main}>

        {/* ── TAB 1: Upload Data ── */}
        {activeTab === "upload" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{ ...styles.dropzone, ...(dragOver ? styles.dropzoneActive : {}) }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div style={styles.uploadIconCircle}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>

              <h2 style={styles.uploadTitle}>Upload Transaction Dataset</h2>
              <p style={styles.uploadSubtitle}>Drag and drop your file here, or click to browse</p>
              <p style={styles.uploadHint}>Supports CSV, JSON, and Excel files (max 50MB)</p>

              {selectedFile && (
                <p style={{ fontSize: 13, color: "#4d9fc4", margin: 0 }}>
                  Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}

              <label style={styles.selectBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Select File
                <input type="file" accept=".csv,.json,.xlsx,.xls" style={{ display: "none" }} onChange={handleFileInputChange} />
              </label>

              {selectedFile && !uploading && (
                <button
                  onClick={handleUpload}
                  style={{ ...styles.selectBtn, marginTop: 0, background: "linear-gradient(135deg, #0a7f4f, #05532e)", cursor: "pointer" }}
                >
                  Upload & Analyse
                </button>
              )}

              {uploading && <p style={{ color: "#4d9fc4", fontSize: 14 }}>Uploading and scoring…</p>}
            </div>

            {/* Upload result summary */}
            {uploadResult && (
              <div style={styles.resultCard}>
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Upload ID</span>
                  <span style={styles.resultValue}>{uploadResult.upload_id}</span>
                </div>
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Total Rows</span>
                  <span style={styles.resultValue}>{uploadResult.total_rows.toLocaleString()}</span>
                </div>
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Fraud Detected</span>
                  <span style={{ ...styles.resultValue, color: "#ff6b6b" }}>{uploadResult.fraud_detected.toLocaleString()}</span>
                </div>
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Fraud Rate</span>
                  <span style={{ ...styles.resultValue, color: "#ffb347" }}>{uploadResult.fraud_rate}%</span>
                </div>
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Model Used</span>
                  <span style={{ ...styles.resultValue, color: uploadResult.used_model ? "#4ec97b" : "#8899aa" }}>
                    {uploadResult.used_model ? "Trained Model" : "Rule-based Fallback"}
                  </span>
                </div>
                <p style={{ color: "#4d9fc4", fontSize: 13, margin: "8px 0 0" }}>{uploadResult.message}</p>
              </div>
            )}

            {uploadError && (
              <div style={{ ...styles.resultCard, border: "1px solid #ff6b6b33" }}>
                <p style={{ color: "#ff6b6b", fontSize: 14, margin: 0 }}>Error: {uploadError}</p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Train Model ── */}
        {activeTab === "train" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {!uploadResult ? (
              <div style={styles.placeholder}>
                <p style={{ color: "#8899aa", fontSize: 15 }}>Upload a dataset first to enable training.</p>
              </div>
            ) : (
              <div style={styles.resultCard}>
                <p style={{ color: "#4d9fc4", fontSize: 13, margin: "0 0 16px" }}>
                  Training on: <strong style={{ color: "#e8f2ff" }}>{uploadResult.upload_id}</strong> — {uploadResult.total_rows.toLocaleString()} rows
                </p>

                <div style={styles.formRow}>
                  <label style={styles.formLabel}>Model Type</label>
                  <select
                    value={trainModelType}
                    onChange={(e) => setTrainModelType(e.target.value)}
                    style={styles.formSelect}
                  >
                    <option value="random_forest">Random Forest</option>
                    <option value="gradient_boosting">Gradient Boosting</option>
                    <option value="logistic_regression">Logistic Regression</option>
                  </select>
                </div>

                <div style={styles.formRow}>
                  <label style={styles.formLabel}>Epochs (1–500)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={trainEpochs}
                    onChange={(e) => setTrainEpochs(Number(e.target.value))}
                    style={styles.formInput}
                  />
                </div>

                <div style={styles.formRow}>
                  <label style={styles.formLabel}>Test Size (0.1–0.4)</label>
                  <input
                    type="number"
                    min={0.1}
                    max={0.4}
                    step={0.05}
                    value={trainTestSize}
                    onChange={(e) => setTrainTestSize(Number(e.target.value))}
                    style={styles.formInput}
                  />
                </div>

                <button
                  onClick={handleTrain}
                  disabled={training}
                  style={{
                    ...styles.selectBtn,
                    marginTop: 8,
                    opacity: training ? 0.6 : 1,
                    cursor: training ? "not-allowed" : "pointer",
                  }}
                >
                  {training ? "Training…" : "Start Training"}
                </button>
              </div>
            )}

            {trainResult && (
              <div style={styles.resultCard}>
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Job ID</span>
                  <span style={styles.resultValue}>{trainResult.id}</span>
                </div>
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Status</span>
                  <span style={{
                    ...styles.resultValue,
                    color: trainResult.status === "Completed" ? "#4ec97b" : trainResult.status === "Failed" ? "#ff6b6b" : "#ffb347",
                  }}>
                    {trainResult.status}
                  </span>
                </div>
                {trainResult.accuracy != null && (
                  <>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>Accuracy</span>
                      <span style={styles.resultValue}>{(trainResult.accuracy * 100).toFixed(2)}%</span>
                    </div>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>Precision</span>
                      <span style={styles.resultValue}>{(trainResult.precision! * 100).toFixed(2)}%</span>
                    </div>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>Recall</span>
                      <span style={styles.resultValue}>{(trainResult.recall! * 100).toFixed(2)}%</span>
                    </div>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>F1 Score</span>
                      <span style={styles.resultValue}>{(trainResult.f1_score! * 100).toFixed(2)}%</span>
                    </div>
                    <div style={styles.resultRow}>
                      <span style={styles.resultLabel}>AUC-ROC</span>
                      <span style={styles.resultValue}>{trainResult.auc_roc?.toFixed(4)}</span>
                    </div>
                  </>
                )}
                {trainResult.error && (
                  <p style={{ color: "#ff6b6b", fontSize: 13, margin: "8px 0 0" }}>{trainResult.error}</p>
                )}
              </div>
            )}

            {trainError && (
              <div style={{ ...styles.resultCard, border: "1px solid #ff6b6b33" }}>
                <p style={{ color: "#ff6b6b", fontSize: 14, margin: 0 }}>Error: {trainError}</p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: Metrics ── */}
        {activeTab === "metrics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {metricsLoading && (
              <div style={styles.placeholder}>
                <p style={{ color: "#8899aa", fontSize: 15 }}>Loading metrics…</p>
              </div>
            )}

            {metricsError && (
              <div style={{ ...styles.resultCard, border: "1px solid #ff6b6b33" }}>
                <p style={{ color: "#ff6b6b", fontSize: 14, margin: 0 }}>Error: {metricsError}</p>
              </div>
            )}

            {metrics && !metricsLoading && (
              <>
                <div style={styles.resultCard}>
                  <p style={{ color: "#6a8099", fontSize: 12, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 1 }}>
                    Dataset Statistics
                  </p>
                  <div style={styles.resultRow}>
                    <span style={styles.resultLabel}>Total Samples</span>
                    <span style={styles.resultValue}>{metrics.dataset_stats.total_samples.toLocaleString()}</span>
                  </div>
                  <div style={styles.resultRow}>
                    <span style={styles.resultLabel}>Fraud Samples</span>
                    <span style={{ ...styles.resultValue, color: "#ff6b6b" }}>{metrics.dataset_stats.fraud_samples.toLocaleString()}</span>
                  </div>
                  <div style={styles.resultRow}>
                    <span style={styles.resultLabel}>Normal Samples</span>
                    <span style={{ ...styles.resultValue, color: "#4ec97b" }}>{metrics.dataset_stats.normal_samples.toLocaleString()}</span>
                  </div>
                  <div style={styles.resultRow}>
                    <span style={styles.resultLabel}>Fraud Rate</span>
                    <span style={{ ...styles.resultValue, color: "#ffb347" }}>{metrics.dataset_stats.fraud_rate_pct}%</span>
                  </div>
                </div>

                <div style={styles.resultCard}>
                  <p style={{ color: "#6a8099", fontSize: 12, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 1 }}>
                    Model — {metrics.current_model}
                  </p>
                  {!metrics.model_available ? (
                    <p style={{ color: "#8899aa", fontSize: 14 }}>{metrics.note ?? "No trained model available."}</p>
                  ) : (
                    <>
                      {metrics.accuracy != null && (
                        <>
                          <div style={styles.resultRow}>
                            <span style={styles.resultLabel}>Accuracy</span>
                            <span style={styles.resultValue}>{(metrics.accuracy * 100).toFixed(2)}%</span>
                          </div>
                          <div style={styles.resultRow}>
                            <span style={styles.resultLabel}>Precision</span>
                            <span style={styles.resultValue}>{(metrics.precision! * 100).toFixed(2)}%</span>
                          </div>
                          <div style={styles.resultRow}>
                            <span style={styles.resultLabel}>Recall</span>
                            <span style={styles.resultValue}>{(metrics.recall! * 100).toFixed(2)}%</span>
                          </div>
                          <div style={styles.resultRow}>
                            <span style={styles.resultLabel}>F1 Score</span>
                            <span style={styles.resultValue}>{(metrics.f1_score! * 100).toFixed(2)}%</span>
                          </div>
                          <div style={styles.resultRow}>
                            <span style={styles.resultLabel}>AUC-ROC</span>
                            <span style={styles.resultValue}>{metrics.auc_roc?.toFixed(4)}</span>
                          </div>
                        </>
                      )}
                      {metrics.error && (
                        <p style={{ color: "#ffb347", fontSize: 13, margin: "8px 0 0" }}>{metrics.error}</p>
                      )}
                    </>
                  )}
                </div>

                {metrics.feature_importance && metrics.feature_importance.length > 0 && (
                  <div style={styles.resultCard}>
                    <p style={{ color: "#6a8099", fontSize: 12, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 1 }}>
                      Top Feature Importances
                    </p>
                    {metrics.feature_importance.map((f) => (
                      <div key={f.feature} style={{ ...styles.resultRow, flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                        <span style={{ ...styles.resultLabel, fontSize: 13 }}>{f.feature}</span>
                        <div style={{ width: "100%", background: "#1e2d40", borderRadius: 4, height: 6 }}>
                          <div style={{ width: `${(f.importance * 100).toFixed(1)}%`, background: "#00cfff", height: 6, borderRadius: 4 }} />
                        </div>
                        <span style={{ color: "#4d9fc4", fontSize: 11 }}>{(f.importance * 100).toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={fetchMetrics} style={{ ...styles.selectBtn, alignSelf: "flex-start" }}>
                  Refresh
                </button>
              </>
            )}
          </div>
        )}

        {/* ── TAB 4: History ── */}
        {activeTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {historyLoading && (
              <div style={styles.placeholder}>
                <p style={{ color: "#8899aa", fontSize: 15 }}>Loading history…</p>
              </div>
            )}

            {!historyLoading && (
              <>
                {/* Upload history */}
                <div style={styles.resultCard}>
                  <p style={{ color: "#6a8099", fontSize: 12, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 1 }}>
                    Upload History ({uploadHistory.length})
                  </p>
                  {uploadHistory.length === 0 ? (
                    <p style={{ color: "#8899aa", fontSize: 14 }}>No uploads yet.</p>
                  ) : (
                    uploadHistory.map((u) => (
                      <div key={u.upload_id} style={{ ...styles.resultRow, alignItems: "flex-start", flexWrap: "wrap", gap: 8, padding: "10px 0", borderBottom: "1px solid #1e2d40" }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <p style={{ margin: 0, color: "#e8f2ff", fontSize: 14, fontWeight: 600 }}>{u.filename}</p>
                          <p style={{ margin: "2px 0 0", color: "#6a8099", fontSize: 12 }}>
                            {u.uploaded_at} · {u.total_rows.toLocaleString()} rows · {u.fraud_detected} fraud ({u.fraud_rate}%)
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteUpload(u.upload_id)}
                          style={{ background: "none", border: "1px solid #2a4060", color: "#ff6b6b", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Training history */}
                <div style={styles.resultCard}>
                  <p style={{ color: "#6a8099", fontSize: 12, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 1 }}>
                    Training History ({trainingHistory.length})
                  </p>
                  {trainingHistory.length === 0 ? (
                    <p style={{ color: "#8899aa", fontSize: 14 }}>No training runs yet.</p>
                  ) : (
                    trainingHistory.map((t) => (
                      <div key={t.id} style={{ padding: "10px 0", borderBottom: "1px solid #1e2d40" }}>
                        <p style={{ margin: 0, color: "#e8f2ff", fontSize: 14, fontWeight: 600 }}>
                          {t.id} — {t.model_type}
                        </p>
                        <p style={{ margin: "2px 0 0", color: "#6a8099", fontSize: 12 }}>
                          {t.started_at} · Epochs: {t.epochs} ·{" "}
                          <span style={{ color: t.status === "Completed" ? "#4ec97b" : t.status === "Failed" ? "#ff6b6b" : "#ffb347" }}>
                            {t.status}
                          </span>
                          {t.accuracy != null && ` · Acc: ${(t.accuracy * 100).toFixed(2)}%`}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <button onClick={fetchHistory} style={{ ...styles.selectBtn, alignSelf: "flex-start" }}>
                  Refresh
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {/* Help button — unchanged */}
      <button style={styles.helpBtn} title="Help">?</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Styles — all original styles preserved + new additions
// ─────────────────────────────────────────────

const styles: StyleRecord = {
  root: {
    minHeight: "100vh",
    backgroundColor: "#0d1520",
    color: "#e2eaf5",
    fontFamily: "'Segoe UI', 'Inter', sans-serif",
    position: "relative",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    backgroundColor: "#111c2b",
    padding: "14px 28px",
    display: "flex",
    alignItems: "center",
    borderBottom: "1px solid #1e2d40",
  },
  logoWrapper: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  logoIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    background: "linear-gradient(135deg, #1a3a5c, #0d2035)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #1e3a55",
  },
  appTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#e8f2ff",
    letterSpacing: 0.2,
  },
  appSubtitle: {
    fontSize: 12,
    color: "#6a8099",
    marginTop: 2,
  },
  nav: {
    backgroundColor: "#111c2b",
    display: "flex",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 16,
    gap: 4,
    position: "relative",
  },
  navBtn: {
    background: "none",
    border: "none",
    color: "#8899aa",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "14px 18px",
    fontSize: 14,
    fontWeight: 500,
    position: "relative",
    transition: "color 0.2s",
    outline: "none",
  },
  navBtnActive: {
    color: "#00cfff",
  },
  navIcon: {
    display: "flex",
    alignItems: "center",
  },
  navUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    background: "#00cfff",
    borderRadius: "2px 2px 0 0",
  },
  navDivider: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    background: "#1e2d40",
  },
  main: {
    flex: 1,
    padding: "28px 24px",
    display: "flex",
    flexDirection: "column",
  },
  dropzone: {
    border: "2px dashed #2a4060",
    borderRadius: 14,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "64px 40px",
    gap: 12,
    cursor: "pointer",
    transition: "border-color 0.2s, background 0.2s",
    background: "rgba(255,255,255,0.01)",
    minHeight: 360,
  },
  dropzoneActive: {
    borderColor: "#00cfff",
    background: "rgba(0, 207, 255, 0.05)",
  },
  uploadIconCircle: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #0a9fd4, #0065b3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    boxShadow: "0 4px 24px rgba(0, 160, 220, 0.3)",
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#e8f2ff",
    margin: 0,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: "#4d9fc4",
    margin: 0,
  },
  uploadHint: {
    fontSize: 12,
    color: "#4a6070",
    margin: 0,
  },
  selectBtn: {
    marginTop: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0a9fd4, #0065b3)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 2px 12px rgba(0, 130, 200, 0.35)",
    transition: "opacity 0.2s",
    letterSpacing: 0.2,
  },
  placeholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minHeight: 300,
  },
  helpBtn: {
    position: "fixed",
    bottom: 24,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "#1a2d42",
    border: "1px solid #2a4060",
    color: "#8899aa",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
  },
  // ── New styles for data display ──
  resultCard: {
    background: "#111c2b",
    border: "1px solid #1e2d40",
    borderRadius: 12,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  resultRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 0",
  },
  resultLabel: {
    color: "#6a8099",
    fontSize: 13,
  },
  resultValue: {
    color: "#e8f2ff",
    fontSize: 14,
    fontWeight: 600,
  },
  formRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 0",
    gap: 16,
  },
  formLabel: {
    color: "#8899aa",
    fontSize: 13,
    minWidth: 140,
  },
  formSelect: {
    background: "#0d1520",
    border: "1px solid #2a4060",
    color: "#e8f2ff",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 13,
    flex: 1,
    outline: "none",
  },
  formInput: {
    background: "#0d1520",
    border: "1px solid #2a4060",
    color: "#e8f2ff",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 13,
    flex: 1,
    outline: "none",
  },
};
