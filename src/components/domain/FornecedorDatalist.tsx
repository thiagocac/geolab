import { useQuery } from '@tanstack/react-query';
import { listFornecedores } from '../../lib/api/concretagem';

// T8: datalist compartilhado do autocompletar de fornecedor (campo segue texto livre — spec v1).
export const FORNECEDORES_DL = 'fornecedores-conhecidos';
export function FornecedorDatalist() {
  const q = useQuery({ queryKey: ['fornecedores-dl'], staleTime: 5 * 60 * 1000, queryFn: listFornecedores });
  return <datalist id={FORNECEDORES_DL}>{(q.data ?? []).map((f) => <option key={f} value={f} />)}</datalist>;
}
