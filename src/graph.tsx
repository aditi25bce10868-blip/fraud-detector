import { useState } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@400;600;700;800&display=swap');
  @keyframes pg  { 0%,100%{box-shadow:0 0 0 0 rgba(0,230,118,0.5);} 50%{box-shadow:0 0 0 6px rgba(0,230,118,0);} }
  @keyframes pgc { 0%,100%{box-shadow:0 0 0 0 rgba(0,212,255,0.5);} 50%{box-shadow:0 0 0 6px rgba(0,212,255,0);} }
  @keyframes slidedown { from{opacity:0;transform:translateY(-6px);} to{opacity:1;transform:none;} }
  .pulsedot   { animation:pg  2s infinite; }
  .pulsedot-c { animation:pgc 2s infinite; }
  .rc:hover  { border-color:rgba(255,53,53,0.45)!important; transform:translateX(3px); }
  .roc:hover { border-color:#008fb5!important; }
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:#0b1628;}
  ::-webkit-scrollbar-thumb{background:#1a2e48;border-radius:2px;}
`;

// ─── DEMO DATA ────────────────────────────────────────────────────────────────

const KPI = {
  fraud_detection_rate: { value:87.4, unit:"%",  trend:"+2.1% improvement",  label:"Fraud Detection Rate" },
  false_positive_rate:  { value:12.6, unit:"%",  trend:"-0.8% last week",    label:"False Positive Rate"  },
  total_flagged_today:  { value:1847,  unit:"",   trend:"+134 since yesterday",label:"Total Flagged Today"  },
  transactions_today:   { value:3.5,  unit:"K",  trend:"+5.1% vs last week", label:"Transactions Today"   },
};

const CITIES = [
  { city:"Mumbai",    total_transactions:4820, fraud_count:312, fraud_rate_pct:6.47, risk_label:"High"   as const, bar_width_pct:100,  categories:[{n:"UPI Fraud",c:142},{n:"Card Skimming",c:89},{n:"Mule Network",c:51}], topAccts:[{a:"XXXX2584",r:94.2,f:18},{a:"XXXX7731",r:88.7,f:14}] },
  { city:"Delhi",     total_transactions:4210, fraud_count:244, fraud_rate_pct:5.80, risk_label:"High"   as const, bar_width_pct:89.6, categories:[{n:"Mule Network",c:108},{n:"UPI Fraud",c:76},{n:"Structuring",c:60}],  topAccts:[{a:"XXXX5510",r:91.0,f:16},{a:"XXXX8392",r:85.4,f:12}] },
  { city:"Bangalore", total_transactions:3910, fraud_count:187, fraud_rate_pct:4.78, risk_label:"High"   as const, bar_width_pct:73.9, categories:[{n:"Phishing",c:88},{n:"UPI Fraud",c:62},{n:"Card Skimming",c:37}],   topAccts:[{a:"XXXX2640",r:87.2,f:15},{a:"XXXX5431",r:81.0,f:9}]  },
  { city:"Kolkata",   total_transactions:2640, fraud_count:120, fraud_rate_pct:4.54, risk_label:"High"   as const, bar_width_pct:70.2, categories:[{n:"Structuring",c:54},{n:"Mule Network",c:41},{n:"Phishing",c:25}],  topAccts:[{a:"XXXX0700",r:80.1,f:11},{a:"XXXX6756",r:74.3,f:8}]  },
  { city:"Hyderabad", total_transactions:2980, fraud_count:98,  fraud_rate_pct:3.28, risk_label:"High"   as const, bar_width_pct:50.7, categories:[{n:"UPI Fraud",c:47},{n:"Card Skimming",c:31},{n:"Phishing",c:20}],  topAccts:[{a:"XXXX4229",r:76.5,f:9},{a:"XXXX9852",r:70.2,f:6}]   },
  { city:"Chennai",   total_transactions:2100, fraud_count:62,  fraud_rate_pct:2.95, risk_label:"Medium" as const, bar_width_pct:45.6, categories:[{n:"UPI Fraud",c:30},{n:"Structuring",c:20},{n:"Phishing",c:12}],   topAccts:[{a:"XXXX8400",r:64.8,f:7}] },
  { city:"Pune",      total_transactions:1870, fraud_count:49,  fraud_rate_pct:2.62, risk_label:"Medium" as const, bar_width_pct:40.5, categories:[{n:"Card Skimming",c:24},{n:"UPI Fraud",c:16},{n:"Mule Network",c:9}],topAccts:[{a:"XXXX3311",r:61.0,f:6}] },
  { city:"Ahmedabad", total_transactions:1650, fraud_count:38,  fraud_rate_pct:2.30, risk_label:"Medium" as const, bar_width_pct:35.5, categories:[{n:"Structuring",c:18},{n:"UPI Fraud",c:12},{n:"Phishing",c:8}],    topAccts:[{a:"XXXX7720",r:58.3,f:5}] },
  { city:"Surat",     total_transactions:980,  fraud_count:16,  fraud_rate_pct:1.63, risk_label:"Medium" as const, bar_width_pct:25.2, categories:[{n:"UPI Fraud",c:9},{n:"Card Skimming",c:7}],                         topAccts:[{a:"XXXX4490",r:48.1,f:3}] },
  { city:"Jaipur",    total_transactions:760,  fraud_count:8,   fraud_rate_pct:1.05, risk_label:"Low"    as const, bar_width_pct:16.2, categories:[{n:"Phishing",c:5},{n:"UPI Fraud",c:3}],                              topAccts:[{a:"XXXX2210",r:32.4,f:2}] },
  { city:"Lucknow",   total_transactions:690,  fraud_count:6,   fraud_rate_pct:0.87, risk_label:"Low"    as const, bar_width_pct:13.4, categories:[{n:"UPI Fraud",c:4},{n:"Phishing",c:2}],                              topAccts:[{a:"XXXX5501",r:28.7,f:2}] },
  { city:"Nagpur",    total_transactions:540,  fraud_count:4,   fraud_rate_pct:0.74, risk_label:"Low"    as const, bar_width_pct:11.4, categories:[{n:"Card Skimming",c:3},{n:"Phishing",c:1}],                          topAccts:[{a:"XXXX9900",r:22.1,f:1}] },
];

type City = typeof CITIES[0];

const ROUTES_BASE = [
  { route:"Mumbai → Delhi",      total_transactions:1840, fraud_count:184, fraud_rate_pct:10.00, risk_label:"High"   as const },
  { route:"Delhi → Bangalore",   total_transactions:1520, fraud_count:137, fraud_rate_pct:9.01,  risk_label:"High"   as const },
  { route:"Mumbai → Bangalore",  total_transactions:1310, fraud_count:92,  fraud_rate_pct:7.02,  risk_label:"High"   as const },
  { route:"Kolkata → Mumbai",    total_transactions:1100, fraud_count:66,  fraud_rate_pct:6.00,  risk_label:"High"   as const },
  { route:"Hyderabad → Delhi",   total_transactions:890,  fraud_count:38,  fraud_rate_pct:4.27,  risk_label:"High"   as const },
  { route:"Chennai → Mumbai",    total_transactions:740,  fraud_count:24,  fraud_rate_pct:3.24,  risk_label:"High"   as const },
  { route:"Pune → Delhi",        total_transactions:610,  fraud_count:16,  fraud_rate_pct:2.62,  risk_label:"Medium" as const },
  { route:"Ahmedabad → Mumbai",  total_transactions:490,  fraud_count:11,  fraud_rate_pct:2.24,  risk_label:"Medium" as const },
];

// ─── Components ───────────────────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: string }) {
  const m: Record<string, [string,string,string]> = {
    High:   ["rgba(255,53,53,.12)","#ff3535","#b01818"],
    Medium: ["rgba(255,136,0,.12)","#ff8800","#a85500"],
    Low:    ["rgba(0,230,118,.10)","#00e676","#008a3e"],
  };
  const [bg,color,border] = m[risk] ?? m.Low;
  return <span style={{ fontSize:9.5, fontWeight:700, padding:"2px 7px", borderRadius:4,
    fontFamily:"'JetBrains Mono',monospace", background:bg, color, border:`1px solid ${border}` }}>{risk}</span>;
}

function SecHeader({ icon, title, children }: { icon:string; title:string; children?: React.ReactNode }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 0 10px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
        <div className="pulsedot-c" style={{ width:7, height:7, borderRadius:"50%", background:"#00d4ff", flexShrink:0 }} />
        <span style={{ fontSize:15 }}>{icon}</span>
        <span style={{ fontSize:14, fontWeight:800, letterSpacing:-0.1 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function RegionCard({ r, expanded, onToggle }: { r: City; expanded: boolean; onToggle: ()=>void }) {
  const barGrad = r.risk_label==="High" ? "linear-gradient(90deg,#b01818,#ff3535)"
    : r.risk_label==="Medium" ? "linear-gradient(90deg,#a85500,#ff8800)"
    : "linear-gradient(90deg,#007a30,#00e676)";

  return (
    <div className="rc" onClick={onToggle} style={{
      background: expanded ? "rgba(14,26,46,0.95)" : "#0e1a2e",
      borderRadius:11, padding:13, marginBottom:9, cursor:"pointer",
      border: expanded ? "1px solid rgba(0,212,255,0.30)" : "1px solid #1a2e48",
      transition:"border-color .2s,transform .15s",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:7 }}>
            {r.city} <span style={{ fontSize:9, color:"#4a6280" }}>{expanded?"▲":"▼"}</span>
          </div>
          <div style={{ fontSize:10, color:"#4a6280", fontFamily:"'JetBrains Mono',monospace", marginTop:1 }}>
            {r.total_transactions.toLocaleString()} transactions
          </div>
        </div>
        <RiskBadge risk={r.risk_label} />
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}>
        <span style={{ color:"#4a6280" }}>Fraud Rate:</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:"#ff3535" }}>{r.fraud_rate_pct.toFixed(2)}%</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:6 }}>
        <span style={{ color:"#4a6280" }}>Flagged:</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>{r.fraud_count}</span>
      </div>

      <div style={{ height:4, background:"#1a2e48", borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", borderRadius:2, background:barGrad, width:`${r.bar_width_pct}%`, transition:"width .5s" }} />
      </div>

      {expanded && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #1a2e48", animation:"slidedown .18s ease" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
            {([
              ["Avg Tx Value", `₹${(r.total_transactions*0.029).toFixed(1)}K`, "#00d4ff"],
              ["Detection",   `${Math.max(0,100-r.fraud_rate_pct*2.1).toFixed(1)}%`, "#00e676"],
              ["Risk Score",  `${r.bar_width_pct}/100`, r.risk_label==="High"?"#ff3535":r.risk_label==="Medium"?"#ff8800":"#00e676"],
              ["Review Queue",`${Math.round(r.fraud_count*0.4)}`, "#ff8800"],
            ] as [string,string,string][]).map(([lbl,val,col]) => (
              <div key={lbl} style={{ background:"#091528", borderRadius:8, padding:"8px 10px", border:"1px solid #1a2e48" }}>
                <div style={{ fontSize:9, color:"#4a6280", marginBottom:3 }}>{lbl}</div>
                <div style={{ fontSize:15, fontWeight:800, color:col, fontFamily:"'JetBrains Mono',monospace" }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:9, color:"#4a6280", marginBottom:6, fontFamily:"'JetBrains Mono',monospace", letterSpacing:1 }}>FRAUD BY CATEGORY</div>
          {r.categories.map(c => (
            <div key={c.n} style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginBottom:4 }}>
              <span style={{ color:"#8aa0b8" }}>{c.n}</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", color:"#ff8800" }}>{c.c} cases</span>
            </div>
          ))}
          <div style={{ fontSize:9, color:"#4a6280", margin:"10px 0 6px", fontFamily:"'JetBrains Mono',monospace", letterSpacing:1 }}>TOP FLAGGED ACCOUNTS</div>
          {r.topAccts.map(a => (
            <div key={a.a} style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginBottom:4 }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", color:"#dce8f2" }}>{a.a}</span>
              <span style={{ color:"#ff3535", fontFamily:"'JetBrains Mono',monospace" }}>{a.r}% risk · {a.f} frauds</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RouteCard({ route, rank }: { route: typeof ROUTES_BASE[0]; rank: number }) {
  const maxVol = ROUTES_BASE[0].total_transactions;
  const volPct = Math.round(route.total_transactions / maxVol * 100);
  return (
    <div className="roc" style={{
      background:"#0e1a2e", borderRadius:11, padding:13, marginBottom:9,
      transition:"border-color .2s",
      border: route.risk_label==="High" ? "1px solid rgba(255,53,53,.25)" : "1px solid #1a2e48",
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:9, marginBottom:7 }}>
        <div style={{ width:24, height:24, borderRadius:"50%", background:"#122035", border:"1px solid #1a2e48",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:10, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:"#00d4ff", flexShrink:0 }}>{rank}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
            {route.route}
            {route.risk_label==="High" && (
              <span style={{ fontSize:8, fontWeight:700, padding:"1px 5px", borderRadius:4,
                fontFamily:"'JetBrains Mono',monospace", background:"rgba(255,53,53,.12)", color:"#ff3535", border:"1px solid #b01818" }}>⚠ High</span>
            )}
          </div>
          <div style={{ fontSize:10, color:"#4a6280", fontFamily:"'JetBrains Mono',monospace", marginTop:1 }}>
            {route.total_transactions.toLocaleString()} transactions
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, fontFamily:"'JetBrains Mono',monospace" }}>{route.fraud_count}</div>
          <div style={{ fontSize:9, color:"#4a6280" }}>flagged</div>
        </div>
      </div>
      <div style={{ height:3, background:"#1a2e48", borderRadius:2, overflow:"hidden", marginBottom:4 }}>
        <div style={{ height:"100%", borderRadius:2,
          background: route.risk_label==="High" ? "#ff8800" : "#00d4ff", width:`${volPct}%` }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#4a6280", fontFamily:"'JetBrains Mono',monospace" }}>
        <span>{volPct}% of max volume</span>
        <span style={{ color: route.risk_label==="High" ? "#ff3535" : "inherit" }}>{route.fraud_rate_pct.toFixed(2)}% fraud rate</span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FraudDashboard() {
  const [riskFilter,     setRiskFilter]     = useState("All");
  const [routeSort,      setRouteSort]      = useState("volume");
  const [expandedRegion, setExpandedRegion] = useState<string|null>(null);

  const filteredCities = riskFilter === "All" ? CITIES : CITIES.filter(c => c.risk_label === riskFilter);

  const sortedRoutes = [...ROUTES_BASE].sort((a, b) =>
    routeSort === "flagged" ? b.fraud_count - a.fraud_count
    : routeSort === "rate"  ? b.fraud_rate_pct - a.fraud_rate_pct
    : b.total_transactions  - a.total_transactions
  );

  const filterColors: Record<string,{active:string;border:string;bg:string}> = {
    All:    {active:"#00d4ff",border:"rgba(0,212,255,0.3)",bg:"rgba(0,212,255,0.08)"},
    High:   {active:"#ff3535",border:"rgba(255,53,53,0.3)", bg:"rgba(255,53,53,0.08)"},
    Medium: {active:"#ff8800",border:"rgba(255,136,0,0.3)", bg:"rgba(255,136,0,0.08)"},
    Low:    {active:"#00e676",border:"rgba(0,230,118,0.3)", bg:"rgba(0,230,118,0.08)"},
  };
  const fbStyle = (f: string): React.CSSProperties => {
    const isActive = f === riskFilter;
    const c = filterColors[f] ?? filterColors.All;
    return { cursor:"pointer", border:"1px solid", borderRadius:6, padding:"3px 9px",
      fontSize:10, fontFamily:"'JetBrains Mono',monospace", transition:"all .15s",
      borderColor:isActive?c.border:"#1a2e48", color:isActive?c.active:"#4a6280", background:isActive?c.bg:"#0e1a2e" };
  };
  const sbStyle = (k: string): React.CSSProperties => ({
    cursor:"pointer", fontSize:9, padding:"2px 7px", borderRadius:4,
    fontFamily:"'JetBrains Mono',monospace", transition:"all .15s",
    color:      routeSort===k ? "#00d4ff" : "#4a6280",
    border:     routeSort===k ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
    background: routeSort===k ? "rgba(0,212,255,0.06)" : "transparent",
  });

  const kpiCards = [
    {label:KPI.fraud_detection_rate.label, val:`${KPI.fraud_detection_rate.value}%`,  chg:`↗ ${KPI.fraud_detection_rate.trend}`, icon:"🛡️", accent:"#ff3535", bg:"rgba(255,53,53,.12)",  border:"rgba(255,53,53,.2)"},
    {label:KPI.false_positive_rate.label,  val:`${KPI.false_positive_rate.value}%`,   chg:`↗ ${KPI.false_positive_rate.trend}`,  icon:"🎯", accent:"#ffd600", bg:"rgba(255,214,0,.12)", border:"rgba(255,214,0,.2)"},
    {label:KPI.total_flagged_today.label,  val:KPI.total_flagged_today.value.toLocaleString(), chg:`↗ ${KPI.total_flagged_today.trend}`, icon:"⚠️", accent:"#ff8800", bg:"rgba(255,136,0,.12)",  border:"rgba(255,136,0,.2)"},
    {label:KPI.transactions_today.label,   val:`${KPI.transactions_today.value}K`,    chg:`↗ ${KPI.transactions_today.trend}`,   icon:"💳", accent:"#00d4ff", bg:"rgba(0,212,255,.12)",  border:"rgba(0,212,255,.2)"},
  ];

  return (
    <div style={{ fontFamily:"'Syne',sans-serif", background:"#07101c", color:"#dce8f2", minHeight:"100vh", overflowX:"hidden", position:"relative" }}>
      <style>{CSS}</style>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        backgroundImage:`linear-gradient(rgba(0,212,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.018) 1px,transparent 1px)`,
        backgroundSize:"44px 44px" }} />

      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:200, background:"rgba(7,16,28,0.96)", backdropFilter:"blur(20px)",
        borderBottom:"1px solid #1a2e48", padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:11 }}>
          <div style={{ width:38, height:38, borderRadius:10, fontSize:18,
            background:"linear-gradient(135deg,rgba(0,212,255,0.18),rgba(0,143,181,0.28))",
            border:"1px solid rgba(0,212,255,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }}>🛡️</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"#00d4ff", letterSpacing:-0.2 }}>Fraud Analytics Dashboard</div>
            <div style={{ fontSize:10, color:"#4a6280", fontFamily:"'JetBrains Mono',monospace", marginTop:1 }}>Real-time Transaction Monitoring &amp; Fraud Detection</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(0,230,118,0.07)", border:"1px solid rgba(0,230,118,0.22)",
          padding:"5px 12px", borderRadius:20, fontSize:10.5, color:"#00e676", fontFamily:"'JetBrains Mono',monospace" }}>
          <div className="pulsedot" style={{ width:7, height:7, borderRadius:"50%", background:"#00e676" }} />
          System Online
        </div>
      </div>

      {/* Content */}
      <div style={{ position:"relative", zIndex:1, padding:"0 14px 30px" }}>

        {/* KPI */}
        <SecHeader icon="📊" title="Fraud Detection Overview" />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:4 }}>
          {kpiCards.map(mc => (
            <div key={mc.label} style={{ background:"#0e1a2e", borderRadius:12, padding:15,
              border:`1px solid ${mc.border}`, position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg,${mc.accent} 0%,transparent 55%)`, opacity:.07, pointerEvents:"none" }} />
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7 }}>
                <div style={{ fontSize:11, fontWeight:600, color:mc.accent }}>{mc.label}</div>
                <div style={{ width:32, height:32, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, background:mc.bg }}>{mc.icon}</div>
              </div>
              <div style={{ fontSize:28, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", lineHeight:1, marginBottom:5 }}>{mc.val}</div>
              <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:"#00e676" }}>{mc.chg}</div>
            </div>
          ))}
        </div>

        <div style={{ height:1, background:"#1a2e48", margin:"6px 0" }} />

        {/* Heatmap */}
        <SecHeader icon="🔥" title="Regional Fraud Heatmap">
          <div style={{ display:"flex", gap:5 }}>
            {(["All","High","Medium","Low"] as const).map(f => (
              <button key={f} onClick={() => setRiskFilter(f)} style={fbStyle(f)}>{f}</button>
            ))}
          </div>
        </SecHeader>

        {filteredCities.length === 0
          ? <div style={{ color:"#4a6280", fontSize:11, fontFamily:"'JetBrains Mono',monospace",
              padding:"24px", textAlign:"center", background:"#0e1a2e", borderRadius:11, border:"1px solid #1a2e48", marginBottom:9 }}>
              No regions for filter: {riskFilter}
            </div>
          : filteredCities.map(r => (
            <RegionCard key={r.city} r={r}
              expanded={expandedRegion === r.city}
              onToggle={() => setExpandedRegion(p => p === r.city ? null : r.city)} />
          ))
        }

        <div style={{ height:1, background:"#1a2e48", margin:"6px 0" }} />

        {/* Routes */}
        <SecHeader icon="📍" title="Top Transaction Routes">
          <div style={{ display:"flex", gap:5, alignItems:"center" }}>
            <span style={{ fontSize:9, color:"#4a6280", fontFamily:"'JetBrains Mono',monospace" }}>Sort:</span>
            {([["volume","Volume"],["flagged","Flagged"],["rate","Fraud %"]] as [string,string][]).map(([k,lbl]) => (
              <button key={k} onClick={() => setRouteSort(k)} style={sbStyle(k)}>{lbl}</button>
            ))}
          </div>
        </SecHeader>

        {sortedRoutes.map((r, i) => <RouteCard key={r.route} route={r} rank={i+1} />)}

      </div>
    </div>
  );
}
