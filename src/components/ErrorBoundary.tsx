import { Component, type ReactNode } from 'react';
import { captureException, flush } from '../lib/telemetry';

/**
 * ErrorBoundary global (auditoria de observabilidade v173).
 * Antes: um erro de render derrubava a árvore inteira (tela branca) e o evento só chegava ao
 * window.onerror, sem component stack. Agora: registra como 'fatal' (conta no crash-free de
 * v_release_health), guarda o component stack e mostra fallback com recarga.
 * Fallback com estilos inline de propósito: não depende de providers/DS que podem ter quebrado.
 */
type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    const msg = error instanceof Error ? error.message : String(error);
    // Chunk stale pós-deploy: recuperável por reload (guard anti-loop por query param); não loga fatal.
    if (/dynamically imported module|Importing a module script failed|error loading dynamically imported/i.test(msg)) {
      try { const u = new URL(window.location.href); const last = Number(u.searchParams.get('_r') || '0'); if (Date.now() - last > 15000) { u.searchParams.set('_r', String(Date.now())); window.location.replace(u.toString()); } } catch { /* */ }
      return;
    }
    captureException(error, {
      category: 'react',
      severity: 'fatal',
      metadata: { component_stack: (info?.componentStack ?? '').slice(0, 4000) },
    });
    void flush();
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif', background: 'var(--paper, #fff)', color: 'var(--ink, #1c1917)' }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink, #182863)', marginBottom: 8 }}>Algo deu errado</div>
          <p style={{ fontSize: 14, color: 'var(--ink-faint, #57534e)', margin: '0 0 16px' }}>
            O erro foi registrado e a equipe será notificada. Recarregue a página para continuar.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#182863', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Recarregar a página
          </button>
        </div>
      </div>
    );
  }
}
