// valida-corpus.mjs — harness anti-regressão do leitor de laudos PDF.
//
// Roda o parser (src/lib/importacao/laudoPdf.ts) contra um corpus LOCAL de laudos
// extraídos em texto posicional + gabarito, e compara com a baseline registrada.
// O corpus contém dados de cliente e NÃO vai para o git (pasta corpus/ ignorada).
//
// Estrutura esperada (default ./corpus, mude com --dir):
//   corpus/txt/Laudo_NNNNNN.txt   — texto posicional (1 por PDF; \f separa páginas)
//   corpus/gabarito.json          — { "Laudo_NNNNNN": { lab, trunc, pares: ["27.5|7d", ...] } }
//   corpus/gab_nfs.json           — opcional: { "Laudo_NNNNNN": ["093019", ...] } (NFs do gabarito)
//   corpus/gab_mold.json          — opcional: { "Laudo_NNNNNN": ["dd/mm/aaaa", ...] } (moldagens)
//   corpus/baseline.json          — gerada/atualizada com --update-baseline
//
// Uso:
//   npm run valida:corpus                     # valida e compara com a baseline (exit 1 se regrediu)
//   npm run valida:corpus -- --update-baseline  # aceita os números atuais como nova baseline
//   npm run valida:corpus -- --dir /caminho     # corpus em outra pasta
//
// Saída: métricas no console + corpus/relatorio.csv (recall/precisão por arquivo,
// para diff entre versões do parser).
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const dirIdx = args.indexOf('--dir');
const DIR = resolve(dirIdx >= 0 ? args[dirIdx + 1] : './corpus');
const UPDATE = args.includes('--update-baseline');
const BUILD = resolve('./.corpus-build');

if (!existsSync(`${DIR}/txt`) || !existsSync(`${DIR}/gabarito.json`)) {
  console.error(`Corpus não encontrado em ${DIR} (esperado: txt/ e gabarito.json).`);
  console.error('Peça o pacote corpus-laudos-mrv e extraia na raiz do projeto como ./corpus');
  process.exit(2);
}

// 1. Compila só o parser (sem depender do bundle do app)
mkdirSync(BUILD, { recursive: true });
execSync(`npx tsc src/lib/importacao/laudoPdf.ts --outDir ${BUILD} --module es2022 --target es2022 --moduleResolution bundler --skipLibCheck`, { stdio: 'inherit' });
const { parseLaudoTexto } = await import(pathToFileURL(`${BUILD}/laudoPdf.js`).href);

// 2. Valida arquivo a arquivo (normalização idêntica ao gabarito: mpa com 1 casa, idade+unidade)
const gab = JSON.parse(readFileSync(`${DIR}/gabarito.json`, 'utf8'));
const gabNfs = existsSync(`${DIR}/gab_nfs.json`) ? JSON.parse(readFileSync(`${DIR}/gab_nfs.json`, 'utf8')) : null;
const gabMold = existsSync(`${DIR}/gab_mold.json`) ? JSON.parse(readFileSync(`${DIR}/gab_mold.json`, 'utf8')) : null;
const norm = (s) => { const [v, i] = s.split('|'); return `${parseFloat(v).toFixed(1)}|${i}`; };

let n = 0, somaR = 0, somaPnt = 0, nNt = 0, perf = 0, r90 = 0;
let nfOk = 0, nfDet = 0, nfTot = 0, moldOk = 0, moldTot = 0;
const linhas = [['arquivo', 'lab', 'recall', 'precisao'].join(';')];
for (const f of readdirSync(`${DIR}/txt`).sort()) {
  const a = f.replace('.txt', '');
  if (!gab[a]) continue;
  const t = readFileSync(`${DIR}/txt/${f}`, 'utf8');
  if (t.replace(/\s/g, '').length < 400) continue; // escaneado: fora do escopo textual
  n++;
  const r = parseLaudoTexto(t);
  const chave = (x) => `${x.mpa.toFixed(1)}|${x.idade}${x.idadeUnidade[0] === 'h' ? 'h' : 'd'}`;
  const ext = new Set(r.resultados.map(chave));
  const g = new Set(gab[a].pares.map(norm));
  const inter = [...g].filter((x) => ext.has(x)).length;
  const recall = g.size ? inter / g.size : 1;
  const prec = ext.size ? inter / ext.size : 1;
  somaR += recall;
  if (!gab[a].trunc) { somaPnt += prec; nNt++; }
  if (recall >= 0.9) r90++;
  if (recall === 1 && prec === 1) perf++;
  linhas.push([a, gab[a].lab ?? '', recall.toFixed(3), prec.toFixed(3)].join(';'));
  // Cobertura de NFs em DUAS réguas (NFs com zeros à esquerda normalizados):
  // detectadas = a NF aparece em qualquer ponto do laudo (régua histórica das releases, ~76%);
  // vinculadas = a NF chegou atribuída a um resultado (régua mais dura, o que o matcher usa).
  if (Array.isArray(gabNfs?.[a])) {
    const z = (v) => String(v).replace(/^0+/, '');
    const detect = new Set((r.nfs ?? []).map(z));
    const vinc = new Set(r.resultados.map((x) => z(x.nf)).filter(Boolean));
    for (const nf of gabNfs[a]) { nfTot++; if (detect.has(z(nf))) nfDet++; if (vinc.has(z(nf))) nfOk++; }
  }
  if (Array.isArray(gabMold?.[a])) {
    const achadas = new Set(r.resultados.map((x) => x.dataMoldagem).filter(Boolean));
    for (const d of gabMold[a]) { moldTot++; if (achadas.has(d)) moldOk++; }
  }
}

const atual = {
  arquivos: n,
  recall_medio: +(somaR / n).toFixed(3),
  prec_nt: +(somaPnt / nNt).toFixed(3),
  recall_90: r90,
  perfeitos: perf,
  ...(nfTot ? { nfs_detectadas: nfDet, nfs_vinculadas: nfOk, nfs_gabarito: nfTot } : {}),
};
writeFileSync(`${DIR}/relatorio.csv`, '\uFEFF' + linhas.join('\r\n'));

console.log(`arquivos=${atual.arquivos}`);
console.log(`recall_medio=${atual.recall_medio.toFixed(3)}`);
console.log(`prec_NT=${atual.prec_nt.toFixed(3)} (n=${nNt})`);
console.log(`recall>=0.9: ${atual.recall_90}/${n} | perfeitos: ${atual.perfeitos}`);
if (nfTot) console.log(`NFs do gabarito — detectadas: ${nfDet}/${nfTot} (${((100 * nfDet) / nfTot).toFixed(0)}%) · vinculadas a resultados: ${nfOk}/${nfTot} (${((100 * nfOk) / nfTot).toFixed(0)}%)`);
if (moldTot) console.log(`moldagens do gabarito encontradas: ${moldOk}/${moldTot} (${((100 * moldOk) / moldTot).toFixed(0)}%)`);
console.log(`relatório por arquivo: ${DIR}/relatorio.csv`);

// 3. Baseline: regressão de recall_medio ou recall_90 derruba o gate
const basePath = `${DIR}/baseline.json`;
if (UPDATE || !existsSync(basePath)) {
  writeFileSync(basePath, JSON.stringify(atual, null, 2) + '\n');
  console.log(`${UPDATE ? 'baseline ATUALIZADA' : 'baseline criada'}: ${basePath}`);
  process.exit(0);
}
const base = JSON.parse(readFileSync(basePath, 'utf8'));
const quedaR = atual.recall_medio < base.recall_medio - 0.0005;
const queda90 = atual.recall_90 < base.recall_90;
if (quedaR || queda90) {
  console.error(`\nREGRESSÃO vs baseline (${base.recall_medio.toFixed(3)} · ${base.recall_90}>=0,9):` +
    `${quedaR ? ` recall_medio ${atual.recall_medio.toFixed(3)}` : ''}${queda90 ? ` recall_90 ${atual.recall_90}` : ''}`);
  console.error('Compare corpus/relatorio.csv com a versão anterior para achar os arquivos afetados.');
  process.exit(1);
}
console.log(`sem regressão vs baseline (recall ${base.recall_medio.toFixed(3)} · ${base.recall_90}>=0,9)${atual.recall_medio > base.recall_medio || atual.recall_90 > base.recall_90 ? ' — MELHOROU: rode --update-baseline para registrar' : ''}`);
