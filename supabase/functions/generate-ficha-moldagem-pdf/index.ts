import { serveWithTelemetry } from '../_shared/telemetry.ts';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import QRCode from 'npm:qrcode@1.5.3';
import { handleCors } from '../_shared/cors.ts';
import { fail } from '../_shared/response.ts';
import { userClient } from '../_shared/client.ts';

// Ficha de moldagem (GEOLAB): caminhoes + CPs da concretagem, com campos manuscritos
// (numeracao do lab, assinaturas). userClient/RLS. Helvetica (sem WOFF2).

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v));
const sane = (v: unknown) => s(v).replace(/[→➔➜]/g, '->').replace(/[–—]/g, '-').replace(/[^\x20-\x7E -ÿ\n]/g, '?');
const ddmm = (iso: string) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-';
const emb = (v: unknown): Row => (v && typeof v === 'object' ? v as Row : {});

serveWithTelemetry('generate-ficha-moldagem-pdf', async (req) => {
  try {
    const cors = handleCors(req); if (cors) return cors;
    const body = await req.json().catch(() => ({})) as Row;
    const concId = s(body.concretagem_id);
    if (!concId) return fail('concretagem_id e obrigatorio');
    const db = userClient(req);

    const { data: conc, error } = await db.from('concretagens')
      .select('id, tenant_id, codigo, data_real, data_programada, hora_programada, hora_inicio, hora_fim, fornecedor_texto, traco_texto, local_texto, volume_programado_m3, volume_lancado_m3, dimensao_cp, clima, temperatura_ambiente_c, bombeado, tenants(name), client_works(nome), lab_clients(razao_social, nome_fantasia), operational_materials(nome, fck_mpa)')
      .eq('id', concId).is('deleted_at', null).maybeSingle();
    if (error) return fail(error.message, 500);
    if (!conc) return fail('Concretagem nao encontrada (ou sem acesso).', 404);

    const { data: cfg } = await db.from('config_lab').select('recebimento_campos, concretagem_campos').eq('tenant_id', conc.tenant_id).maybeSingle();
    const RC = emb(cfg?.recebimento_campos);
    const CC = emb(cfg?.concretagem_campos);
    const ron = (k: string, d = true) => RC[k] === undefined ? d : RC[k] !== false;
    const con = (k: string, d = true) => CC[k] === undefined ? d : CC[k] !== false;

    const { data: cams } = await db.from('material_receipts')
      .select('id, serie, nota_fiscal, placa, motorista, volume_m3, hora_saida_usina, hora_chegada_obra, hora_inicio_descarga, hora_fim_descarga, hora_moldagem, slump_medido_cm, temperatura_concreto_c, houve_adicao_agua, agua_litros, rejeitado, motivo_rejeicao, elementos_concretados, observacoes')
      .eq('concretagem_id', concId).is('deleted_at', null).order('serie');
    const { data: cps } = await db.from('corpos_prova')
      .select('receipt_id, codigo, idade_dias, idade_unidade, data_moldagem, data_prevista_rompimento, contraprova, material_test_types(nome)')
      .eq('concretagem_id', concId).is('deleted_at', null).order('codigo');

    const porReceipt = new Map<string, Row[]>();
    (cps ?? []).forEach((cp: Row) => { const k = s(cp.receipt_id); const a = porReceipt.get(k) ?? []; a.push(cp); porReceipt.set(k, a); });

    const obra = emb(conc.client_works);
    const cliente = emb(conc.lab_clients);
    const traco = emb(conc.operational_materials);
    const lab = emb(conc.tenants);

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.094, 0.157, 0.388);
    const grey = rgb(0.42, 0.46, 0.52);
    const line = rgb(0.78, 0.81, 0.86);
    const ink = rgb(0.1, 0.12, 0.16);
    const W = 595, H = 842, M = 46;
    let page = pdf.addPage([W, H]);
    let y = H - 54;
    const nova = () => { page = pdf.addPage([W, H]); y = H - 54; };

    // Melhoria 1.1 — QR com o concretagem_id (casamento determinístico na leitura da ficha). Best-effort.
    try {
      const qrUrl = await QRCode.toDataURL(concId, { margin: 1, width: 240 });
      const qrPng = await pdf.embedPng(Uint8Array.from(atob(qrUrl.split(',')[1]), (ch) => ch.charCodeAt(0)));
      const qz = 80;
      page.drawImage(qrPng, { x: W - M - qz, y: H - M - qz, width: qz, height: qz });
      page.drawText('ficha de moldagem', { x: W - M - qz, y: H - M - qz - 9, size: 6, font, color: grey });
    } catch { /* QR nunca quebra a ficha */ }

    page.drawText(sane(`${s(lab.name) || 'Laboratorio'} - Controle Tecnologico de Materiais`), { x: M, y, size: 9, font: bold, color: grey }); y -= 16;
    page.drawText(sane(`Ficha de moldagem - ${s(conc.codigo) || '(sem codigo)'}`), { x: M, y, size: 16, font: bold, color: navy }); y -= 14;
    page.drawText(sane(`${s(cliente.razao_social) || s(cliente.nome_fantasia)} - ${s(obra.nome)} - ${ddmm(s(conc.data_real || conc.data_programada))}`), { x: M, y, size: 9, font, color: grey }); y -= 11;
    const info: string[] = [];
    if (con('traco_fck')) info.push(`Traco: ${s(traco.nome) || s(conc.traco_texto) || '-'}  |  fck: ${s(traco.fck_mpa) || '-'} MPa`);
    if (con('fornecedor')) info.push(`Fornecedor: ${s(conc.fornecedor_texto) || '-'}`);
    if (con('dimensao_cp')) info.push(`CP: ${s(conc.dimensao_cp) || '100x200'}`);
    if (con('volume_programado')) info.push(`Volume prog.: ${s(conc.volume_programado_m3) || '-'} m3`);
    if (con('bombeado')) info.push(`Lancamento: ${conc.bombeado ? 'bombeado' : 'convencional'}`);
    page.drawText(sane(info.join('  |  ')).slice(0, 130), { x: M, y, size: 9, font, color: grey }); y -= 11;
    if (con('data_hora')) { page.drawText(sane(`Horario: ${s(conc.hora_inicio || conc.hora_programada) || '-'}${s(conc.hora_fim) ? ' a ' + s(conc.hora_fim) : ''}`), { x: M, y, size: 9, font, color: grey }); y -= 11; }
    if (con('local_peca') && s(conc.local_texto)) { page.drawText(sane(`Local/peca: ${s(conc.local_texto)}`).slice(0, 110), { x: M, y, size: 9, font, color: grey }); y -= 11; }
    if (con('clima') || con('temperatura_ambiente')) { page.drawText(sane(`Clima: ${s(conc.clima) || '-'}  |  Temperatura ambiente: ${s(conc.temperatura_ambiente_c) || '-'} C`), { x: M, y, size: 9, font, color: grey }); y -= 11; }
    y -= 6;

    const camsArr = (cams ?? []) as Row[];
    if (!camsArr.length) { page.drawText('Nenhum caminhao lancado.', { x: M, y, size: 10, font, color: grey }); y -= 14; }
    for (const cam of camsArr) {
      if (y < 150) nova();
      const camInfo: string[] = [`Caminhao ${s(cam.serie) || '-'}`];
      if (ron('nota_fiscal')) camInfo.push(`NF ${s(cam.nota_fiscal) || '-'}`);
      if (ron('placa')) camInfo.push(`Placa ${s(cam.placa) || '-'}`);
      if (ron('volume_m3')) camInfo.push(`${s(cam.volume_m3) || '-'} m3`);
      if (ron('slump')) camInfo.push(`slump ${s(cam.slump_medido_cm) || '-'} cm`);
      if (ron('temperatura_concreto')) camInfo.push(`temp. ${s(cam.temperatura_concreto_c) || '-'} C`);
      page.drawText(sane(camInfo.join('  -  ')), { x: M, y, size: 10.5, font: bold, color: navy }); y -= 14;
      const detalhe: string[] = [];
      if (ron('motorista') && s(cam.motorista)) detalhe.push(`Motorista: ${s(cam.motorista)}`);
      if (ron('horarios_transporte')) detalhe.push(`Transporte: ${s(cam.hora_saida_usina) || '-'} -> ${s(cam.hora_chegada_obra) || '-'}`);
      if (ron('horarios_descarga')) detalhe.push(`Descarga: ${s(cam.hora_inicio_descarga) || '-'} -> ${s(cam.hora_fim_descarga) || '-'}`);
      if (ron('hora_moldagem') && s(cam.hora_moldagem)) detalhe.push(`Moldagem: ${s(cam.hora_moldagem)}`);
      if (ron('agua_adicionada') && cam.houve_adicao_agua === true) detalhe.push(`Agua: ${s(cam.agua_litros) || '-'} L`);
      if (ron('rejeicao') && cam.rejeitado === true) detalhe.push(`Rejeitado: ${s(cam.motivo_rejeicao) || '-'}`);
      if (detalhe.length) { page.drawText(sane(detalhe.join('  |  ')).slice(0, 120), { x: M, y, size: 8.5, font, color: grey }); y -= 12; }
      if (ron('elementos_concretados') && s(cam.elementos_concretados)) { page.drawText(sane(`Elementos: ${s(cam.elementos_concretados)}`).slice(0, 120), { x: M, y, size: 8.5, font, color: grey }); y -= 12; }
      const lista = porReceipt.get(s(cam.id)) ?? [];
      if (!lista.length) {
        page.drawText('Sem CPs gerados neste caminhao.', { x: M + 10, y, size: 9, font, color: grey }); y -= 14;
      } else {
        page.drawText('CP', { x: M + 10, y, size: 7.5, font: bold, color: grey });
        page.drawText('NUMERACAO LAB', { x: M + 105, y, size: 7.5, font: bold, color: grey });
        page.drawText('ENSAIO', { x: M + 210, y, size: 7.5, font: bold, color: grey });
        page.drawText('IDADE', { x: M + 330, y, size: 7.5, font: bold, color: grey });
        page.drawText('MOLDAGEM', { x: M + 380, y, size: 7.5, font: bold, color: grey });
        page.drawText('ROMPER EM', { x: M + 450, y, size: 7.5, font: bold, color: grey });
        y -= 12;
        for (const cp of lista) {
          if (y < 90) nova();
          page.drawText(sane(s(cp.codigo)).slice(0, 16), { x: M + 10, y, size: 9, font: bold, color: ink });
          page.drawLine({ start: { x: M + 105, y: y - 1.5 }, end: { x: M + 195, y: y - 1.5 }, thickness: 0.7, color: line });
          page.drawText(sane(`${s(emb(cp.material_test_types).nome) || 'Compressao'}${cp.contraprova === true ? ' (CP)' : ''}`).slice(0, 22), { x: M + 210, y, size: 8.5, font, color: ink });
          page.drawText(cp.idade_dias != null ? `${s(cp.idade_dias)} ${s(cp.idade_unidade) === 'hora' ? 'h' : 'd'}` : '-', { x: M + 330, y, size: 9, font, color: ink });
          page.drawText(ddmm(s(cp.data_moldagem)), { x: M + 380, y, size: 9, font, color: ink });
          page.drawText(ddmm(s(cp.data_prevista_rompimento)), { x: M + 450, y, size: 9, font, color: ink });
          y -= 13;
        }
      }
      y -= 6;
    }

    if (y < 120) nova();
    y -= 14;
    page.drawText('Responsavel pela moldagem (obra):', { x: M, y, size: 9, font: bold, color: grey });
    page.drawLine({ start: { x: M + 180, y: y - 2 }, end: { x: M + 340, y: y - 2 }, thickness: 0.8, color: line });
    page.drawText('Data: ____/____/______', { x: M + 360, y, size: 9, font, color: grey }); y -= 26;
    page.drawText('Recebido pelo laboratorio:', { x: M, y, size: 9, font: bold, color: grey });
    page.drawLine({ start: { x: M + 180, y: y - 2 }, end: { x: M + 340, y: y - 2 }, thickness: 0.8, color: line });
    page.drawText('Data: ____/____/______', { x: M + 360, y, size: 9, font, color: grey });

    const pages = pdf.getPages();
    pages.forEach((p, idx) => {
      p.drawText(sane(`Gerado em ${new Date().toLocaleString('pt-BR')} - lab.consultegeo.org - pag. ${idx + 1}/${pages.length}`), { x: M, y: 28, size: 7.5, font, color: grey });
    });

    const bytes = await pdf.save();
    return new Response(bytes, { headers: { 'access-control-allow-origin': '*', 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="ficha-moldagem.pdf"' } });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'erro desconhecido', 500);
  }
});
