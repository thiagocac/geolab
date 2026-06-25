// Util de download/abertura de arquivos (PDF, planilhas, anexos) robusto para producao.
// Pontos cobertos (praticas atuais de mercado):
// - Download via <a download>: nunca e barrado por popup-blocker e leva o nome de arquivo correto.
// - Object URLs revogados com atraso: revogar cedo demais aborta o download/preview em alguns browsers.
// - "Abrir em nova aba" (visualizar PDF): a aba e aberta SINCRONA, dentro do gesto do clique, e so
//   navegada depois do await. window.open chamado apos um await perde a ativacao do usuario e e
//   bloqueado pelo navegador (era a causa do "clico e nada acontece").

function clickAnchor(url: string, filename?: string): void {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Baixa um Blob como arquivo. Imune a popup-blocker.
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  clickAnchor(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// Baixa a partir de uma URL pronta (ex.: signed URL com Content-Disposition: attachment).
export function saveUrl(url: string, filename?: string): void {
  clickAnchor(url, filename);
}

// Object URL de um Blob com revogacao automatica adiada — para abrir um PDF em nova aba.
export function blobUrlAutoRevoke(blob: Blob, ttlMs = 60_000): string {
  const url = URL.createObjectURL(blob);
  setTimeout(() => URL.revokeObjectURL(url), ttlMs);
  return url;
}

export type DeferredTab = { go: (url: string) => void; fail: () => void };

// Abre uma aba SINCRONAMENTE (no gesto do clique) para navegar depois de um await, sem cair no
// bloqueio de popup. Uso:
//   const tab = openDeferredTab();
//   try { const url = await gerar(); tab.go(url); } catch (e) { tab.fail(); /* toast */ }
export function openDeferredTab(): DeferredTab {
  const win = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
  let settled = false;
  return {
    go(url: string) {
      settled = true;
      if (win && !win.closed) {
        try { win.opener = null; } catch { /* noop */ }
        win.location.replace(url);
      } else {
        // Aba sincrona barrada (raro): tenta o fallback direto.
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    fail() { if (!settled && win && !win.closed) win.close(); },
  };
}
