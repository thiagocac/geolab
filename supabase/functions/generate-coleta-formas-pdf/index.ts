// generate-coleta-formas-pdf (Concresoft) — relatorio do motorista p/ coleta de formas.
// Recebe { roteiro_id }, le o roteiro + itens (RLS via Authorization) e imprime um roteiro em BLOCOS
// (uma parada por bloco): obra/cliente, endereco, contato, formas a coletar, concretagens de origem,
// e campos em branco p/ caneta (coletado / qtd / obs). QR no topo abre a rota no Google Maps (celular).
// Self-contained (padrao generate-etiquetas-lote-pdf): verify_jwt + client anon com Authorization.
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import QRCode from 'npm:qrcode@1.5.3';

// --- Observabilidade (M1, auditoria 2026-07-07): registra cada invocacao em ef_invocation_log ---
// (alimenta v_ef_metrics_hourly e o alarme de 5xx/p95 do telemetry-alarm). Best-effort: nunca
// bloqueia nem altera a resposta da EF. trace_id via ?trace_id= (sem preflight CORS).
const _obsSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _obsTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _obsActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const s = _obsSvc(); const { data: u, error } = await s.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await s.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _obsFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null }) { try { const s = _obsSvc(); const actor = await _obsActor(req); const tr = _obsTrace(req); await s.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(tr ? { trace_id: tr } : {}) } }); } catch { /* telemetria nunca bloqueia a EF */ } }
function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _obsFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }


const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const MM = 72 / 25.4;
const NAVY = rgb(0.094, 0.157, 0.388);
const INK = rgb(0.106, 0.137, 0.188);
const MUTED = rgb(0.361, 0.392, 0.451);
const LINE = rgb(0.85, 0.87, 0.90);

const dbr = (s: unknown) => { const t = String(s ?? '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '-'; const [, m, d] = t.split('-'); return `${d}/${m}`; };
type Fonte = Awaited<ReturnType<PDFDocument['embedFont']>>;

function fit(font: Fonte, text: string, size: number, maxW: number): string {
  let t = String(text ?? '');
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
  return t;
}
function enderecoDe(d: Record<string, unknown>): string {
  const p = [d.endereco, d.bairro, [d.cidade, d.uf].filter(Boolean).join('/')].filter((x) => x && String(x).trim());
  const cep = d.cep ? ' · CEP ' + d.cep : '';
  return p.join(' · ') + cep;
}

serveWithTelemetry('generate-coleta-formas-pdf', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const roteiroId = String(body.roteiro_id ?? '');
    if (!roteiroId) return json({ error: 'roteiro_id obrigatorio' }, 400);
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return json({ error: 'nao autenticado' }, 401);
    const sb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ error: 'nao autenticado' }, 401);

    const { data: rot, error: e1 } = await sb.from('coleta_roteiros')
      .select('id, data, observacao, tenants(name), colaboradores(nome)')
      .eq('id', roteiroId).is('deleted_at', null).maybeSingle();
    if (e1) return json({ error: e1.message }, 403);
    if (!rot) return json({ error: 'roteiro nao encontrado' }, 404);

    const { data: itens, error: e2 } = await sb.from('coleta_roteiro_itens')
      .select('ordem, work_id, qtd_prevista, detalhe').eq('roteiro_id', roteiroId).is('deleted_at', null).order('ordem');
    if (e2) return json({ error: e2.message }, 403);
    const paradas = (itens ?? []) as Record<string, unknown>[];

    const labNome = String((rot.tenants as Record<string, unknown> | null)?.name ?? '');
    const motorista = String((rot.colaboradores as Record<string, unknown> | null)?.nome ?? '');
    const totalFormas = paradas.reduce((s, it) => s + (Number(it.qtd_prevista) || 0), 0);

    // URL do Google Maps (paradas na ordem). Origem = local do motorista; destino = ultima parada.
    const enderecos = paradas.map((it) => { const d = (it.detalhe ?? {}) as Record<string, unknown>; return [d.endereco, d.cidade, d.uf].filter(Boolean).join(', '); }).filter((x) => x);
    let mapsUrl = '';
    if (enderecos.length) {
      const dest = encodeURIComponent(enderecos[enderecos.length - 1]);
      const way = enderecos.slice(0, -1).slice(0, 9).map((e) => encodeURIComponent(e)).join('|');
      mapsUrl = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + dest + (way ? '&waypoints=' + way : '');
    }

    const doc = await PDFDocument.create();
    doc.setTitle('Roteiro de coleta de formas'); doc.setProducer('Concresoft');
    const F = await doc.embedFont(StandardFonts.Helvetica);
    const FB = await doc.embedFont(StandardFonts.HelveticaBold);
    const PW = 595, PH = 842, MX = 34;
    let page = doc.addPage([PW, PH]);
    let y = PH - 40;

    const header = () => {
      page.drawText(fit(FB, labNome || 'Laboratorio', 13, 300), { x: MX, y, size: 13, font: FB, color: NAVY });
      if (mapsUrl) {
        try {
          const qs = 46; const qx = PW - MX - qs; const qy = y - 20;
          const qr = QRCode.create(mapsUrl, { errorCorrectionLevel: 'M' }); const n = qr.modules.size, dat = qr.modules.data, mod = qs / n;
          for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dat[r * n + c]) page.drawRectangle({ x: qx + c * mod, y: qy + (n - 1 - r) * mod, width: mod + 0.1, height: mod + 0.1, color: INK });
          page.drawText('rota no Maps', { x: qx - 4, y: qy - 9, size: 6.5, font: F, color: MUTED });
        } catch { /* qr opcional */ }
      }
      y -= 18;
      page.drawText('Roteiro de coleta de formas', { x: MX, y, size: 11, font: FB, color: INK }); y -= 14;
      page.drawText('Data: ' + dbr(rot.data) + (motorista ? '     Motorista: ' + motorista : '') , { x: MX, y, size: 9, font: F, color: MUTED }); y -= 12;
      page.drawText(paradas.length + ' parada(s)  ·  ' + totalFormas + ' forma(s) a coletar', { x: MX, y, size: 9, font: FB, color: NAVY }); y -= 8;
      page.drawLine({ start: { x: MX, y }, end: { x: PW - MX, y }, thickness: 1, color: NAVY }); y -= 16;
    };
    header();

    const blocoH = 74;
    paradas.forEach((it, i) => {
      if (y - blocoH < 40) { page = doc.addPage([PW, PH]); y = PH - 40; header(); }
      const d = (it.detalhe ?? {}) as Record<string, unknown>;
      const concs = Array.isArray(d.concretagens) ? d.concretagens as Record<string, unknown>[] : [];
      const qtd = Number(it.qtd_prevista) || 0;
      const nome = String(d.obra ?? '') + (d.cliente ? '  —  ' + d.cliente : '');
      page.drawText(String((it.ordem as number) ?? i + 1), { x: MX, y: y - 2, size: 15, font: FB, color: NAVY });
      const lx = MX + 24;
      page.drawText(fit(FB, nome, 11, 380), { x: lx, y: y - 2, size: 11, font: FB, color: INK });
      page.drawText(qtd + ' formas', { x: PW - MX - 70, y: y - 2, size: 12, font: FB, color: NAVY });
      let by = y - 16;
      page.drawText(fit(F, enderecoDe(d), 9, 500), { x: lx, y: by, size: 9, font: F, color: INK }); by -= 12;
      if (d.contato || d.telefone) { page.drawText(fit(F, 'Contato: ' + [d.contato, d.telefone].filter(Boolean).join(' · '), 9, 500), { x: lx, y: by, size: 9, font: F, color: MUTED }); by -= 12; }
      const concTxt = concs.map((c) => String(c.codigo ?? '') + ' (' + (Number(c.saldo) || 0) + ')').join(',  ');
      page.drawText(fit(F, 'Concretagens: ' + (concTxt || '—'), 8.5, 500), { x: lx, y: by, size: 8.5, font: F, color: MUTED }); by -= 15;
      page.drawText('Coletado:  [   ]        Qtd coletada: __________        Obs: ______________________________', { x: lx, y: by, size: 9, font: F, color: INK });
      y -= blocoH;
      page.drawLine({ start: { x: MX, y: y + 8 }, end: { x: PW - MX, y: y + 8 }, thickness: 0.6, color: LINE });
    });

    if (rot.observacao) {
      if (y - 40 < 40) { page = doc.addPage([PW, PH]); y = PH - 40; }
      page.drawText(fit(F, 'Observacoes: ' + String(rot.observacao), 9, PW - 2 * MX), { x: MX, y: y - 6, size: 9, font: F, color: MUTED });
    }
    // Assinatura do motorista no rodape da ultima pagina.
    page.drawText('Assinatura do motorista: ____________________________________', { x: MX, y: 34, size: 9, font: F, color: MUTED });

    const bytes = await doc.save();
    return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="roteiro-coleta-formas.pdf"', ...cors } });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
