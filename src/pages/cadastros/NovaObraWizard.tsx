import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { listClientesRef, createObra, createTracoObra } from '../../lib/api/obras';

const ufs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const str = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown): number | null => { const s = String(v ?? '').trim(); return s === '' ? null : Number(s); };

export function NovaObraWizard() {
  const { member } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [f, setF] = useState<Record<string, unknown>>({ estrutura_habilitada: false, criar_traco: false });
  const [busy, setBusy] = useState(false);
  const clientes = useQuery({ queryKey: ['ref', 'lab_clients', 'nova-obra'], queryFn: listClientesRef });

  function set(k: string, v: unknown) { setF((s) => ({ ...s, [k]: v })); }
  const sigla4 = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
  function avancar() {
    if (!f.client_id) { toast('Selecione o cliente.', 'error'); return; }
    if (!str(f.nome)) { toast('Informe o nome da obra.', 'error'); return; }
    setStep(2);
  }
  async function finalizar() {
    if (!member) return;
    setBusy(true);
    try {
      const workId = await createObra(member.tenant_id, {
        client_id: String(f.client_id), codigo: str(f.codigo) || null, nome: str(f.nome), sigla: str(f.sigla) || null,
        endereco: str(f.endereco) || null, cidade: str(f.cidade) || null, uf: str(f.uf) || null,
        responsavel_tecnico: str(f.responsavel_tecnico) || null, crea: str(f.crea) || null,
        estrutura_habilitada: !!f.estrutura_habilitada,
      });
      if (f.criar_traco && str(f.traco_codigo) && str(f.traco_nome)) {
        await createTracoObra(member.tenant_id, workId, {
          codigo: str(f.traco_codigo), nome: str(f.traco_nome), fck_mpa: num(f.traco_fck),
          padrao_moldagem: [{ idade: 28, unidade: 'dia', quantidade: 2 }],
        });
      }
      toast('Obra criada.', 'success');
      nav('/concretagens');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
      <PageHeader kicker="Concreto" title="Nova obra" description={'Assistente concreto-first - etapa ' + step + ' de 2.'} />
      {step === 1 ? (
        <Card>
          <div style={{ display: 'grid', gap: 12 }}>
            <SelectField label="Cliente" required value={String(f.client_id ?? '')} onChange={(e) => set('client_id', e.target.value)}>
              <option value="">Selecione...</option>
              {(clientes.data ?? []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </SelectField>
            <div style={{ display: 'flex', gap: 12 }}>
              <Field label="Código da obra" value={String(f.codigo ?? '')} onChange={(e) => set('codigo', e.target.value)} />
              <Field label="Nome da obra" required value={String(f.nome ?? '')} onChange={(e) => { const v = e.target.value; set('nome', v); if (!str(f.sigla)) set('sigla', sigla4(v)); }} />
            </div>
            <Field label="Sigla (prefixo do Nº de relatório)" hint="Gerada das 4 primeiras letras do nome; editável." value={String(f.sigla ?? '')} onChange={(e) => set('sigla', e.target.value)} />
            <Field label="Endereço" value={String(f.endereco ?? '')} onChange={(e) => set('endereco', e.target.value)} />
            <div style={{ display: 'flex', gap: 12 }}>
              <Field label="Cidade" value={String(f.cidade ?? '')} onChange={(e) => set('cidade', e.target.value)} />
              <SelectField label="UF" value={String(f.uf ?? '')} onChange={(e) => set('uf', e.target.value)}><option value="">-</option>{ufs.map((u) => <option key={u} value={u}>{u}</option>)}</SelectField>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Field label="Responsavel tecnico" value={String(f.responsavel_tecnico ?? '')} onChange={(e) => set('responsavel_tecnico', e.target.value)} />
              <Field label="CREA" value={String(f.crea ?? '')} onChange={(e) => set('crea', e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button variant="ghost" onClick={() => nav('/concretagens')}>Cancelar</Button>
              <Button onClick={avancar}>Avancar</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={!!f.estrutura_habilitada} onChange={(e) => set('estrutura_habilitada', e.target.checked)} /> Habilitar estrutura (pecas/locais) nesta obra
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <input type="checkbox" checked={!!f.criar_traco} onChange={(e) => set('criar_traco', e.target.checked)} /> Criar um traco inicial para esta obra
            </label>
            {f.criar_traco ? (
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Código do traco" value={String(f.traco_codigo ?? '')} onChange={(e) => set('traco_codigo', e.target.value)} />
                <Field label="Nome" value={String(f.traco_nome ?? '')} onChange={(e) => set('traco_nome', e.target.value)} />
                <Field label="Fck (MPa)" type="number" value={String(f.traco_fck ?? '')} onChange={(e) => set('traco_fck', e.target.value)} />
              </div>
            ) : null}
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>O traco inicial sai com padrao 28d x 2 CP (NBR 5739); ajuste depois em Cadastros &gt; Materiais e ensaios.</p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => void finalizar()} disabled={busy}>{busy ? 'Criando...' : 'Criar obra'}</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
