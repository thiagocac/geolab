import { Plus, X } from '../ui/icons';
import {
  PADRAO_MOLDAGEM_SHORTCUTS, TIPO_ENSAIO_OPCOES, UNIDADE_IDADE_OPCOES,
  linhaDeAtalho, normalizePadroes, type PadraoMoldagem, type TipoEnsaioPadrao, type UnidadeIdade,
} from '../../lib/concreto';

/**
 * Editor do Padrão de Moldagem de um concreto: tabela de idades de controle
 * (idade, unidade, tipo de ensaio, valor esperado, crescimento %, qtd CP).
 * Valor armazenado como JSON em operational_materials.padrao_moldagem.
 */
export function MoldingStandardEditor({ value, onChange, fck }: { value: PadraoMoldagem[]; onChange: (next: PadraoMoldagem[]) => void; fck?: number | null }) {
  const rows = normalizePadroes(value, fck);
  const set = (id: string, patch: Partial<PadraoMoldagem>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const add = (sc: (typeof PADRAO_MOLDAGEM_SHORTCUTS)[number]) => onChange([...rows, linhaDeAtalho(sc, fck)]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PADRAO_MOLDAGEM_SHORTCUTS.map((sc) => (
          <button key={sc.label} type="button" onClick={() => add(sc)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold ${sc.mode === 'empty'
              ? 'border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
              : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
            {sc.mode === 'empty' ? <Plus size={13} /> : null}{sc.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Nenhuma idade de controle. Use os atalhos acima (ex.: 7 dias, 28 dias, 63 dias).
        </p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>Idade</th>
                <th>Unidade</th>
                <th>Tipo de ensaio</th>
                <th>Qtd CP</th>
                <th className="w-8"><span className="sr-only">Remover</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-xs text-slate-400 dark:text-slate-500">{i + 1}</td>
                  <td><input className="input !min-h-9 w-20 px-2 py-1" type="number" min="0" step="1" value={r.idadeControle} onChange={(e) => set(r.id, { idadeControle: e.target.value })} aria-label={`Idade da linha ${i + 1}`} /></td>
                  <td>
                    <select className="input !min-h-9 w-24 px-2 py-1" value={r.unidadeIdade} onChange={(e) => set(r.id, { unidadeIdade: e.target.value as UnidadeIdade })} aria-label={`Unidade da linha ${i + 1}`}>
                      {UNIDADE_IDADE_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="input !min-h-9 w-44 px-2 py-1" value={r.tipoEnsaio} onChange={(e) => set(r.id, { tipoEnsaio: e.target.value as TipoEnsaioPadrao })} aria-label={`Tipo de ensaio da linha ${i + 1}`}>
                      {TIPO_ENSAIO_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td><input className="input !min-h-9 w-16 px-2 py-1" type="number" min="0" step="1" value={r.quantidadeCp} onChange={(e) => set(r.id, { quantidadeCp: e.target.value })} aria-label={`Quantidade de CPs da linha ${i + 1}`} /></td>
                  <td>
                    <button type="button" className="icon-btn !min-h-8 !min-w-8" onClick={() => remove(r.id)} aria-label={`Remover linha ${i + 1}`} title="Remover"><X size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
