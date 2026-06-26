import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingState } from '../ui/State';
import { useToast } from '../../lib/toast';
import { listComentarios, postarComentario, resolverComentario } from '../../lib/api/comentarios';

// Thread de comentários/contestações de um laudo. Usado no portal (cliente) e na LaudosPage (staff).
export function ComentariosLaudo({ labReportId, workId, podeResolver = false, podeComentar = true, podeContestar = true }: { labReportId: string; workId: string | null; podeResolver?: boolean; podeComentar?: boolean; podeContestar?: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [msg, setMsg] = useState('');
  const [contestar, setContestar] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['comentarios', labReportId], queryFn: () => listComentarios(labReportId) });
  const lista = q.data ?? [];

  async function enviar() {
    if (!msg.trim()) return;
    if (!workId) { toast('Laudo sem obra vinculada.', 'error'); return; }
    setBusy(true);
    try {
      await postarComentario(workId, msg.trim(), { labReportId, tipo: contestar ? 'contestacao' : 'comentario' });
      setMsg(''); setContestar(false);
      await qc.invalidateQueries({ queryKey: ['comentarios', labReportId] });
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function resolver(id: string, resolvido: boolean) {
    try { await resolverComentario(id, resolvido); await qc.invalidateQueries({ queryKey: ['comentarios', labReportId] }); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <div className="space-y-3 p-3">
      {q.isLoading ? <LoadingState /> : lista.length === 0 ? <p className="text-sm text-slate-500">Sem comentários ainda.</p> : (
        <div className="space-y-2">
          {lista.map((c) => (
            <div key={c.id} className={'rounded-lg border p-2.5 text-sm ' + (c.autor_tipo === 'cliente' ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40' : 'border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-900/10')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{c.autor_nome ?? (c.autor_tipo === 'cliente' ? 'Cliente' : 'Laboratório')}</span>
                <Badge tone={c.autor_tipo === 'cliente' ? 'neutral' : 'info'}>{c.autor_tipo === 'cliente' ? 'Cliente' : 'Laboratório'}</Badge>
                {c.tipo === 'contestacao' ? <Badge tone={c.resolvido_at ? 'success' : 'danger'}>{c.resolvido_at ? 'Contestação resolvida' : 'Contestação'}</Badge> : null}
                <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                {podeResolver && c.tipo === 'contestacao' ? <button type="button" className="ml-auto text-xs text-slate-500 underline hover:text-slate-900 dark:hover:text-slate-100" onClick={() => void resolver(c.id, !c.resolvido_at)}>{c.resolvido_at ? 'Reabrir' : 'Marcar resolvida'}</button> : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{c.mensagem}</p>
            </div>
          ))}
        </div>
      )}
      {podeComentar ? (
        <div className="space-y-2">
          <textarea className="input min-h-[60px] w-full" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Escreva um comentário ou dúvida sobre este laudo..." />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {podeContestar ? <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={contestar} onChange={(e) => setContestar(e.target.checked)} /> Registrar como contestação de resultado</label> : <span />}
            <Button onClick={() => void enviar()} disabled={busy || !msg.trim()}>{busy ? 'Enviando...' : 'Enviar'}</Button>
          </div>
        </div>
      ) : <p className="text-xs text-slate-400">Seu acesso não permite comentar neste laudo.</p>}
    </div>
  );
}
