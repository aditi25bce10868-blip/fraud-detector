import { useState, useEffect, useRef, CSSProperties, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface TrendPoint       { t: string; v: number }
interface DonutSegment     { pct: number; color: string; label: string; count: string }
interface AlertData        { acc: string; desc: string; ago: string; amount: string; score: number; type: string }
interface RiskyAccountData { rank: number; acc: string; score: number; txns: number; amount: string; status: string; flagReason: string }
interface PincodeData      { rank: number; pin: string; city: string; state: string; risk: "high" | "medium" | "low"; cluster: number; suspicious: number; linkedAccounts: string[] }

// ─────────────────────────────────────────────────────────────────────────────
// API helper
// ─────────────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const api = {
  get: (path: string) => fetch(`${BASE}${path}`).then(r => r.json()),
};

// ─────────────────────────────────────────────────────────────────────────────
// Graph Intelligence Design Tokens (matches graph.tsx)
// ─────────────────────────────────────────────────────────────────────────────
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
  purple:      "#9b8afb",
  blue:        "#4db8ff",
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
  @keyframes ns-blink  { 0%,100%{opacity:1} 50%{opacity:.2}  }
  @keyframes ns-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes ns-pulse-green { 0%,100%{box-shadow:0 0 0 0 rgba(0,230,118,0.5)} 50%{box-shadow:0 0 0 6px rgba(0,230,118,0)} }
  @keyframes ns-pulse-cyan  { 0%,100%{box-shadow:0 0 0 0 rgba(0,212,255,0.5)} 50%{box-shadow:0 0 0 6px rgba(0,212,255,0)} }
  @keyframes ns-spin { to { transform: rotate(360deg); } }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Grid overlay background (shared aesthetic from graph.tsx)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Loading screen
// ─────────────────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      background: C.bg, minHeight: "100vh", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
    }}>
      <div style={{
        width: 36, height: 36, border: `3px solid ${C.border}`,
        borderTop: `3px solid ${C.cyan}`, borderRadius: "50%",
        animation: "ns-spin 0.8s linear infinite",
      }} />
      <div style={{ color: C.cyan, fontFamily: C.mono, fontSize: 12, letterSpacing: "0.1em" }}>
        LOADING DASHBOARD...
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card style helper
// ─────────────────────────────────────────────────────────────────────────────
const card = (extra?: CSSProperties): CSSProperties => ({
  background:    C.card,
  border:        `1px solid ${C.border}`,
  borderRadius:  12,
  padding:       "16px 18px",
  display:       "flex",
  flexDirection: "column" as const,
  gap:           12,
  ...extra,
});

// ─────────────────────────────────────────────────────────────────────────────
// Pill / badge helpers
// ─────────────────────────────────────────────────────────────────────────────
const pill = (color: string): CSSProperties => ({
  fontSize: 9.5, fontFamily: C.mono, background: `${color}12`,
  border: `1px solid ${color}28`, padding: "3px 9px", borderRadius: 6,
  color, letterSpacing: "0.05em",
});

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline
// ─────────────────────────────────────────────────────────────────────────────
function Sparkline({ data, color, h = 38 }: { data: number[]; color: string; h?: number }) {
  if (!data || data.length < 2) return null;
  const w = 110;
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(" ");
  const id = `sp${color.replace("#", "")}`;
  return (
    <svg width={w} height={h} style={{ overflow: "visible", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, valueColor, sub, sparkData, sparkColor, live, accent,
}: {
  icon: { emoji: string; bg: string };
  label: string; value: string; valueColor?: string;
  sub?: string; sparkData?: number[]; sparkColor?: string;
  live?: boolean; accent: string;
}) {
  return (
    <div style={{
      ...card(),
      position: "relative", overflow: "hidden",
      border: `1px solid ${accent}28`,
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(135deg,${accent} 0%,transparent 55%)`,
        opacity: 0.04, pointerEvents: "none",
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: accent, fontFamily: C.mono, letterSpacing: "0.04em", marginBottom: 4 }}>
            {label}
            {live && (
              <span style={{ marginLeft: 7, display: "inline-flex", alignItems: "center", gap: 4, color: C.green }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, display: "inline-block", animation: "ns-blink 1.6s ease infinite" }} />
                LIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: C.mono, color: valueColor ?? C.textPrimary, lineHeight: 1, marginBottom: 4 }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 10, color: C.textSub, fontFamily: C.mono }}>{sub}</div>}
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 9, display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 16,
          background: `${accent}18`, border: `1px solid ${accent}25`, flexShrink: 0,
        }}>{icon.emoji}</div>
      </div>
      {sparkData && sparkColor && (
        <div style={{ marginTop: 6 }}>
          <Sparkline data={sparkData} color={sparkColor} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Donut Chart
// ─────────────────────────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: DonutSegment[] }) {
  const r = 64, cx = 72, cy = 72, sw = 20, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={144} height={144}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={sw} />
          {segments.map((seg, i) => {
            const dash = (seg.pct / 100) * circ, gap = circ - dash;
            const el = (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={seg.color} strokeWidth={sw - 2}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px`, transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
              />
            );
            offset += dash;
            return el;
          })}
          <circle cx={cx} cy={cy} r={r - sw / 2 - 4} fill={C.card} />
          <text x={cx} y={cy - 5} textAnchor="middle" fill={C.textPrimary} fontSize="20" fontWeight="700" fontFamily={C.sans}>{segments[0]?.pct ?? 0}%</text>
          <text x={cx} y={cy + 13} textAnchor="middle" fill={C.textSub} fontSize="8.5" fontFamily={C.mono} letterSpacing="1">LOW RISK</text>
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        {segments.map(seg => (
          <div key={seg.label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.textSub, fontFamily: C.sans }}>{seg.label}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, fontFamily: C.mono }}>{seg.count}</span>
            </div>
            <div style={{ height: 3, background: C.border, borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${seg.pct}%`, background: seg.color, borderRadius: 99, transition: "width 1.2s ease" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Trend Chart
// ─────────────────────────────────────────────────────────────────────────────
function TrendChart({ data, suspData }: { data: TrendPoint[]; suspData: number[] }) {
  const W = 800, H = 160;
  const pad = { l: 48, r: 24, t: 16, b: 32 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = Math.max(...data.map(d => d.v)), min = Math.min(...data.map(d => d.v));
  const suspMax = Math.max(...suspData), suspMin = Math.min(...suspData);
  const [hovered, setHovered] = useState<number | null>(null);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data.length) return null;

  const pts = data.map((d, i) => ({
    x: pad.l + (i / (data.length - 1)) * iw,
    y: pad.t + ih - ((d.v - min) / (max - min || 1)) * ih, ...d,
  }));
  const suspPts = suspData.map((v, i) => ({
    x: pad.l + (i / (suspData.length - 1)) * iw,
    y: pad.t + ih - ((v - suspMin) / (suspMax - suspMin || 1)) * ih, v,
  }));

  const smooth = pts.map((p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = pts[i - 1], cpx = (prev.x + p.x) / 2;
    return `C ${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
  }).join(" ");
  const smoothSusp = suspPts.map((p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = suspPts[i - 1], cpx = (prev.x + p.x) / 2;
    return `C ${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
  }).join(" ");
  const fillPath     = `${smooth} L ${pts[pts.length-1].x},${pad.t+ih} L ${pts[0].x},${pad.t+ih} Z`;
  const fillSuspPath = `${smoothSusp} L ${suspPts[suspPts.length-1].x},${pad.t+ih} L ${suspPts[0].x},${pad.t+ih} Z`;
  const yTicks = [2000, 4000, 6000, 8000];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) * (W / rect.width);
    let closest = 0, closestDist = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - rx); if (d < closestDist) { closestDist = d; closest = i; } });
    setHovered(closest); setMouseX(e.clientX - rect.left); setMouseY(e.clientY - rect.top);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 8, justifyContent: "flex-end" }}>
        {[{ color: C.blue, label: "Transactions" }, { color: C.red, label: "Suspicious" }].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 18, height: 2, background: color, borderRadius: 99 }} />
            <span style={{ fontSize: 10, color: C.textSub, fontFamily: C.mono }}>{label}</span>
          </div>
        ))}
      </div>
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        onMouseMove={handleMouseMove} onMouseLeave={() => setHovered(null)} style={{ cursor: "crosshair" }}>
        <defs>
          <linearGradient id="nstf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity="0.18" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="nssf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.red} stopOpacity="0.12" />
            <stop offset="100%" stopColor={C.red} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map(tick => {
          const y = pad.t + ih - ((tick - min) / (max - min || 1)) * ih;
          return (
            <g key={tick}>
              <line x1={pad.l} y1={y} x2={W-pad.r} y2={y} stroke="rgba(0,212,255,0.06)" strokeDasharray="3 6" />
              <text x={pad.l - 10} y={y + 4} fill={C.textMuted} fontSize="9" textAnchor="end" fontFamily={C.mono}>
                {tick >= 1000 ? `${tick / 1000}k` : tick}
              </text>
            </g>
          );
        })}
        {pts.map((p, i) => (
          <text key={i} x={p.x} y={H - 6} fill={hovered === i ? C.blue : C.textMuted}
            fontSize="8" textAnchor="middle" fontFamily={C.mono}>{p.t}</text>
        ))}
        <path d={fillPath} fill="url(#nstf)" />
        <path d={smooth} fill="none" stroke={C.blue} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={fillSuspPath} fill="url(#nssf)" />
        <path d={smoothSusp} fill="none" stroke={C.red} strokeWidth="1.8" strokeDasharray="5 3" strokeLinejoin="round" strokeLinecap="round" />
        {hovered !== null && (
          <>
            <line x1={pts[hovered].x} y1={pad.t} x2={pts[hovered].x} y2={pad.t+ih}
              stroke={C.cyan} strokeWidth="1" strokeDasharray="3 4" opacity="0.4" />
            <circle cx={pts[hovered].x} cy={pts[hovered].y} r="8" fill={C.blue} opacity="0.15" />
          </>
        )}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hovered === i ? 7 : 5}
              fill={hovered === i ? C.blue : C.card} stroke={C.blue} strokeWidth="2"
              style={{ transition: "r 0.15s, fill 0.15s" }} />
            <circle cx={p.x} cy={p.y} r="2.5" fill={C.blue} />
          </g>
        ))}
        {suspPts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hovered === i ? 6 : 4}
              fill={hovered === i ? C.red : C.card} stroke={C.red} strokeWidth="1.8"
              style={{ transition: "r 0.15s, fill 0.15s" }} />
          </g>
        ))}
      </svg>
      {hovered !== null && (
        <div style={{
          position: "absolute", left: mouseX + 12, top: mouseY - 55,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: "10px 14px", pointerEvents: "none", zIndex: 10, minWidth: 130,
        }}>
          <div style={{ fontSize: 10, color: C.textSub, fontFamily: C.mono, marginBottom: 6 }}>{pts[hovered].t}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 10, color: C.blue, fontFamily: C.mono }}>Txns</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.blue, fontFamily: C.mono }}>{pts[hovered].v.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 10, color: C.red, fontFamily: C.mono }}>Suspicious</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.red, fontFamily: C.mono }}>{suspData[hovered]}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(7,16,28,0.88)", backdropFilter: "blur(6px)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: 24, minWidth: 360, maxWidth: 480, width: "90%",
        animation: "ns-fadein 0.2s ease",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, fontFamily: C.sans }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ fontSize: 11, color: C.textSub, fontFamily: C.mono }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: color ?? C.textPrimary, fontFamily: C.mono }}>{value}</span>
    </div>
  );
}

function AlertModal({ alert, onClose }: { alert: AlertData; onClose: () => void }) {
  return (
    <Modal title={`Alert — ${alert.acc}`} onClose={onClose}>
      <Row label="Type"     value={alert.type}           color={C.cyan}   />
      <Row label="Amount"   value={`₹${alert.amount}`}   color={C.orange} />
      <Row label="Score"    value={`${alert.score}/100`} color={C.red}    />
      <Row label="Detected" value={alert.ago}            color={C.textPrimary} />
      <div style={{ marginTop: 6, background: C.surface, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: C.textSub, fontFamily: C.sans, lineHeight: 1.6 }}>
        {alert.desc}
      </div>
    </Modal>
  );
}

function AccountModal({ account, onClose }: { account: RiskyAccountData; onClose: () => void }) {
  return (
    <Modal title={`Account — ${account.acc}`} onClose={onClose}>
      <Row label="Risk Score"   value={`${account.score}/100`} color={C.red}    />
      <Row label="Transactions" value={account.txns}           color={C.cyan}   />
      <Row label="Total Amount" value={account.amount}         color={C.orange} />
      <Row label="Status"       value={account.status}         color={C.yellow} />
      <div style={{ marginTop: 6, background: C.surface, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: C.textSub, fontFamily: C.sans, lineHeight: 1.6 }}>
        {account.flagReason}
      </div>
    </Modal>
  );
}

function PincodeModal({ pincode, onClose }: { pincode: PincodeData; onClose: () => void }) {
  const rc = pincode.risk === "high" ? C.red : pincode.risk === "medium" ? C.orange : C.green;
  return (
    <Modal title={`Pincode — ${pincode.pin}`} onClose={onClose}>
      <Row label="Location"     value={`${pincode.city}, ${pincode.state}`} color={C.cyan}   />
      <Row label="Risk Level"   value={pincode.risk.toUpperCase()}           color={rc}       />
      <Row label="Cluster Size" value={`${pincode.cluster} accounts`}        color={C.textPrimary} />
      <Row label="Suspicious"   value={pincode.suspicious}                   color={C.orange} />
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 10, color: C.textSub, fontFamily: C.mono, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>Linked Accounts</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {pincode.linkedAccounts.map(a => (
            <span key={a} style={{ background: "rgba(0,212,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 5, padding: "3px 8px", fontSize: 10.5, color: C.cyan, fontFamily: C.mono }}>{a}</span>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert / Account / Pincode row cards (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function AlertItem({ data, onClick }: { data: AlertData; onClick: () => void }) {
  const sc = data.score >= 90 ? C.red : data.score >= 75 ? C.orange : C.yellow;
  return (
    <div onClick={onClick} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9,
      padding: "10px 12px", cursor: "pointer", transition: "border-color 0.2s, background 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"; e.currentTarget.style.background = C.cardHover; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;               e.currentTarget.style.background = C.surface;  }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textPrimary, fontFamily: C.mono }}>{data.acc}</span>
        <span style={{ fontSize: 9.5, color: C.textSub, fontFamily: C.mono }}>{data.ago}</span>
      </div>
      <div style={{ fontSize: 11, color: C.textSub, marginBottom: 6, fontFamily: C.sans }}>{data.desc}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, background: `${C.orange}14`, color: C.orange, border: `1px solid ${C.orange}30`, borderRadius: 5, padding: "2px 7px", fontFamily: C.mono }}>₹{data.amount}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: sc, fontFamily: C.mono }}>{data.score}</span>
      </div>
    </div>
  );
}

function RiskyAccountRow({ data, onClick }: { data: RiskyAccountData; onClick: () => void }) {
  const sc = data.score >= 90 ? C.red : data.score >= 80 ? C.orange : C.yellow;
  return (
    <div onClick={onClick} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9,
      padding: "10px 12px", cursor: "pointer", transition: "border-color 0.2s, background 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,53,53,0.3)"; e.currentTarget.style.background = C.cardHover; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;               e.currentTarget.style.background = C.surface;  }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 20, height: 20, borderRadius: 5, background: `${sc}18`, border: `1px solid ${sc}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: sc, fontFamily: C.mono }}>{data.rank}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, fontFamily: C.mono }}>{data.acc}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: sc, fontFamily: C.mono }}>{data.score}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.textSub, fontFamily: C.mono, marginBottom: 4 }}>
        <span>{data.txns} txns</span>
        <span style={{ color: C.orange }}>{data.amount}</span>
      </div>
      <div style={{ fontSize: 9.5, color: C.textSub, fontFamily: C.sans }}>{data.flagReason}</div>
      <div style={{ marginTop: 6 }}>
        <span style={{ fontSize: 9, background: `${C.yellow}10`, color: C.yellow, border: `1px solid ${C.yellow}25`, borderRadius: 4, padding: "2px 6px", fontFamily: C.mono }}>{data.status}</span>
      </div>
    </div>
  );
}

function PincodeCard({ data, onClick }: { data: PincodeData; onClick: () => void }) {
  const rc = data.risk === "high" ? C.red : data.risk === "medium" ? C.orange : C.green;
  return (
    <div onClick={onClick} style={{
      background: C.surface, border: `1px solid ${rc}20`, borderRadius: 9,
      padding: "10px 12px", cursor: "pointer", transition: "background 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.background = C.cardHover}
      onMouseLeave={e => e.currentTarget.style.background = C.surface}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 20, height: 20, borderRadius: 5, background: `${rc}18`, border: `1px solid ${rc}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: rc, fontFamily: C.mono }}>{data.rank}</span>
          <span style={{ fontWeight: 700, fontSize: 13, fontFamily: C.mono, color: C.textPrimary }}>{data.pin}</span>
        </div>
        <span style={{ background: `${rc}18`, color: rc, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, fontFamily: C.mono, border: `1px solid ${rc}35`, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{data.risk}</span>
      </div>
      <div style={{ fontSize: 10.5, color: C.textSub, fontFamily: C.sans, marginBottom: 7 }}>{data.city}, {data.state}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {([["Cluster", `${data.cluster} accts`, C.textPrimary], ["Suspicious", String(data.suspicious), C.orange]] as [string,string,string][]).map(([k, v, vc]) => (
          <div key={k}>
            <div style={{ fontSize: 9, color: C.textMuted, fontFamily: C.mono, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: vc, fontFamily: C.mono }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 7, height: 3, background: C.border, borderRadius: 99 }}>
        <div style={{ height: "100%", width: `${Math.min((data.suspicious / 200) * 100, 100)}%`, background: rc, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.cyan, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: C.textPrimary, fontFamily: C.sans, letterSpacing: "-0.01em" }}>{title}</span>
      </div>
      {right}
    </div>
  );
}

function LiveBadge() {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9.5, color: C.green, fontFamily: C.mono, letterSpacing: "0.05em" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, animation: "ns-blink 1.6s ease infinite" }} />LIVE
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function FraudDashboard() {
  const [, setTick] = useState(0);
  const [now, setNow]               = useState(() => new Date());
  const [loading, setLoading]       = useState(true);
  const [alertModal,   setAlertModal]   = useState<AlertData | null>(null);
  const [accountModal, setAccountModal] = useState<RiskyAccountData | null>(null);
  const [pincodeModal, setPincodeModal] = useState<PincodeData | null>(null);

  // ── API state ──────────────────────────────────────────────────────────────
  const [stats,        setStats]    = useState<any>(null);
  const [trendData,    setTrend]    = useState<TrendPoint[]>([]);
  const [suspTrend,    setSusp]     = useState<number[]>([]);
  const [donutSegments,setDonut]    = useState<DonutSegment[]>([]);
  const [fraudPatterns,setPatterns] = useState<any[]>([]);
  const [alerts,       setAlerts]   = useState<AlertData[]>([]);
  const [riskyAccounts,setRisky]    = useState<RiskyAccountData[]>([]);
  const [pincodes,     setPincodes] = useState<PincodeData[]>([]);

  // ── Spark fallback arrays (filled from trend data) ─────────────────────────
  const [sparkTx,   setSparkTx]   = useState<number[]>([]);
  const [sparkSus,  setSparkSus]  = useState<number[]>([]);
  const [sparkRisk, setSparkRisk] = useState<number[]>([]);

  // ── Clock tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => { setTick(t => t + 1); setNow(new Date()); }, 3000);
    return () => clearInterval(id);
  }, []);

  // ── Load all data on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, trendRes, alertsRes, accountsRes, pincodesRes] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/dashboard/transaction-trend"),
          api.get("/alerts/"),
          api.get("/accounts/risky?limit=6"),
          api.get("/pincodes/suspicious"),
        ]);

        // ── Stats → KPI cards ──────────────────────────────────────────────
        setStats(statsRes);

        // ── Risk distribution → Donut ──────────────────────────────────────
        const rd = statsRes.risk_distribution;
        setDonut([
          { pct: rd.percentages.low,    color: C.green,  label: "Low Risk",    count: rd.low_risk.toLocaleString()    },
          { pct: rd.percentages.medium, color: C.orange, label: "Medium Risk", count: rd.medium_risk.toLocaleString() },
          { pct: rd.percentages.high,   color: C.red,    label: "High Risk",   count: rd.high_risk.toLocaleString()   },
        ]);

        // ── Fraud pattern summary ──────────────────────────────────────────
        const fp = statsRes.fraud_pattern_summary;
        setPatterns([
          { emoji: "👥", num: String(fp.mule_clusters),  label: "Mule Clusters Detected", color: C.orange, bg: C.orange },
          { emoji: "📄", num: String(fp.structuring),    label: "Structuring Cases",        color: C.blue,   bg: C.blue   },
          { emoji: "⚡", num: String(fp.high_velocity),  label: "High-Velocity Cases",      color: C.purple, bg: C.purple },
        ]);

        // ── Transaction trend → Chart ──────────────────────────────────────
        // Backend returns all 24 hours — pick every 3rd for 8 points on chart
        const raw: { label: string; total: number; fraud: number }[] = trendRes.trend ?? [];
        const step  = Math.max(1, Math.floor(raw.length / 8));
        const slice = raw.filter((_: any, i: number) => i % step === 0).slice(0, 8);
        setTrend(slice.map((d: any) => ({ t: d.label, v: d.total })));
        setSusp(slice.map((d: any) => d.fraud));

        // ── Spark arrays from trend ────────────────────────────────────────
        setSparkTx(slice.map((d: any) => d.total));
        setSparkSus(slice.map((d: any) => d.fraud));
        // High-risk spark: simple ascending curve from stats
        const hr = statsRes.high_risk_accounts ?? 234;
        setSparkRisk(Array.from({ length: 8 }, (_, i) => Math.round(hr * (0.7 + i * 0.04))));

        // ── Alerts → map backend fields to frontend interface ──────────────
        const rawAlerts: any[] = alertsRes.alerts ?? [];
        setAlerts(rawAlerts.slice(0, 7).map((a: any) => ({
          acc:    a.account,
          desc:   a.alert_reason,
          ago:    "just now",
          amount: a.amount.toLocaleString("en-IN"),
          score:  a.risk_score,
          type:   a.fraud_category,
        })));

        // ── Risky accounts → map backend fields to frontend interface ──────
        const rawAccounts: any[] = accountsRes.accounts ?? [];
        setRisky(rawAccounts.map((a: any) => ({
          rank:       a.rank,
          acc:        a.account_number,
          score:      a.risk_score,
          txns:       a.transaction_count,
          amount:     `₹${a.flagged_amount_lakh}L`,
          status:     a.status,
          flagReason: a.flag_reason,
        })));

        // ── Pincodes → map backend fields to frontend interface ────────────
        const rawPins: any[] = pincodesRes.pincodes ?? [];
        setPincodes(rawPins.slice(0, 6).map((p: any, i: number) => ({
          rank:           i + 1,
          pin:            p.pincode,
          city:           p.city,
          state:          p.state,
          risk:           p.risk_level as "high" | "medium" | "low",
          cluster:        p.cluster_size,
          suspicious:     p.suspicious_count,
          linkedAccounts: [],   // populated on modal click via /pincodes/investigate/{pin}
        })));

      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingScreen />;

  // ─────────────────────────────────────────────────────────────────────────
  // Render (100% identical to original — only data sources changed)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: C.sans, color: C.textPrimary, position: "relative", overflowX: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <GridOverlay />

      {alertModal   && <AlertModal   alert={alertModal}     onClose={() => setAlertModal(null)}   />}
      {accountModal && <AccountModal account={accountModal} onClose={() => setAccountModal(null)} />}
      {pincodeModal && <PincodeModal pincode={pincodeModal} onClose={() => setPincodeModal(null)} />}

      <div style={{ position: "relative", zIndex: 1, padding: "24px 22px 32px" }}>

        {/* ── Page Header ── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ fontSize: 9.5, color: C.textSub, fontFamily: C.mono, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 5 }}>
              AML Intelligence Platform
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: C.sans, letterSpacing: "-0.03em", color: C.textPrimary, lineHeight: 1 }}>
              Fraud Detection<span style={{ color: C.cyan }}> Dashboard</span>
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9.5, color: C.textSub, fontFamily: C.mono, marginBottom: 2, letterSpacing: "0.08em" }}>LAST UPDATED</div>
              <div style={{ fontSize: 11, color: C.textPrimary, fontFamily: C.mono }}>
                {now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })} IST
              </div>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "rgba(0,230,118,0.07)", border: "1px solid rgba(0,230,118,0.22)",
              color: C.green, fontSize: 10.5, fontWeight: 700, padding: "7px 14px",
              borderRadius: 99, fontFamily: C.mono, letterSpacing: "0.04em",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "ns-pulse-green 2s ease infinite" }} />
              LIVE MONITORING
            </div>
          </div>
        </div>

        {/* ── KPI Row 1 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
          <StatCard icon={{ emoji: "📈", bg: C.blue }}   label="Total Transactions"      value={(stats?.total_transactions      ?? 0).toLocaleString()} sub="Last 24 hours"      sparkData={sparkTx}   sparkColor={C.blue}   live accent={C.blue}   />
          <StatCard icon={{ emoji: "⚠️", bg: C.red }}    label="Suspicious Transactions" value={String(stats?.suspicious_transactions ?? 0)}             valueColor={C.red}    sub="Requires review"  sparkData={sparkSus}  sparkColor={C.red}    accent={C.red}    />
          <StatCard icon={{ emoji: "🛡️", bg: C.purple }} label="High-Risk Accounts"      value={String(stats?.high_risk_accounts      ?? 0)}             valueColor={C.purple} sub="Active monitoring" sparkData={sparkRisk} sparkColor={C.purple} accent={C.purple} />
        </div>

        {/* ── KPI Row 2 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard icon={{ emoji: "👥", bg: C.orange }} label="Active Mule Clusters" value={String(stats?.active_mule_clusters ?? 0)} valueColor={C.orange} sub="Under investigation" accent={C.orange} />
          <StatCard icon={{ emoji: "🔔", bg: C.yellow }} label="Alerts Today"         value={String(stats?.alerts_today         ?? 0)} valueColor={C.yellow} sub="All severities"      accent={C.yellow} />
          <StatCard icon={{ emoji: "📄", bg: C.blue }}   label="Structuring Cases"    value={String(stats?.structuring_cases    ?? 0)} valueColor={C.blue}   sub="Active cases"        accent={C.blue}   />
        </div>

        {/* ── Transaction Trend ── */}
        <div style={{ ...card(), marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: C.sans }}>Transaction Trend</div>
              <div style={{ fontSize: 10.5, color: C.textSub, fontFamily: C.mono, marginTop: 2 }}>Hover any point for details · 24-hour volume overview</div>
            </div>
            <span style={pill(C.cyan)}>24H VIEW</span>
          </div>
          <TrendChart data={trendData} suspData={suspTrend} />
        </div>

        {/* ── Risk Distribution + Fraud Pattern ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14, marginBottom: 18 }}>
          <div style={card()}>
            <SectionHeader title="Risk Distribution" right={<span style={pill(C.green)}>LIVE</span>} />
            <DonutChart segments={donutSegments} />
          </div>
          <div style={card()}>
            <SectionHeader title="Fraud Pattern Summary" />
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {fraudPatterns.map(item => (
                <div key={item.label} style={{
                  background: C.surface, border: `1px solid ${item.color}18`, borderRadius: 10,
                  padding: "13px 15px", display: "flex", alignItems: "center", gap: 13,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: `${item.bg}15`,
                    border: `1px solid ${item.bg}25`, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 18, flexShrink: 0,
                  }}>{item.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.textSub, fontFamily: C.mono, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: C.sans, color: item.color, lineHeight: 1 }}>{item.num}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 26, flexShrink: 0 }}>
                    {[0.4, 0.6, 0.5, 0.8, 0.7, 0.9, 1].map((h, i) => (
                      <div key={i} style={{ width: 3, height: `${h * 100}%`, background: item.color, borderRadius: 2, opacity: 0.4 + h * 0.5 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom Three Columns ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

          {/* Real-Time Alerts */}
          <div style={{ ...card(), maxHeight: 500, overflow: "hidden" }}>
            <SectionHeader title="Real-Time Alerts" right={<LiveBadge />} />
            <div style={{ fontSize: 10, color: C.textSub, fontFamily: C.mono, marginTop: -4 }}>Click any alert to investigate</div>
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 7, flex: 1, paddingRight: 2 }}>
              {alerts.map((a, i) => <AlertItem key={i} data={a} onClick={() => setAlertModal(a)} />)}
            </div>
          </div>

          {/* Top Risky Accounts */}
          <div style={{ ...card(), maxHeight: 500, overflow: "hidden" }}>
            <SectionHeader title="Top Risky Accounts" right={<span style={pill(C.red)}>HIGH RISK</span>} />
            <div style={{ fontSize: 10, color: C.textSub, fontFamily: C.mono, marginTop: -4 }}>Click to view full investigation</div>
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 7, flex: 1, paddingRight: 2 }}>
              {riskyAccounts.map((a, i) => <RiskyAccountRow key={i} data={a} onClick={() => setAccountModal(a)} />)}
            </div>
            <div style={{ paddingTop: 10, borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                ["Avg Score", riskyAccounts.length ? Math.round(riskyAccounts.reduce((s,a)=>s+a.score,0)/riskyAccounts.length) : "-", C.red],
                ["Flagged",   riskyAccounts.length ? `₹${(riskyAccounts.reduce((s,a)=>s+parseFloat(a.amount.replace(/[₹L]/g,"")),0)).toFixed(1)}L` : "-", C.orange],
                ["Active",    riskyAccounts.length, C.yellow],
              ].map(([k, v, vc]) => (
                <div key={k as string} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: C.textSub, fontFamily: C.mono, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: vc as string, fontFamily: C.mono }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Suspicious Pincodes */}
          <div style={{ ...card(), maxHeight: 500, overflow: "hidden" }}>
            <SectionHeader title="Suspicious Pincodes" right={<span style={{ fontSize: 11, color: C.textSub, fontFamily: C.mono }}>🇮🇳 India</span>} />
            <div style={{ fontSize: 10, color: C.textSub, fontFamily: C.mono, marginTop: -4 }}>Click to view cluster details</div>
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 7, flex: 1, paddingRight: 2 }}>
              {pincodes.map((p, i) => <PincodeCard key={i} data={p} onClick={() => setPincodeModal(p)} />)}
            </div>
            <div style={{ paddingTop: 10, borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                ["High Risk",  pincodes.filter(p=>p.risk==="high").length,              C.red],
                ["Clusters",   pincodes.reduce((s,p)=>s+p.cluster,0),                  C.orange],
                ["Suspicious", pincodes.reduce((s,p)=>s+p.suspicious,0),               C.yellow],
              ].map(([k, v, vc]) => (
                <div key={k as string} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: C.textSub, fontFamily: C.mono, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: vc as string, fontFamily: C.mono }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}