import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

// Redefinicao de senha (T7 da auditoria UX). Chega-se pelo link do e-mail de recuperacao:
// rota publica /redefinir-senha (se allowlisted no Auth) OU evento PASSWORD_RECOVERY quando
// o redirect cai na raiz. Estilo espelha a ValidarPage (inline + CSS vars) — fora do shell.
export function RedefinirSenhaPage() {
  const { session, clearRecovery } = useAuth();
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);

  async function salvar() {
    setErro(null);
    if (senha.length < 8) { setErro('A senha precisa de pelo menos 8 caracteres.'); return; }
    if (senha !== senha2) { setErro('As senhas digitadas não conferem.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setBusy(false);
    if (error) { setErro('Não foi possível salvar: ' + error.message); return; }
    setOkMsg(true);
    clearRecovery();
    setTimeout(() => { window.location.assign('/'); }, 1200);
  }
  function irLogin() { clearRecovery(); window.location.assign('/'); }

  const inp = { width: '100%', minHeight: 44, border: '1px solid var(--line-strong)', borderRadius: 14, background: 'var(--surface)', color: 'var(--ink)', padding: '10px 12px' } as const;
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--paper)' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)' }}>Concresoft</div>
          <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Redefinição de senha</div>
        </div>
        <div className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
          {!session ? (
            <>
              <strong style={{ color: 'var(--magenta)' }}>Link inválido ou expirado</strong>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>Solicite um novo link em “Esqueci minha senha” na tela de login.</p>
              <button type="button" className="btn btn-primary" onClick={irLogin}>Ir para o login</button>
            </>
          ) : okMsg ? (
            <>
              <strong style={{ color: '#16a34a' }}>Senha alterada</strong>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>Entrando no sistema…</p>
            </>
          ) : (
            <>
              <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)' }}>Nova senha<input style={inp} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" /></label>
              <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)' }}>Repetir a nova senha<input style={inp} type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} autoComplete="new-password" onKeyDown={(e) => { if (e.key === 'Enter') void salvar(); }} /></label>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>Mínimo de 8 caracteres.</p>
              {erro ? <div style={{ fontSize: 13, color: 'var(--magenta)' }}>{erro}</div> : null}
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void salvar()}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
