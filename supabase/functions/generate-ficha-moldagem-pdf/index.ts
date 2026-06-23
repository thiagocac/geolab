import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
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

Deno.serve(async (req) => {
  try {
    const cors = handleCors(req); if (cors) return cors;
    const body = await req.json().catch(() => ({})) as Row;
    const concId = s(body.concretagem_id);
    if (!concId) return fail('concretagem_id e obrigatorio');
    const db = userClient(req);

    const { data: conc, error } = await db.from('concretagens')
      .select('id, codigo, data_real, data_programada, fornecedor_texto, traco_texto, local_texto, dimensao_cp, tenants(name), client_works(nome), lab_clients(razao_social, nome_fantasia), operational_materials(nome, fck_mpa)')
      .eq('id', concId).is('deleted_at', null).maybeSingle();
    if (error) return fail(error.message, 500);
    if (!conc) return fail('Concretagem nao encontrada (ou sem acesso).', 404);

    const { data: cams } = await db.from('material_receipts')
      .select('id, serie, nota_fiscal, placa, volume_m3, slump_medido_cm')
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

    page.drawText(sane(`${s(lab.name) || 'Laboratorio'} - Controle Tecnologico de Materiais`), { x: M, y, size: 9, font: bold, color: grey }); y -= 16;
    page.drawText(sane(`Ficha de moldagem - ${s(conc.codigo) || '(sem codigo)'}`), { x: M, y, size: 16, font: bold, color: navy }); y -= 14;
    page.drawText(sane(`${s(cliente.razao_social) || s(cliente.nome_fantasia)} - ${s(obra.nome)} - ${ddmm(s(conc.data_real || conc.data_programada))}`), { x: M, y, size: 9, font, color: grey }); y -= 11;
    page.drawText(sane(`Traco: ${s(traco.nome) || s(conc.traco_texto) || '-'}  |  fck: ${s(traco.fck_mpa) || '-'} MPa  |  Fornecedor: ${s(conc.fornecedor_texto) || '-'}  |  CP: ${s(conc.dimensao_cp) || '100x200'}`), { x: M, y, size: 9, font, color: grey }); y -= 11;
    if (s(conc.local_texto)) { page.drawText(sane(`Local/peca: ${s(conc.local_texto)}`).slice(0, 110), { x: M, y, size: 9, font, color: grey }); y -= 11; }
    y -= 6;

    const camsArr = (cams ?? []) as Row[];
    if (!camsArr.length) { page.drawText('Nenhum caminhao lancado.', { x: M, y, size: 10, font, color: grey }); y -= 14; }
    for (const cam of camsArr) {
      if (y < 150) nova();
      page.drawText(sane(`Caminhao ${s(cam.serie) || '-'}  -  NF ${s(cam.nota_fiscal) || '-'}  -  Placa ${s(cam.placa) || '-'}  -  ${s(cam.volume_m3) || '-'} m3  -  slump ${s(cam.slump_medido_cm) || '-'} cm`), { x: M, y, size: 10.5, font: bold, color: navy }); y -= 14;
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
