// src/lib/pdf.ts
// Helpers de abertura/download de PDF e arquivos SEM disparar o popup-blocker.
// O navegador so permite window.open()/anchor.click() dentro do \"user gesture\". Chamar window.open()
// DEPOIS de um await (gerar/assinar URL, criar blob) perde o gesto e o popup e bloqueado. openDeferredTab()
// abre uma aba EM BRANCO de forma sincrona (no clique) e navega quando a URL/blob resolve.

export type DeferredTab = { set: (url: string) => void; openBlob: (blob: Blob) => void; fail: () => void };

export function openDeferredTab(): DeferredTab {
  const tab = typeof window !== 'undefined' ? window.open('', '_blank', 'noopener,noreferrer') : null;
  const set = (url: string) => {
    if (tab && !tab.closed) { try { tab.location.href = url; return; } catch { /* fallthrough */ } }
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const openBlob = (blob: Blob) => { const u = URL.createObjectURL(blob); set(u); setTimeout(() => URL.revokeObjectURL(u), 60000); };
  const fail = () => { try { tab?.close(); } catch { /* noop */ } };
  return { set, openBlob, fail };
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function saveUrl(url: string, filename?: string): void {
  const a = document.createElement('a');
  a.href = url; if (filename) a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}
