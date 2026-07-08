import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { FilePicker } from '../../components/ui/FilePicker';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { getSignatureSettings, saveSignatureSettings, uploadRubrica, MODOS, NIVEL_POR_MODO, type SignatureSettings, type SignatureMode } from '../../lib/api/assinatura';
import { assertImagem, assertUploadSize } from '../../lib/upload';

const NIVEL_TONE = { simples: 'neutral', avancada: 'info', qualificada: 'success' } as const;
const NIVEL_LABEL = { simples: 'Assinatura simples', avancada: 'Assinatura avancada', qualificada: 'Assinatura qualificada (ICP-Brasil)' } as const;

export function AssinaturaConfigPage() {
  const { can, member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const pode = can('laudo.assinar_config');

  const q = useQuery({ queryKey: ['signature-settings'], queryFn: getSignatureSettings });
  const [draft, setDraft] = useState<SignatureSettings | null>(null);
  const cur = draft ?? q.data ?? null;
  const [busy, setBusy] = useState(false);
  const [rubricaBusy, setRubricaBusy] = useState(false);

  async function handleRubrica(file?: File) {
    if (!file || !member || !cur) return;
    setRubricaBusy(true);
    try { assertImagem(file); assertUploadSize(file); const path = await uploadRubrica(member.tenant_id, file, cur); setDraft({ ...cur, imagem_rubrica_path: path }); await qc.invalidateQueries({ queryKey: ['signature-settings'] }); toast('Rubrica enviada.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setRubricaBusy(false); }
  }

  function set<K extends keyof SignatureSettings>(k: K, v: SignatureSettings[K]) { if (cur) setDraft({ ...cur, [k]: v }); }

  async function salvar() {
    if (!cur) return;
    setBusy(true);
    try {
      await saveSignatureSettings(cur);
      await qc.invalidateQueries({ queryKey: ['signature-settings'] });
      setDraft(null);
      toast('Configuracao de assinatura salva.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  const nivel = cur ? NIVEL_POR_MODO[cur.modo] : 'simples';
  const isIcp = cur ? (cur.modo === 'a1_local' || cur.modo === 'nuvem_psc') : false;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Configuracoes" title="Assinatura do laudo" description="Define como o laudo e assinado ao ser emitido. O laudo se adapta ao modo escolhido: sem assinatura, QR de validacao, imagem de rubrica ou certificado ICP-Brasil (A1 ou em nuvem)." />
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : cur ? (
        <>
          <Card className="p-5">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Modo de assinatura</h2>
              <Badge tone={NIVEL_TONE[nivel]}>{NIVEL_LABEL[nivel]}</Badge>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {MODOS.map((m) => {
                const sel = cur.modo === m.key;
                const bloq = !pode || !!m.futuro;
                return (
                  <label key={m.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: sel ? 'var(--surface-2, rgba(24,40,99,0.06))' : 'transparent', cursor: bloq ? 'not-allowed' : 'pointer', opacity: m.futuro ? 0.55 : 1 }}>
                    <input type="radio" name="modo-assinatura" checked={sel} disabled={bloq} onChange={() => set('modo', m.key as SignatureMode)} style={{ marginTop: 3 }} />
                    <span>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.label}{m.futuro ? ' (em breve)' : ''}</span>
                      <span className="text-sm" style={{ display: 'block', color: 'var(--ink-faint)' }}>{m.desc}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-black text-slate-950 dark:text-slate-50" style={{ marginBottom: 12 }}>Opcoes</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={cur.exigir_para_emissao} disabled={!pode} onChange={(e) => set('exigir_para_emissao', e.target.checked)} />
                <span className="text-sm">Exigir assinatura para emitir o laudo</span>
              </label>
              {isIcp ? (
                <>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={cur.carimbo_tempo} disabled={!pode} onChange={(e) => set('carimbo_tempo', e.target.checked)} />
                    <span className="text-sm">Carimbo do tempo (AD-RT) — aplicado na fase de endurecimento</span>
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={cur.ltv} disabled={!pode} onChange={(e) => set('ltv', e.target.checked)} />
                    <span className="text-sm">Validacao de longo prazo (LTV / AD-RA)</span>
                  </label>
                </>
              ) : null}
            </div>
          </Card>

          {cur.modo === 'imagem_rubrica' ? (
            <Card className="p-5">
              <h2 className="text-lg font-black text-slate-950 dark:text-slate-50" style={{ marginBottom: 4 }}>Imagem da rubrica</h2>
              <p className="text-sm" style={{ color: 'var(--ink-faint)', marginBottom: 14 }}>Imagem carimbada na area de assinatura do laudo (PNG ou JPG; fundo transparente de preferencia).</p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="text-sm" style={{ color: 'var(--ink-faint)' }}>{cur.imagem_rubrica_path ? 'Rubrica enviada.' : 'Nenhuma rubrica enviada.'}</span>
                {pode ? <FilePicker label={rubricaBusy ? 'Enviando...' : 'Escolher imagem'} accept="image/png,image/jpeg" disabled={rubricaBusy} resetAfter onFiles={(fs) => void handleRubrica(fs[0])} /> : null}
              </div>
            </Card>
          ) : null}

          {isIcp ? (
            <Card className="p-5">
              <h2 className="text-lg font-black text-slate-950 dark:text-slate-50" style={{ marginBottom: 4 }}>Titular do certificado</h2>
              <p className="text-sm" style={{ color: 'var(--ink-faint)', marginBottom: 14 }}>Quem assina. O upload do certificado A1 e as credenciais de nuvem entram nas proximas fases.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <SelectField label="Tipo" value={cur.titular_tipo} disabled={!pode} onChange={(e) => set('titular_tipo', e.target.value as SignatureSettings['titular_tipo'])}>
                  <option value="">—</option>
                  <option value="e-cpf">e-CPF (RT)</option>
                  <option value="e-cnpj">e-CNPJ (laboratorio)</option>
                </SelectField>
                <Field label="Nome do titular" value={cur.titular_nome} disabled={!pode} onChange={(e) => set('titular_nome', e.target.value)} />
                <Field label="CPF / CNPJ" value={cur.titular_doc} disabled={!pode} onChange={(e) => set('titular_doc', e.target.value)} />
              </div>
            </Card>
          ) : null}

          {pode ? (
            <div><Button onClick={() => void salvar()} disabled={busy || !draft}>{busy ? 'Salvando...' : 'Salvar assinatura'}</Button></div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Configuracao restrita a quem tem a permissao de configurar assinatura.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
