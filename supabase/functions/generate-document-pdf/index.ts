// generate-document-pdf (Concresoft) — motor único de documentos comerciais (SPEC-01, v214).
// Renderiza uma versão de template (schema de BLOCOS, decisão 10/07) contra o contexto canônico
// da RPC render_document_context (lab.* + proposta/contrato/cliente). Placeholders {{caminho.prop}}.
// Blocos: titulo, paragrafo, chave_valor, tabela_itens, divisor, espaco, assinaturas.
// preview=true usa sample_data da versão (draft ok) e NÃO persiste; oficial exige versão published,
// grava document_render_jobs e salva o PDF no bucket privado 'documentos' (service role; leitura por signed URL).
// RN-01: uma published por template · RN-02: contexto sempre do tenant do usuário (RPC tenant-gated)
// RN-03: placeholder desconhecido → 422 + job failed · RN-04: PDF gerado é snapshot imutável.
// Self-contained (padrão generate-etiquetas-lote-pdf): client anon com Authorization (RLS decide).
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { serverError } from '../_shared/response.ts';

// --- Observabilidade (M1): registra cada invocação em ef_invocation_log. Best-effort. ---
const _obsSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _obsTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _obsActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const s = _obsSvc(); const { data: u, error } = await s.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await s.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _obsFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null }) { try { const s = _obsSvc(); const actor = await _obsActor(req); const tr = _obsTrace(req); await s.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(tr ? { trace_id: tr } : {}) } }); } catch { /* telemetria nunca bloqueia a EF */ } }
function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _obsFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const MM = 72 / 25.4;
const A4W = 210 * MM, A4H = 297 * MM;
const MARG = 15 * MM;
const NAVY = rgb(0.094, 0.157, 0.388);
const MAGENTA = rgb(0.773, 0.067, 0.494);
const INK = rgb(0.106, 0.137, 0.188);
const MUTED = rgb(0.361, 0.392, 0.451);
const LINE = rgb(0.886, 0.91, 0.941);
const ZEBRA = rgb(0.973, 0.98, 0.988);

type Fonte = Awaited<ReturnType<PDFDocument['embedFont']>>;
type Ctx = Record<string, unknown>;
type Col = { header: string; path: string; format?: string; align?: string; width?: number };
type Bloco = { type: string; text?: string; size?: string; rows?: Array<{ label: string; value: string }>; source?: string; columns?: Col[]; total_path?: string; total_label?: string; h?: number; left?: string; right?: string };

function resolvePath(ctx: Ctx, path: string): unknown {
  let cur: unknown = ctx;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
function fmtValue(v: unknown, format?: string): string {
  if (v == null) return '';
  if (format === 'moeda') { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(v); }
  if (format === 'numero') { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('pt-BR') : String(v); }
  if (typeof v === 'number') return v.toLocaleString('pt-BR');
  return String(v);
}
function interpolate(text: string, ctx: Ctx, missing: Set<string>): string {
  return String(text ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) => {
    const v = resolvePath(ctx, path);
    if (v === undefined) { missing.add(path); return '—'; }
    return fmtValue(v);
  });
}
function wrapText(font: Fonte, text: string, size: number, maxW: number): string[] {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (font.widthOfTextAtSize(cand, size) <= maxW) { cur = cand; continue; }
    if (cur) lines.push(cur);
    if (font.widthOfTextAtSize(w, size) <= maxW) { cur = w; continue; }
    let piece = '';
    for (const ch of w) { if (font.widthOfTextAtSize(piece + ch, size) > maxW) { lines.push(piece); piece = ch; } else piece += ch; }
    cur = piece;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}
function fit(font: Fonte, text: string, size: number, maxW: number): string {
  let t = String(text ?? '');
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1);
  return t + '…';
}

serveWithTelemetry('generate-document-pdf', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const templateVersionId = body.template_version_id ? String(body.template_version_id) : '';
    const templateId = body.template_id ? String(body.template_id) : '';
    const entityType = String(body.entity_type ?? 'outro');
    const entityId = body.entity_id ? String(body.entity_id) : null;
    const preview = body.preview === true;
    if (!templateVersionId && !templateId) return json({ error: 'template_version_id ou template_id obrigatorio' }, 400);

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return json({ error: 'nao autenticado' }, 401);
    const sb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ error: 'nao autenticado' }, 401);
    const { data: canVer } = await sb.rpc('current_has_permission', { p_permission: 'documento_template.ver' });
    if (canVer === false) return json({ error: 'sem permissao (documento_template.ver)' }, 403);

    // Resolve a versão: id direto, ou published do template (preview aceita draft mais recente).
    let vq = sb.from('document_template_versions')
      .select('id, tenant_id, template_id, version, status, title_template, blocks, sample_data')
      .is('deleted_at', null);
    if (templateVersionId) vq = vq.eq('id', templateVersionId);
    else vq = vq.eq('template_id', templateId).order('version', { ascending: false });
    const { data: versoes, error: eV } = await vq;
    if (eV) return json({ error: eV.message }, 403);
    const lista = (versoes ?? []) as Array<Record<string, unknown>>;
    const versao = templateVersionId
      ? lista[0]
      : (lista.find((v) => v.status === 'published') ?? (preview ? lista[0] : undefined));
    if (!versao) return json({ error: 'versao de template nao encontrada' }, 404);
    if (!preview && versao.status !== 'published') return json({ error: 'somente versao published gera documento oficial (use preview)' }, 422);

    // Contexto: RPC tenant-gated (RN-02); preview sem entidade completa com sample_data.
    const { data: ctxData, error: eCtx } = await sb.rpc('render_document_context', { p_entity_type: entityType, p_entity_id: entityId });
    if (eCtx) return json({ error: eCtx.message }, 422);
    const sample = (preview && !entityId ? (versao.sample_data ?? {}) : {}) as Ctx;
    const ctx: Ctx = { ...sample, ...(ctxData as Ctx ?? {}) };

    const missing = new Set<string>();
    const blocks = Array.isArray(versao.blocks) ? (versao.blocks as Bloco[]) : [];
    const titleDoc = interpolate(String(versao.title_template ?? 'Documento'), ctx, missing);
    const lab = (ctx.lab ?? {}) as Record<string, unknown>;

    // --- PDF ---
    const doc = await PDFDocument.create();
    doc.setTitle(titleDoc); doc.setProducer('Concresoft');
    const F = await doc.embedFont(StandardFonts.Helvetica);
    const FB = await doc.embedFont(StandardFonts.HelveticaBold);
    const CW = A4W - 2 * MARG;
    let page = doc.addPage([A4W, A4H]);
    let y = A4H - MARG;
    const ensure = (h: number) => { if (y - h < MARG + 10 * MM) { page = doc.addPage([A4W, A4H]); y = A4H - MARG; } };

    // Cabeçalho: laboratório + título do documento
    page.drawText(fit(FB, String(lab.nome ?? ''), 12, CW), { x: MARG, y: y - 12, size: 12, font: FB, color: NAVY });
    const sub = [lab.endereco, lab.cidade ? `${lab.cidade}/${lab.uf ?? ''}` : '', lab.cnpj ? `CNPJ ${lab.cnpj}` : ''].filter(Boolean).join(' · ');
    if (sub) page.drawText(fit(F, sub, 8, CW), { x: MARG, y: y - 24, size: 8, font: F, color: MUTED });
    y -= 34;
    page.drawLine({ start: { x: MARG, y }, end: { x: A4W - MARG, y }, thickness: 1.2, color: MAGENTA });
    y -= 18;
    for (const ln of wrapText(FB, titleDoc, 16, CW)) { ensure(20); page.drawText(ln, { x: MARG, y: y - 4, size: 16, font: FB, color: INK }); y -= 20; }
    y -= 4;

    for (const b of blocks) {
      const t = String(b.type ?? '');
      if (t === 'titulo') {
        const size = b.size === 'g' ? 14 : 12;
        y -= 6;
        for (const ln of wrapText(FB, interpolate(b.text ?? '', ctx, missing), size, CW)) { ensure(size + 8); page.drawText(ln, { x: MARG, y: y - size, size, font: FB, color: NAVY }); y -= size + 4; }
        y -= 2;
      } else if (t === 'paragrafo') {
        for (const ln of wrapText(F, interpolate(b.text ?? '', ctx, missing), 10, CW)) { ensure(14); page.drawText(ln, { x: MARG, y: y - 10, size: 10, font: F, color: INK }); y -= 13.5; }
        y -= 4;
      } else if (t === 'chave_valor') {
        const labelW = CW * 0.32;
        for (const r of b.rows ?? []) {
          const value = interpolate(r.value ?? '', ctx, missing);
          const lines = wrapText(F, value, 10, CW - labelW - 8);
          ensure(14 * lines.length);
          page.drawText(fit(FB, interpolate(r.label ?? '', ctx, missing), 9, labelW), { x: MARG, y: y - 10, size: 9, font: FB, color: MUTED });
          for (const ln of lines) { page.drawText(ln, { x: MARG + labelW + 8, y: y - 10, size: 10, font: F, color: INK }); y -= 13.5; }
          y -= 1.5;
        }
        y -= 4;
      } else if (t === 'tabela_itens') {
        const rowsData = resolvePath(ctx, String(b.source ?? ''));
        if (!Array.isArray(rowsData)) { missing.add(String(b.source ?? 'tabela.source')); continue; }
        const cols = (b.columns ?? []).filter((c) => c?.header != null && c?.path != null);
        if (!cols.length) continue;
        const totalW = cols.reduce((s, c) => s + (Number(c.width) > 0 ? Number(c.width) : 1), 0);
        const widths = cols.map((c) => ((Number(c.width) > 0 ? Number(c.width) : 1) / totalW) * CW);
        const rowH = 16;
        ensure(rowH * 2);
        // header
        page.drawRectangle({ x: MARG, y: y - rowH, width: CW, height: rowH, color: NAVY });
        let cx = MARG;
        cols.forEach((c, i) => { page.drawText(fit(FB, c.header, 8, widths[i] - 8), { x: cx + 4, y: y - rowH + 4.5, size: 8, font: FB, color: rgb(1, 1, 1) }); cx += widths[i]; });
        y -= rowH;
        // rows
        (rowsData as Array<Record<string, unknown>>).forEach((row, ri) => {
          ensure(rowH);
          if (ri % 2 === 1) page.drawRectangle({ x: MARG, y: y - rowH, width: CW, height: rowH, color: ZEBRA });
          let rx = MARG;
          cols.forEach((c, i) => {
            const raw = resolvePath(row as Ctx, c.path);
            const txt = fit(F, fmtValue(raw, c.format), 8.5, widths[i] - 8);
            const tw = F.widthOfTextAtSize(txt, 8.5);
            const alignRight = c.align === 'right' || c.format === 'moeda' || c.format === 'numero';
            page.drawText(txt, { x: alignRight ? rx + widths[i] - 4 - tw : rx + 4, y: y - rowH + 4.5, size: 8.5, font: F, color: INK });
            rx += widths[i];
          });
          page.drawLine({ start: { x: MARG, y: y - rowH }, end: { x: MARG + CW, y: y - rowH }, thickness: 0.4, color: LINE });
          y -= rowH;
        });
        if (b.total_path) {
          const soma = (rowsData as Array<Record<string, unknown>>).reduce((s, r) => s + (Number(resolvePath(r as Ctx, String(b.total_path))) || 0), 0);
          ensure(rowH + 2);
          const label = String(b.total_label ?? 'Total');
          const txt = soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const tw = FB.widthOfTextAtSize(txt, 10);
          page.drawText(label, { x: MARG + CW - tw - 90, y: y - 12, size: 9, font: FB, color: MUTED });
          page.drawText(txt, { x: MARG + CW - tw - 4, y: y - 12, size: 10, font: FB, color: INK });
          y -= rowH;
        }
        y -= 6;
      } else if (t === 'divisor') {
        ensure(10);
        page.drawLine({ start: { x: MARG, y: y - 4 }, end: { x: A4W - MARG, y: y - 4 }, thickness: 0.6, color: LINE });
        y -= 12;
      } else if (t === 'espaco') {
        y -= Math.max(2, Math.min(80, Number(b.h) || 8));
      } else if (t === 'assinaturas') {
        const bw = (CW - 24) / 2;
        ensure(70);
        y -= 40;
        const esq = interpolate(b.left ?? '{{lab.responsavel_tecnico}}', ctx, missing);
        const dir = interpolate(b.right ?? '{{cliente.razao_social}}', ctx, missing);
        page.drawLine({ start: { x: MARG, y }, end: { x: MARG + bw, y }, thickness: 0.8, color: INK });
        page.drawLine({ start: { x: MARG + bw + 24, y }, end: { x: MARG + CW, y }, thickness: 0.8, color: INK });
        page.drawText(fit(F, esq, 9, bw), { x: MARG, y: y - 12, size: 9, font: F, color: INK });
        page.drawText(fit(F, dir, 9, bw), { x: MARG + bw + 24, y: y - 12, size: 9, font: F, color: INK });
        y -= 26;
      }
    }

    // RN-03: placeholder desconhecido bloqueia o documento.
    if (missing.size > 0) {
      const campos = [...missing].sort();
      if (!preview && entityId) {
        const svc = _obsSvc();
        await svc.from('document_render_jobs').insert({
          tenant_id: versao.tenant_id, template_version_id: versao.id, entity_type: entityType, entity_id: entityId,
          status: 'failed', error_message: 'placeholders desconhecidos: ' + campos.join(', '),
          render_context: { missing: campos },
        });
      }
      return json({ error: 'placeholders desconhecidos no template', campos }, 422);
    }

    // Rodapé em todas as páginas (nota do lab + paginação + data)
    const pages = doc.getPages();
    const nota = String(lab.nota_rodape ?? '');
    pages.forEach((p, i) => {
      p.drawLine({ start: { x: MARG, y: MARG + 14 }, end: { x: A4W - MARG, y: MARG + 14 }, thickness: 0.5, color: LINE });
      if (nota) p.drawText(fit(F, nota, 7, CW - 90), { x: MARG, y: MARG + 4, size: 7, font: F, color: MUTED });
      const pg = `Página ${i + 1} de ${pages.length} · ${String((ctx as Record<string, unknown>).hoje ?? '')}`;
      const w = F.widthOfTextAtSize(pg, 7);
      p.drawText(pg, { x: A4W - MARG - w, y: MARG + 4, size: 7, font: F, color: MUTED });
    });

    const bytes = await doc.save();

    // Persistência (documento oficial): bucket privado + job de trilha (RN-04: snapshot imutável).
    let jobId: string | null = null;
    let storagePath: string | null = null;
    if (!preview) {
      const svc = _obsSvc();
      const { data: m } = await svc.from('members').select('id').eq('auth_id', ures.user.id).eq('active', true).is('deleted_at', null).maybeSingle();
      const { data: job, error: eJob } = await svc.from('document_render_jobs').insert({
        tenant_id: versao.tenant_id, template_version_id: versao.id, entity_type: entityType, entity_id: entityId,
        status: 'rendering', generated_by: m?.id ?? null, render_context: { title: titleDoc },
      }).select('id').single();
      if (!eJob && job) {
        jobId = String(job.id);
        storagePath = `${versao.tenant_id}/${entityType}/${jobId}.pdf`;
        const up = await svc.storage.from('documentos').upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });
        if (up.error) {
          await svc.from('document_render_jobs').update({ status: 'failed', error_message: up.error.message, updated_at: new Date().toISOString() }).eq('id', jobId);
          storagePath = null;
        } else {
          await svc.from('document_render_jobs').update({ status: 'done', storage_path: storagePath, generated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', jobId);
        }
      }
    }

    const fname = titleDoc.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'documento';
    return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${fname}.pdf"`, ...(jobId ? { 'x-job-id': jobId } : {}), ...(storagePath ? { 'x-storage-path': storagePath } : {}), ...cors } });
  } catch (e) {
    return serverError(e, { req, fnName: 'generate-document-pdf', action: 'relatorio.pdf:generate-document-pdf' });
  }
});
