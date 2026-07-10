// generate-nc-report-pdf (Concresoft) - RAC (Relatorio de Acao Corretiva) de uma nao-conformidade.
// Segue relatorios-ds.md (geometria/hierarquia) com cores da marca Concresoft. pdf-lib/Helvetica (sem WOFF2).
// Padrao re-derivado da generate-medicao-pdf viva (self-contained, sem _shared; verify_jwt + RLS do solicitante).
import { PDFDocument, StandardFonts, rgb, PDFImage } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { serverError } from '../_shared/response.ts';

// --- Observabilidade (M1, auditoria 2026-07-07): registra cada invocacao em ef_invocation_log ---
// (alimenta v_ef_metrics_hourly e o alarme de 5xx/p95 do telemetry-alarm). Best-effort: nunca
// bloqueia nem altera a resposta da EF. trace_id via ?trace_id= (sem preflight CORS).
const _obsSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _obsTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _obsActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const s = _obsSvc(); const { data: u, error } = await s.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await s.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _obsFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null }) { try { const s = _obsSvc(); const actor = await _obsActor(req); const tr = _obsTrace(req); await s.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(tr ? { trace_id: tr } : {}) } }); } catch { /* telemetria nunca bloqueia a EF */ } }
function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _obsFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }


const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-expose-headers': 'x-nc-id' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const BRAND = rgb(0.094, 0.157, 0.388), ACCENT = rgb(0.773, 0.067, 0.494);
const BRAND050 = rgb(0.914, 0.937, 0.973);
const INK = rgb(0.106, 0.137, 0.188), MUTED = rgb(0.361, 0.392, 0.451), FAINT = rgb(0.545, 0.576, 0.643);
const LINE = rgb(0.867, 0.890, 0.933), LINESOFT = rgb(0.929, 0.945, 0.973), WHITE = rgb(1, 1, 1);
const SUCCESS = rgb(0.180, 0.620, 0.357), WARN = rgb(0.718, 0.475, 0.122), SIGN = rgb(0.659, 0.702, 0.780);
const PW = 595.28, PH = 841.89, MX = 32, RIGHT = PW - MX, CW = RIGHT - MX, BOTTOM = 38;

const san = (s: unknown): string => String(s ?? '').replace(/→/g, '->').replace(/[–—]/g, '-').replace(/[^\x20-\xFF]/g, '?');
const dbr = (s: unknown) => { const t = String(s ?? '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '-'; const [y, m, d] = t.split('-'); return `${d}/${m}/${y}`; };
const dthr = (s: unknown) => { if (!s) return '-'; const d = new Date(String(s)); if (isNaN(d.getTime())) return '-'; return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

function statusInfo(s: unknown): { cor: ReturnType<typeof rgb>; rot: string } {
  const v = String(s ?? '').toLowerCase();
  if (v.includes('conclu') || v.includes('encerr') || v.includes('fech') || v.includes('resolv')) return { cor: SUCCESS, rot: 'CONCLUIDA' };
  if (v.includes('andamento') || v.includes('tratativa') || v.includes('analise')) return { cor: rgb(0.243, 0.176, 0.443), rot: 'EM ANDAMENTO' };
  if (v.includes('cancel')) return { cor: FAINT, rot: 'CANCELADA' };
  return { cor: WARN, rot: san(String(s ?? 'ABERTA')).toUpperCase() };
}

serveWithTelemetry('generate-nc-report-pdf', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const ncId = String(body.nc_id ?? body.non_conformity_id ?? '');
    if (!ncId) return json({ error: 'nc_id obrigatorio' }, 400);
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return json({ error: 'nao autenticado' }, 401);
    const sb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ error: 'nao autenticado' }, 401);

    const { data: nc, error: e1 } = await sb.from('non_conformities').select('id, tenant_id, work_id, numero, classification_code, classification_nome, tipo_code, tipo_nome, origem, severidade, status, data_abertura, descricao, entidade_origem, entidade_origem_id, created_at, updated_at').eq('id', ncId).is('deleted_at', null).maybeSingle();
    if (e1) return json({ error: e1.message }, 403);
    if (!nc) return json({ error: 'nao-conformidade nao encontrada' }, 404);

    const [{ data: tenant }, { data: cfg }, { data: work }, { data: acoes }, { data: situs }, { data: racPad }] = await Promise.all([
      sb.from('tenants').select('name').eq('id', nc.tenant_id).maybeSingle(),
      sb.from('config_lab').select('logo_path, responsavel_tecnico, crea_rt, nota_rodape').eq('tenant_id', nc.tenant_id).maybeSingle(),
      nc.work_id ? sb.from('client_works').select('nome, codigo, client_id').eq('id', nc.work_id).maybeSingle() : Promise.resolve({ data: null }),
      sb.from('nc_actions').select('descricao, situacao_codigo, executada_em, created_at').eq('nc_id', ncId).is('deleted_at', null).order('created_at', { ascending: true }),
      sb.from('nc_situations').select('codigo, nome'),
      sb.from('nc_rac_acao_padrao').select('acao_corretiva, quem, quando, ordem').eq('tenant_id', nc.tenant_id).eq('classification_code', nc.classification_code).eq('ativo', true).order('ordem', { ascending: true }),
    ]);
    let cliente: Record<string, unknown> | null = null;
    if (work?.client_id) { const { data: c } = await sb.from('lab_clients').select('razao_social, nome_fantasia, cnpj_cpf').eq('id', work.client_id).maybeSingle(); cliente = c; }
    const situMap = new Map((Array.isArray(situs) ? situs : []).map((s: Record<string, unknown>) => [String(s.codigo), String(s.nome)]));

    let logoBytes: Uint8Array | null = null; let logoPng = true;
    if (cfg?.logo_path) { try { const dl = await admin.storage.from('lab-reports').download(String(cfg.logo_path)); if (dl.data) { logoBytes = new Uint8Array(await dl.data.arrayBuffer()); const lp = String(cfg.logo_path).toLowerCase(); logoPng = !(lp.endsWith('.jpg') || lp.endsWith('.jpeg')); } } catch (_) { logoBytes = null; } }

    const numero = String(nc.numero ?? ('NC ' + String(nc.id).slice(0, 6).toUpperCase()));
    const st = statusInfo(nc.status);

    const doc = await PDFDocument.create();
    doc.setTitle('RAC ' + numero); doc.setProducer('Concresoft'); doc.setAuthor(String(tenant?.name ?? 'Laboratorio')); doc.setSubject('Relatorio de Acao Corretiva');
    const F = await doc.embedFont(StandardFonts.Helvetica);
    const FB = await doc.embedFont(StandardFonts.HelveticaBold);
    let page = doc.addPage([PW, PH]);
    let logoImg: PDFImage | null = null;
    if (logoBytes) { try { logoImg = logoPng ? await doc.embedPng(logoBytes) : await doc.embedJpg(logoBytes); } catch (_) { logoImg = null; } }
    const T = (s: unknown, x: number, y: number, size: number, f = F, c = INK) => page.drawText(san(s), { x, y, size, font: f, color: c });
    const TR = (s: unknown, xr: number, y: number, size: number, f = F, c = INK) => { const w = f.widthOfTextAtSize(san(s), size); page.drawText(san(s), { x: xr - w, y, size, font: f, color: c }); };
    const TC = (s: unknown, xc: number, y: number, size: number, f = F, c = INK) => { const w = f.widthOfTextAtSize(san(s), size); page.drawText(san(s), { x: xc - w / 2, y, size, font: f, color: c }); };
    const rect = (x: number, y: number, w: number, h: number, col: unknown) => page.drawRectangle({ x, y, width: w, height: h, color: col as undefined });
    const hline = (x1: number, y: number, x2: number, col = LINE, w = 0.6) => page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: w, color: col });
    const clip = (s: unknown, size: number, maxW: number, f = F) => { let t = san(s); if (f.widthOfTextAtSize(t, size) <= maxW) return t; while (t.length > 1 && f.widthOfTextAtSize(t + '..', size) > maxW) t = t.slice(0, -1); return t + '..'; };
    const wrapLines = (s: unknown, size: number, maxW: number, f = F): string[] => { const ws = san(s).split(/\s+/).filter(Boolean); const out: string[] = []; let ln = ''; for (const w of ws) { const t = ln ? ln + ' ' + w : w; if (f.widthOfTextAtSize(t, size) > maxW && ln) { out.push(ln); ln = w; } else ln = t; } if (ln) out.push(ln); return out.length ? out : ['-']; };
    const newPage = (titulo: string): number => { page = doc.addPage([PW, PH]); const yy = PH - 50; T(titulo, MX, yy, 8, FB, BRAND); page.drawLine({ start: { x: MX, y: yy - 6 }, end: { x: RIGHT, y: yy - 6 }, thickness: 1.2, color: BRAND }); return yy - 20; };
    const need = (h: number, y: number): number => (y - h < BOTTOM ? newPage('RAC ' + numero + ' (continuacao)') : y);

    const topo = PH - 30;
    if (logoImg) { const iw = logoImg.width, ih = logoImg.height; const sc = Math.min(150 / iw, 19 / ih); page.drawImage(logoImg, { x: MX, y: topo - ih * sc, width: iw * sc, height: ih * sc }); }
    else { T(String(tenant?.name ?? 'LABORATORIO'), MX, topo - 12, 9, FB, MUTED); }
    rect(RIGHT - 86, topo - 19, 15, 15, ACCENT); page.drawText('C', { x: RIGHT - 81.5, y: topo - 15.4, size: 9, font: FB, color: WHITE });
    const sw = FB.widthOfTextAtSize('soft', 13), cwid = FB.widthOfTextAtSize('Concre', 13);
    T('soft', RIGHT - sw, topo - 15.6, 13, FB, ACCENT); T('Concre', RIGHT - sw - cwid, topo - 15.6, 13, FB, BRAND);
    T('Relatorio de Acao Corretiva', MX, PH - 52, 20, FB, BRAND);
    T('RAC - tratativa de nao-conformidade - Concresoft', MX + 2, PH - 65, 8.5, F, MUTED);
    TR('RAC No', RIGHT, PH - 40, 6.6, F, FAINT); TR(numero, RIGHT, PH - 62, 13, FB, BRAND);
    page.drawCircle({ x: RIGHT - FB.widthOfTextAtSize(st.rot, 7.5) - 8, y: PH - 71.5, size: 2.4, color: st.cor });
    TR(st.rot, RIGHT, PH - 73.5, 7.5, FB, st.cor);
    page.drawLine({ start: { x: MX, y: PH - 80 }, end: { x: MX + 170, y: PH - 80 }, thickness: 2, color: BRAND });
    page.drawLine({ start: { x: MX + 170, y: PH - 80 }, end: { x: RIGHT, y: PH - 80 }, thickness: 2, color: LINE });
    let y = PH - 98;

    const x1 = MX, x2 = MX + CW * 0.40, x3 = MX + CW * 0.78;
    const w1 = CW * 0.40 - 8, w2 = CW * 0.38 - 8, w3 = CW * 0.22 - 4;
    const kv = (lbl: string, val: unknown, x: number, yy: number, mw: number) => { T(lbl, x, yy, 6.3, F, FAINT); T(clip(val, 8.4, mw, FB), x, yy - 11, 8.4, FB, INK); };
    kv('OBRA', work?.nome || '-', x1, y, w1);
    kv('CLIENTE', cliente?.razao_social || cliente?.nome_fantasia || '-', x2, y, w2);
    kv('ABERTURA', dbr(nc.data_abertura), x3, y, w3);
    y -= 26;
    kv('CLASSIFICACAO', nc.classification_nome || nc.classification_code || '-', x1, y, w1);
    kv('TIPO', nc.tipo_nome || nc.tipo_code || '-', x2, y, w2);
    kv('SEVERIDADE', String(nc.severidade || '-').toUpperCase(), x3, y, w3);
    y -= 26;
    kv('ORIGEM', nc.origem || '-', x1, y, w1);
    kv('ENTIDADE DE ORIGEM', nc.entidade_origem ? (String(nc.entidade_origem) + (nc.entidade_origem_id ? ' ' + String(nc.entidade_origem_id).slice(0, 8) : '')) : '-', x2, y, w2);
    kv('EMISSAO', dbr(new Date().toISOString()), x3, y, w3);
    y -= 24; hline(MX, y, RIGHT, LINE); y -= 16;

    T('DESCRICAO DA NAO-CONFORMIDADE', MX, y, 7.6, FB, BRAND); y -= 13;
    for (const l of wrapLines(nc.descricao || 'Sem descricao registrada.', 8, CW)) { y = need(12, y); T(l, MX, y, 8, F, MUTED); y -= 11; }
    y -= 9;

    y = need(60, y);
    T('ACOES CORRETIVAS RECOMENDADAS', MX, y, 7.6, FB, BRAND);
    T('(padrao por classificacao)', MX + FB.widthOfTextAtSize('ACOES CORRETIVAS RECOMENDADAS', 7.6) + 6, y, 6.4, F, FAINT); y -= 13;
    const cQuem = MX + CW * 0.60, cQuando = MX + CW * 0.80;
    page.drawLine({ start: { x: MX, y: y + 2 }, end: { x: RIGHT, y: y + 2 }, thickness: 0.8, color: BRAND });
    T('ACAO CORRETIVA', MX, y - 8, 6.1, FB, BRAND); T('QUEM', cQuem, y - 8, 6.1, FB, BRAND); T('QUANDO', cQuando, y - 8, 6.1, FB, BRAND);
    page.drawLine({ start: { x: MX, y: y - 12 }, end: { x: RIGHT, y: y - 12 }, thickness: 0.8, color: BRAND }); y -= 23;
    const racRows = (Array.isArray(racPad) ? racPad : []) as Record<string, unknown>[];
    if (racRows.length === 0) { T('Nenhuma acao padrao cadastrada para esta classificacao.', MX, y, 7, F, FAINT); y -= 12; }
    else for (const r of racRows) {
      const ls = wrapLines(r.acao_corretiva, 7, cQuem - MX - 8);
      y = need(ls.length * 9 + 8, y);
      const yTop = y;
      ls.forEach((l, i) => T(l, MX, y - i * 9, 7, F, INK));
      T(clip(r.quem, 7, cQuando - cQuem - 6), cQuem, yTop, 7, F, MUTED);
      T(clip(r.quando, 7, RIGHT - cQuando), cQuando, yTop, 7, F, MUTED);
      y -= Math.max(ls.length * 9, 9) + 3; hline(MX, y, RIGHT, LINESOFT, 0.35); y -= 5.5;
    }
    y -= 8;

    y = need(60, y);
    T('ACOES REGISTRADAS', MX, y, 7.6, FB, BRAND);
    T('(tratativa executada)', MX + FB.widthOfTextAtSize('ACOES REGISTRADAS', 7.6) + 6, y, 6.4, F, FAINT); y -= 13;
    const dSit = MX + CW * 0.16, dDesc = MX + CW * 0.40;
    page.drawLine({ start: { x: MX, y: y + 2 }, end: { x: RIGHT, y: y + 2 }, thickness: 0.8, color: BRAND });
    T('DATA', MX, y - 8, 6.1, FB, BRAND); T('SITUACAO', dSit, y - 8, 6.1, FB, BRAND); T('DESCRICAO', dDesc, y - 8, 6.1, FB, BRAND);
    page.drawLine({ start: { x: MX, y: y - 12 }, end: { x: RIGHT, y: y - 12 }, thickness: 0.8, color: BRAND }); y -= 23;
    const actRows = (Array.isArray(acoes) ? acoes : []) as Record<string, unknown>[];
    if (actRows.length === 0) { T('Nenhuma acao registrada ate o momento.', MX, y, 7, F, FAINT); y -= 12; }
    else for (const a of actRows) {
      const ls = wrapLines(a.descricao, 7, RIGHT - dDesc);
      y = need(ls.length * 9 + 8, y);
      const yTop = y;
      T(dbr(a.executada_em || a.created_at), MX, yTop, 7, F, MUTED);
      T(clip(situMap.get(String(a.situacao_codigo)) ?? a.situacao_codigo ?? '-', 7, dDesc - dSit - 6), dSit, yTop, 7, FB, INK);
      ls.forEach((l, i) => T(l, dDesc, y - i * 9, 7, F, INK));
      y -= Math.max(ls.length * 9, 9) + 3; hline(MX, y, RIGHT, LINESOFT, 0.35); y -= 5.5;
    }
    y -= 12;

    y = need(96, y);
    page.drawRectangle({ x: MX, y: y - 32, width: CW, height: 32, color: BRAND050, borderColor: LINE, borderWidth: 0.6 });
    T('Declara-se que as acoes acima refletem a tratativa da nao-conformidade ' + numero + ',', MX + 12, y - 13, 7.5, F, MUTED);
    T('conforme registros do laboratorio na data de emissao.', MX + 12, y - 23, 7.5, F, MUTED);
    TR('Status atual', RIGHT - 12, y - 12, 6.3, F, FAINT); TR(st.rot, RIGHT - 12, y - 23, 8, FB, st.cor);
    y -= 54;
    const cAss = MX + CW * 0.5;
    page.drawLine({ start: { x: cAss - 95, y }, end: { x: cAss + 95, y }, thickness: 0.7, color: SIGN }); y -= 11;
    TC(String(cfg?.responsavel_tecnico || 'Responsavel Tecnico'), cAss, y, 7.8, FB, INK); y -= 9;
    if (cfg?.crea_rt) { TC('CREA ' + String(cfg.crea_rt), cAss, y, 6.4, F, FAINT); y -= 9; }
    else { TC('Responsavel Tecnico', cAss, y, 6.4, F, FAINT); y -= 9; }

    const emitido = dthr(new Date().toISOString());
    const pages = doc.getPages(); const total = pages.length;
    pages.forEach((p, i) => { p.drawLine({ start: { x: MX, y: 27 }, end: { x: RIGHT, y: 27 }, thickness: 0.6, color: LINE }); p.drawText(san('Concresoft - RAC - ' + numero + ' - emitido ' + emitido), { x: MX, y: 18, size: 6.4, font: F, color: FAINT }); const pg = san('Pagina ' + (i + 1) + ' de ' + total); p.drawText(pg, { x: RIGHT - F.widthOfTextAtSize(pg, 6.4), y: 18, size: 6.4, font: F, color: FAINT }); });

    const bytes = await doc.save();
    const fname = 'rac-' + san(numero).replace(/[^A-Za-z0-9_-]/g, '_') + '.pdf';
    return new Response(bytes, { headers: { ...cors, 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${fname}"`, 'x-nc-id': String(nc.id) } });
  } catch (e) {
    return serverError(e, { req, fnName: 'generate-nc-report-pdf', action: 'relatorio.pdf:generate-nc-report-pdf' });
  }
});
