import { useState, useEffect, useMemo } from "react";

// ── API bases ─────────────────────────────────────────────────────────────────
const REPORTS_API     = "http://localhost:8000/api/reports";
const INVESTIGATION_API = "http://localhost:8000/api/investigations";

// ── Types ─────────────────────────────────────────────────────────────────────

type SARStatus = "Submitted" | "Under Review" | "Pending";
type Priority  = "High" | "Medium" | "Low";
type LogStatus = "Success" | "Failed" | "Warning";

interface SARReport {
  id:       string;
  date:     string;
  subject:  string;
  type:     string;
  amount:   number;
  priority: Priority;
  status:   SARStatus;
}

interface AuditLog {
  id:        string;
  timestamp: string;
  user:      string;
  action:    string;
  resource:  string;
  details:   string;
  status:    LogStatus;
}

// Backend shapes
interface SummaryData {
  total_transactions:     number;
  total_fraud:            number;
  total_normal:           number;
  fraud_percentage:       number;
  total_amount:           number;
  fraud_amount:           number;
  avg_fraud_amount:       number;
  high_risk_accounts:     number;
  cities_affected:        number;
  most_common_fraud_type: string;
}

interface CategoryRow {
  category:     string;
  count:        number;
  total_amount: number;
  avg_risk:     number;
  percentage:   number;
}

interface InvestigationAuditEntry {
  event:     string;
  source:    string;
  timestamp: string;
  level:     "warning" | "info" | "danger" | "success";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Map fraud category → SAR type label
function categoryToSARType(cat: string): string {
  const lower = cat.toLowerCase();
  if (lower.includes("structur"))    return "Structuring";
  if (lower.includes("wire"))        return "Wire Transfer";
  if (lower.includes("cash"))        return "Cash Activity";
  if (lower.includes("mule"))        return "Account Takeover";
  if (lower.includes("layering"))    return "Structuring";
  if (lower.includes("atm"))         return "Cash Activity";
  return "Other";
}

// Deterministically assign priority from avg_risk
function riskToPriority(avgRisk: number): Priority {
  if (avgRisk >= 0.7) return "High";
  if (avgRisk >= 0.45) return "Medium";
  return "Low";
}

// Deterministically assign SAR status from index
function indexToStatus(i: number): SARStatus {
  const cycle: SARStatus[] = ["Submitted", "Under Review", "Pending", "Submitted", "Submitted", "Under Review"];
  return cycle[i % cycle.length];
}

// Map investigation audit level → LogStatus
const LEVEL_TO_STATUS: Record<string, LogStatus> = {
  danger:  "Failed",
  warning: "Warning",
  info:    "Success",
  success: "Success",
};

// Derive user email from source string
function sourceToUser(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("risk engine"))         return "risk.engine@fincorp.com";
  if (s.includes("intelligence"))        return "intel.layer@fincorp.com";
  if (s.includes("auth"))                return "auth.system@fincorp.com";
  if (s.includes("ml model"))            return "ml.model@fincorp.com";
  if (s.includes("device"))             return "device.monitor@fincorp.com";
  if (s.includes("investigator") || s.includes("a. singh")) return "a.singh@fincorp.com";
  return "system@fincorp.com";
}

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

// Generate a synthetic SAR report date (recent, deterministic by index)
function sarDate(i: number): string {
  const base = new Date("2026-04-05");
  base.setDate(base.getDate() - i);
  return base.toISOString().slice(0, 10);
}

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:          "#07101c",
  surface:     "#0b1525",
  card:        "#0e1a2e",
  cardHover:   "#11203a",
  border:      "#1a2e48",
  cyan:        "#00d4ff",
  green:       "#00e676",
  red:         "#ff3535",
  orange:      "#ff8800",
  yellow:      "#ffd600",
  blue:        "#4db8ff",
  purple:      "#9b8afb",
  textPrimary: "#dce8f2",
  textSub:     "#4a6280",
  textMuted:   "#2a3e58",
  mono:        "'JetBrains Mono', monospace",
  sans:        "'Syne', sans-serif",
} as const;

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@400;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #0b1628; }
  ::-webkit-scrollbar-thumb { background: #1a2e48; border-radius: 2px; }
  @keyframes ns-blink  { 0%,100%{opacity:1} 50%{opacity:.2} }
  @keyframes ns-fadein { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
  @keyframes ns-pulse-cyan { 0%,100%{box-shadow:0 0 0 0 rgba(0,212,255,0.5)} 50%{box-shadow:0 0 0 6px rgba(0,212,255,0)} }
`;

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ height = 60 }: { height?: number }) {
  return <div style={{ height, borderRadius: 9, background: C.card, border: `1px solid ${C.border}`, marginBottom: 10, opacity: 0.5 }} />;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GridOverlay() {
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
      backgroundImage: `linear-gradient(rgba(0,212,255,0.018) 1px,transparent 1px),
                        linear-gradient(90deg,rgba(0,212,255,0.018) 1px,transparent 1px)`,
      backgroundSize: "44px 44px",
    }} />
  );
}

function StatCard({ icon, value, label, accent }: { icon: React.ReactNode; value: number | string; label: string; accent: string }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${accent}28`,
      borderRadius: 12, padding: "18px 20px", flex: 1, minWidth: 150,
      display: "flex", flexDirection: "column", gap: 10,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg,${accent} 0%,transparent 55%)`, opacity: 0.04, pointerEvents: "none" }} />
      <div style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}18`, border: `1px solid ${accent}28`, color: accent, fontSize: 16 }}>
        {icon}
      </div>
      <div style={{ color: accent, fontSize: 26, fontWeight: 800, fontFamily: C.mono }}>{value}</div>
      <div style={{ color: C.textSub, fontSize: 11, fontFamily: C.mono, letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: SARStatus }) {
  const map: Record<SARStatus, { bg: string; color: string; icon: string }> = {
    "Submitted":    { bg: "rgba(0,230,118,0.10)",  color: "#00e676", icon: "✓"  },
    "Under Review": { bg: "rgba(255,136,0,0.10)",   color: "#ff8800", icon: "⏱" },
    "Pending":      { bg: "rgba(255,53,53,0.10)",   color: "#ff3535", icon: "!"  },
  };
  const s = map[status];
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.color}40`,
      borderRadius: 999, padding: "3px 11px", fontSize: 11, fontWeight: 700,
      fontFamily: C.mono, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
    }}>
      {s.icon} {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const map: Record<Priority, { bg: string; color: string }> = {
    High:   { bg: "rgba(255,53,53,0.10)",  color: "#ff3535" },
    Medium: { bg: "rgba(77,184,255,0.10)", color: "#4db8ff" },
    Low:    { bg: "rgba(0,230,118,0.10)",  color: "#00e676" },
  };
  const s = map[priority];
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.color}40`,
      borderRadius: 999, padding: "3px 11px", fontSize: 11, fontWeight: 700,
      fontFamily: C.mono, display: "inline-block",
    }}>
      {priority}
    </span>
  );
}

function LogStatusBadge({ status }: { status: LogStatus }) {
  const map: Record<LogStatus, { bg: string; color: string }> = {
    Success: { bg: "rgba(0,230,118,0.10)",  color: "#00e676" },
    Failed:  { bg: "rgba(255,53,53,0.10)",  color: "#ff3535" },
    Warning: { bg: "rgba(255,136,0,0.10)",  color: "#ff8800" },
  };
  const s = map[status];
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.color}40`,
      borderRadius: 999, padding: "3px 11px", fontSize: 11, fontWeight: 600,
      fontFamily: C.mono, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      {status}
    </span>
  );
}

function ExportButton({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <button style={{
      background: primary ? "linear-gradient(135deg,#0a9fd4,#0065b3)" : C.surface,
      color: primary ? "#fff" : C.textSub,
      border: primary ? "none" : `1px solid ${C.border}`,
      borderRadius: 8, padding: "9px 18px", fontSize: 12, fontWeight: 700,
      fontFamily: C.sans, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 7, transition: "opacity 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
      <span>↓</span> {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  background: C.surface, color: C.textPrimary, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: "8px 12px", fontSize: 12, fontFamily: C.mono,
  outline: "none", width: "100%",
};

// ── SAR Tab ────────────────────────────────────────────────────────────────────

function SARTab() {
  const [summary,    setSummary]    = useState<SummaryData | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<"All Status" | SARStatus>("All Status");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${REPORTS_API}/summary`).then(r => r.json()),
      fetch(`${REPORTS_API}/by-category`).then(r => r.json()),
    ])
      .then(([sum, cat]: [SummaryData, { categories: CategoryRow[] }]) => {
        setSummary(sum);
        setCategories(cat.categories ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Build SAR rows from category breakdown — one per fraud category
  const sarReports: SARReport[] = useMemo(() =>
    categories.map((cat, i): SARReport => {
      const sarType  = categoryToSARType(cat.category);
      const priority = riskToPriority(cat.avg_risk);
      const status   = indexToStatus(i);
      const seq      = String(1234 - i).padStart(6, "0");
      return {
        id:       `SAR-2026-${seq}`,
        date:     sarDate(i),
        subject:  `${cat.category} Pattern — ${cat.count} transactions flagged`,
        type:     sarType,
        amount:   cat.total_amount,
        priority,
        status,
      };
    }),
  [categories]);

  const filtered    = filter === "All Status" ? sarReports : sarReports.filter(r => r.status === filter);
  const total       = sarReports.length;
  const pending     = sarReports.filter(r => r.status === "Pending").length;
  const submitted   = sarReports.filter(r => r.status === "Submitted").length;
  const underReview = sarReports.filter(r => r.status === "Under Review").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* Stat Cards */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {loading
          ? [0,1,2,3].map(i => <div key={i} style={{ flex: 1, minWidth: 150 }}><Skeleton height={110} /></div>)
          : <>
            <StatCard icon="📄" value={total}       label="Total Reports" accent={C.blue}   />
            <StatCard icon="!"  value={pending}     label="Pending"       accent={C.red}    />
            <StatCard icon="✓"  value={submitted}   label="Submitted"     accent={C.green}  />
            <StatCard icon="⏱"  value={underReview} label="Under Review"  accent={C.orange} />
          </>
        }
      </div>

      {/* Summary callout — extra real data from /summary */}
      {!loading && summary && (
        <div style={{
          background: "rgba(0,212,255,0.04)", border: `1px solid rgba(0,212,255,0.14)`,
          borderRadius: 10, padding: "10px 16px",
          display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center",
        }}>
          {([
            ["Total Fraud Txns",   summary.total_fraud.toLocaleString(),            C.red   ],
            ["Total Fraud Amount", fmt(Math.round(summary.fraud_amount)),            C.orange],
            ["High-Risk Accounts", summary.high_risk_accounts.toLocaleString(),     C.yellow],
            ["Cities Affected",    summary.cities_affected.toLocaleString(),         C.cyan  ],
            ["Top Category",       summary.most_common_fraud_type,                  C.purple],
          ] as [string, string, string][]).map(([lbl, val, col]) => (
            <div key={lbl}>
              <div style={{ fontSize: 10, color: C.textSub, fontFamily: C.mono, marginBottom: 2 }}>{lbl}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: C.mono }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter + Export */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.textSub, fontSize: 12, fontFamily: C.mono }}>Filter by Status:</span>
          <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}
            style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
            <option>All Status</option>
            <option>Submitted</option>
            <option>Under Review</option>
            <option>Pending</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <ExportButton label="Export PDF" primary />
          <ExportButton label="Export CSV" />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        {loading
          ? <Skeleton height={300} />
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Report Number", "Date", "Subject", "Type", "Amount", "Priority", "Status"].map(h => (
                    <th key={h} style={{
                      padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700,
                      color: C.textSub, fontFamily: C.mono, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.15s", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.cardHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "14px 16px", color: C.textPrimary, fontSize: 12, fontFamily: C.mono }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: C.cyan, fontSize: 13 }}>📄</span> {r.id}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: C.textSub,     fontSize: 12, fontFamily: C.mono }}>{r.date}</td>
                    <td style={{ padding: "14px 16px", color: C.textPrimary, fontSize: 12, fontFamily: C.sans, maxWidth: 240 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject}</span>
                    </td>
                    <td style={{ padding: "14px 16px", color: C.textSub, fontSize: 12, fontFamily: C.mono }}>{r.type}</td>
                    <td style={{ padding: "14px 16px", color: C.green,  fontSize: 12, fontFamily: C.mono, fontWeight: 700 }}>{fmt(Math.round(r.amount))}</td>
                    <td style={{ padding: "14px 16px" }}><PriorityBadge priority={r.priority} /></td>
                    <td style={{ padding: "14px 16px" }}><StatusBadge   status={r.status}   /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}

// ── Audit Tab ──────────────────────────────────────────────────────────────────

function AuditTab() {
  const [rawLogs,      setRawLogs]      = useState<AuditLog[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [startDate,    setStartDate]    = useState("");
  const [endDate,      setEndDate]      = useState("");
  const [userFilter,   setUserFilter]   = useState("All Users");
  const [actionFilter, setActionFilter] = useState("All Actions");
  const [statusFilter, setStatusFilter] = useState("All Status");

  // Fetch audit logs from investigation suspicious-accounts, then pull each case's audit trail
  useEffect(() => {
    setLoading(true);
    fetch(`${INVESTIGATION_API}/suspicious-accounts?limit=20`)
      .then(r => r.json())
      .then(async (d: { accounts: { account_number: string; case_id: string }[] }) => {
        const accounts = d.accounts ?? [];
        // Fetch up to 5 cases to get a rich audit log set
        const casePromises = accounts.slice(0, 5).map(a => {
          const raw = a.account_number.replace(/\s/g, "").replace(/X/g, "");
          return fetch(`${INVESTIGATION_API}/case/${encodeURIComponent(raw || a.case_id)}`)
            .then(r => r.json())
            .catch(() => null);
        });
        const cases = await Promise.all(casePromises);

        // Flatten all audit trails into a unified log list
        const logs: AuditLog[] = [];
        let seq = 1;
        for (const c of cases) {
          if (!c?.audit_trail) continue;
          const caseId = c.case_id ?? "UNKNOWN";
          for (const entry of (c.audit_trail as InvestigationAuditEntry[])) {
            logs.push({
              id:        `LOG-${String(seq++).padStart(3, "0")}`,
              timestamp: entry.timestamp ?? "",
              user:      sourceToUser(entry.source ?? ""),
              action:    entry.event?.split(" ")[0]?.toUpperCase().replace(/[^A-Z_]/g, "_") ?? "ACTION",
              resource:  caseId,
              details:   entry.event ?? "",
              status:    LEVEL_TO_STATUS[entry.level ?? "info"] ?? "Success",
            });
          }
        }

        // Sort newest first by timestamp string (ISO-ish)
        logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setRawLogs(logs);

        // Set default date range from data
        if (logs.length > 0) {
          const dates = logs.map(l => l.timestamp.slice(0, 10)).filter(Boolean).sort();
          setStartDate(dates[0] ?? "");
          setEndDate(dates[dates.length - 1] ?? "");
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total      = rawLogs.length;
  const successful = rawLogs.filter(l => l.status === "Success").length;
  const failed     = rawLogs.filter(l => l.status === "Failed").length;
  const warnings   = rawLogs.filter(l => l.status === "Warning").length;

  const filtered = useMemo(() => rawLogs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.user.includes(q) || l.action.toLowerCase().includes(q) ||
      l.resource.toLowerCase().includes(q) || l.details.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All Status" || l.status === statusFilter;
    const matchAction = actionFilter === "All Actions" || l.action === actionFilter;
    const matchUser   = userFilter   === "All Users"   || l.user   === userFilter;
    const matchStart  = !startDate || l.timestamp.slice(0, 10) >= startDate;
    const matchEnd    = !endDate   || l.timestamp.slice(0, 10) <= endDate;
    return matchSearch && matchStatus && matchAction && matchUser && matchStart && matchEnd;
  }), [rawLogs, search, statusFilter, actionFilter, userFilter, startDate, endDate]);

  const uniqueUsers   = useMemo(() => Array.from(new Set(rawLogs.map(l => l.user))), [rawLogs]);
  const uniqueActions = useMemo(() => Array.from(new Set(rawLogs.map(l => l.action))), [rawLogs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* Stat Cards */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {loading
          ? [0,1,2,3].map(i => <div key={i} style={{ flex: 1, minWidth: 150 }}><Skeleton height={110} /></div>)
          : <>
            <StatCard icon="⚡" value={total}      label="Total Actions" accent={C.blue}   />
            <StatCard icon="🛡" value={successful} label="Successful"    accent={C.green}  />
            <StatCard icon="✗"  value={failed}     label="Failed"        accent={C.red}    />
            <StatCard icon="⚠"  value={warnings}   label="Warnings"      accent={C.orange} />
          </>
        }
      </div>

      {/* Filters */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textSub, fontSize: 14 }}>🔍</span>
          <input type="text" placeholder="Search logs by user, action, resource, or details..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[
            { label: "Start Date", value: startDate, setter: setStartDate },
            { label: "End Date",   value: endDate,   setter: setEndDate   },
          ].map(f => (
            <div key={f.label} style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", color: C.textSub, fontSize: 10.5, fontFamily: C.mono, marginBottom: 5, letterSpacing: "0.05em" }}>{f.label}</label>
              <div style={{ position: "relative" }}>
                <input type="text" value={f.value} onChange={e => f.setter(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 34 }} />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.textSub }}>📅</span>
              </div>
            </div>
          ))}
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", color: C.textSub, fontSize: 10.5, fontFamily: C.mono, marginBottom: 5, letterSpacing: "0.05em" }}>User</label>
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option>All Users</option>
              {uniqueUsers.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", color: C.textSub, fontSize: 10.5, fontFamily: C.mono, marginBottom: 5, letterSpacing: "0.05em" }}>Action Type</label>
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option>All Actions</option>
              {uniqueActions.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", color: C.textSub, fontSize: 10.5, fontFamily: C.mono, marginBottom: 5, letterSpacing: "0.05em" }}>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option>All Status</option>
              <option>Success</option>
              <option>Failed</option>
              <option>Warning</option>
            </select>
          </div>
        </div>

        {/* Export + Count */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <ExportButton label="Export PDF" primary />
            <ExportButton label="Export CSV" />
          </div>
          <span style={{ color: C.textSub, fontSize: 12, fontFamily: C.mono }}>
            {loading ? "Loading..." : `Showing ${filtered.length} of ${total} log entries`}
          </span>
        </div>
      </div>

      {/* Logs Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        {loading
          ? <Skeleton height={300} />
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Timestamp", "User", "Action", "Resource", "Details", "Status"].map(h => (
                    <th key={h} style={{
                      padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700,
                      color: C.textSub, fontFamily: C.mono, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr key={l.id}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.15s", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.cardHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "13px 16px", color: C.textSub,     fontSize: 11, fontFamily: C.mono, whiteSpace: "nowrap" }}>{l.timestamp}</td>
                    <td style={{ padding: "13px 16px", color: C.textPrimary, fontSize: 11, fontFamily: C.mono, whiteSpace: "nowrap" }}>{l.user}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ background: "rgba(0,212,255,0.08)", color: C.cyan, borderRadius: 5, padding: "2px 7px", fontSize: 10, fontFamily: C.mono, fontWeight: 700, border: "1px solid rgba(0,212,255,0.2)" }}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px", color: C.orange,     fontSize: 11, fontFamily: C.mono }}>{l.resource}</td>
                    <td style={{ padding: "13px 16px", color: C.textSub,    fontSize: 11, fontFamily: C.sans, maxWidth: 220 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.details}</span>
                    </td>
                    <td style={{ padding: "13px 16px" }}><LogStatusBadge status={l.status} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "28px 16px", textAlign: "center", color: C.textSub, fontFamily: C.mono, fontSize: 12 }}>
                      No log entries match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ReportingLayer() {
  const [activeTab, setActiveTab] = useState<"sar" | "audit">("sar");

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: C.sans, color: C.textPrimary, position: "relative", overflowX: "hidden" }}>
        <GridOverlay />

        <div style={{ position: "relative", zIndex: 1, padding: "24px 28px 36px" }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 7 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 11,
                background: "linear-gradient(135deg, rgba(0,212,255,0.18), rgba(0,143,181,0.28))",
                border: "1px solid rgba(0,212,255,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19,
                boxShadow: "0 0 18px rgba(0,212,255,0.2)",
              }}>
                🛡
              </div>
              <div>
                <h1 style={{ color: C.textPrimary, fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", fontFamily: C.sans }}>
                  Reporting Layer
                </h1>
                <p style={{ color: C.textSub, fontSize: 11, fontFamily: C.mono, marginTop: 2 }}>
                  Comprehensive reporting, SAR management, and audit trail monitoring
                </p>
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{
            display: "flex", gap: 4, marginBottom: 26,
            background: C.surface, borderRadius: 11, padding: 4,
            width: "fit-content", border: `1px solid ${C.border}`,
          }}>
            {(["sar", "audit"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 700, fontFamily: C.sans,
                display: "flex", alignItems: "center", gap: 7, transition: "all 0.2s",
                background: activeTab === tab ? "linear-gradient(135deg,#0a9fd4,#0065b3)" : "transparent",
                color:      activeTab === tab ? "#fff" : C.textSub,
                boxShadow:  activeTab === tab ? "0 0 16px rgba(0,130,200,0.35)" : "none",
              }}>
                <span>{tab === "sar" ? "📄" : "📊"}</span>
                {tab === "sar" ? "SAR Reports" : "Audit Logs"}
              </button>
            ))}
          </div>

          {/* ── Tab Content ── */}
          {activeTab === "sar" ? <SARTab /> : <AuditTab />}
        </div>
      </div>
    </>
  );
}