import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button } from './ui/Button';
import { Field } from './ui/Field';

// Sem formulario HTML nativo (regra do check-source): submit via Enter / botão.
export function LoginScreen() {
  const { signIn, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try { await signIn(email.trim().toLowerCase(), password); }
    catch { /* erro fica em useAuth().error */ }
    finally { setBusy(false); }
  }
  function onEnter(e: { key: string }) { if (e.key === 'Enter') void submit(); }

  return (
    <div className="login-shell">
      <aside className="login-aside">
        <div className="grid-overlay" aria-hidden="true" />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg viewBox="0 0 104 100" width="34" height="33" aria-hidden="true">
            <rect x="0" y="0" width="104" height="24" rx="12" fill="#fff" />
            <rect x="0" y="38" width="62" height="24" rx="12" fill="#fff" />
            <rect x="0" y="76" width="104" height="24" rx="12" fill="#fff" />
          </svg>
          <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>GEOLAB</span>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontWeight: 800, fontSize: 28, lineHeight: 1.12, letterSpacing: '-.02em', maxWidth: '18ch' }}>
            Controle tecnológico que vale como documento.
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', color: 'rgba(255,255,255,.6)', marginTop: 18 }}>
            CONSULTE GEO · CONCRESOFT · © 2026
          </div>
        </div>
      </aside>
      <main className="login-main">
        <div style={{ width: '100%', maxWidth: 380, display: 'grid', gap: 14 }}>
          <div className="kicker">Autenticação</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.015em', color: 'var(--ink)' }}>Acessar o laboratório</h1>
          <p style={{ margin: '0 0 6px', color: 'var(--ink-faint)', fontSize: 13 }}>Controle tecnológico de materiais para laboratórios</p>
          <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter} autoComplete="username" />
          <Field label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onEnter} autoComplete="current-password" />
          {error ? <div style={{ color: 'var(--magenta)', fontSize: 13 }}>{error}</div> : null}
          <Button onClick={() => void submit()} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
        </div>
      </main>
    </div>
  );
}
