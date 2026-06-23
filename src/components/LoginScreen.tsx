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
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>
          <span style={{ color: 'var(--ink)' }}>Consulte </span><span style={{ color: 'var(--magenta)' }}>GEO</span>
          <span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}> · GEOLAB</span>
        </div>
        <p style={{ margin: 0, color: 'var(--ink-faint)', fontSize: 13 }}>Controle tecnológico de materiais para laboratórios</p>
        <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter} autoComplete="username" />
        <Field label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onEnter} autoComplete="current-password" />
        {error ? <div style={{ color: 'var(--magenta)', fontSize: 13 }}>{error}</div> : null}
        <Button onClick={() => void submit()} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
      </div>
    </div>
  );
}
