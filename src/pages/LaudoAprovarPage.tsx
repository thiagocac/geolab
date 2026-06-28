import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { decidirLaudoLink } from '../lib/api/laudo';
import { useConfirm } from '../components/ui/ConfirmDialog';

// Página PÚBLICA (fora do gate de auth) — alvo do magic link de aprovação de laudo.
// Aprovar / Devolver / Reprovar + comentário. Uso único: o backend (consume_magic_link_laudo)
// valida hash + expiry + consumed_at. Estilo espelha a ValidarPage (inline + CSS vars).
type Decision = 'aprovar' | 'devolver' | 'reprovar';

const CONFIRM_DECISAO: Record<Decision, { title: string; message: string; confirmLabel: string; danger?: boolean }> = {
  aprovar: { title: 'Aprovar laudo', message: 'Confirma a aprovação deste laudo? Este link é de uso único e a decisão não poderá ser desfeita.', confirmLabel: 'Aprovar' },
  devolver: { title: 'Devolver laudo', message: 'Confirma a devolução do laudo para correção? Este link é de uso único.', confirmLabel: 'Devolver' },
  reprovar: { title: 'Reprovar laudo', message: 'Confirma a reprovação deste laudo? Este link é de uso único e a decisão não poderá ser desfeita.', confirmLabel: 'Reprovar', danger: true },
};

export function LaudoAprovarPage() {
  const { token = '' } = useParams();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<Decision | null>(null);
  const [done, setDone] = useState<{ ok: boolean; msg: string } | null>(null);
  const confirm = useConfirm();

  async function decide(d: Decision) {
    if (!token) { setDone({ ok: false, msg: 'Link inválido: token não informado.' }); return; }
    if ((d === 'devolver' || d === 'reprovar') && !comment.trim()) { setDone({ ok: false, msg: 'Informe um comentário para devolver ou reprovar.' }); return; }
    if (!(await confirm(CONFIRM_DECISAO[d]))) return;
    setBusy(d);
    const r = await decidirLaudoLink(token, d, comment.trim());
    setBusy(null);
    if (r.ok) setDone({ ok: true, msg: 'Laudo ' + (r.numero ?? '') + ' — decisão registrada (status: ' + (r.status ?? '-') + ').' });
    else setDone({ ok: false, msg: r.error ?? 'Falha ao registrar a decisão.' });
  }

  const btn = (bg: string) => ({ padding: '10px 14px', borderRadius: 8, border: 'none', color: '#fff', fontWeight: 800, cursor: busy ? 'default' : 'pointer', background: bg, opacity: busy ? 0.6 : 1 } as const);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--paper)' }}>
      <div style={{ width: '100%', maxWidth: 520, display: 'grid', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)' }}>Concresoft</div>
          <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Aprovação de laudo</div>
        </div>
        <div className="card" style={{ padding: 20, display: 'grid', gap: 14 }}>
          {done?.ok ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>Decisão registrada</div>
              <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: '6px 0 0' }}>{done.msg}</p>
            </div>
          ) : !token ? (
            <p style={{ margin: 0, color: 'var(--ink-faint)' }}>Link inválido: token não informado.</p>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>Revise o laudo (PDF enviado junto deste link) e registre sua decisão. <strong>Este link é de uso único.</strong></p>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--ink-faint)' }}>
                Comentário (obrigatório para devolver/reprovar)
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
              </label>
              {done && !done.ok ? <p style={{ margin: 0, fontSize: 13, color: 'var(--magenta)' }}>{done.msg}</p> : null}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" disabled={!!busy} style={btn('#16a34a')} onClick={() => void decide('aprovar')}>{busy === 'aprovar' ? '...' : 'Aprovar'}</button>
                <button type="button" disabled={!!busy} style={btn('#d97706')} onClick={() => void decide('devolver')}>{busy === 'devolver' ? '...' : 'Devolver'}</button>
                <button type="button" disabled={!!busy} style={btn('#dc2626')} onClick={() => void decide('reprovar')}>{busy === 'reprovar' ? '...' : 'Reprovar'}</button>
              </div>
            </>
          )}
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-faint)' }}>lab.consultegeo.org</p>
      </div>
    </div>
  );
}
