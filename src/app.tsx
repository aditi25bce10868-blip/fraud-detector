import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LoginScreen, TwoFAScreen, AuthShell, AuthContext, JWT, authStore, DEMO_USERS } from "./Sign";
import Dashboard from "./dashboard";
import Investigation from "./investigations";
import Graph from "./graph";
import Reporting from "./reporting";
import Upload from "./upload";
import Sidebar from "./Sidebar";

type Screen = 0 | 1 | 2;

const App = () => {
  const [screen,    setScreen]    = useState<Screen>(0);
  const [ctx,       setCtx]       = useState<AuthContext | null>(null);
  const [failCount, setFailCount] = useState(0);

  const handleLogin = (data: AuthContext) => {
    setCtx(data);
    if (data.biometric) {
      authStore.token = JWT.sign({ email: data.email, role: data.user.role });
      setScreen(2);
    } else {
      setScreen(1);
    }
  };

  const handle2FA = () => {
    if (!ctx) return;
    authStore.token = JWT.sign({ email: ctx.email, role: ctx.user.role });
    setScreen(2);
  };

  const handleLogout = () => {
    authStore.token = null;
    setCtx(null);
    setFailCount(0);
    setScreen(0);
  };

  if (screen === 0)
    return <AuthShell><LoginScreen onNext={handleLogin} failCount={failCount} setFailCount={setFailCount} /></AuthShell>;

  if (screen === 1 && ctx)
    return <AuthShell><TwoFAScreen ctx={ctx} onNext={handle2FA} onBack={() => setScreen(0)} /></AuthShell>;

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/investigation" element={<Investigation />} />
            <Route path="/graph"         element={<Graph />} />
            <Route path="/reporting"     element={<Reporting />} />
            <Route path="/upload"        element={<Upload />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;