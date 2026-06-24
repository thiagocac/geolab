import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Check, LogOut } from '../components/ui/icons';

// N vínculos: lista os laboratórios e troca via select_tenant. Quem desmonta a tela
// é a flag needsTenantSelection no App (ao resolver o member).
export function TenantSelectionPage() {
  const { tenants, selectTenant, signOut } = useAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Selecione o laboratório</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {tenants.map((t) => (
            <button
              key={t.tenant_id}
              type="button"
              onClick={() => void selectTenant(t.tenant_id)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontWeight: 600 }}>{t.tenant_name}<small style={{ color: 'var(--ink-faint)', fontWeight: 400 }}> · {t.role}</small></span>
              {t.is_selected ? <Check size={18} /> : null}
            </button>
          ))}
        </div>
        <Button variant="ghost" leftIcon={<LogOut size={16} />} onClick={() => void signOut()}>Sair</Button>
      </div>
    </div>
  );
}
