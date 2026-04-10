import { useState } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@400;600;700;800&display=swap');
  @keyframes pg  { 0%,100%{box-shadow:0 0 0 0 rgba(0,230,118,0.5);} 50%{box-shadow:0 0 0 6px rgba(0,230,118,0);} }
  @keyframes pgc { 0%,100%{box-shadow:0 0 0 0 rgba(0,212,255,0.5);} 50%{box-shadow:0 0 0 6px rgba(0,212,255,0);} }
  @keyframes fadein { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:none;} }
  .pulsedot   { animation:pg  2s infinite; }
  .pulsedot-c { animation:pgc 2s infinite; }
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:#0b1628;}
  ::-webkit-scrollbar-thumb{background:#1a2e48;border-radius:2px;}
  .acct-item:hover { background:#122035!important; border-color:rgba(0,212,255,0.3)!important; }
  .action-btn:hover { opacity:0.85; transform:scale(0.98); }
`;

// ─── DEMO ACCOUNTS ────────────────────────────────────────────────────────────

const ACCOUNTS = [
  {
    raw:"2584", masked:"XXXX XXXX 2584", case_id:"MUL-2026-2584",
    name:"Rajesh Kumar", bank:"HDFC Bank", account_type:"Savings",
    city:"Mumbai", risk_score:94.2, risk_label:"High Risk",
    linked_accounts:4, fraud_count:18, total_amount:4820000,
    risk_breakdown:{ transaction_velocity:70, cross_account_activity:30, behavioral_pattern:100 },
    recent_activity:[
      { time:"18:23", description:"TRANSFER to XXXX7731", amount:257143.26, is_fraud:true,  risk_level:"high"   },
      { time:"11:56", description:"PAYMENT to XXXX0412",  amount:784.06,   is_fraud:false, risk_level:"low"    },
      { time:"09:44", description:"TRANSFER to XXXX5519", amount:180000.00,is_fraud:true,  risk_level:"high"   },
      { time:"08:12", description:"UPI to XXXX2290",      amount:49900.00, is_fraud:true,  risk_level:"medium" },
    ],
    behavioral_summary:"Rapid fund movement detected across multiple linked accounts within 30-minute window. Pattern consistent with money mule behaviour. Structuring pattern: multiple sub-threshold transactions detected.",
    signals:[
      "Rapid fund movement detected across multiple linked accounts within 30-minute window.",
      "Pattern consistent with money mule behaviour.",
      "Structuring pattern: multiple sub-threshold transactions detected.",
    ],
    anomalies:[
      { type:"Large Transfer",    severity:"Critical", amount:257143.26, time:"18:23:41", description:"Amount exceeds 18x average transaction" },
      { type:"Rapid Transactions",severity:"Critical", amount:487943.26, time:"Multiple", description:"4 large transfers within 30-minute window" },
      { type:"Structuring",       severity:"High",     amount:149700.00, time:"Multiple", description:"6 transactions structured below ₹50K threshold" },
    ],
    audit:[
      { event:"Case opened — 18 fraud transactions flagged", source:"Risk Engine",       level:"danger",  timestamp:"2026-04-05 14:00:12" },
      { event:"New device login detected (DEV-A7F2)",        source:"Auth System",        level:"danger",  timestamp:"2026-04-05 13:58:44" },
      { event:"Cross-account links identified: 4 accounts",  source:"Intelligence Layer", level:"info",    timestamp:"2026-04-05 13:57:31" },
      { event:"Transaction anomalies detected",              source:"Risk Engine",        level:"warning", timestamp:"2026-04-05 13:56:09" },
    ],
    graph:{
      nodes:[
        { id:"primary", label:"Primary\nXXXX2584", type:"primary" },
        { id:"a1",      label:"XXXX7731",           type:"high_risk" },
        { id:"a2",      label:"XXXX0412",           type:"high_risk" },
        { id:"a3",      label:"XXXX5519",           type:"high_risk" },
        { id:"a4",      label:"XXXX2290",           type:"suspicious" },
        { id:"upi",     label:"UPI: raj@hdfc",      type:"suspicious" },
        { id:"dev",     label:"Device DEV-A7F2",    type:"safe" },
        { id:"ip",      label:"IP: 103.21.58.x",    type:"suspicious" },
      ],
      edges:[
        { from:"primary",to:"a1",  amount:257143, type:"transfer" },
        { from:"primary",to:"a2",  amount:180000, type:"transfer" },
        { from:"primary",to:"a3",  amount:49900,  type:"transfer" },
        { from:"primary",to:"a4",  amount:89700,  type:"transfer" },
        { from:"primary",to:"upi", amount:null,   type:"upi"      },
        { from:"primary",to:"dev", amount:null,   type:"device"   },
        { from:"dev",    to:"ip",  amount:null,   type:"ip"       },
      ],
    },
  },
  {
    raw:"5510", masked:"XXXX XXXX 5510", case_id:"MUL-2026-5510",
    name:"Priya Sharma",  bank:"SBI", account_type:"Current",
    city:"Delhi", risk_score:88.7, risk_label:"High Risk",
    linked_accounts:3, fraud_count:14, total_amount:3100000,
    risk_breakdown:{ transaction_velocity:65, cross_account_activity:45, behavioral_pattern:88 },
    recent_activity:[
      { time:"17:40", description:"NEFT to XXXX8800",    amount:195000.00,is_fraud:true,  risk_level:"high"   },
      { time:"14:22", description:"TRANSFER to XXXX3301",amount:87500.00, is_fraud:true,  risk_level:"high"   },
      { time:"11:05", description:"PAYMENT to XXXX9120", amount:1240.50,  is_fraud:false, risk_level:"low"    },
    ],
    behavioral_summary:"Pattern consistent with money mule behaviour. Structuring pattern: multiple sub-threshold transactions detected.",
    signals:[
      "Pattern consistent with money mule behaviour.",
      "Structuring pattern: multiple sub-threshold transactions detected.",
    ],
    anomalies:[
      { type:"Large Transfer",    severity:"Critical", amount:195000.00, time:"17:40:22", description:"Amount exceeds 12x average transaction" },
      { type:"Rapid Transactions",severity:"Critical", amount:282500.00, time:"Multiple", description:"3 large transfers within 1-hour window" },
    ],
    audit:[
      { event:"Case opened — 14 fraud transactions flagged", source:"Risk Engine",       level:"danger",  timestamp:"2026-04-05 12:10:00" },
      { event:"Cross-account links identified: 3 accounts",  source:"Intelligence Layer",level:"info",    timestamp:"2026-04-05 12:09:11" },
      { event:"Transaction anomalies detected",              source:"Risk Engine",        level:"warning", timestamp:"2026-04-05 12:08:43" },
    ],
    graph:{
      nodes:[
        { id:"primary",label:"Primary\nXXXX5510", type:"primary"   },
        { id:"a1",     label:"XXXX8800",           type:"high_risk" },
        { id:"a2",     label:"XXXX3301",           type:"high_risk" },
        { id:"a3",     label:"XXXX9120",           type:"suspicious"},
        { id:"dev",    label:"Device DEV-C9B1",    type:"safe"      },
        { id:"ip",     label:"IP: 49.36.11.x",     type:"suspicious"},
      ],
      edges:[
        { from:"primary",to:"a1", amount:195000, type:"transfer" },
        { from:"primary",to:"a2", amount:87500,  type:"transfer" },
        { from:"primary",to:"a3", amount:44200,  type:"transfer" },
        { from:"primary",to:"dev",amount:null,   type:"device"   },
        { from:"dev",    to:"ip", amount:null,   type:"ip"       },
      ],
    },
  },
  {
    raw:"8392", masked:"XXXX XXXX 8392", case_id:"MUL-2026-8392",
    name:"Amit Verma",    bank:"ICICI Bank", account_type:"Savings",
    city:"Bangalore", risk_score:82.1, risk_label:"High Risk",
    linked_accounts:2, fraud_count:11, total_amount:2740000,
    risk_breakdown:{ transaction_velocity:55, cross_account_activity:38, behavioral_pattern:78 },
    recent_activity:[
      { time:"20:11", description:"TRANSFER to XXXX4490", amount:142000.00,is_fraud:true,  risk_level:"high"   },
      { time:"16:33", description:"UPI to XXXX7720",      amount:48500.00, is_fraud:true,  risk_level:"medium" },
      { time:"10:15", description:"PAYMENT to XXXX1102",  amount:2100.00,  is_fraud:false, risk_level:"low"    },
    ],
    behavioral_summary:"Rapid fund movement detected. Device location inconsistencies observed.",
    signals:[
      "Rapid fund movement detected across multiple linked accounts within 30-minute window.",
      "Device location inconsistencies observed.",
    ],
    anomalies:[
      { type:"Large Transfer", severity:"Critical", amount:142000.00, time:"20:11:05", description:"Amount exceeds 10x average transaction" },
      { type:"Structuring",    severity:"High",     amount:97000.00,  time:"Multiple", description:"4 transactions structured below threshold" },
    ],
    audit:[
      { event:"Case opened — 11 fraud transactions flagged", source:"Risk Engine",   level:"danger",  timestamp:"2026-04-04 20:15:00" },
      { event:"Geographic inconsistency logged",             source:"Device Monitor",level:"warning", timestamp:"2026-04-04 20:14:22" },
      { event:"Transaction anomalies detected",              source:"Risk Engine",    level:"warning", timestamp:"2026-04-04 20:13:55" },
    ],
    graph:{
      nodes:[
        { id:"primary",label:"Primary\nXXXX8392", type:"primary"   },
        { id:"a1",     label:"XXXX4490",           type:"high_risk" },
        { id:"a2",     label:"XXXX7720",           type:"suspicious"},
        { id:"dev",    label:"Device DEV-F3D8",    type:"safe"      },
      ],
      edges:[
        { from:"primary",to:"a1", amount:142000,type:"transfer"},
        { from:"primary",to:"a2", amount:48500, type:"transfer"},
        { from:"primary",to:"dev",amount:null,  type:"device"  },
      ],
    },
  },
  // fill remaining 7 slots with lighter-risk accounts
  ...["2640","5431","0700","6756","4229","9852","8400"].map((raw, i) => ({
    raw, masked:`XXXX XXXX ${raw}`, case_id:`MUL-2026-${raw}`,
    name:`Account Holder ${raw}`, bank:["Axis Bank","Kotak","PNB","BOB","Yes Bank","Canara","HDFC Bank"][i],
    account_type:"Wallet", city:["Mumbai","Delhi","Kolkata","Hyderabad","Chennai","Pune","Ahmedabad"][i],
    risk_score: 25, risk_label:"Low Risk",
    linked_accounts:1, fraud_count:2, total_amount:180000,
    risk_breakdown:{ transaction_velocity:20, cross_account_activity:15, behavioral_pattern:25 },
    recent_activity:[
      { time:"10:00", description:`PAYMENT to XXXX${raw.slice(-4)}`, amount:5000, is_fraud:false, risk_level:"low" },
    ],
    behavioral_summary:"No significant behavioral anomalies detected.",
    signals:[] as string[],
    anomalies:[] as any[],
    audit:[
      { event:"Case opened — 2 fraud transactions flagged", source:"Risk Engine", level:"warning", timestamp:"2026-04-04 09:00:00" },
    ],
    graph:{ nodes:[{ id:"primary", label:`Primary\nXXXX${raw}`, type:"primary" }], edges:[] as any[] },
  })),
];

type Account = typeof ACCOUNTS[0];

// ─── Graph renderer ───────────────────────────────────────────────────────────

function GraphViz({ graph }: { graph: Account["graph"] }) {
  const nodePos: Record<string, [number,number]> = {
    primary: [200, 160],
    a1:      [80,  60],
    a2:      [320, 60],
    a3:      [80,  260],
    a4:      [320, 260],
    upi:     [200, 300],
    dev:     [430, 130],
    ip:      [430, 220],
  };
  const nodeColors: Record<string,{fill:string;stroke:string;text:string}> = {
    primary:   { fill:"rgba(0,212,255,0.18)",  stroke:"#00d4ff", text:"#00d4ff"  },
    high_risk: { fill:"rgba(255,53,53,0.18)",   stroke:"#ff3535", text:"#ff6060"  },
    suspicious:{ fill:"rgba(255,136,0,0.15)",   stroke:"#ff8800", text:"#ff8800"  },
    safe:      { fill:"rgba(0,230,118,0.12)",   stroke:"#00e676", text:"#00e676"  },
  };
  const W=500, H=340;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", maxHeight:280 }}>
      {graph.edges.map((e,i) => {
        const [x1,y1] = nodePos[e.from] ?? [200,160];
        const [x2,y2] = nodePos[e.to]   ?? [200,160];
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={e.type==="transfer"?"#ff8800":"#1a2e48"} strokeWidth={e.type==="transfer"?1.5:1}
              strokeDasharray={e.type==="transfer"?"":e.type==="ip"?"4,3":undefined} opacity={0.7} />
            {e.amount && (
              <text x={(x1+x2)/2} y={(y1+y2)/2-5} fill="#ff8800" fontSize={9}
                fontFamily="'JetBrains Mono',monospace" textAnchor="middle">
                ₹{(e.amount/1000).toFixed(0)}K
              </text>
            )}
          </g>
        );
      })}
      {graph.nodes.map(n => {
        const [cx,cy] = nodePos[n.id] ?? [200,160];
        const c = nodeColors[n.type] ?? nodeColors.safe;
        const r = n.type==="primary" ? 36 : 28;
        return (
          <g key={n.id}>
            <circle cx={cx} cy={cy} r={r} fill={c.fill} stroke={c.stroke} strokeWidth={n.type==="primary"?2:1.5} />
            {n.label.split("\n").map((line,li) => (
              <text key={li} x={cx} y={cy+(li-((n.label.split("\n").length-1)/2))*13}
                fill={c.text} fontSize={n.type==="primary"?10:9} fontFamily="'JetBrains Mono',monospace"
                textAnchor="middle" dominantBaseline="middle">{line}</text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string,[string,string]> = {
  danger:  ["#ff3535","rgba(255,53,53,0.1)"],
  warning: ["#ff8800","rgba(255,136,0,0.1)"],
  info:    ["#00d4ff","rgba(0,212,255,0.1)"],
  success: ["#00e676","rgba(0,230,118,0.1)"],
};
const SEV_COLORS: Record<string,string> = { Critical:"#ff3535", High:"#ff8800", Medium:"#ffd600" };

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Investigation() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [notes, setNotes]             = useState<string[]>([]);
  const [noteInput, setNoteInput]     = useState("");
  const [actions, setActions]         = useState<string[]>([]);

  const acct = ACCOUNTS[selectedIdx];

  const riskColor = acct.risk_score >= 75 ? "#ff3535" : acct.risk_score >= 45 ? "#ff8800" : "#00e676";

  function doAction(label: string) {
    setActions(prev => [`[${new Date().toLocaleTimeString()}] ${label} — Case ${acct.case_id}`, ...prev]);
  }

  return (
    <div style={{ fontFamily:"'Syne',sans-serif", background:"#07101c", color:"#dce8f2", minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:200, background:"rgba(7,16,28,0.96)", backdropFilter:"blur(20px)",
        borderBottom:"1px solid #1a2e48", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:9, fontSize:16, background:"rgba(255,53,53,0.12)",
            border:"1px solid rgba(255,53,53,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }}>🔍</div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:"#ff3535" }}>Forensic Ops Console</div>
            <div style={{ fontSize:9.5, color:"#4a6280", fontFamily:"'JetBrains Mono',monospace" }}>Cross-Channel Mule Detection &amp; Case Investigation</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:10, padding:"3px 10px", borderRadius:12, border:"1px solid #ff8800", color:"#ff8800",
            fontFamily:"'JetBrains Mono',monospace" }}>CASE #{acct.case_id}</span>
          <span style={{ fontSize:10, padding:"3px 10px", borderRadius:12,
            border:`1px solid ${riskColor}`, color:riskColor,
            fontFamily:"'JetBrains Mono',monospace" }}>{acct.risk_label.toUpperCase().replace(" ","_")}</span>
          <div style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(255,53,53,0.08)",
            border:"1px solid rgba(255,53,53,0.25)", padding:"4px 10px", borderRadius:16, fontSize:10, color:"#ff3535" }}>
            <div className="pulsedot" style={{ width:6, height:6, borderRadius:"50%", background:"#ff3535" }} />
            CASE ACTIVE
          </div>
        </div>
      </div>

      {/* Investigator bar */}
      <div style={{ background:"#0b1628", borderBottom:"1px solid #1a2e48", padding:"6px 16px",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(0,212,255,0.15)",
            border:"1px solid rgba(0,212,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:11, fontWeight:700, color:"#00d4ff" }}>AS</div>
          <span style={{ fontSize:11, color:"#8aa0b8" }}>Lead Investigator: <strong style={{ color:"#dce8f2" }}>Aditi Singh</strong></span>
          <span style={{ fontSize:10, color:"#4a6280", fontFamily:"'JetBrains Mono',monospace" }}>Security Level: L3 · Assigned 2026-04-05 14:00</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* Main panel */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 14px 30px" }}>

          {/* Account Holder Details */}
          <div style={{ background:"#0e1a2e", borderRadius:12, border:"1px solid #1a2e48", padding:16, marginBottom:12, animation:"fadein .2s ease" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <div className="pulsedot-c" style={{ width:7, height:7, borderRadius:"50%", background:"#00d4ff" }} />
              <span style={{ fontSize:13, fontWeight:800 }}>Account Holder Details</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                ["Name",            acct.name                             ],
                ["Account Number",  acct.masked                           ],
                ["Bank Name",       acct.bank                             ],
                ["Linked Accounts", `⇌ ${acct.linked_accounts} Connected` ],
                ["Account Type",    acct.account_type                     ],
                ["City",            acct.city                             ],
              ].map(([lbl,val]) => (
                <div key={lbl}>
                  <div style={{ fontSize:9, color:"#4a6280", marginBottom:2, fontFamily:"'JetBrains Mono',monospace" }}>{lbl}</div>
                  <div style={{ fontSize:12, fontWeight:600, color: lbl==="Linked Accounts"?"#00d4ff":"#dce8f2" }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Score Breakdown */}
          <div style={{ background:"#0e1a2e", borderRadius:12, border:"1px solid #1a2e48", padding:16, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <div className="pulsedot-c" style={{ width:7, height:7, borderRadius:"50%", background:"#00d4ff" }} />
              <span style={{ fontSize:13, fontWeight:800 }}>Risk Score Breakdown</span>
              <span style={{ marginLeft:"auto", fontSize:22, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:riskColor }}>{acct.risk_score}%</span>
            </div>
            {[
              ["Transaction Velocity",   acct.risk_breakdown.transaction_velocity],
              ["Cross-Account Activity", acct.risk_breakdown.cross_account_activity],
              ["Behavioral Pattern",     acct.risk_breakdown.behavioral_pattern],
            ].map(([lbl,val]) => {
              const pct = val as number;
              const barColor = pct >= 80 ? "#ff3535" : pct >= 50 ? "#ff8800" : "#ffd600";
              return (
                <div key={lbl as string} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}>
                    <span style={{ color:"#8aa0b8", fontFamily:"'JetBrains Mono',monospace" }}>{lbl}</span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", color:barColor, fontWeight:700 }}>{pct}%</span>
                  </div>
                  <div style={{ height:6, background:"#1a2e48", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:3, background:barColor, width:`${pct}%`, transition:"width .6s" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Activity */}
          <div style={{ background:"#0e1a2e", borderRadius:12, border:"1px solid #1a2e48", padding:16, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <div className="pulsedot-c" style={{ width:7, height:7, borderRadius:"50%", background:"#00d4ff" }} />
              <span style={{ fontSize:13, fontWeight:800 }}>Recent Activity</span>
            </div>
            {acct.recent_activity.map((tx, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                background: tx.is_fraud ? "rgba(255,53,53,0.05)" : "#091528",
                borderRadius:8, padding:"8px 12px", marginBottom:6,
                border: tx.is_fraud ? "1px solid rgba(255,53,53,0.2)" : "1px solid #1a2e48" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <span style={{ fontSize:10, color:"#4a6280", fontFamily:"'JetBrains Mono',monospace", flexShrink:0 }}>{tx.time}</span>
                  <span style={{ fontSize:11, color:"#dce8f2" }}>{tx.description}</span>
                </div>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, flexShrink:0,
                  color: tx.is_fraud ? "#ff3535" : "#00e676" }}>
                  ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                </span>
              </div>
            ))}
          </div>

          {/* Behavioral Summary */}
          <div style={{ background:"#0e1a2e", borderRadius:12, border:"1px solid rgba(255,214,0,0.2)", padding:16, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <span style={{ fontSize:14 }}>💡</span>
              <span style={{ fontSize:13, fontWeight:800, color:"#ffd600" }}>Behavioral Pattern Summary</span>
            </div>
            <p style={{ fontSize:11, color:"#8aa0b8", lineHeight:1.6, margin:"0 0 10px" }}>{acct.behavioral_summary}</p>
            {acct.signals.map((s,i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}>
                <span style={{ color:"#ff8800", flexShrink:0 }}>›</span>
                <span style={{ fontSize:10.5, color:"#8aa0b8" }}>{s}</span>
              </div>
            ))}
          </div>

          {/* Cross-Channel Graph */}
          <div style={{ background:"#0e1a2e", borderRadius:12, border:"1px solid #1a2e48", padding:16, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <div className="pulsedot-c" style={{ width:7, height:7, borderRadius:"50%", background:"#00d4ff" }} />
              <span style={{ fontSize:13, fontWeight:800 }}>Cross-Channel Activity Graph</span>
              <span style={{ fontSize:10, color:"#4a6280", marginLeft:4 }}>— Intelligence layer · connections &amp; money flow</span>
            </div>
            <GraphViz graph={acct.graph} />
            <div style={{ display:"flex", gap:12, marginTop:6 }}>
              {[["#00d4ff","Primary"],["#ff3535","High Risk"],["#ff8800","Suspicious"],["#00e676","Safe"]].map(([c,lbl]) => (
                <div key={lbl} style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color:"#4a6280" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:c as string }} />
                  {lbl}
                </div>
              ))}
            </div>
          </div>

          {/* Transaction Anomalies */}
          {acct.anomalies.length > 0 && (
            <div style={{ background:"#0e1a2e", borderRadius:12, border:"1px solid rgba(255,53,53,0.2)", padding:16, marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <div className="pulsedot-c" style={{ width:7, height:7, borderRadius:"50%", background:"#ff3535" }} />
                <span style={{ fontSize:13, fontWeight:800 }}>Transaction Anomalies</span>
                <span style={{ marginLeft:"auto", fontSize:10, padding:"2px 8px", borderRadius:10,
                  background:"rgba(255,53,53,0.12)", color:"#ff3535", fontFamily:"'JetBrains Mono',monospace" }}>
                  {acct.anomalies.length} detected
                </span>
              </div>
              {acct.anomalies.map((an, i) => (
                <div key={i} style={{ background:"rgba(255,53,53,0.05)", borderRadius:8, padding:"10px 12px", marginBottom:8,
                  border:"1px solid rgba(255,53,53,0.15)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"#dce8f2" }}>{an.type}</span>
                    <span style={{ fontSize:9, padding:"1px 6px", borderRadius:4, fontFamily:"'JetBrains Mono',monospace",
                      color: SEV_COLORS[an.severity] ?? "#ff8800",
                      background:`${SEV_COLORS[an.severity]}18`, border:`1px solid ${SEV_COLORS[an.severity]}44` }}>
                      {an.severity}
                    </span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:10 }}>
                    <span style={{ color:"#8aa0b8" }}>{an.description}</span>
                    <span style={{ color:"#ff3535", fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>
                      ₹{an.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div style={{ background:"#0e1a2e", borderRadius:12, border:"1px solid #1a2e48", padding:16, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:800, marginBottom:10, color:"#dce8f2" }}>Quick Actions</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                ["🚩 Flag Account", "#ff3535", "rgba(255,53,53,0.12)", "flag"],
                ["❄️ Freeze Account","#00d4ff","rgba(0,212,255,0.12)","freeze"],
                ["📋 Mark Transaction","#ff8800","rgba(255,136,0,0.12)","mark"],
                ["⬆️ Escalate Case","#ffd600","rgba(255,214,0,0.12)","escalate"],
              ].map(([lbl,color,bg,key]) => (
                <button key={key} className="action-btn" onClick={() => doAction(lbl as string)} style={{
                  background: bg as string, border:`1px solid ${color}44`, borderRadius:8, padding:"8px 12px",
                  color: color as string, fontSize:11, fontWeight:700, cursor:"pointer", transition:"all .15s", textAlign:"left",
                  fontFamily:"'JetBrains Mono',monospace",
                }}>{lbl}</button>
              ))}
            </div>
            {actions.length > 0 && (
              <div style={{ marginTop:10 }}>
                {actions.slice(0,3).map((a,i) => (
                  <div key={i} style={{ fontSize:9.5, color:"#00e676", fontFamily:"'JetBrains Mono',monospace",
                    padding:"3px 0", borderTop:"1px solid #1a2e48" }}>{a}</div>
                ))}
              </div>
            )}
          </div>

          {/* Investigation Notes */}
          <div style={{ background:"#0e1a2e", borderRadius:12, border:"1px solid #1a2e48", padding:16, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:800, marginBottom:10 }}>Investigation Notes</div>
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                placeholder="Add investigation note..."
                style={{ flex:1, background:"#091528", border:"1px solid #1a2e48", borderRadius:6,
                  padding:"6px 10px", color:"#dce8f2", fontSize:11, fontFamily:"'JetBrains Mono',monospace",
                  outline:"none" }} />
              <button onClick={() => { if(noteInput.trim()){ setNotes(p=>[...p, noteInput.trim()]); setNoteInput(""); }}}
                style={{ background:"rgba(0,212,255,0.12)", border:"1px solid rgba(0,212,255,0.3)", borderRadius:6,
                  padding:"6px 12px", color:"#00d4ff", fontSize:11, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace" }}>
                Save
              </button>
            </div>
            {notes.length === 0
              ? <div style={{ fontSize:10, color:"#4a6280", fontFamily:"'JetBrains Mono',monospace" }}>No notes yet.</div>
              : notes.map((n,i) => (
                <div key={i} style={{ fontSize:10.5, color:"#8aa0b8", padding:"5px 8px", background:"#091528",
                  borderRadius:6, border:"1px solid #1a2e48", marginBottom:4 }}>
                  <span style={{ color:"#4a6280", marginRight:6 }}>#{i+1}</span>{n}
                </div>
              ))
            }
          </div>

          {/* Audit Trail */}
          <div style={{ background:"#0e1a2e", borderRadius:12, border:"1px solid #1a2e48", padding:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <div className="pulsedot-c" style={{ width:7, height:7, borderRadius:"50%", background:"#00d4ff" }} />
              <span style={{ fontSize:13, fontWeight:800 }}>Audit Trail</span>
              <span style={{ marginLeft:"auto", fontSize:10, padding:"2px 8px", borderRadius:10, fontFamily:"'JetBrains Mono',monospace",
                background:"rgba(0,212,255,0.1)", color:"#00d4ff" }}>{acct.audit.length} events</span>
            </div>
            {acct.audit.map((ev, i) => {
              const [col, bg] = LEVEL_COLORS[ev.level] ?? LEVEL_COLORS.info;
              return (
                <div key={i} style={{ display:"flex", gap:10, padding:"8px 0",
                  borderBottom: i < acct.audit.length-1 ? "1px solid #1a2e48" : "none" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:col, flexShrink:0, marginTop:3 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:"#dce8f2" }}>{ev.event}</div>
                    <div style={{ fontSize:9.5, color:"#4a6280", fontFamily:"'JetBrains Mono',monospace", marginTop:2 }}>
                      {ev.source} · {ev.timestamp}
                    </div>
                  </div>
                  <span style={{ fontSize:9, padding:"1px 6px", borderRadius:4, fontFamily:"'JetBrains Mono',monospace",
                    alignSelf:"flex-start", background:bg, color:col, border:`1px solid ${col}44` }}>
                    {ev.level}
                  </span>
                </div>
              );
            })}
          </div>

        </div>

        {/* Sidebar */}
        <div style={{ width:220, borderLeft:"1px solid #1a2e48", background:"#07101c", overflowY:"auto", padding:"12px 10px", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div className="pulsedot-c" style={{ width:6, height:6, borderRadius:"50%", background:"#00d4ff" }} />
              <span style={{ fontSize:12, fontWeight:800 }}>Suspicious Accounts</span>
            </div>
            <span style={{ fontSize:9, padding:"1px 6px", borderRadius:10,
              background:"rgba(255,53,53,0.1)", color:"#ff3535", fontFamily:"'JetBrains Mono',monospace" }}>
              {ACCOUNTS.length} Flagged
            </span>
          </div>

          {ACCOUNTS.map((a, i) => {
            const rc = a.risk_score >= 75 ? "#ff3535" : a.risk_score >= 45 ? "#ff8800" : "#4a6280";
            return (
              <div key={a.raw} className="acct-item"
                onClick={() => { setSelectedIdx(i); setNotes([]); setActions([]); }}
                style={{ background: selectedIdx===i ? "#122035" : "#0e1a2e",
                  borderRadius:8, padding:"8px 10px", marginBottom:6, cursor:"pointer",
                  border: selectedIdx===i ? "1px solid rgba(0,212,255,0.4)" : "1px solid #1a2e48",
                  transition:"all .15s" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                  <span style={{ fontSize:11, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color: selectedIdx===i?"#00d4ff":"#dce8f2" }}>
                    Account {a.masked.split(" ").pop()}
                  </span>
                  <span style={{ fontSize:9, fontFamily:"'JetBrains Mono',monospace", color:rc, fontWeight:700 }}>
                    {a.risk_score}%
                  </span>
                </div>
                <div style={{ fontSize:9, color:"#4a6280", fontFamily:"'JetBrains Mono',monospace" }}>
                  {a.bank.length > 14 ? a.bank.slice(0,14)+"…" : a.bank}
                </div>
                <div style={{ fontSize:9, color:rc, fontFamily:"'JetBrains Mono',monospace", marginTop:1 }}>{a.risk_label}</div>
                {selectedIdx===i && (
                  <div style={{ marginTop:4, height:2, borderRadius:1, background:"rgba(0,212,255,0.4)" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}