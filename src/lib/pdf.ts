// src/lib/pdf.ts
// Abertura/download de PDF sem disparar o popup-blocker.
// O navegador só permite window.open()/anchor.click() dentro do "user gesture". Chamar window.open()
// DEPOIS de um await (gerar PDF, assinar URL, criar blob) perde o gesto e a aba é bloqueada.
// openDeferredTab() abre a aba EM BRANCO de forma SÍNCRONA (no clique) e a navega quando o conteúdo
// resolve. IMPORTANTE: a aba síncrona NÃO usa 'noopener' — com noopener o window.open('') retorna
// null e o truque falha (o fallback pós-await acaba bloqueado). Se nem a aba síncrona abrir
// (bloqueio total do usuário), openBlob() cai automaticamente no DOWNLOAD, que praticamente nunca
// é bloqueado — assim a emissão nunca falha em silêncio.

function loadingDoc(label: string): string {
  const safe = String(label).replace(/[<>&]/g, '');
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + safe + '</title><style>'
    + 'html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;'
    + 'font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;background:#0b1220;color:#e8ecf4}'
    + '.box{text-align:center}.sp{width:34px;height:34px;margin:0 auto 14px;border:3px solid #2a3550;'
    + 'border-top-color:#C5117E;border-radius:50%;animation:r .8s linear infinite}'
    + '@keyframes r{to{transform:rotate(360deg)}}.t{font-size:14px;letter-spacing:.2px;opacity:.92}'
    + '</style></head><body><div class="box"><div class="sp"></div><div class="t">'
    + safe + '</div></div></body></html>';
}

export type DeferredTab = {
  set: (url: string) => void;
  openBlob: (blob: Blob, filename?: string) => void;
  fail: () => void;
};

export function openDeferredTab(loadingLabel = 'Gerando documento…'): DeferredTab {
  // Sem 'noopener' de propósito: precisamos da referência da janela p/ navegar após o await.
  const tab = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  if (tab) {
    try { (tab as Window).opener = null; tab.document.write(loadingDoc(loadingLabel)); tab.document.close(); }
    catch { /* about:blank pode recusar o write em alguns navegadores — segue */ }
  }
  const navigate = (url: string): boolean => {
    if (tab && !tab.closed) { try { tab.location.replace(url); return true; } catch { /* cai no fallback */ } }
    return false;
  };
  const set = (url: string) => {
    if (navigate(url)) return;
    const w = typeof window !== 'undefined' ? window.open(url, '_blank') : null;
    if (!w) saveUrl(url); // último recurso: download por âncora (não bloqueia)
  };
  const openBlob = (blob: Blob, filename = 'documento.pdf') => {
    const u = URL.createObjectURL(blob);
    if (navigate(u)) { setTimeout(() => URL.revokeObjectURL(u), 120000); return; }
    // Aba indisponível (popup bloqueado): DOWNLOAD direto do blob.
    saveBlob(blob, filename);
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  };
  const fail = () => { try { if (tab && !tab.closed) tab.close(); } catch { /* noop */ } };
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
