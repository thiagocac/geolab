// GEOLAB - Agenda de rompimentos em PDF (visual da ficha de moldagem; pdf-lib/Helvetica). Self-contained. v9.
// Item G: 2 colunas EM BRANCO p/ preenchimento a caneta — "Data / hora rompimento" e "Tensao de ruptura (MPa)";
// se entrar_carga=true a 2a coluna vira "Carga de ruptura (<unidade>)". OCR dos manuscritos = backlog.
// v9: opcional agrupar_prensa=true -> secoes por prensa PREVISTA (alocacao equipamento_obras da obra do CP);
// v11: labName prioriza o vinculo SELECIONADO (members.is_selected) p/ usuario multi-lab.
// CP pendente herda a prensa da obra; multiplas prensas -> secao "Varias prensas"; nenhuma -> "Sem prensa".
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

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
const san = (s: unknown): string => String(s ?? '').replace(/[→➔➜]/g, '->').replace(/[–—]/g, '-').replace(/[^\x20-\xFF\n]/g, '?');
const dbr = (s: unknown) => { const t = String(s ?? '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '-'; const [y, m, d] = t.split('-'); return `${d}/${m}/${y}`; };
const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Rel = Record<string, unknown>;
const emb = (v: unknown): Rel => (v && typeof v === 'object' && !Array.isArray(v) ? v as Rel : Array.isArray(v) ? (v[0] as Rel ?? {}) : {});

serveWithTelemetry('generate-agenda-rompimento-pdf', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({})) as Rel;
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return json({ error: 'nao autenticado' }, 401);
    const sb = createClient(url, anon, { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: 'nao autenticado' }, 401);

    let labName = 'Laboratorio';
    const { data: mems } = await sb.from('members').select('tenants(name), is_selected').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).order('is_selected', { ascending: false, nullsFirst: false }).limit(1);
    if (mems && mems.length) labName = String(emb((mems[0] as Rel).tenants).name ?? labName);

    const SEL = 'id, codigo, numeracao_lab, external_key, idade_dias, idade_unidade, data_prevista_rompimento, situacao, valor_esperado, material_receipts(nota_fiscal, serie), material_test_types(nome, codigo), concretagens(codigo, work_id, fck_previsto, client_works(nome), lab_clients(razao_social, nome_fantasia))';
    let { data, error } = await sb.from('corpos_prova').select(SEL).is('deleted_at', null).order('data_prevista_rompimento', { ascending: true });
    if (error && /numeracao_lab/i.test(error.message)) {
      const retry = await sb.from('corpos_prova').select(SEL.replace('numeracao_lab, ', '')).is('deleted_at', null).order('data_prevista_rompimento', { ascending: true });
      data = retry.data; error = retry.error;
    }
    if (error) return json({ error: error.message }, 403);

    const ref = String(body.data_ref ?? new Date().toISOString().slice(0, 10));
    const janela = String(body.janela ?? 'ate');
    const tipo = String(body.tipo_ensaio ?? 'compressao');
    const idade = String(body.idade ?? 'todas');
    const nf = norm(body.nota_fiscal ?? '');
    const fCliente = norm(body.cliente ?? '');
    const fObra = norm(body.obra ?? '');
    const entrarCarga = body.entrar_carga === true || body.entrar_carga === 'true';
    const cargaUnidade = String(body.carga_unidade ?? 'kn');
    const agruparPrensa = body.agrupar_prensa === true || body.agrupar_prensa === 'true';

    // Alocacao viva prensa<->obra (equipamento_obras) + rotulo (apelido||marca_modelo). So prensas ativas.
    const obraPrensas = new Map<string, string[]>(); // work_id -> [equipamento_id]
    const prensaRotulo = new Map<string, string>();   // equipamento_id -> rotulo
    if (agruparPrensa) {
      const [alo, eqs] = await Promise.all([
        sb.from('equipamento_obras').select('work_id, equipamento_id').is('deleted_at', null),
        sb.from('equipamentos').select('id, apelido, marca_modelo, tipo, ativo').eq('tipo', 'prensa').is('deleted_at', null),
      ]);
      const ativa = new Set<string>();
      for (const e of ((eqs.data ?? []) as Rel[])) { if (e.ativo !== false) { ativa.add(String(e.id)); prensaRotulo.set(String(e.id), String(e.apelido || e.marca_modelo || '(sem nome)')); } }
      for (const a of ((alo.data ?? []) as Rel[])) { const w = String(a.work_id), pid = String(a.equipamento_id); if (!ativa.has(pid)) continue; const arr = obraPrensas.get(w) ?? []; arr.push(pid); obraPrensas.set(w, arr); }
    }

    const clienteNome = (r: Rel) => { const c = emb((r.concretagens as Rel)?.lab_clients); return String(c.nome_fantasia ?? c.razao_social ?? ''); };
    const obraNome = (r: Rel) => String(emb((r.concretagens as Rel)?.client_works).nome ?? '');

    const rows = ((data ?? []) as Rel[]).filter((r) => {
      const prev = String(r.data_prevista_rompimento ?? '');
      if (janela === 'ate' && (!prev || prev > ref)) return false;
      if (janela === 'dia' && prev !== ref) return false;
      if (tipo !== 'todas') { const tn = norm((r.material_test_types as Rel)?.nome ?? (r.material_test_types as Rel)?.codigo ?? 'compressao'); const tk = tn.includes('compress') ? 'compressao' : tn.replace(/\s+/g, '_'); if (tk !== tipo) return false; }
      const idadeTxt = `${r.idade_dias ?? '-'} ${r.idade_unidade === 'hora' ? 'horas' : 'dias'}`;
      if (idade !== 'todas' && idadeTxt !== idade) return false;
      if (fCliente && fCliente !== 'todas' && norm(clienteNome(r)) !== fCliente) return false;
      if (fObra && fObra !== 'todas' && norm(obraNome(r)) !== fObra) return false;
      const busca = norm([r.codigo, r.numeracao_lab, r.external_key, (r.material_receipts as Rel)?.nota_fiscal, (r.concretagens as Rel)?.codigo].join(' '));
      if (nf && !busca.includes(nf)) return false;
      return true;
    });

    const doc = await PDFDocument.create();
    const F = await doc.embedFont(StandardFonts.Helvetica);
    const B = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595.28, H = 841.89, M = 28;
    const x0 = M, x1 = W - M, Wu = x1 - x0;
    const navy = rgb(0.094, 0.157, 0.388), white = rgb(1, 1, 1), grid = rgb(0.80, 0.83, 0.88), nl = rgb(0.45, 0.52, 0.72), ink = rgb(0.06, 0.09, 0.13), lbl = rgb(0.40, 0.46, 0.54), writeline = rgb(0.62, 0.66, 0.72), secbg = rgb(0.90, 0.92, 0.96);
    let page = doc.addPage([W, H]);
    const tW = (f: typeof F, t: string, sz: number) => f.widthOfTextAtSize(san(t), sz);
    const txt = (x: number, y: number, t: string, sz: number, f = F, c = ink) => { if (t) page.drawText(san(t), { x, y, size: sz, font: f, color: c }); };
    const txtC = (cx: number, y: number, t: string, sz: number, f = F, c = ink) => { if (t) page.drawText(san(t), { x: cx - tW(f, t, sz) / 2, y, size: sz, font: f, color: c }); };
    const txtR = (xr: number, y: number, t: string, sz: number, f = F, c = ink) => { if (t) page.drawText(san(t), { x: xr - tW(f, t, sz), y, size: sz, font: f, color: c }); };
    const hl = (xa: number, xb: number, y: number, c = grid, w = 0.6) => page.drawLine({ start: { x: xa, y }, end: { x: xb, y }, thickness: w, color: c });
    const vl = (x: number, ya: number, yb: number, c = grid, w = 0.6) => page.drawLine({ start: { x, y: ya }, end: { x, y: yb }, thickness: w, color: c });
    const fill = (x: number, ytop: number, w: number, h: number, c: ReturnType<typeof rgb>) => page.drawRectangle({ x, y: ytop - h, width: w, height: h, color: c });

    const cols: Array<{ label: string; w: number; x?: number }> = [
      { label: 'Numeracao', w: 78 },
      { label: 'Cliente / obra', w: 132 },
      { label: 'NF', w: 42 },
      { label: 'Idade', w: 32 },
      { label: 'Data prevista', w: 54 },
      { label: 'Data / hora rompimento', w: 86 },
      { label: entrarCarga ? ('Carga de ruptura (' + cargaUnidade + ')') : 'Tensao de ruptura (MPa)', w: 91 },
    ];
    const sumW = cols.reduce((a, c) => a + c.w, 0); const kf = Wu / sumW; let cxacc = x0;
    for (const c of cols) { c.x = cxacc; c.w = c.w * kf; cxacc += c.w; }
    const colX = (i: number) => cols[i].x as number;
    const colW = (i: number) => cols[i].w;

    const wrap2 = (f: typeof F, t: string, sz: number, maxw: number): [string, string] => {
      const words = t.split(' '); let a = '', b = '';
      for (const w of words) { const tt = (a ? a + ' ' : '') + w; if (!b && tW(f, tt, sz) <= maxw) a = tt; else b = (b ? b + ' ' : '') + w; }
      return [a, b];
    };

    const headerBand = (): number => {
      let y = H - M; const th = 40; fill(x0, y, Wu, th, navy);
      txt(x0 + 10, y - 15, labName, 12, B, white);
      txt(x0 + 10, y - 27, 'Controle Tecnologico de Materiais - Concreto', 6.5, F, rgb(0.78, 0.81, 0.9));
      txtR(x1 - 8, y - 12, 'AGENDA DE ROMPIMENTOS', 11, B, white);
      const refc = rgb(0.78, 0.81, 0.9);
      txtR(x1 - 8, y - 23, 'NBR 5739 - 5738 - 16886 - 16889', 5.6, F, refc);
      txtR(x1 - 8, y - 31, 'app.concresoft.io', 5.6, F, refc);
      y -= th + 7;
      txt(x0, y, 'Data de referencia: ' + dbr(ref) + '   |   CPs no recorte: ' + rows.length + (agruparPrensa ? '   |   agrupado por prensa' : '') + (entrarCarga ? '   |   campo: Carga (' + cargaUnidade + ')' : ''), 8.5, F, lbl);
      return y - 9;
    };
    const colHeader = (y: number): number => {
      const hh = 26; fill(x0, y, Wu, hh, navy);
      for (let i = 0; i < cols.length; i++) {
        const cx = colX(i), cw = colW(i); const [l1, l2] = wrap2(B, cols[i].label, 6, cw - 4);
        if (l2) { txtC(cx + cw / 2, y - 10, l1, 6, B, white); txtC(cx + cw / 2, y - 19, l2, 6, B, white); }
        else txtC(cx + cw / 2, y - 16, l1, 6.5, B, white);
      }
      for (let i = 1; i < cols.length; i++) vl(colX(i), y - hh, y, nl, 0.6);
      return y - hh;
    };
    const startPage = (first: boolean): number => { if (!first) page = doc.addPage([W, H]); const yy = first ? headerBand() : (H - M); return colHeader(yy); };

    const rowh = 22;
    const drawRow = (r: Rel, y: number) => {
      const cp = String(r.numeracao_lab ?? r.external_key ?? r.codigo ?? r.id).slice(0, 16);
      const cli = clienteNome(r); const ob = obraNome(r);
      const obraTxt = (cli ? cli + ' / ' : '') + (ob || String((r.concretagens as Rel)?.codigo ?? '-'));
      txt(colX(0) + 4, y - rowh + 8, cp, 7.5, B, ink);
      const [a, b] = wrap2(F, obraTxt, 6.5, colW(1) - 7);
      txt(colX(1) + 4, y - 8.5, a, 6.5, F, ink); if (b) txt(colX(1) + 4, y - 16, b.slice(0, 42), 6.5, F, ink);
      txtC(colX(2) + colW(2) / 2, y - rowh + 8, String((r.material_receipts as Rel)?.nota_fiscal ?? '-'), 7, F, ink);
      txtC(colX(3) + colW(3) / 2, y - rowh + 8, String(r.idade_dias ?? '-') + (r.idade_unidade === 'hora' ? 'h' : 'd'), 7, F, ink);
      const atras = !!r.data_prevista_rompimento && String(r.data_prevista_rompimento) < ref && r.situacao === 'pendente';
      txtC(colX(4) + colW(4) / 2, y - rowh + 8, dbr(r.data_prevista_rompimento) + (atras ? ' !' : ''), 7, F, atras ? rgb(0.78, 0.10, 0.10) : ink);
      hl(colX(5) + 6, colX(5) + colW(5) - 6, y - rowh + 6.5, writeline, 0.5);
      hl(colX(6) + 6, colX(6) + colW(6) - 6, y - rowh + 6.5, writeline, 0.5);
    };
    const gridRow = (y: number) => {
      hl(x0, x1, y - rowh, grid, 0.5);
      for (let i = 0; i <= cols.length; i++) { const xx = i < cols.length ? colX(i) : x1; vl(xx, y - rowh, y, grid, 0.5); }
    };
    const sech = 16;
    const drawSection = (y: number, titulo: string, n: number): number => {
      fill(x0, y, Wu, sech, secbg);
      txt(x0 + 6, y - 11, titulo, 8, B, navy);
      txtR(x1 - 6, y - 11, n + ' CP(s)', 7, F, lbl);
      return y - sech;
    };

    let y = startPage(true);

    if (!agruparPrensa) {
      for (const r of rows) {
        if (y - rowh < 48) y = startPage(false);
        drawRow(r, y); gridRow(y); y -= rowh;
      }
    } else {
      // Particiona por prensa prevista. Um CP em N prensas cai em cada uma? Nao: para agenda de trabalho,
      // multiplas prensas = ambiguo -> secao propria "Varias prensas"; zero -> "Sem prensa".
      const buckets = new Map<string, Rel[]>(); // key -> rows ; key 'p:<id>' | 'multi' | 'none'
      const orderKeys: string[] = [];
      const push = (k: string, r: Rel) => { if (!buckets.has(k)) { buckets.set(k, []); orderKeys.push(k); } (buckets.get(k) as Rel[]).push(r); };
      for (const r of rows) {
        const w = String((r.concretagens as Rel)?.work_id ?? '');
        const ps = w ? (obraPrensas.get(w) ?? []) : [];
        if (ps.length === 1) push('p:' + ps[0], r);
        else if (ps.length > 1) push('multi', r);
        else push('none', r);
      }
      // ordena: prensas por rotulo, depois multi, depois none
      const pKeys = orderKeys.filter((k) => k.startsWith('p:')).sort((a, b) => (prensaRotulo.get(a.slice(2)) ?? '').localeCompare(prensaRotulo.get(b.slice(2)) ?? ''));
      const finalKeys = [...pKeys, ...(buckets.has('multi') ? ['multi'] : []), ...(buckets.has('none') ? ['none'] : [])];
      for (const k of finalKeys) {
        const list = buckets.get(k) as Rel[];
        const titulo = k === 'multi' ? 'Varias prensas alocadas' : k === 'none' ? 'Sem prensa alocada' : ('Prensa: ' + (prensaRotulo.get(k.slice(2)) ?? '-'));
        if (y - (sech + rowh) < 48) y = startPage(false);
        y = drawSection(y, titulo, list.length);
        for (const r of list) {
          if (y - rowh < 48) { y = startPage(false); y = drawSection(y, titulo + ' (cont.)', list.length); }
          drawRow(r, y); gridRow(y); y -= rowh;
        }
        y -= 6;
      }
    }
    if (!rows.length) txtC(W / 2, H - 150, 'Nenhum CP no recorte selecionado.', 9, F, lbl);

    const pages = doc.getPages();
    pages.forEach((p, i) => { p.drawText(san(labName + ' - app.concresoft.io'), { x: M, y: 22, size: 6.5, font: F, color: lbl }); p.drawText(san('Pagina ' + (i + 1) + '/' + pages.length), { x: x1 - 52, y: 22, size: 6.5, font: F, color: lbl }); });
    const bytes = await doc.save();
    return new Response(bytes, { headers: { ...cors, 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="agenda-rompimentos-' + ref + '.pdf"' } });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
