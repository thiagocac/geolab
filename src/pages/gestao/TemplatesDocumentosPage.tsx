import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { openDeferredTab } from '../../lib/pdf';
import {
  listTemplates, upsertTemplate, listVersions, saveDraft, publishVersion, gerarDocumentoPdf, propostaTemplatePadrao,
  type DocTemplate, type BlocoDoc,
} from '../../lib/api/documentTemplates';

// SPEC-01 (v214) — Editor de templates de documentos por BLOCOS (decisão 10/07).
// Fluxo: template → versões (draft → published → archived). Preview renderiza a draft com
// sample_data pela própria EF (o que você vê é o motor real, não uma simulação de tela).
// Placeholders {{caminho.prop}} resolvem contra o contexto da RPC render_document_context.

const ESCOPOS: Array<{ value: DocTemplate['escopo']; label: string }> = [
  { value: 'proposta', label: 'Proposta' }, { value: 'contrato', label: 'Contrato' }, { value: 'medicao', label: 'Medição' },
  { value: 'recibo', label: 'Recibo' }, { value: 'declaracao', label: 'Declaração' }, { value: 'outro', label: 'Outro' },
];
const TIPOS_BLOCO: Array<{ value: BlocoDoc['type']; label: string }> = [
  { value: 'titulo', label: 'Título de seção' }, { value: 'paragrafo', label: 'Parágrafo' },
  { value: 'chave_valor', label: 'Campos (rótulo: valor)' }, { value: 'tabela_itens', label: 'Tabela de itens' },
  { value: 'divisor', label: 'Linha divisória' }, { value: 'espaco', label: 'Espaço' }, { value: 'assinaturas', label: 'Assinaturas' },
];
const PLACEHOLDERS_AJUDA = 'Placeholders: {{lab.nome}} {{lab.responsavel_tecnico}} {{hoje}} · proposta: {{proposta.numero}} {{proposta.validade}} {{proposta.valor_total}} (itens em proposta.itens: descricao, unidade, quantidade, preco_unitario, total) · contrato: {{contrato.numero}} {{contrato.vigencia_fim}} (itens em contrato.itens) · cliente: {{cliente.razao_social}} {{cliente.cnpj_cpf}}';

function novoBloco(type: BlocoDoc['type']): BlocoDoc {
  if (type === 'chave_valor') return { type, rows: [{ label: 'Rótulo', value: '{{cliente.razao_social}}' }] };
  if (type === 'tabela_itens') return { type, source: 'proposta.itens', total_path: 'total', total_label: 'Valor total', columns: [{ header: 'Descrição', path: 'descricao', width: 4 }, { header: 'Qtd', path: 'quantidade', format: 'numero', width: 1 }, { header: 'Total', path: 'total', format: 'moeda', width: 1.5 }] };
  if (type === 'espaco') return { type, h: 12 };
  if (type === 'assinaturas') return { type, left: '{{lab.responsavel_tecnico}} — {{lab.nome}}', right: '{{cliente.razao_social}}' };
  if (type === 'titulo') return { type, text: 'Título da seção' };
  if (type === 'paragrafo') return { type, text: 'Texto do parágrafo com {{placeholders}} opcionais.' };
  return { type };
}

function BlocoEditor({ b, onChange, onRemove, onMove }: { b: BlocoDoc; onChange: (nb: BlocoDoc) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void }) {
  const tipoLabel = TIPOS_BLOCO.find((t) => t.value === b.type)?.label ?? b.type;
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">{tipoLabel}</span>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onMove(-1)} className="rounded border border-slate-300 px-2 text-xs dark:border-slate-600" aria-label="Mover para cima">↑</button>
          <button type="button" onClick={() => onMove(1)} className="rounded border border-slate-300 px-2 text-xs dark:border-slate-600" aria-label="Mover para baixo">↓</button>
          <button type="button" onClick={onRemove} className="rounded border border-red-300 px-2 text-xs font-bold text-red-600 dark:border-red-800" aria-label="Remover bloco">✕</button>
        </div>
      </div>
      {b.type === 'titulo' || b.type === 'paragrafo' ? (
        <TextArea label="" rows={b.type === 'paragrafo' ? 3 : 1} value={b.text ?? ''} onChange={(e) => onChange({ ...b, text: e.target.value })} />
      ) : null}
      {b.type === 'chave_valor' ? (
        <div className="grid gap-2">
          {(b.rows ?? []).map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-end gap-2">
              <Field label={i === 0 ? 'Rótulo' : ''} value={r.label} onChange={(e) => { const rows = [...(b.rows ?? [])]; rows[i] = { ...rows[i], label: e.target.value }; onChange({ ...b, rows }); }} />
              <Field label={i === 0 ? 'Valor (aceita {{placeholder}})' : ''} value={r.value} onChange={(e) => { const rows = [...(b.rows ?? [])]; rows[i] = { ...rows[i], value: e.target.value }; onChange({ ...b, rows }); }} />
              <Button variant="ghost" onClick={() => onChange({ ...b, rows: (b.rows ?? []).filter((_, j) => j !== i) })}>✕</Button>
            </div>
          ))}
          <div><Button variant="secondary" onClick={() => onChange({ ...b, rows: [...(b.rows ?? []), { label: '', value: '' }] })}>Adicionar campo</Button></div>
        </div>
      ) : null}
      {b.type === 'tabela_itens' ? (
        <div className="grid gap-2">
          <div className="grid gap-2 md:grid-cols-3">
            <Field label="Fonte (lista do contexto)" value={b.source ?? ''} onChange={(e) => onChange({ ...b, source: e.target.value })} placeholder="proposta.itens" />
            <Field label="Somar coluna (opcional)" value={b.total_path ?? ''} onChange={(e) => onChange({ ...b, total_path: e.target.value })} placeholder="total" />
            <Field label="Rótulo do total" value={b.total_label ?? ''} onChange={(e) => onChange({ ...b, total_label: e.target.value })} placeholder="Valor total" />
          </div>
          {(b.columns ?? []).map((c, i) => (
            <div key={i} className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] items-end gap-2">
              <Field label={i === 0 ? 'Cabeçalho' : ''} value={c.header} onChange={(e) => { const cols = [...(b.columns ?? [])]; cols[i] = { ...cols[i], header: e.target.value }; onChange({ ...b, columns: cols }); }} />
              <Field label={i === 0 ? 'Campo (path)' : ''} value={c.path} onChange={(e) => { const cols = [...(b.columns ?? [])]; cols[i] = { ...cols[i], path: e.target.value }; onChange({ ...b, columns: cols }); }} />
              <SelectField label={i === 0 ? 'Formato' : ''} value={c.format ?? ''} onChange={(e) => { const cols = [...(b.columns ?? [])]; cols[i] = { ...cols[i], format: e.target.value || undefined }; onChange({ ...b, columns: cols }); }}>
                <option value="">texto</option><option value="numero">número</option><option value="moeda">moeda</option>
              </SelectField>
              <Field label={i === 0 ? 'Largura' : ''} type="number" value={String(c.width ?? 1)} onChange={(e) => { const cols = [...(b.columns ?? [])]; cols[i] = { ...cols[i], width: Number(e.target.value) || 1 }; onChange({ ...b, columns: cols }); }} />
              <Button variant="ghost" onClick={() => onChange({ ...b, columns: (b.columns ?? []).filter((_, j) => j !== i) })}>✕</Button>
            </div>
          ))}
          <div><Button variant="secondary" onClick={() => onChange({ ...b, columns: [...(b.columns ?? []), { header: '', path: '' }] })}>Adicionar coluna</Button></div>
        </div>
      ) : null}
      {b.type === 'espaco' ? <Field label="Altura (pontos)" type="number" value={String(b.h ?? 12)} onChange={(e) => onChange({ ...b, h: Number(e.target.value) || 12 })} /> : null}
      {b.type === 'assinaturas' ? (
        <div className="grid gap-2 md:grid-cols-2">
          <Field label="Assinatura esquerda" value={b.left ?? ''} onChange={(e) => onChange({ ...b, left: e.target.value })} />
          <Field label="Assinatura direita" value={b.right ?? ''} onChange={(e) => onChange({ ...b, right: e.target.value })} />
        </div>
      ) : null}
    </div>
  );
}

export function TemplatesDocumentosPage() {
  const { member, can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const podeGerenciar = can('documento_template.gerenciar');
  const templatesQ = useQuery({ queryKey: ['doc-templates'], queryFn: listTemplates });
  const templates = templatesQ.data ?? [];

  const [editorOpen, setEditorOpen] = useState(false);
  const [tpl, setTpl] = useState<DocTemplate & { id?: string }>({ key: '', nome: '', escopo: 'proposta', descricao: '', ativo: true });
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [publishedInfo, setPublishedInfo] = useState<string>('');
  const [titleTemplate, setTitleTemplate] = useState('Documento');
  const [blocks, setBlocks] = useState<BlocoDoc[]>([]);
  const [sampleText, setSampleText] = useState('{}');
  const [tipoNovo, setTipoNovo] = useState<BlocoDoc['type']>('paragrafo');
  const [salvando, setSalvando] = useState(false);

  function abrirNovo(preset?: 'proposta') {
    const p = preset === 'proposta' ? propostaTemplatePadrao() : null;
    setTpl({ key: preset === 'proposta' ? 'proposta-padrao' : '', nome: preset === 'proposta' ? 'Proposta comercial padrão' : '', escopo: 'proposta', descricao: '', ativo: true });
    setDraftId(undefined); setPublishedInfo('');
    setTitleTemplate(p?.title_template ?? 'Documento');
    setBlocks(p?.blocks ?? []);
    setSampleText(JSON.stringify(p?.sample_data ?? {}, null, 2));
    setEditorOpen(true);
  }
  async function abrirEdicao(t: DocTemplate & { id: string }) {
    setTpl(t);
    try {
      const versoes = await listVersions(t.id);
      const draft = versoes.find((v) => v.status === 'draft');
      const pub = versoes.find((v) => v.status === 'published');
      const base = draft ?? pub;
      setDraftId(draft?.id);
      setPublishedInfo(pub ? `v${pub.version} publicada` : 'nenhuma versão publicada');
      setTitleTemplate(base?.title_template ?? 'Documento');
      setBlocks((base?.blocks ?? []) as BlocoDoc[]);
      setSampleText(JSON.stringify(base?.sample_data ?? {}, null, 2));
      setEditorOpen(true);
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  function parseSample(): Record<string, unknown> | null {
    try { const v = JSON.parse(sampleText || '{}'); return v && typeof v === 'object' ? v as Record<string, unknown> : {}; }
    catch { toast('Dados de exemplo não são um JSON válido.', 'error'); return null; }
  }
  async function salvarRascunho(): Promise<string | null> {
    if (!tpl.key.trim() || !tpl.nome.trim()) { toast('Informe identificador e nome do template.', 'info'); return null; }
    const sample = parseSample();
    if (sample === null) return null;
    setSalvando(true);
    try {
      const tplId = await upsertTemplate({ ...tpl, tenant_id: member?.tenant_id });
      const id = await saveDraft(tplId, member?.tenant_id ?? '', { title_template: titleTemplate, blocks, sample_data: sample }, draftId);
      setTpl((s) => ({ ...s, id: tplId }));
      setDraftId(id);
      await qc.invalidateQueries({ queryKey: ['doc-templates'] });
      toast('Rascunho salvo.', 'success');
      return id;
    } catch (e) { toast((e as Error).message, 'error'); return null; }
    finally { setSalvando(false); }
  }
  async function verPreview() {
    const id = await salvarRascunho();
    if (!id) return;
    const tab = openDeferredTab('Gerando preview do documento…');
    try {
      const blob = await gerarDocumentoPdf({ templateVersionId: id, entityType: tpl.escopo, preview: true });
      tab.openBlob(blob, 'preview-' + tpl.key + '.pdf');
    } catch (e) { tab.fail(); toast((e as Error).message, 'error'); }
  }
  async function publicar() {
    const id = await salvarRascunho();
    if (!id || !tpl.id) return;
    const ok = await confirm({ title: 'Publicar template', message: 'A versão publicada passa a ser usada nos documentos oficiais e a anterior é arquivada (documentos já gerados não mudam). Publicar?', confirmLabel: 'Publicar' });
    if (!ok) return;
    try {
      await publishVersion(tpl.id, id);
      setDraftId(undefined);
      await qc.invalidateQueries({ queryKey: ['doc-templates'] });
      toast('Versão publicada.', 'success');
      setEditorOpen(false);
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  function moveBloco(i: number, dir: -1 | 1) {
    setBlocks((bs) => { const j = i + dir; if (j < 0 || j >= bs.length) return bs; const nb = [...bs]; const t = nb[i]; nb[i] = nb[j]; nb[j] = t; return nb; });
  }

  return (
    <div className="space-y-4">
      <PageHeader kicker="Gestão" title="Templates de documentos" description="Modelos de proposta, contrato e declarações com campos dinâmicos — o PDF oficial sai sempre do template publicado." />
      <Card>
        <CardHeader kicker="Modelos" title="Templates do laboratório">{PLACEHOLDERS_AJUDA}</CardHeader>
        <div className="space-y-3 p-4">
          {podeGerenciar ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => abrirNovo('proposta')}>Novo a partir do modelo de proposta</Button>
              <Button onClick={() => abrirNovo()}>Novo template</Button>
            </div>
          ) : null}
          {templatesQ.isLoading ? <LoadingState /> : templatesQ.isError ? <ErrorState message={(templatesQ.error as Error).message} /> : templates.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhum template ainda. Comece pelo modelo de proposta pronto — dá para publicar em um minuto e ajustar depois.</p>
          ) : (
            <div className="table-scroll"><table className="table"><thead><tr><th>Nome</th><th>Identificador</th><th>Tipo</th><th>Status</th><th>Ações</th></tr></thead><tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="font-semibold">{t.nome}</td><td>{t.key}</td>
                  <td>{ESCOPOS.find((e) => e.value === t.escopo)?.label ?? t.escopo}</td>
                  <td>{t.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td><button type="button" className="font-bold text-blue-700" onClick={() => void abrirEdicao(t)}>{podeGerenciar ? 'Editar' : 'Ver'}</button></td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </div>
      </Card>

      <Modal open={editorOpen} wide title={tpl.id ? `Template: ${tpl.nome}` : 'Novo template'} onClose={() => setEditorOpen(false)}
        footer={<>
          <Button variant="ghost" onClick={() => setEditorOpen(false)}>Fechar</Button>
          {podeGerenciar ? <Button variant="secondary" disabled={salvando} onClick={() => void salvarRascunho()}>Salvar rascunho</Button> : null}
          <Button variant="secondary" disabled={salvando} onClick={() => void verPreview()}>Ver preview (PDF)</Button>
          {podeGerenciar ? <Button disabled={salvando} onClick={() => void publicar()}>Publicar</Button> : null}
        </>}>
        <div className="grid gap-3">
          {publishedInfo ? <p className="text-xs text-slate-500">{publishedInfo}{draftId ? ' · editando rascunho' : ' · alterações criam um novo rascunho'}</p> : null}
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Nome" required value={tpl.nome} onChange={(e) => setTpl((s) => ({ ...s, nome: e.target.value }))} />
            <Field label="Identificador (único)" required value={tpl.key} onChange={(e) => setTpl((s) => ({ ...s, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') }))} disabled={!!tpl.id} />
            <SelectField label="Tipo de documento" value={tpl.escopo} onChange={(e) => setTpl((s) => ({ ...s, escopo: e.target.value as DocTemplate['escopo'] }))}>
              {ESCOPOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </SelectField>
          </div>
          <Field label="Título do documento (aceita {{placeholder}})" value={titleTemplate} onChange={(e) => setTitleTemplate(e.target.value)} />
          <div className="grid gap-2">
            <span className="text-sm font-bold">Blocos do documento</span>
            {blocks.length === 0 ? <p className="text-sm text-slate-500">Sem blocos — adicione abaixo ou comece pelo modelo pronto.</p> : null}
            {blocks.map((b, i) => (
              <BlocoEditor key={i} b={b}
                onChange={(nb) => setBlocks((bs) => bs.map((x, j) => (j === i ? nb : x)))}
                onRemove={() => setBlocks((bs) => bs.filter((_, j) => j !== i))}
                onMove={(dir) => moveBloco(i, dir)} />
            ))}
            <div className="flex items-end gap-2">
              <div className="w-64"><SelectField label="Adicionar bloco" value={tipoNovo} onChange={(e) => setTipoNovo(e.target.value as BlocoDoc['type'])}>{TIPOS_BLOCO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</SelectField></div>
              <Button variant="secondary" onClick={() => setBlocks((bs) => [...bs, novoBloco(tipoNovo)])}>Adicionar</Button>
            </div>
          </div>
          <TextArea label="Dados de exemplo do preview (JSON)" rows={6} value={sampleText} onChange={(e) => setSampleText(e.target.value)} hint="Usados só no preview quando não há uma proposta/contrato real selecionado." />
        </div>
      </Modal>
    </div>
  );
}
