import { NavLink } from "react-router-dom";
import { LayoutDashboard, Search, GitBranch, FileText, Upload, LogOut } from "lucide-react";

interface SidebarProps {
  onLogout: () => void;
}

// ── Nexus Sentinel brand icon ──────────────────────────────────────────────────
function NexusIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: "/",            end: true,  icon: LayoutDashboard, label: "Dashboard"         },
  { to: "/investigation",           icon: Search,          label: "Investigation"     },
  { to: "/graph",                   icon: GitBranch,       label: "Graph Intelligence"},
  { to: "/reporting",               icon: FileText,        label: "Reporting"         },
  { to: "/upload",                  icon: Upload,          label: "Upload"            },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@400;600;700;800&display=swap');

  .ns-sidebar {
    width: 230px;
    min-height: 100vh;
    background: #0b1525;
    border-right: 1px solid #1a2e48;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    font-family: 'Syne', sans-serif;
    position: relative;
    z-index: 10;
  }

  /* Subtle grid overlay */
  .ns-sidebar::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(0,212,255,0.015) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,212,255,0.015) 1px, transparent 1px);
    background-size: 44px 44px;
  }

  .ns-sidebar-logo {
    padding: 20px 18px 16px;
    display: flex;
    align-items: center;
    gap: 11px;
    border-bottom: 1px solid #1a2e48;
    position: relative;
  }

  .ns-logo-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(0,212,255,0.18), rgba(0,143,181,0.28));
    border: 1px solid rgba(0,212,255,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #00d4ff;
    flex-shrink: 0;
  }

  .ns-logo-text {
    font-size: 14px;
    font-weight: 800;
    color: #dce8f2;
    letter-spacing: -0.2px;
    line-height: 1.2;
  }
  .ns-logo-sub {
    font-size: 9.5px;
    color: #4a6280;
    font-family: 'JetBrains Mono', monospace;
    margin-top: 2px;
    letter-spacing: 0.04em;
  }

  /* User pill */
  .ns-user-pill {
    margin: 14px 14px 10px;
    background: rgba(0,212,255,0.04);
    border: 1px solid #1a2e48;
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: relative;
  }
  .ns-user-name {
    font-size: 12px;
    font-weight: 700;
    color: #dce8f2;
  }
  .ns-user-msg {
    font-size: 10px;
    color: #00d4ff;
    font-family: 'JetBrains Mono', monospace;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .ns-msg-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #00d4ff;
    flex-shrink: 0;
    animation: ns-blink 1.6s ease infinite;
  }

  /* Nav */
  .ns-nav {
    flex: 1;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: relative;
  }

  .ns-nav-label {
    font-size: 9px;
    color: #2a3e58;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 10px 8px 4px;
  }

  .ns-nav-link {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #4a6280;
    text-decoration: none;
    transition: color 0.18s, background 0.18s;
    position: relative;
  }
  .ns-nav-link:hover {
    color: #dce8f2;
    background: rgba(0,212,255,0.05);
  }
  .ns-nav-link.active {
    color: #00d4ff;
    background: rgba(0,212,255,0.08);
    border: 1px solid rgba(0,212,255,0.18);
  }
  .ns-nav-link svg {
    flex-shrink: 0;
  }
  .ns-nav-link.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 25%;
    bottom: 25%;
    width: 2.5px;
    background: #00d4ff;
    border-radius: 0 2px 2px 0;
  }

  /* Footer */
  .ns-sidebar-footer {
    padding: 14px;
    border-top: 1px solid #1a2e48;
    display: flex;
    align-items: center;
    gap: 10px;
    position: relative;
  }
  .ns-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid #1a2e48;
    flex-shrink: 0;
  }
  .ns-footer-name {
    font-size: 12px;
    font-weight: 700;
    color: #dce8f2;
    line-height: 1.3;
  }
  .ns-footer-role {
    font-size: 10px;
    color: #4a6280;
    font-family: 'JetBrains Mono', monospace;
  }
  .ns-logout-btn {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    color: #ff3535;
    font-size: 11px;
    padding: 5px 8px;
    border-radius: 6px;
    transition: background 0.18s;
    font-family: 'Syne', sans-serif;
    font-weight: 600;
  }
  .ns-logout-btn:hover {
    background: rgba(255, 53, 53, 0.1);
  }

  @keyframes ns-blink {
    0%,100% { opacity: 1; }
    50% { opacity: 0.2; }
  }
`;

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  return (
    <>
      <style>{CSS}</style>
      <aside className="ns-sidebar">

        {/* Brand */}
        <div className="ns-sidebar-logo">
          <div className="ns-logo-icon">
            <NexusIcon size={20} />
          </div>
          <div>
            <div className="ns-logo-text">Nexus Sentinel</div>
            <div className="ns-logo-sub">AML Intelligence Platform</div>
          </div>
        </div>

        {/* User info */}
        <div className="ns-user-pill">
          <div className="ns-user-name">Alex Johnson</div>
          <div className="ns-user-msg">
            <div className="ns-msg-dot" />
            05 unread messages
          </div>
        </div>

        {/* Nav items */}
        <nav className="ns-nav">
          <div className="ns-nav-label">Navigation</div>
          {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `ns-nav-link${isActive ? " active" : ""}`}
            >
              <Icon size={15} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="ns-sidebar-footer">
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGKP0sx-DE7BqoVJFPBcAnEQRpVLNJGJs_CQ&s"
            alt="Alex"
            className="ns-avatar"
          />
          <div>
            <div className="ns-footer-name">Alex Johnson</div>
            <div className="ns-footer-role">Analyst · L3</div>
          </div>
          <button className="ns-logout-btn" onClick={onLogout} title="Logout">
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>

      </aside>
    </>
  );
};

export default Sidebar;
