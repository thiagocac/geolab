import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { RotaMap } from '../../components/RotaMap';
import { openDeferredTab } from '../../lib/pdf';
import { listColaboradoresRef } from '../../lib/api/formas';
import { coletaWorklist, criarRoteiro, listRoteiros, getRoteiro, baixarItem, concluirRoteiro, cancelarRoteiro, roteiroPdfUrl, mapsUrlDeParadas, getOrigem, worksCoords, geocodificar, reordenarRoteiro, otimizarSequencia, type WorklistObra, type RoteiroItem } from '../../lib/api/coletaFormas';

const hoje = () => new Date().toISOString().slice(0, 10);
const dataBR = (s: string | null) => (s && s.length >= 10 ? s.slice(0, 10).split('-').reverse().join('/') : '—');
const STATUS_COR: Record<string, string> = { pendente: 'var(--ink-faint)', parcial: '#d97706', coletado: '#16a34a', pulado: 'var(--magenta)', aberto: 'var(--ink-faint)', em_rota: '#d97706', concluido: '#16a34a', cancelado: 'var(--magenta)' };
const STATUS_ROTULO: Record<string, string> = { pendente: 'pendente', parcial: 'parcial', coletado: 'coletado', pulado: 'pulado', aberto: 'aberto', em_rota: 'em rota', concluido: 'concluído', cancelado: 'cancelado' };

export function ColetaFormasPage() {
  const { member, hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const nav = useNavigate();
  const podeGerar = hasRole('admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista', 'operador_campo');

  const [aba, setAba] = useState<'coletar' | 'roteiros'>('coletar');
  const [dias, setDias] = useState('1');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [motorista, setMotorista] = useState('');
  const [dataRot, setDataRot] = useState(hoje());
  const [obsRot, setObsRot] = useState('');
  const [busy, setBusy] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [baixaQtd, setBaixaQtd] = useState<Record<string, string>>({});
  const [otimizando, setOtimizando] = useState(false);

  const colabs = useQuery({ queryKey: ['coleta-colabs'], queryFn: listColaboradoresRef });
  const wl = useQuery({ queryKey: ['coleta-worklist', dias], queryFn: () => coletaWorklist(Number(dias) || null), enabled: aba === 'coletar' });
  const roteiros = useQuery({ queryKey: ['coleta-roteiros'], queryFn: listRoteiros, enabled: aba === 'roteiros' });
  const rot = useQuery({ queryKey: ['coleta-roteiro', aberto], queryFn: () => getRoteiro(aberto as string), enabled: !!aberto });
  const origemQ = useQuery({ queryKey: ['coleta-origem'], queryFn: getOrigem });
  const workIds = (rot.data?.itens ?? []).map((i) => i.work_id);
  const coordsQ = useQuery({ queryKey: ['coleta-coords', aberto, workIds.join(',')], queryFn: () => worksCoords(workIds), enabled: !!aberto && workIds.length > 0 });

  const obras = wl.data ?? [];
  const selecionadas = obras.filter((o) => sel.has(o.work_id));
  const totalSel = selecionadas.reduce((s, o) => s + o.total, 0);
  const origemCoord = origemQ.data?.lat != null && origemQ.data?.lng != null ? { lat: origemQ.data.lat, lng: origemQ.data.lng } : null;

  function toggle(id: string) { setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  async function gerar() {
    if (!member) return;
    if (!selecionadas.length) { toast('Selecione ao menos uma obra.', 'error'); return; }
    setBusy(true);
    try {
      const itens = selecionadas.map((o, i) => ({ work_id: o.work_id, ordem: i + 1, qtd_prevista: o.total, detalhe: o }));
      const id = await criarRoteiro({ data: dataRot, motorista_id: motorista || null, observacao: obsRot || null, itens });
      setSel(new Set()); setObsRot('');
      await qc.invalidateQueries({ queryKey: ['coleta-roteiros'] });
      toast('Roteiro criado com ' + itens.length + ' parada(s).', 'success');
      setAberto(id); setAba('roteiros');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  function imprimir(id: string) { const tab = openDeferredTab('Gerando relatório...'); roteiroPdfUrl(id).then((u) => tab.set(u)).catch((e) => { tab.fail(); toast((e as Error).message, 'error'); }); }
  function abrirMaps(paradas: WorklistObra[]) { const u = mapsUrlDeParadas(paradas); if (!u) { toast('Sem endereços para montar a rota.', 'info'); return; } window.open(u, '_blank', 'noopener'); }

  async function baixar(it: RoteiroItem) {
    const raw = baixaQtd[it.id]; const qtd = raw === undefined ? it.qtd_prevista : Math.max(0, Math.round(Number(raw) || 0));
    try {
      await baixarItem(it.id, qtd);
      await qc.invalidateQueries({ queryKey: ['coleta-roteiro', aberto] });
      await qc.invalidateQueries({ queryKey: ['coleta-worklist'] });
      toast('Baixa registrada (' + qtd + ').', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  async function concluir(id: string) {
    if (!(await confirm({ title: 'Concluir roteiro', message: 'Marcar este roteiro como concluído?', confirmLabel: 'Concluir' }))) return;
    try { await concluirRoteiro(id); await qc.invalidateQueries({ queryKey: ['coleta-roteiros'] }); await qc.invalidateQueries({ queryKey: ['coleta-roteiro', id] }); toast('Roteiro concluído.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function cancelar(id: string) {
    if (!(await confirm({ title: 'Cancelar roteiro', message: 'Cancelar o roteiro e reverter as baixas registradas por ele?', danger: true, confirmLabel: 'Cancelar roteiro' }))) return;
    try { await cancelarRoteiro(id); await qc.invalidateQueries({ queryKey: ['coleta-roteiros'] }); await qc.invalidateQueries({ queryKey: ['coleta-roteiro', id] }); await qc.invalidateQueries({ queryKey: ['coleta-worklist'] }); toast('Roteiro cancelado.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  async function otimizar() {
    const d = rot.data; if (!d) return;
    setOtimizando(true);
    try {
      const ids = d.itens.map((i) => i.work_id);
      const gc = await geocodificar(ids, true);
      await qc.invalidateQueries({ queryKey: ['coleta-origem'] });
      const coords = await worksCoords(ids);
      await qc.invalidateQueries({ queryKey: ['coleta-coords'] });
      const origem = gc.origem ?? origemCoord;
      const pts = d.itens.filter((i) => coords[i.work_id]).map((i) => ({ id: i.work_id, lat: coords[i.work_id].lat, lng: coords[i.work_id].lng }));
      if (pts.length < 2) { toast('Poucas obras geocodificadas para otimizar.', 'info'); setOtimizando(false); return; }
      const order = otimizarSequencia(origem, pts);
      const byWork = new Map(d.itens.map((i) => [i.work_id, i.id]));
      const ordens = order.map((wid, idx) => ({ id: byWork.get(wid) as string, ordem: idx + 1 }));
      let next = order.length + 1;
      for (const i of d.itens) if (!coords[i.work_id]) ordens.push({ id: i.id, ordem: next++ });
      await reordenarRoteiro(d.id, ordens);
      await qc.invalidateQueries({ queryKey: ['coleta-roteiro', aberto] });
      const nErr = gc.erros?.length ?? 0;
      toast('Rota otimizada.' + (nErr ? ' ' + nErr + ' obra(s) sem geocodificar.' : ''), 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setOtimizando(false); }
  }

  const detalhe = rot.data;
  const coords = coordsQ.data ?? {};
  const paradasMapa = detalhe ? detalhe.itens.filter((i) => coords[i.work_id]).map((i, idx) => ({ id: i.work_id, label: (idx + 1) + '. ' + (i.detalhe?.obra ?? ''), lat: coords[i.work_id].lat, lng: coords[i.work_id].lng })) : [];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Gestão" title="Coleta de fôrmas" description="Obras com fôrmas a recolher (derivadas das concretagens), roteiro do dia para o motorista, baixa por parada e rota otimizada no mapa." />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant={aba === 'coletar' ? 'primary' : 'secondary'} onClick={() => { setAba('coletar'); setAberto(null); }}>A coletar</Button>
        <Button variant={aba === 'roteiros' ? 'primary' : 'secondary'} onClick={() => setAba('roteiros')}>Roteiros</Button>
      </div>

      {aba === 'coletar' ? (
        <>
          <Card className="p-5">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ maxWidth: 220 }}><Field label="Prontas há ≥ (dias)" type="number" min={0} step={1} value={dias} onChange={(e) => setDias(e.target.value)} hint="Fôrmas de concretagens com pelo menos N dias." /></div>
              <span className="text-sm" style={{ color: 'var(--ink-faint)' }}>{obras.length} obra(s) · {obras.reduce((s, o) => s + o.total, 0)} fôrma(s) em campo</span>
            </div>
            {wl.isLoading ? <LoadingState /> : wl.isError ? <ErrorState message={(wl.error as Error).message} /> : obras.length === 0 ? <EmptyState /> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {obras.map((o) => (
                  <label key={o.work_id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid var(--line)', borderRadius: 12, padding: 12, cursor: 'pointer', background: sel.has(o.work_id) ? 'rgba(24,40,99,0.05)' : undefined }}>
                    <input type="checkbox" checked={sel.has(o.work_id)} onChange={() => toggle(o.work_id)} style={{ marginTop: 3 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700 }}>{o.obra}{o.cliente ? <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}> — {o.cliente}</span> : null}</span>
                        <span style={{ fontWeight: 800, color: 'var(--navy, #182863)' }}>{o.total} fôrmas</span>
                      </div>
                      <div className="text-sm" style={{ color: 'var(--ink-faint)' }}>{[o.endereco, o.cidade, o.uf].filter(Boolean).join(' · ') || 'sem endereço'}{o.telefone ? ' · ' + o.telefone : ''}</div>
                      <div className="text-xs" style={{ color: 'var(--ink-faint)', marginTop: 2 }}>{o.concretagens.map((c) => (c.codigo ?? '—') + ' · ' + dataBR(c.data) + ' (' + c.saldo + ', ' + c.dias + 'd)').join('   ·   ')}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </Card>

          {podeGerar && selecionadas.length ? (
            <Card className="p-5">
              <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
                <div style={{ fontWeight: 800 }}>Montar roteiro — {selecionadas.length} parada(s), {totalSel} fôrma(s)</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Data" type="date" value={dataRot} onChange={(e) => setDataRot(e.target.value)} />
                  <SelectField label="Motorista" value={motorista} onChange={(e) => setMotorista(e.target.value)}>
                    <option value="">—</option>
                    {(colabs.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </SelectField>
                </div>
                <TextArea label="Observação (opcional)" value={obsRot} onChange={(e) => setObsRot(e.target.value)} />
                <div><Button onClick={() => void gerar()} disabled={busy}>{busy ? 'Gerando...' : 'Gerar roteiro do dia'}</Button></div>
              </div>
            </Card>
          ) : null}
        </>
      ) : aberto && detalhe ? (
        <Card className="p-5">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <button type="button" className="text-sm" style={{ color: 'var(--ink-faint)' }} onClick={() => setAberto(null)}>← Roteiros</button>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Roteiro {dataBR(detalhe.data)}</div>
              <div className="text-sm" style={{ color: 'var(--ink-faint)' }}>{detalhe.motorista ? 'Motorista: ' + detalhe.motorista + ' · ' : ''}<span style={{ color: STATUS_COR[detalhe.status], fontWeight: 700 }}>{STATUS_ROTULO[detalhe.status] ?? detalhe.status}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {podeGerar && detalhe.status !== 'cancelado' ? <Button variant="secondary" disabled={otimizando} onClick={() => void otimizar()}>{otimizando ? 'Otimizando...' : 'Otimizar rota'}</Button> : null}
              <Button variant="secondary" onClick={() => abrirMaps(detalhe.itens.map((i) => i.detalhe))}>Abrir no Maps</Button>
              <Button variant="secondary" onClick={() => imprimir(detalhe.id)}>Imprimir relatório</Button>
              {detalhe.status !== 'concluido' && detalhe.status !== 'cancelado' ? <Button variant="secondary" onClick={() => void concluir(detalhe.id)}>Concluir</Button> : null}
              {detalhe.status !== 'cancelado' ? <Button variant="ghost" onClick={() => void cancelar(detalhe.id)}>Cancelar</Button> : null}
            </div>
          </div>

          <div className="text-sm" style={{ color: 'var(--ink-faint)', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Ponto de partida: {origemQ.data?.endereco ? <b style={{ color: 'var(--ink)' }}>{origemQ.data.endereco}</b> : 'não definido'}</span>
            <Button variant="ghost" onClick={() => nav('/preferencias')}>Configurar em Preferências</Button>
          </div>

          {paradasMapa.length ? <div style={{ marginBottom: 12 }}><RotaMap origem={origemCoord} paradas={paradasMapa} /></div> : (coordsQ.isFetching ? <div className="text-xs" style={{ color: 'var(--ink-faint)', marginBottom: 12 }}>Carregando coordenadas…</div> : <div className="text-xs" style={{ color: 'var(--ink-faint)', marginBottom: 12 }}>Sem coordenadas ainda — use "Otimizar rota" para geocodificar as obras.</div>)}

          <div style={{ display: 'grid', gap: 8 }}>
            {detalhe.itens.map((it) => (
              <div key={it.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, color: 'var(--navy, #182863)', minWidth: 18 }}>{it.ordem}</span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700 }}>{it.detalhe?.obra ?? '—'}</div>
                  <div className="text-sm" style={{ color: 'var(--ink-faint)' }}>{[it.detalhe?.endereco, it.detalhe?.cidade, it.detalhe?.uf].filter(Boolean).join(' · ') || 'sem endereço'}</div>
                  <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>Previsto {it.qtd_prevista} · <span style={{ color: STATUS_COR[it.status], fontWeight: 700 }}>{STATUS_ROTULO[it.status] ?? it.status}</span>{it.status !== 'pendente' ? ' · coletado ' + it.qtd_coletada : ''}</div>
                </div>
                {podeGerar && detalhe.status !== 'cancelado' && detalhe.status !== 'concluido' ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input className="input !min-h-9 w-20 px-2 py-1" type="number" min={0} step={1} value={baixaQtd[it.id] ?? String(it.qtd_prevista)} onChange={(e) => setBaixaQtd((p) => ({ ...p, [it.id]: e.target.value }))} aria-label="Quantidade coletada" />
                    <Button variant="secondary" onClick={() => void baixar(it)}>{it.status === 'pendente' ? 'Baixar' : 'Refazer'}</Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          {roteiros.isLoading ? <LoadingState /> : roteiros.isError ? <ErrorState message={(roteiros.error as Error).message} /> : (roteiros.data ?? []).length === 0 ? <EmptyState /> : (
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Data</th><th>Motorista</th><th style={{ textAlign: 'right' }}>Paradas</th><th style={{ textAlign: 'right' }}>Fôrmas</th><th>Status</th><th></th></tr></thead>
                <tbody>{(roteiros.data ?? []).map((r) => (
                  <tr key={r.id}>
                    <td>{dataBR(r.data)}</td>
                    <td>{r.motorista ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{r.n_paradas}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.total}</td>
                    <td><span style={{ color: STATUS_COR[r.status], fontWeight: 700 }}>{STATUS_ROTULO[r.status] ?? r.status}</span></td>
                    <td style={{ textAlign: 'right' }}><Button variant="ghost" onClick={() => setAberto(r.id)}>Abrir</Button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
