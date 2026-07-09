import { useState } from 'react';
import { SelectField } from '../ui/Field';
import type { Estrutura } from '../../lib/api/estruturaObra';

export type EstruturaPecaPick = { local: string; estrutura_id: string; estrutura_nome: string; peca_id: string; peca_nome: string };

// Dois selects encadeados: Estrutura (Bloco/Torre) -> Peça (Unidade). Ao escolher a peça, chama onPick
// com o texto "Estrutura · Peça" e os ids (para gravar em local_texto + metadata).
export function EstruturaPecaSelect({ estruturas, onPick }: { estruturas: Estrutura[]; onPick: (v: EstruturaPecaPick) => void }) {
  const [estId, setEstId] = useState('');
  const est = estruturas.find((e) => e.id === estId) ?? null;
  return (
    <>
      <SelectField label="Estrutura" value={estId} onChange={(e) => setEstId(e.target.value)}>
        <option value="">—</option>
        {estruturas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </SelectField>
      <SelectField label="Peça" value="" disabled={!est} onChange={(e) => { const p = est?.pecas.find((x) => x.id === e.target.value); if (p && est) onPick({ local: est.nome + ' · ' + p.nome, estrutura_id: est.id, estrutura_nome: est.nome, peca_id: p.id, peca_nome: p.nome }); }}>
        <option value="">{est ? 'Selecionar peça…' : 'Escolha a estrutura'}</option>
        {(est?.pecas ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </SelectField>
    </>
  );
}
