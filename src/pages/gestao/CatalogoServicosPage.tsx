import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { NumField } from '../../components/ui/NumField';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { TIPO_COBRANCA_OPCOES } from '../../lib/api/contractFinance';
import { listCatalogItems, upsertCatalogItem, seedCatalogDefaults, type CatalogItem } from '../../lib/api/serviceCatalog';

// SPEC-02 (v214) — Catálogo mestre de serviços: fonte única de descrição/unidade/preço sugerido.
// A tabela de preços (por lab/cliente/obra) importa daqui; propostas selecionam daqui (SPEC-03).

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CatalogoServicosPage() {
  const { member, can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const podeEditar = can('servico_catalogo.gerenciar');
  const q = useQuery({ queryKey: ['service-catalog'], queryFn: listCatalogItems });
  const items = q.data ?? [];
  const novo = (): CatalogItem => ({ code: '', nome: '', descricao: '', unidade: 'un', tipo_cobranca: 'por_cp_ensaiado', preco_sugerido: 0, custo_estimado: 0, ativo: true });
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<CatalogItem>(novo);
  const labelTipo = (v: string) => TIPO_COBRANCA_OPCOES.find((x) => x.value === v)?.label ?? v;

  function abrirNovo() { setEditando(false); setForm(novo()); setOpen(true); }
  function abrirEdit(it: CatalogItem) { setEditando(true); setForm({ ...it }); setOpen(true); }
  function setTipo(v: string) { const o = TIPO_COBRANCA_OPCOES.find((x) => x.value === v); setForm((s) => ({ ...s, tipo_cobranca: v, unidade: s.unidade && s.unidade !== 'un' ? s.unidade : (o?.unidade ?? 'un'), nome: s.nome || (o?.label ?? '') })); }

  async function salvar() {
    if (!form.code.trim() || !form.nome.trim()) { toast('Informe código e nome.', 'info'); return; }
    try {
      await upsertCatalogItem({ ...form, tenant_id: member?.tenant_id });
      await qc.invalidateQueries({ queryKey: ['service-catalog'] });
      setOpen(false); toast('Item salvo.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function toggleAtivo(it: CatalogItem) {
    try { await upsertCatalogItem({ ...it, ativo: !it.ativo }); await qc.invalidateQueries({ queryKey: ['service-catalog'] }); toast(it.ativo ? 'Item desativado.' : 'Item ativado.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function criarPadrao() {
    try { const n = await seedCatalogDefaults(); await qc.invalidateQueries({ queryKey: ['service-catalog'] }); toast(n > 0 ? `${n} item(ns) padrão criados.` : 'Itens padrão já existiam.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <Card>
      <CardHeader title="Catálogo de serviços" kicker="Fonte única de preços sugeridos">Itens que o laboratório vende (CP, laudo, visita, fôrma, mensalidade). A tabela de preços por cliente/obra e as propostas importam daqui — o código não muda depois de usado.</CardHeader>
      <div className="space-y-3 p-4">
        {podeEditar ? (
          <div className="flex flex-wrap justify-end gap-2">
            {items.length === 0 ? <Button variant="secondary" onClick={() => void criarPadrao()}>Criar itens padrão</Button> : null}
            <Button onClick={abrirNovo}>Adicionar serviço</Button>
          </div>
        ) : <p className="text-sm text-slate-500">Somente perfis com permissão de gestão editam o catálogo.</p>}
        {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Catálogo vazio. Use “Criar itens padrão” para começar com os serviços típicos do laboratório.</p>
        ) : (
          <div className="table-scroll"><table className="table"><thead><tr><th>Código</th><th>Serviço</th><th>Cobrança</th><th>Unidade</th><th>Preço sugerido</th><th>Custo estimado</th><th>Status</th>{podeEditar ? <th>Ações</th> : null}</tr></thead><tbody>
            {items.map((it) => (
              <tr key={it.id ?? it.code} className={it.ativo ? '' : 'opacity-50'}>
                <td className="font-semibold">{it.code}</td>
                <td><div className="font-medium">{it.nome}</div>{it.descricao ? <div className="text-xs text-slate-500">{it.descricao}</div> : null}</td>
                <td>{labelTipo(it.tipo_cobranca)}</td><td>{it.unidade}</td>
                <td className="tabular-nums">{money(Number(it.preco_sugerido))}</td>
                <td className="tabular-nums">{money(Number(it.custo_estimado))}</td>
                <td>{it.ativo ? 'Ativo' : 'Inativo'}</td>
                {podeEditar ? <td><div className="flex gap-3"><button type="button" className="font-bold text-blue-700" onClick={() => abrirEdit(it)}>Editar</button><button type="button" className="font-bold text-blue-700" onClick={() => void toggleAtivo(it)}>{it.ativo ? 'Desativar' : 'Ativar'}</button></div></td> : null}
              </tr>
            ))}
          </tbody></table></div>
        )}
      </div>
      <Modal open={open} title={editando ? 'Editar serviço' : 'Novo serviço'} onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()}>Salvar</Button></>}>
        <div className="grid gap-3">
          <SelectField label="Tipo de cobrança" value={form.tipo_cobranca} onChange={(e) => setTipo(e.target.value)}>
            {TIPO_COBRANCA_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            <option value="avulso">Avulso</option>
          </SelectField>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Código (único; não muda após uso)" required value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value.toUpperCase() }))} disabled={editando} />
            <Field label="Unidade" value={form.unidade} onChange={(e) => setForm((s) => ({ ...s, unidade: e.target.value }))} />
          </div>
          <Field label="Nome do serviço" required value={form.nome} onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))} />
          <Field label="Descrição (aparece em propostas/contratos)" value={form.descricao ?? ''} onChange={(e) => setForm((s) => ({ ...s, descricao: e.target.value }))} />
          <div className="grid gap-3 md:grid-cols-2">
            <NumField label="Preço sugerido (R$)" value={form.preco_sugerido} onCommit={(n) => setForm((s) => ({ ...s, preco_sugerido: n ?? 0 }))} min={0} max={9999999} dec={2} />
            <NumField label="Custo estimado (R$)" value={form.custo_estimado} onCommit={(n) => setForm((s) => ({ ...s, custo_estimado: n ?? 0 }))} min={0} max={9999999} dec={2} />
          </div>
        </div>
      </Modal>
    </Card>
  );
}
