import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { completeLogin } from '../lib/auth';

export default function CallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    completeLogin(location.search)
      .then((returnTo) => {
        if (!cancelled) navigate(returnTo || '/', { replace: true });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [location.search, navigate]);

  return (
    <section className="card">
      <h1>正在完成登录…</h1>
      {error ? (
        <>
          <p className="error">{error}</p>
          <a className="btn" href="/">返回首页</a>
        </>
      ) : (
        <p className="muted">正在校验授权码并换取令牌。</p>
      )}
    </section>
  );
}
