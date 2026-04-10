import { useState, useEffect, useRef, FC, ReactNode, CSSProperties, KeyboardEvent, ChangeEvent } from "react";

// ── Types ────────────────────────────────────────────────────────
interface JwtPayload {
  email: string;
  role: string;
  iat: number;
  exp: number;
}

interface DemoUser {
  password: string;
  role: string;
  clearance: string;
  dept: string;
  avatar: string;
}

export interface AuthContext {
  email: string;
  user: DemoUser;
  biometric?: boolean;
}

interface ActivityEntry {
  device: string;
  location: string;
  time: string;
  status: "success" | "blocked";
  ip: string;
}

type BiometricState = "idle" | "scanning" | "success" | "fail";
type OtpMethod = "sms" | "email" | "totp";

interface PasswordRules {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  symbol: boolean;
}

// ── JWT Simulation ───────────────────────────────────────────────
export const JWT = {
  sign(payload: Omit<JwtPayload, "iat" | "exp">): string {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }));
    const sig = btoa(`mds-secret-${payload.email}`).slice(0, 24);
    return `${header}.${body}.${sig}`;
  },
  decode(token: string): JwtPayload | null {
    try { return JSON.parse(atob(token.split(".")[1])) as JwtPayload; } catch { return null; }
  },
  isExpired(token: string): boolean {
    const d = JWT.decode(token);
    return !d || Date.now() > d.exp;
  },
};

// ── Auth Store ───────────────────────────────────────────────────
export const authStore: { token: string | null; refreshToken: string | null } = {
  token: null,
  refreshToken: null,
};

export const DEMO_USERS: Record<string, DemoUser> = {
  "analyst@muledetect.com": { password: "Secure@2026!", role: "Senior Analyst", clearance: "Level 3", dept: "Financial Crimes Unit", avatar: "SA" },
  "admin@muledetect.com":   { password: "Admin@2026!",  role: "System Admin",   clearance: "Level 5", dept: "Operations",           avatar: "AD" },
};

const ACTIVITY_LOG: ActivityEntry[] = [
  { device: "MacBook Pro",      location: "Mumbai, IN",    time: "Today 09:14",    status: "success", ip: "103.21.xx.xx" },
  { device: "iPhone 15 Pro",    location: "Ahmedabad, IN", time: "Yesterday 18:42",status: "success", ip: "103.21.xx.xx" },
  { device: "Unknown Device",   location: "Singapore",     time: "3 days ago",     status: "blocked", ip: "45.76.xx.xx"  },
];

// ── Helpers ──────────────────────────────────────────────────────
function validatePassword(pw: string): PasswordRules {
  return {
    length: pw.length >= 8,
    upper:  /[A-Z]/.test(pw),
    lower:  /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^a-zA-Z0-9]/.test(pw),
  };
}

function useCountdown(initial: number, active: boolean): number {
  const [secs, setSecs] = useState<number>(initial);
  useEffect(() => {
    if (!active) return;
    setSecs(initial);
    const id = setInterval(() => setSecs(s => s <= 1 ? (clearInterval(id), 0) : s - 1), 1000);
    return () => clearInterval(id);
  }, [active, initial]);
  return secs;
}

// ── Styles ───────────────────────────────────────────────────────
const S: Record<string, CSSProperties> = {
  input: {
    width: "100%",
    background: "rgba(0,180,255,0.04)",
    border: "1px solid rgba(0,180,255,0.12)",
    borderRadius: 10,
    padding: "10px 12px 10px 38px",
    color: "#cce8ff",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
    letterSpacing: "0.03em",
    transition: "border-color 0.2s, background 0.2s",
    boxSizing: "border-box",
  },
  label: {
    display: "block",
    fontSize: 10,
    letterSpacing: "0.12em",
    color: "rgba(0,180,255,0.55)",
    textTransform: "uppercase",
    marginBottom: 6,
    fontFamily: "'JetBrains Mono', monospace",
  },
  btn: {
    width: "100%",
    padding: "11px 16px",
    background: "linear-gradient(135deg, #0077bb, #00b4ff)",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#001830",
    transition: "opacity 0.2s, transform 0.1s",
    position: "relative",
    overflow: "hidden",
  },
  btnGhost: {
    width: "100%",
    padding: "10px 16px",
    background: "transparent",
    border: "1px solid rgba(0,180,255,0.18)",
    borderRadius: 10,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.06em",
    color: "rgba(0,180,255,0.65)",
    transition: "all 0.2s",
  },
};

// ── Icons ────────────────────────────────────────────────────────
const Icon = {
  Shield: (): JSX.Element => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 20, height: 20 }}>
      <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Mail: (): JSX.Element => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 16, height: 16 }}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  Lock: (): JSX.Element => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 16, height: 16 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Eye: ({ off }: { off: boolean }): JSX.Element => off ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 16, height: 16 }}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 16, height: 16 }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Fingerprint: (): JSX.Element => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
      <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0 0 15.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 0 0 8 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
    </svg>
  ),
  Face: (): JSX.Element => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
      <path d="M8.5 14s1 2 3.5 2 3.5-2 3.5-2" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  ),
  Check: (): JSX.Element => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Alert: (): JSX.Element => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Activity: (): JSX.Element => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 16, height: 16 }}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Refresh: (): JSX.Element => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Device: (): JSX.Element => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 16, height: 16 }}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <circle cx="12" cy="18" r="1" fill="currentColor" />
    </svg>
  ),
};

// ── Sub-components ────────────────────────────────────────────────
const Brand: FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
    <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(0,180,255,0.08)", border: "1px solid rgba(0,180,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#00b4ff" }}>
      <Icon.Shield />
    </div>
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", color: "#ddf0ff", textTransform: "uppercase" }}>MuleDetect</div>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "rgba(0,180,255,0.5)", fontFamily: "'JetBrains Mono', monospace" }}>SECURE AUTH PORTAL · v4.2</div>
    </div>
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e676", animation: "blink 2s infinite" }} />
      <span style={{ fontSize: 9, color: "rgba(0,230,118,0.6)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>SECURED</span>
    </div>
  </div>
);

const StepBar: FC<{ step: number; total: number }> = ({ step, total }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", flex: i < total - 1 ? 1 : undefined, gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: i < step ? "#00b4ff" : i === step ? "#00e676" : "rgba(0,180,255,0.15)", boxShadow: i <= step ? "0 0 8px rgba(0,180,255,0.5)" : "none", transition: "all 0.4s", flexShrink: 0 }} />
        {i < total - 1 && <div style={{ flex: 1, height: 1, background: i < step ? "rgba(0,180,255,0.4)" : "rgba(0,180,255,0.08)", transition: "background 0.4s" }} />}
      </div>
    ))}
    <span style={{ fontSize: 10, color: "rgba(0,180,255,0.45)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginLeft: 4 }}>{step + 1}/{total}</span>
  </div>
);

const Field: FC<{ label: string; icon: FC; children: ReactNode }> = ({ label, icon: IconComp, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={S.label}>{label}</label>
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "rgba(0,180,255,0.4)", display: "flex" }}><IconComp /></div>
      {children}
    </div>
  </div>
);

const PwStrength: FC<{ rules: PasswordRules }> = ({ rules }) => {
  const passed = Object.values(rules).filter(Boolean).length;
  const colors = ["#ff3d3d", "#ff7a00", "#ffcc00", "#7aff4d", "#00e676"];
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
        {[0,1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, background: i < passed ? colors[passed - 1] : "rgba(0,180,255,0.1)", transition: "background 0.3s" }} />)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
        {(Object.entries(rules) as [keyof PasswordRules, boolean][]).map(([k, v]) => {
          const labels: Record<keyof PasswordRules, string> = { length: "8+ chars", upper: "Uppercase", lower: "Lowercase", number: "Number", symbol: "Symbol" };
          return <span key={k} style={{ fontSize: 10, color: v ? "#00e676" : "rgba(140,180,210,0.35)", fontFamily: "'JetBrains Mono', monospace", display: "flex", alignItems: "center", gap: 3 }}>{v ? "✓" : "○"} {labels[k]}</span>;
        })}
      </div>
    </div>
  );
};

const Captcha: FC<{ verified: boolean; onVerify: (v: boolean) => void }> = ({ verified, onVerify }) => {
  const [loading, setLoading] = useState(false);
  const handleClick = () => {
    if (verified || loading) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); onVerify(true); }, 1200);
  };
  return (
    <div style={{ border: "1px solid rgba(0,180,255,0.12)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, background: "rgba(0,180,255,0.03)", marginBottom: 14, cursor: verified ? "default" : "pointer" }} onClick={handleClick}>
      <div style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${verified ? "rgba(0,230,118,0.6)" : "rgba(0,180,255,0.3)"}`, background: verified ? "rgba(0,230,118,0.12)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.3s" }}>
        {loading ? <div style={{ width: 10, height: 10, border: "1.5px solid rgba(0,180,255,0.5)", borderTopColor: "#00b4ff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : verified ? <svg viewBox="0 0 12 12" fill="none" stroke="#00e676" strokeWidth="2" style={{ width: 10, height: 10 }}><path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
      </div>
      <span style={{ fontSize: 12, color: verified ? "rgba(0,230,118,0.7)" : "rgba(140,180,210,0.6)", flex: 1 }}>{loading ? "Verifying…" : verified ? "Human verified" : "I'm not a robot"}</span>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: 9, color: "rgba(0,180,255,0.3)", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4 }}>reCAPTCHA<br />Privacy · Terms</div></div>
    </div>
  );
};

const ErrorBanner: FC<{ msg: string }> = ({ msg }) => {
  if (!msg) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 14, color: "#ff8080", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>
      <Icon.Alert /><span>{msg}</span>
    </div>
  );
};

const OtpInputs: FC<{ value: string; onChange: (v: string) => void; onComplete: (v: string) => void }> = ({ value, onChange, onComplete }) => {
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));
  const vals = value.split("");
  const handle = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...vals]; next[i] = digit;
    const str = next.join("");
    onChange(str);
    if (digit && i < 5) refs[i + 1].current?.focus();
    if (str.length === 6) onComplete(str);
  };
  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !vals[i] && i > 0) refs[i - 1].current?.focus();
  };
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input key={i} ref={refs[i]} value={vals[i] || ""} maxLength={1}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handle(i, e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleKey(i, e)}
          style={{ flex: 1, textAlign: "center", background: vals[i] ? "rgba(0,180,255,0.1)" : "rgba(0,180,255,0.04)", border: `1px solid ${vals[i] ? "rgba(0,180,255,0.4)" : "rgba(0,180,255,0.12)"}`, borderRadius: 8, padding: "12px 4px", color: "#cce8ff", fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 500, outline: "none", transition: "all 0.2s", width: 0 }}
        />
      ))}
    </div>
  );
};

const BiometricBtn: FC<{ icon: FC; label: string; onClick?: () => void }> = ({ icon: IconComp, label, onClick }) => {
  const [state, setState] = useState<BiometricState>("idle");
  const handle = () => {
    setState("scanning");
    setTimeout(() => setState(Math.random() > 0.15 ? "success" : "fail"), 2000);
    setTimeout(() => { setState("idle"); onClick?.(); }, 3500);
  };
  const colors: Record<BiometricState, string> = { idle: "rgba(0,180,255,0.4)", scanning: "#00b4ff", success: "#00e676", fail: "#ff4d4d" };
  const borderColors: Record<BiometricState, string> = { idle: "rgba(0,180,255,0.12)", scanning: "rgba(0,180,255,0.3)", success: "rgba(0,230,118,0.4)", fail: "rgba(255,77,77,0.4)" };
  return (
    <button onClick={handle} style={{ border: `1px solid ${borderColors[state]}`, borderRadius: 10, background: "rgba(0,180,255,0.03)", padding: "12px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: colors[state], transition: "all 0.3s", flex: 1 }}>
      {state === "scanning" ? <div style={{ position: "relative", width: 28, height: 28 }}><div style={{ position: "absolute", inset: 0, border: "2px solid rgba(0,180,255,0.3)", borderTopColor: "#00b4ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div> : <IconComp />}
      <span style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
        {state === "idle" ? label : state === "scanning" ? "Scanning…" : state === "success" ? "Verified" : "Failed"}
      </span>
    </button>
  );
};

const TokenDisplay: FC<{ token: string }> = ({ token }) => {
  const [show, setShow] = useState(false);
  const decoded = JWT.decode(token);
  return (
    <div style={{ border: "1px solid rgba(0,180,255,0.1)", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
      <button onClick={() => setShow(!show)} style={{ width: "100%", padding: "8px 12px", background: "rgba(0,180,255,0.05)", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(0,180,255,0.6)", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>
        <span>JWT TOKEN · {token.slice(0, 16)}…</span>
        <span>{show ? "▲ HIDE" : "▼ INSPECT"}</span>
      </button>
      {show && decoded && (
        <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "rgba(140,180,210,0.6)", lineHeight: 1.8 }}>
            <div><span style={{ color: "#00b4ff" }}>email:</span> {decoded.email}</div>
            <div><span style={{ color: "#00b4ff" }}>role:</span> {decoded.role}</div>
            <div><span style={{ color: "#00b4ff" }}>iat:</span> {new Date(decoded.iat).toLocaleTimeString()}</div>
            <div><span style={{ color: "#00b4ff" }}>exp:</span> {new Date(decoded.exp).toLocaleTimeString()}</div>
            <div style={{ marginTop: 6, wordBreak: "break-all", color: "rgba(0,180,255,0.3)", fontSize: 9 }}>{token}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Screen 1: Login ───────────────────────────────────────────────
export interface LoginScreenProps {
  onNext: (data: AuthContext) => void;
  failCount: number;
  setFailCount: (n: number) => void;
}

export const LoginScreen: FC<LoginScreenProps> = ({ onNext, failCount, setFailCount }) => {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [captcha, setCaptcha] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwHints, setShowPwHints] = useState(false);
  const pwRules = validatePassword(pw);
  const locked = failCount >= 5;
  const lockTimer = useCountdown(30, locked);

  useEffect(() => { if (lockTimer === 0 && locked) setFailCount(0); }, [lockTimer]);

  const submit = () => {
    setError("");
    if (locked) { setError(`Account locked. Try again in ${lockTimer}s`); return; }
    if (!captcha) { setError("Please complete the CAPTCHA verification."); return; }
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    const user = DEMO_USERS[email.toLowerCase()];
    if (!user || user.password !== pw) {
      const next = failCount + 1;
      setFailCount(next);
      setError(next >= 5 ? "Too many attempts. Account locked for 30s." : `Invalid credentials. ${5 - next} attempts remaining.`);
      return;
    }
    setLoading(true);
    setTimeout(() => { setLoading(false); onNext({ email, user }); }, 1200);
  };

  return (
    <div style={{ animation: "fadeUp 0.4s ease" }}>
      <Brand />
      <StepBar step={0} total={3} />
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(0,180,255,0.07)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf0ff", marginBottom: 2 }}>Analyst Sign-In</div>
        <div style={{ fontSize: 11, color: "rgba(0,180,255,0.4)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>// identity_verification.init()</div>
      </div>
      {locked && <div style={{ background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.25)", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: "#ff8080", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>🔒 Account locked · Unlocks in {lockTimer}s</div>}
      <ErrorBanner msg={error} />
      <Captcha verified={captcha} onVerify={setCaptcha} />
      <Field label="Email Address" icon={Icon.Mail}>
        <input style={{ ...S.input, borderColor: error && !email.includes("@") ? "rgba(255,60,60,0.4)" : undefined }} type="email" placeholder="analyst@muledetect.com" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && submit()} />
      </Field>
      <Field label="Password" icon={Icon.Lock}>
        <input style={{ ...S.input, paddingRight: 36 }} type={showPw ? "text" : "password"} placeholder="Enter password" value={pw} onChange={(e: ChangeEvent<HTMLInputElement>) => { setPw(e.target.value); setShowPwHints(true); }} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && submit()} />
        <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(0,180,255,0.4)", display: "flex", padding: 4 }}><Icon.Eye off={showPw} /></button>
      </Field>
      {showPwHints && pw && <PwStrength rules={pwRules} />}
      {showPwHints && pw && <div style={{ height: 14 }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "rgba(140,180,210,0.6)" }}>
          <div onClick={() => setRemember(!remember)} style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${remember ? "rgba(0,180,255,0.5)" : "rgba(0,180,255,0.25)"}`, background: remember ? "rgba(0,180,255,0.18)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {remember && <Icon.Check />}
          </div>
          Remember me
        </label>
        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "rgba(0,180,255,0.55)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>Forgot password?</button>
      </div>
      <button onClick={submit} disabled={loading || locked} style={{ ...S.btn, marginBottom: 12, opacity: loading || locked ? 0.5 : 1, cursor: loading || locked ? "not-allowed" : "pointer" }}>
        {loading ? "Authenticating…" : "Sign In →"}
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(0,180,255,0.07)" }} />
        <span style={{ fontSize: 10, color: "rgba(140,180,210,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>or continue with</span>
        <div style={{ flex: 1, height: 1, background: "rgba(0,180,255,0.07)" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <BiometricBtn icon={Icon.Fingerprint} label="Fingerprint" onClick={() => captcha && onNext({ email: "analyst@muledetect.com", user: DEMO_USERS["analyst@muledetect.com"], biometric: true })} />
        <BiometricBtn icon={Icon.Face} label="Face ID" onClick={() => captcha && onNext({ email: "analyst@muledetect.com", user: DEMO_USERS["analyst@muledetect.com"], biometric: true })} />
      </div>
    </div>
  );
};

// ── Screen 2: 2FA ─────────────────────────────────────────────────
export interface TwoFAScreenProps {
  ctx: AuthContext;
  onNext: () => void;
  onBack: () => void;
}

export const TwoFAScreen: FC<TwoFAScreenProps> = ({ ctx: _ctx, onNext, onBack }) => {
  const [otp, setOtp] = useState("");
  const [method, setMethod] = useState<OtpMethod>("sms");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timerActive, setTimerActive] = useState(true);
  const secs = useCountdown(299, timerActive);
  const DEMO_OTP = "248610";
  const methodLabels: Record<OtpMethod, string> = { sms: "+91 ••••••7842", email: "ana••••@muledetect.com", totp: "Authenticator App" };

  const verify = (code: string) => {
    if (code.length < 6) return;
    if (code !== DEMO_OTP) { setError("Invalid code. Use: " + DEMO_OTP); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); onNext(); }, 1000);
  };

  return (
    <div style={{ animation: "fadeUp 0.4s ease" }}>
      <Brand />
      <StepBar step={1} total={3} />
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "rgba(0,180,255,0.4)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6, marginBottom: 16, padding: 0 }}>← back</button>
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(0,180,255,0.07)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf0ff", marginBottom: 2 }}>Two-Factor Auth</div>
        <div style={{ fontSize: 11, color: "rgba(0,180,255,0.4)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>// mfa.verify(channel, token)</div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["sms", "email", "totp"] as OtpMethod[]).map(m => (
          <button key={m} onClick={() => { setMethod(m); setOtp(""); setError(""); setTimerActive(true); }} style={{ border: `1px solid ${method === m ? "rgba(0,180,255,0.5)" : "rgba(0,180,255,0.12)"}`, borderRadius: 20, padding: "4px 12px", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", color: method === m ? "#00b4ff" : "rgba(0,180,255,0.4)", background: method === m ? "rgba(0,180,255,0.1)" : "transparent", transition: "all 0.2s" }}>
            {m === "totp" ? "Auth App" : m.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{ border: "1px solid rgba(0,180,255,0.1)", borderRadius: 8, padding: "10px 12px", background: "rgba(0,180,255,0.03)", marginBottom: 14, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "rgba(140,180,210,0.5)", lineHeight: 1.7 }}>
        Code sent to <span style={{ color: "rgba(0,180,255,0.7)" }}>{methodLabels[method]}</span><br />
        <span style={{ color: "rgba(0,230,118,0.5)" }}>Demo OTP: {DEMO_OTP}</span>
      </div>
      <ErrorBanner msg={error} />
      <label style={S.label}>Verification Code</label>
      <OtpInputs value={otp} onChange={v => { setOtp(v); setError(""); }} onComplete={verify} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: "rgba(0,180,255,0.45)", fontFamily: "'JetBrains Mono', monospace" }}>
          Expires <span style={{ color: secs < 30 ? "#ff8080" : "#00b4ff" }}>{Math.floor(secs / 60).toString().padStart(2, "0")}:{(secs % 60).toString().padStart(2, "0")}</span>
        </span>
        <button onClick={() => setTimerActive(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "rgba(0,180,255,0.5)", fontFamily: "'JetBrains Mono', monospace", display: "flex", alignItems: "center", gap: 4 }}>
          <Icon.Refresh /> Resend
        </button>
      </div>
      <button onClick={() => verify(otp)} disabled={otp.length < 6 || loading} style={{ ...S.btn, opacity: otp.length < 6 || loading ? 0.4 : 1, cursor: otp.length < 6 || loading ? "not-allowed" : "pointer" }}>
        {loading ? "Verifying…" : "Verify & Authenticate →"}
      </button>
    </div>
  );
};

// ── Auth Shell wrapper ────────────────────────────────────────────
export const AuthShell: FC<{ children: ReactNode }> = ({ children }) => (
  <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.3} }
      @keyframes spin   { to{transform:rotate(360deg)} }
      @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
      input { -webkit-appearance: none; }
      input:focus { outline: none; border-color: rgba(0,180,255,0.45) !important; background: rgba(0,180,255,0.08) !important; }
      button:hover { opacity: 0.88; }
    `}</style>
    <div style={{ minHeight: "100vh", background: "#060d1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: "1rem", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(0,180,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,255,0.03) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      <div style={{ position: "absolute", borderRadius: "50%", pointerEvents: "none", filter: "blur(80px)", width: 300, height: 300, background: "rgba(0,100,220,0.12)", top: -80, right: -80 }} />
      <div style={{ position: "absolute", borderRadius: "50%", pointerEvents: "none", filter: "blur(80px)", width: 200, height: 200, background: "rgba(0,180,255,0.07)", bottom: -60, left: -60 }} />
      <div style={{ background: "rgba(8,18,36,0.92)", border: "1px solid rgba(0,180,255,0.12)", borderRadius: 20, padding: "2rem", width: "100%", maxWidth: 440, position: "relative", backdropFilter: "blur(16px)", boxShadow: "0 0 0 1px rgba(0,180,255,0.05), 0 32px 64px rgba(0,0,0,0.6)" }}>
        {[{ top: 12, left: 12, borderWidth: "2px 0 0 2px" }, { top: 12, right: 12, borderWidth: "2px 2px 0 0" }, { bottom: 12, left: 12, borderWidth: "0 0 2px 2px" }, { bottom: 12, right: 12, borderWidth: "0 2px 2px 0" }].map((pos, i) => (
          <div key={i} style={{ position: "absolute", width: 16, height: 16, borderColor: "rgba(0,180,255,0.4)", borderStyle: "solid", ...pos }} />
        ))}
        {children}
      </div>
    </div>
  </>
);