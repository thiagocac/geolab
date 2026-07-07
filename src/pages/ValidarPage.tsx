import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { validarLaudo } from '../lib/api/validar';

function Row({ k, val }: { k: string; val?: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textAlign: 'right' }}>{val ?? '-'}</span>
    </div>
  );
}

export function ValidarPage() {
  const { codigo = '' } = useParams();
  const q = useQuery({ queryKey: ['validar', codigo], queryFn: () => validarLaudo(codigo), enabled: !!codigo });
  const v = q.data;
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--paper)' }}>
      <div style={{ width: '100%', maxWidth: 520, display: 'grid', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)' }}>Concresoft</div>
          <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Validação pública de laudo</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          {!codigo ? <p style={{ margin: 0, color: 'var(--ink-faint)' }}>Código não informado.</p>
            : q.isLoading ? <p style={{ margin: 0, color: 'var(--ink-faint)' }}>Verificando...</p>
            : !v?.found ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--magenta)' }}>Laudo não encontrado</div>
                <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: '6px 0 0' }}>O codigo informado não corresponde a um laudo registrado.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: v.status === 'emitido' ? '#16a34a' : '#d97706' }} />
                  <strong style={{ color: 'var(--ink)' }}>{v.status === 'emitido' ? 'Laudo emitido e autêntico' : 'Laudo registrado (' + v.status + ')'}</strong>
                </div>
                <Row k="Número do laudo" val={v.numero} />
                <Row k="Concretagem" val={v.concretagem} />
                <Row k="Data de emissão" val={v.data_emissao} />
                <Row k="Revisão" val={'R' + (v.revisao ?? 0)} />
                <Row k="Laboratório" val={v.laboratorio} />
                <Row k="Responsavel tecnico" val={v.responsavel_tecnico} />
              </div>
            )}
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-faint)' }}>app.concresoft.io</p>
      </div>
    </div>
  );
}
