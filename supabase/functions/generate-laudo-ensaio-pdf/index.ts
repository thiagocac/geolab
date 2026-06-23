// generate-laudo-ensaio-pdf (GEOLAB) - Laudo NBR 5739 modelo v4 + campos dinamicos + paridade v4 (amostragem/contato/local/componentes/incerteza/capeamento/ART/2a assinatura).
import { PDFDocument, StandardFonts, rgb, PDFImage } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import QRCode from 'npm:qrcode@1.5.3';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-expose-headers': 'x-lab-report-id' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const NAVY = rgb(0.094, 0.157, 0.388);
const MAG = rgb(0.773, 0.067, 0.494);
const INK = rgb(0.106, 0.137, 0.188);
const MUTED = rgb(0.36, 0.39, 0.45);
const FAINT = rgb(0.55, 0.58, 0.64);
const LINE = rgb(0.87, 0.89, 0.93);
const NAVYL = rgb(0.906, 0.918, 0.949);
const OKG = rgb(0.18, 0.62, 0.36);
const DANGER = rgb(0.78, 0.20, 0.20);
const WHITE = rgb(1, 1, 1);
const PW = 595.28, PH = 841.89, MX = 40, RIGHT = PW - MX, CW = RIGHT - MX, BOTTOM = 54;

const san = (s: unknown): string => String(s ?? '').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/≈/g, '~').replace(/[^\x00-\xFF]/g, '?');
const fmt = (n: number | null | undefined, d = 1) => (n == null || !isFinite(n) ? '-' : n.toFixed(d).replace('.', ','));
const dbr = (s: unknown) => { const t = String(s ?? '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '-'; const [y, m, dd] = t.split('-'); return `${dd}/${m}/${y}`; };
const emb = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? v as Record<string, unknown> : {});
async function sha256Hex(bytes: Uint8Array): Promise<string> { const d = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const concretagemId = String(body.concretagem_id ?? '');
    if (!concretagemId) return json({ error: 'concretagem_id obrigatorio' }, 400);
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return json({ error: 'nao autenticado' }, 401);
    const sb = createClient(url, anon, { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ error: 'nao autenticado' }, 401);

    const { data: conc, error: e1 } = await sb.from('concretagens')
      .select('id, codigo, data_real, data_programada, hora_programada, hora_inicio, hora_fim, work_id, client_id, tenant_id, fck_previsto, operational_material_id, traco_texto, fornecedor_texto, volume_programado_m3, volume_lancado_m3, dimensao_cp, local_texto, clima, temperatura_ambiente_c, bombeado, observacoes, moldador_id')
      .eq('id', concretagemId).is('deleted_at', null).maybeSingle();
    if (e1) return json({ error: e1.message }, 403);
    if (!conc) return json({ error: 'concretagem nao encontrada' }, 404);

    const [{ data: work }, { data: cliente }, { data: tenant }, { data: om }, { data: cfg }] = await Promise.all([
      sb.from('client_works').select('nome, cidade, uf, endereco, responsavel_tecnico, crea').eq('id', conc.work_id).maybeSingle(),
      sb.from('lab_clients').select('razao_social, nome_fantasia, email, telefone').eq('id', conc.client_id).maybeSingle(),
      sb.from('tenants').select('name').eq('id', conc.tenant_id).maybeSingle(),
      conc.operational_material_id ? sb.from('operational_materials').select('nome, fck_mpa, condicao_preparo, cimento_tipo, consumo_cimento_kg_m3, brita, fator_ac, metodo_cura, aditivo_tipo, dmax_agregado_mm, slump_previsto_cm, slump_tolerancia_cm, bombeado, componentes').eq('id', conc.operational_material_id).maybeSingle() : Promise.resolve({ data: null }),
      sb.from('config_lab').select('laudo_campos, recebimento_campos, concretagem_campos, responsavel_tecnico, crea_rt, acreditacao_inmetro, logo_path, nota_rodape, local_ensaio, art_numero, gerente_qualidade, crea_gq').eq('tenant_id', conc.tenant_id).maybeSingle(),
    ]);
    const { data: moldador } = conc.moldador_id ? await sb.from('colaboradores').select('nome').eq('id', conc.moldador_id).maybeSingle() : { data: null };

    let logoBytes: Uint8Array | null = null; let logoPng = true;
    if (cfg?.logo_path) { try { const dl = await admin.storage.from('lab-reports').download(String(cfg.logo_path)); if (dl.data) { logoBytes = new Uint8Array(await dl.data.arrayBuffer()); const lp = String(cfg.logo_path).toLowerCase(); logoPng = !(lp.endsWith('.jpg') || lp.endsWith('.jpeg')); } } catch (_) { logoBytes = null; } }

    const { data: tests } = await sb.from('material_tests')
      .select('id, resultado_valor, idade_dias, idade_unidade, data_rompimento, cp_diametro_mm, cp_altura_mm, tipo_ruptura, capeamento, carga_ruptura_kn, equipamento_id, receipt_id, corpo_prova_id')
      .eq('concretagem_id', concretagemId).is('deleted_at', null).not('resultado_valor', 'is', null);
    const tlist = (tests ?? []) as Record<string, unknown>[];
    if (!tlist.length) return json({ error: 'sem resultados lancados para esta concretagem' }, 422);

    const cpIds = [...new Set(tlist.map((t) => t.corpo_prova_id).filter(Boolean))] as string[];
    const rcIds = [...new Set(tlist.map((t) => t.receipt_id).filter(Boolean))] as string[];
    const eqIds = [...new Set(tlist.map((t) => t.equipamento_id).filter(Boolean))] as string[];
    const [{ data: cps }, { data: receipts }, { data: equips }] = await Promise.all([
      cpIds.length ? sb.from('corpos_prova').select('id, codigo, data_moldagem').in('id', cpIds) : Promise.resolve({ data: [] }),
      rcIds.length ? sb.from('material_receipts').select('id, nota_fiscal, serie, external_key, placa, motorista, volume_m3, hora_saida_usina, hora_chegada_obra, hora_inicio_descarga, hora_fim_descarga, hora_moldagem, slump_medido_cm, temperatura_concreto_c, houve_adicao_agua, agua_litros, rejeitado, motivo_rejeicao, elementos_concretados, observacoes').in('id', rcIds) : Promise.resolve({ data: [] }),
      eqIds.length ? sb.from('equipamentos').select('id, marca_modelo, numero_serie, classe, numero_certificado, validade_calibracao, lab_calibrador, incerteza_mpa').in('id', eqIds) : Promise.resolve({ data: [] }),
    ]);
    const cpById = new Map((cps ?? []).map((r: Record<string, unknown>) => [r.id, r]));
    const rcById = new Map((receipts ?? []).map((r: Record<string, unknown>) => [r.id, r]));

    const LC = (cfg?.laudo_campos ?? {}) as Record<string, unknown>;
    const RC = (cfg?.recebimento_campos ?? {}) as Record<string, unknown>;
    const CC = (cfg?.concretagem_campos ?? {}) as Record<string, unknown>;
    const ON: Record<string, boolean> = {};
    const RON: Record<string, boolean> = {};
    const CON: Record<string, boolean> = {};
    const defOn = (k: string, d: boolean) => (LC[k] === undefined ? d : LC[k] !== false);
    const defRon = (k: string, d: boolean) => (RC[k] === undefined ? d : RC[k] !== false);
    const defCon = (k: string, d: boolean) => (CC[k] === undefined ? d : CC[k] !== false);
    ['dim_hd', 'tipo_ruptura', 'dados_concreto', 'cimento', 'cura', 'equipamentos', 'responsavel_tecnico', 'qr_validacao', 'logo_laboratorio', 'elemento', 'usina', 'recebimento', 'amostragem'].forEach((k) => (ON[k] = defOn(k, true)));
    ['aditivo', 'acreditacao', 'dmax', 'carga', 'temperatura', 'ficha_moldagem', 'observacoes', 'incerteza', 'moldador', 'contato', 'local_ensaio', 'componentes'].forEach((k) => (ON[k] = defOn(k, false)));
    ['nota_fiscal', 'placa', 'motorista', 'volume_m3', 'horarios_transporte', 'horarios_descarga', 'hora_moldagem', 'slump', 'temperatura_concreto', 'agua_adicionada', 'rejeicao', 'elementos_concretados', 'observacoes_caminhao'].forEach((k) => (RON[k] = defRon(k, true)));
    ['traco_fck', 'fornecedor', 'data_hora', 'local_peca', 'volume_programado', 'dimensao_cp', 'moldador', 'clima', 'temperatura_ambiente', 'bombeado', 'observacoes', 'padrao_moldagem'].forEach((k) => (CON[k] = defCon(k, true)));

    const idade = (t: Record<string, unknown>) => Number(t.idade_dias ?? 0);
    const isCtrl = (t: Record<string, unknown>) => idade(t) === 28 && String(t.idade_unidade ?? 'dia') !== 'hora';
    const grupos = new Map<string, Record<string, unknown>[]>();
    for (const t of tlist) { const k = String(t.receipt_id ?? 'sem-nf'); const a = grupos.get(k) ?? []; a.push(t); grupos.set(k, a); }
    const nfKey = (id: string) => { const rc = rcById.get(id) as Record<string, unknown> | undefined; return rc ? String(rc.nota_fiscal ?? rc.serie ?? '-') : '-'; };
    const exemplares = [...grupos.entries()].sort((a, b) => nfKey(a[0]).localeCompare(nfKey(b[0])));

    // ACEITACAO POR EXEMPLAR (v1): maior do par na idade de controle, por NF
    const resExemplar: number[] = [];
    for (const [, arr] of exemplares) { const ctrl = arr.filter(isCtrl).map((t) => Number(t.resultado_valor)).filter((v) => isFinite(v)); if (ctrl.length) resExemplar.push(Math.max(...ctrl)); }
    const fck = Number(om?.fck_mpa ?? conc.fck_previsto ?? 0);
    const n = resExemplar.length;
    const menorExemplar = n ? Math.min(...resExemplar) : null;
    const conforme = menorExemplar != null && fck > 0 ? menorExemplar >= fck : null;
    const statusTxt = conforme == null ? 'AGUARDANDO IDADE DE CONTROLE' : conforme ? 'CONFORME' : 'NAO CONFORME';
    const statusCor = conforme == null ? FAINT : conforme ? OKG : DANGER;
    const numero = `${String(conc.codigo ?? '').replace(/[^0-9]/g, '').slice(-6).padStart(6, '0')}/${String(conc.data_real ?? conc.data_programada ?? '').slice(0, 4) || '2026'}`;
    const codVal = `LAU-${String(conc.codigo ?? 'XXXX')}`;
    const interessado = String(cliente?.razao_social || cliente?.nome_fantasia || tenant?.name || '-');
    const rt = String(cfg?.responsavel_tecnico || work?.responsavel_tecnico || '');
    const creaRt = String(cfg?.crea_rt || work?.crea || '');
    const contatoEmail = String(cliente?.email || '');
    const art = String(cfg?.art_numero || '');
    const gqNome = String(cfg?.gerente_qualidade || '');
    const gqCrea = String(cfg?.crea_gq || '');
    const localEnsaio = String(cfg?.local_ensaio || '');
    const condicao = String(om?.condicao_preparo || 'A');

    const doc = await PDFDocument.create();
    const F = await doc.embedFont(StandardFonts.Helvetica);
    const FB = await doc.embedFont(StandardFonts.HelveticaBold);
    let page = doc.addPage([PW, PH]);
    let logoImg: PDFImage | null = null;
    if (logoBytes) { try { logoImg = logoPng ? await doc.embedPng(logoBytes) : await doc.embedJpg(logoBytes); } catch (_) { logoImg = null; } }
    const T = (s: unknown, x: number, y: number, size: number, f = F, c = INK) => page.drawText(san(s), { x, y, size, font: f, color: c });
    const TR = (s: unknown, xr: number, y: number, size: number, f = F, c = INK) => { const w = f.widthOfTextAtSize(san(s), size); page.drawText(san(s), { x: xr - w, y, size, font: f, color: c }); };
    const rect = (x: number, y: number, w: number, h: number, c: unknown, border?: unknown) => page.drawRectangle({ x, y, width: w, height: h, color: c as undefined, borderColor: border as undefined, borderWidth: border ? 0.6 : 0 });
    const hline = (x1: number, y: number, x2: number, c = LINE, w = 0.6) => page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: w, color: c });

    const topo = PH - 30;
    if (ON.logo_laboratorio && logoImg) { const iw = logoImg.width, ih = logoImg.height; const sc = Math.min(150 / iw, 30 / ih); page.drawImage(logoImg, { x: MX, y: topo - ih * sc, width: iw * sc, height: ih * sc }); }
    else if (ON.logo_laboratorio) { rect(MX, topo - 26, 150, 26, undefined, LINE); T(String(tenant?.name || 'LABORATORIO'), MX + 8, topo - 16, 8, FB, MUTED); }
    rect(RIGHT - 86, topo - 19, 15, 15, MAG);
    page.drawText('C', { x: RIGHT - 81.5, y: topo - 15.4, size: 9, font: FB, color: WHITE });
    const sw2 = FB.widthOfTextAtSize('soft', 13), cw2 = FB.widthOfTextAtSize('Concre', 13);
    T('soft', RIGHT - sw2, topo - 15.6, 13, FB, MAG); T('Concre', RIGHT - sw2 - cw2, topo - 15.6, 13, FB, NAVY);
    T('Relatorio de Ensaio', MX, PH - 66, 17, FB, NAVY);
    T('Resistencia a compressao de corpos de prova cilindricos - ABNT NBR 5739', MX, PH - 77, 8.2, F, MUTED);
    TR('RELATORIO No', RIGHT, PH - 54, 6.4, F, FAINT); TR(numero, RIGHT, PH - 69, 15, FB, NAVY);
    page.drawCircle({ x: RIGHT - FB.widthOfTextAtSize(statusTxt, 7.5) - 8, y: PH - 80.2, size: 2.4, color: statusCor });
    TR(statusTxt, RIGHT, PH - 82.5, 7.5, FB, statusCor);
    page.drawLine({ start: { x: MX, y: PH - 90 }, end: { x: MX + 175, y: PH - 90 }, thickness: 2, color: NAVY });
    page.drawLine({ start: { x: MX + 175, y: PH - 90 }, end: { x: RIGHT, y: PH - 90 }, thickness: 2, color: LINE });
    let y = PH - 108;
    const need = (h: number, contHeader = true) => { if (y - h < BOTTOM) { page = doc.addPage([PW, PH]); y = PH - 50; if (contHeader) { T('Relatorio No ' + numero + ' (continuacao)', MX, y, 8, FB, NAVY); y -= 16; } } };
    const sec = (label: string) => { need(20, false); T(label, MX, y, 8.5, FB, NAVY); y -= 4; hline(MX, y, RIGHT); y -= 10; };
    const kv = (lbl: string, val: string, x: number) => { T(lbl, x, y, 6.3, F, FAINT); T(val, x, y - 10, 8.2, FB, INK); };

    kv('INTERESSADO', interessado, MX); kv('OBRA', String(work?.nome || '-'), MX + CW * 0.34); kv('COD. CONCRETAGEM', String(conc.codigo || '-'), MX + CW * 0.62); kv('EMISSAO', dbr(new Date().toISOString()), MX + CW * 0.84);
    y -= 24;
    kv('ENDERECO', [work?.endereco, work?.cidade, work?.uf].filter(Boolean).join(' - ') || '-', MX);
    if (ON.responsavel_tecnico) { kv('RESP. TECNICO', rt || '-', MX + CW * 0.34); kv('CREA', creaRt || '-', MX + CW * 0.62); }
    if (ON.contato && contatoEmail) kv('SOLICITANTE', contatoEmail, MX + CW * 0.84);
    else if (ON.acreditacao) kv('ACREDITACAO', String(cfg?.acreditacao_inmetro || '-'), MX + CW * 0.84);
    if (ON.moldador && moldador?.nome) { y -= 22; kv('RESP. MOLDAGEM', String(moldador.nome), MX); }
    y -= 22; hline(MX, y, RIGHT, LINE); y -= 12;

    if (ON.dados_concreto) {
      sec('Dados do concreto e da concretagem');
      const tracoNome = om?.nome ? String(om.nome) : String(conc.traco_texto || '-');
      const pares: [string, string][] = [['Material', 'Concreto']];
      if (CON.traco_fck) { pares.push(['Traco', tracoNome]); pares.push(['Fck (MPa)', fmt(fck, 1)]); }
      if (ON.amostragem) pares.push(['Amostragem', 'Total - condicao ' + condicao]);
      if (om?.condicao_preparo) pares.push(['Condicao de preparo', String(om.condicao_preparo || '-')]);
      if (om?.slump_previsto_cm != null) pares.push(['Abatimento prev. (cm)', `${fmt(Number(om.slump_previsto_cm), 1)} +/- ${fmt(Number(om.slump_tolerancia_cm ?? 0), 1)}`]);
      if (om?.brita) pares.push(['Brita / agregado', String(om.brita || '-')]);
      if (om?.fator_ac != null) pares.push(['A/C projeto', fmt(Number(om.fator_ac), 2)]);
      if (CON.bombeado) pares.push(['Lancamento', conc.bombeado || om?.bombeado ? 'Bombeado' : 'Convencional']);
      if (CON.volume_programado) { pares.push(['Volume prog. (m3)', conc.volume_programado_m3 != null ? fmt(Number(conc.volume_programado_m3), 1) : '-']); pares.push(['Volume lancado (m3)', conc.volume_lancado_m3 != null ? fmt(Number(conc.volume_lancado_m3), 1) : '-']); }
      if (CON.dimensao_cp) pares.push(['Dimensao CP', String(conc.dimensao_cp || '100x200')]);
      if (CON.data_hora) { pares.push(['Data moldagem', dbr(conc.data_real || conc.data_programada)]); pares.push(['Horario', String(conc.hora_inicio || conc.hora_programada || '-') + (conc.hora_fim ? ' a ' + String(conc.hora_fim) : '')]); }
      if (CON.local_peca || ON.elemento) pares.push(['Local / peca', String(conc.local_texto || '-')]);
      if (ON.usina && CON.fornecedor) pares.push(['Central / usina', String(conc.fornecedor_texto || '-')]);
      if (CON.clima) pares.push(['Clima', String(conc.clima || '-')]);
      if (CON.temperatura_ambiente) pares.push(['Temp. ambiente', conc.temperatura_ambiente_c != null ? `${fmt(Number(conc.temperatura_ambiente_c), 1)} C` : '-']);
      if (ON.cimento && om) { pares.push(['Cimento', String(om.cimento_tipo || '-')]); pares.push(['Consumo cimento', om.consumo_cimento_kg_m3 != null ? `${fmt(Number(om.consumo_cimento_kg_m3), 0)} kg/m3` : '-']); }
      if (ON.cura && om) pares.push(['Cura', String(om.metodo_cura || '-')]);
      if (ON.aditivo && om) pares.push(['Aditivo', String(om.aditivo_tipo || '-')]);
      if (ON.dmax && om) pares.push(['Dmax agregado (mm)', om.dmax_agregado_mm != null ? fmt(Number(om.dmax_agregado_mm), 0) : '-']);
      if (ON.componentes && om?.componentes && typeof om.componentes === 'object') { for (const [ck, cv] of Object.entries(om.componentes as Record<string, unknown>)) { if (!cv) continue; const o = (typeof cv === 'object' ? cv : {}) as Record<string, unknown>; const txt = (o.marca || o.procedencia) ? [o.marca, o.procedencia].filter(Boolean).join(' / ') : String(cv); pares.push([ck.charAt(0).toUpperCase() + ck.slice(1), String(txt).slice(0, 28)]); } }
      const colW = CW / 4;
      for (let i = 0; i < pares.length; i += 4) { need(20, false); for (let j = 0; j < 4 && i + j < pares.length; j++) { const [l, v] = pares[i + j]; const x = MX + j * colW; T(l, x, y, 6.2, F, FAINT); T(v, x, y - 9, 7.6, F, INK); } y -= 21; }
      need(12, false); T('Normas: NBR 5739/5738/16889/16886 - Aceitacao NBR 12655. Tipos de ruptura: A conica, B conica/bipartida, C colunar, D cisalhada, E paralela as bases, F pontiaguda.', MX, y, 5.6, F, FAINT); y -= 12;
      y -= 4;
    }

    if (ON.recebimento && (receipts ?? []).length) {
      sec('Recebimento e caminhões');
      const rows = (receipts ?? []) as Record<string, unknown>[];
      for (const rc of rows) {
        need(28, true);
        const head = `Caminhao ${String(rc.serie ?? '-')}  -  NF ${String(rc.nota_fiscal ?? '-')}`;
        rect(MX, y - 10, CW, 12, NAVYL); T(head, MX + 5, y - 7.6, 6.8, FB, NAVY); y -= 13;
        const partes: string[] = [];
        if (RON.placa && rc.placa) partes.push('Placa ' + String(rc.placa));
        if (RON.motorista && rc.motorista) partes.push('Motorista ' + String(rc.motorista));
        if (RON.volume_m3 && rc.volume_m3 != null) partes.push('Vol. ' + fmt(Number(rc.volume_m3), 1) + ' m3');
        if (RON.horarios_transporte) partes.push('Transp. ' + String(rc.hora_saida_usina || '-') + ' -> ' + String(rc.hora_chegada_obra || '-'));
        if (RON.horarios_descarga) partes.push('Desc. ' + String(rc.hora_inicio_descarga || '-') + ' -> ' + String(rc.hora_fim_descarga || '-'));
        if (RON.hora_moldagem && rc.hora_moldagem) partes.push('Mold. ' + String(rc.hora_moldagem));
        if (RON.slump && rc.slump_medido_cm != null) partes.push('Slump ' + fmt(Number(rc.slump_medido_cm), 1) + ' cm');
        if ((ON.temperatura || RON.temperatura_concreto) && rc.temperatura_concreto_c != null) partes.push('Temp. concreto ' + fmt(Number(rc.temperatura_concreto_c), 0) + ' C');
        if (RON.agua_adicionada && rc.houve_adicao_agua) partes.push('Agua adicionada ' + fmt(Number(rc.agua_litros ?? 0), 0) + ' L');
        if (RON.rejeicao && rc.rejeitado) partes.push('Rejeitado: ' + String(rc.motivo_rejeicao || '-'));
        const line = partes.join('  |  ') || 'Sem campos opcionais habilitados';
        T(line.slice(0, 170), MX + 5, y - 7, 6.2, F, MUTED); y -= 11;
        if (RON.elementos_concretados && rc.elementos_concretados) { T(('Elementos: ' + String(rc.elementos_concretados)).slice(0, 170), MX + 5, y - 7, 6.2, F, MUTED); y -= 10; }
        if (RON.observacoes_caminhao && rc.observacoes) { T(('Obs.: ' + String(rc.observacoes)).slice(0, 170), MX + 5, y - 7, 6.2, F, MUTED); y -= 10; }
      }
      y -= 4;
    }

    sec('Resultados - por exemplar / nota fiscal');
    type Col = { key: string; label: string; w: number; on: boolean; x?: number; px?: number };
    const colsAll: Col[] = [{ key: 'cp', label: 'CP', w: 8, on: true }, { key: 'idade', label: 'Idade', w: 12, on: true }, { key: 'data', label: 'Data ruptura', w: 17, on: true }, { key: 'dh', label: 'd x h (mm)', w: 14, on: ON.dim_hd }, { key: 'hd', label: 'h/d', w: 7, on: ON.dim_hd }, { key: 'rup', label: 'Ruptura', w: 9, on: ON.tipo_ruptura }, { key: 'carga', label: 'Carga (kN)', w: 13, on: ON.carga }, { key: 'rcp', label: 'Resist. CP (MPa)', w: 16, on: true }, { key: 'rex', label: 'Resist. exemplar', w: 21, on: true }];
    const cols = colsAll.filter((c) => c.on);
    const wsum = cols.reduce((s, c) => s + c.w, 0);
    let cx = MX; for (const c of cols) { c.x = cx; c.px = (c.w / wsum) * CW; cx += c.px; }
    const cellX = (c: Col, s: string, size: number, f: typeof F) => (c.x as number) + (c.px as number) / 2 - f.widthOfTextAtSize(san(s), size) / 2;
    const thead = () => { need(16, true); rect(MX, y - 12, CW, 13, NAVY); for (const c of cols) T(c.label, cellX(c, c.label, 6.1, FB), y - 8.5, 6.1, FB, WHITE); y -= 12; };
    thead();
    let exi = 0;
    for (const [rid, arr] of exemplares) {
      exi++; const rc = rcById.get(rid) as Record<string, unknown> | undefined;
      arr.sort((a, b) => idade(a) - idade(b));
      const ctrl = arr.filter(isCtrl).map((t) => Number(t.resultado_valor)).filter(isFinite);
      const rexVal = ctrl.length ? Math.max(...ctrl) : null;
      need(13, true); rect(MX, y - 11, CW, 12, NAVYL);
      const faixa = `Exemplar ${exi}  -  NF ${nfKey(rid)}` + (RON.volume_m3 && rc?.volume_m3 ? `  -  Vol ${fmt(Number(rc.volume_m3), 1)} m3` : '') + (RON.slump && rc?.slump_medido_cm != null ? `  -  Slump ${fmt(Number(rc.slump_medido_cm), 1)} cm` : '') + (ON.temperatura && RON.temperatura_concreto && rc?.temperatura_concreto_c != null ? `  -  Temp ${fmt(Number(rc.temperatura_concreto_c), 0)}C` : '') + (ON.ficha_moldagem && rc?.external_key ? `  -  Ficha ${String(rc.external_key)}` : '') + (arr.length && arr[0].capeamento ? '  -  Bases ' + String(arr[0].capeamento) : '');
      T(faixa, MX + 5, y - 8, 6.8, FB, NAVY); y -= 12;
      if (ON.elemento && RON.elementos_concretados && rc?.elementos_concretados) { need(10, true); T(('Local: ' + String(rc.elementos_concretados)).slice(0, 150), MX + 5, y - 7, 6.2, F, MUTED); y -= 11; }
      let first = true;
      for (let i = 0; i < arr.length; i++) {
        const t = arr[i]; need(12, true);
        const cp = cpById.get(t.corpo_prova_id as string) as Record<string, unknown> | undefined;
        const d = Number(t.cp_diametro_mm ?? 0) || 100, h = Number(t.cp_altura_mm ?? 0) || 200;
        const row: Record<string, string> = { cp: String(cp?.codigo ?? i + 1).split('-').pop() || String(i + 1), idade: `${idade(t)} ${String(t.idade_unidade) === 'hora' ? 'h' : 'dias'}`, data: dbr(t.data_rompimento), dh: `${fmt(d, 0)} x ${fmt(h, 0)}`, hd: fmt(h / d, 2), rup: String(t.tipo_ruptura || '-'), carga: t.carga_ruptura_kn != null ? fmt(Number(t.carga_ruptura_kn), 1) : '-', rcp: fmt(Number(t.resultado_valor), 1), rex: first && rexVal != null ? fmt(rexVal, 1) : '' };
        for (const c of cols) { const f = c.key === 'rex' ? FB : F; const col = c.key === 'rex' ? NAVY : INK; T(row[c.key], cellX(c, row[c.key], 6.6, f), y - 8, 6.6, f, col); }
        y -= 11; hline(MX, y, RIGHT, rgb(0.93, 0.95, 0.98), 0.4); first = false;
      }
    }
    y -= 8;

    need(22, false); rect(MX, y - 16, CW, 18, NAVY);
    T(ON.amostragem ? 'Aceitacao (ABNT NBR 12655 - amostragem total - condicao ' + condicao + ')' : 'Aceitacao (ABNT NBR 12655)', MX + 6, y - 10.5, 8, FB, WHITE);
    const aceTxt = menorExemplar != null ? `fck,est = ${fmt(menorExemplar, 1)} MPa  ${conforme ? '>=' : '<'}  fck ${fmt(fck, 1)} MPa` : `${n} exemplar(es) na idade de controle`;
    T(aceTxt, MX + CW * 0.46, y - 10.5, 8, FB, WHITE);
    TR(statusTxt, RIGHT - 8, y - 10.5, 8.5, FB, conforme == null ? WHITE : conforme ? rgb(0.6, 1, 0.78) : rgb(1, 0.8, 0.8));
    y -= 26;

    if (ON.equipamentos && (equips ?? []).length) {
      sec('Equipamentos utilizados');
      rect(MX, y - 11, CW, 12, NAVY);
      const ec = [['Equipamento', 0.24], ['Classe', 0.08], ['No serie', 0.15], ['Certificado', 0.17], ['Lab. calibrador', 0.20], ['Valido ate', 0.16]] as [string, number][];
      let ex2 = MX; for (const [l, w] of ec) { T(l, ex2 + 3, y - 8, 6.1, FB, WHITE); ex2 += w * CW; }
      y -= 12;
      for (const eq of (equips ?? []) as Record<string, unknown>[]) { need(12, true); const inc = ON.incerteza && eq.incerteza_mpa != null ? ' (u=' + fmt(Number(eq.incerteza_mpa), 1) + ')' : ''; const vals = [String(eq.marca_modelo || '-') + inc, String(eq.classe || '-'), String(eq.numero_serie || '-'), String(eq.numero_certificado || '-'), String(eq.lab_calibrador || '-'), dbr(eq.validade_calibracao)]; let x2 = MX; for (let k = 0; k < ec.length; k++) { T(vals[k], x2 + 3, y - 8, 6.5, F, INK); x2 += ec[k][1] * CW; } y -= 11; hline(MX, y, RIGHT, rgb(0.93, 0.95, 0.98), 0.4); }
      y -= 6;
    }

    need(40, false); sec('Comentarios e observacoes');
    const obs = (ON.observacoes && conc.observacoes ? String(conc.observacoes).trim() + ' ' : '') + 'Os resultados tem significado restrito e aplicam-se somente a amostra ensaiada. Aceitacao por exemplar na idade de controle (resistencia do exemplar = maior do par). Estatistica de lote (fck,est ABNT NBR 12655) nao integra esta versao. Coleta na obra; moldagem, cura e ruptura conforme NBR 5738/5739.' + (ON.contato && contatoEmail ? ' Solicitante: ' + contatoEmail + '.' : '') + (ON.local_ensaio && localEnsaio ? ' Ensaios realizados em: ' + localEnsaio + '.' : '') + (ON.incerteza ? ' Incerteza de medicao declarada no certificado de calibracao da prensa.' : '') + (cfg?.nota_rodape ? ' ' + String(cfg.nota_rodape) : '');
    const words = obs.split(' '); let lineS = '';
    for (const w of words) { const test = lineS ? lineS + ' ' + w : w; if (F.widthOfTextAtSize(test, 7) > CW) { T(lineS, MX, y, 7, F, MUTED); y -= 9.5; lineS = w; } else lineS = test; }
    if (lineS) { T(lineS, MX, y, 7, F, MUTED); y -= 9.5; }
    y -= 8;

    need(70, false); const sigY = y;
    if (ON.qr_validacao) { try { const qr = QRCode.create('https://lab.consultegeo.org/validar/' + codVal, { errorCorrectionLevel: 'M' }); const size = qr.modules.size; const dataq = qr.modules.data; const box = 54; const m = box / size; const ox = MX, oy = y - box; for (let r = 0; r < size; r++) for (let c2 = 0; c2 < size; c2++) if (dataq[r * size + c2]) page.drawRectangle({ x: ox + c2 * m, y: oy + (size - 1 - r) * m, width: m + 0.2, height: m + 0.2, color: INK }); T('Validacao publica', MX + 64, y - 10, 6.4, FB, INK); T('lab.consultegeo.org/validar/', MX + 64, y - 20, 6.2, F, MUTED); T(codVal, MX + 64, y - 29, 6.2, FB, INK); T('Assinatura: QR + validacao publica (ICP-Brasil na v2).', MX + 64, y - 38, 6.2, F, MUTED); } catch (_) { /* QR opcional */ } }
    const sx = MX + CW * 0.52;
    hline(sx, sigY - 30, sx + CW * 0.40, MUTED, 0.6);
    T(rt || 'Responsavel Tecnico', sx, sigY - 40, 8, FB, INK);
    T('Responsavel Tecnico', sx, sigY - 49, 6.4, F, MUTED);
    if (creaRt || art) T('CREA ' + (creaRt || '-') + (art ? ' - ART ' + art : ''), sx, sigY - 57, 6.4, F, FAINT);
    if (gqNome) { hline(MX, sigY - 30, MX + CW * 0.40, MUTED, 0.6); T(gqNome, MX, sigY - 40, 8, FB, INK); T('Gerente da Qualidade', MX, sigY - 49, 6.4, F, MUTED); if (gqCrea) T('CREA ' + gqCrea, MX, sigY - 57, 6.4, F, FAINT); }

    const pages = doc.getPages(); const total = pages.length;
    pages.forEach((p, i) => { p.drawLine({ start: { x: MX, y: BOTTOM - 9 }, end: { x: RIGHT, y: BOTTOM - 9 }, thickness: 0.6, color: LINE }); p.drawText(san('Validacao publica - lab.consultegeo.org/validar/' + codVal), { x: MX, y: BOTTOM - 18, size: 6.4, font: F, color: FAINT }); const pg = san(`Pagina ${i + 1} de ${total}`); p.drawText(pg, { x: RIGHT - F.widthOfTextAtSize(pg, 6.4), y: BOTTOM - 18, size: 6.4, font: F, color: FAINT }); });

    const bytes = await doc.save();
    let labReportId: string | null = null;
    if (body.persist === true) {
      try {
        const hash = await sha256Hex(bytes);
        const path = `${conc.tenant_id}/laudos/${codVal}.pdf`;
        await admin.storage.from('lab-reports').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
        const hoje = new Date().toISOString().slice(0, 10);
        const campos = { laboratorio_nome: tenant?.name ?? 'Laboratorio', responsavel_tecnico: rt || null, crea_rt: creaRt || null, storage_path: path, hash_sha256: hash, data_emissao: hoje };
        const { data: existing } = await admin.from('lab_reports').select('id, revisao').eq('tenant_id', conc.tenant_id).eq('numero', numero).is('deleted_at', null).maybeSingle();
        if (existing) { await admin.from('lab_reports').update({ ...campos, revisao: (Number(existing.revisao) || 0) + 1, status: 'em_revisao', updated_at: new Date().toISOString() }).eq('id', existing.id); labReportId = existing.id as string; }
        else { const { data: novo } = await admin.from('lab_reports').insert({ tenant_id: conc.tenant_id, client_id: conc.client_id, work_id: conc.work_id, escopo: 'concretagem', concretagem_id: conc.id, numero, origem: 'sistema', status: 'rascunho', revisao: 0, ...campos }).select('id').maybeSingle(); labReportId = (novo?.id as string) ?? null; }
        if (labReportId) { await admin.from('laudo_resultados').update({ deleted_at: new Date().toISOString() }).eq('lab_report_id', labReportId).is('deleted_at', null); const vincs = tlist.map((t) => ({ tenant_id: conc.tenant_id, lab_report_id: labReportId, material_test_id: t.id as string, vinculo_origem: 'sistema' })).filter((v) => v.material_test_id); if (vincs.length) await admin.from('laudo_resultados').insert(vincs); }
      } catch (_) { /* best-effort */ }
    }
    return new Response(bytes, { headers: { ...cors, 'content-type': 'application/pdf', 'content-disposition': `inline; filename="laudo-${san(conc.codigo)}.pdf"`, 'x-lab-report-id': labReportId ?? '' } });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
