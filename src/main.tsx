import React from 'react';
import ReactDOM from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { App } from './App';
import './styles.css';
import { initTelemetry, log } from './lib/telemetry';
import { ErrorBoundary } from './components/ErrorBoundary';

initTelemetry();

// Observabilidade (v173): erros de query/mutation (RLS, 4xx/5xx do PostgREST, rede) viram
// telemetria 'api' — antes eram invisíveis (só toast local). Dispara APÓS os retries esgotarem.
const describeError = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);
const safeKey = (k: unknown) => { try { return JSON.stringify(k ?? null).slice(0, 200); } catch { return String(k).slice(0, 200); } };
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error, query) => { log.error('api', describeError(error), { kind: 'query', query_key: safeKey(query.queryKey) }); } }),
  mutationCache: new MutationCache({ onError: (error, _variables, _context, mutation) => { log.error('api', describeError(error), { kind: 'mutation', mutation_key: safeKey(mutation.options.mutationKey) }); } }),
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
