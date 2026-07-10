import { useAuth } from '../../lib/auth';
import { TabShell } from '../../components/patterns/TabShell';
import { NcPage } from './NcPage';
import { DiarioCuraPage } from '../gestao/DiarioCuraPage';
import { Iso17025Page } from '../gestao/Iso17025Page';

// [v228] Hub Qualidade — NC, diario de cura (NBR 5738) e ISO 17025 em abas.
export function QualidadePage({ inicial = 'nc' }: { inicial?: 'nc' | 'cura' | 'iso' }) {
  const { hasRole, can } = useAuth();
  const lab = hasRole('admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista', 'operador_campo', 'financeiro');
  return (
    <TabShell inicial={inicial} vazio="Sem acesso à qualidade." tabs={[
      { key: 'nc', label: 'Não-conformidades', ok: lab, render: () => <NcPage /> },
      { key: 'cura', label: 'Diário de cura', ok: can('cura.ver'), render: () => <DiarioCuraPage /> },
      { key: 'iso', label: 'ISO 17025', ok: can('iso17025.ver'), render: () => <Iso17025Page /> },
    ]} />
  );
}
