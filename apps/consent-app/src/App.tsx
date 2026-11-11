import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { beginLogin, getToken, isDemo, logout } from './lib/auth';
import { enablePush } from './lib/push';
import PendingPage from './pages/PendingPage';
import ConsentPage from './pages/ConsentPage';
import CallbackPage from './pages/CallbackPage';
import HistoryPage from './pages/HistoryPage';

function Header() {
  const location = useLocation();
  const loggedIn = Boolean(getToken());

  async function onLogin() {
    try {
      await beginLogin(location.pathname);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <img src="/icon.svg" alt="" width={28} height={28} />
        <span>高风险操作确认</span>
      </Link>
      <div className="topbar-actions">
        {loggedIn ? (
          <>
            {isDemo() && <span className="demo-badge">演示</span>}
            <Link className="btn btn-ghost" to="/history">历史</Link>
            <button className="btn btn-ghost" onClick={logout}>退出</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={onLogin}>登录</button>
        )}
      </div>
    </header>
  );
}

export default function App() {
  useEffect(() => {
    void enablePush().catch(() => undefined);
  }, []);

  return (
    <div className="app">
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<PendingPage />} />
          <Route path="/c/:id" element={<ConsentPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/oauth/callback" element={<CallbackPage />} />
          <Route
            path="*"
            element={
              <section className="card">
                <h1>页面不存在</h1>
                <p className="muted">检查链接是否完整。</p>
                <Link className="btn" to="/">返回列表</Link>
              </section>
            }
          />
        </Routes>
      </main>
      <footer className="footer">
        <span>Autional Consent</span>
        <span className="muted">只展示与提交决定，不持有服务凭据</span>
      </footer>
    </div>
  );
}
