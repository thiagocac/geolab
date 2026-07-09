import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const failures = [];
function walk(dir) { if (!existsSync(dir)) return []; return readdirSync(dir).flatMap(name => { if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) return []; const p=join(dir,name); const s=statSync(p); return s.isDirectory()?walk(p):[p]; }); }
const pkg = JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
for (const name of ['next','@remix-run/react','@prisma/client','drizzle-orm','redux','@reduxjs/toolkit','styled-components','@emotion/react','@emotion/styled','lucide-react']) if (deps[name]) failures.push(`Dependencia proibida: ${name}`);
for (const f of walk(join(root,'src')).filter(f=>/\.(ts|tsx)$/.test(f))) {
  const text=readFileSync(f,'utf8');
  if (/console\.(log|debug)\s*\(/.test(text)) failures.push(`${f}: console.log/debug proibido`);
  if (/\batob\s*\(/.test(text)) failures.push(`${f}: atob proibido`);
  if (/\b(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]/.test(text)) failures.push(`${f}: localStorage/sessionStorage proibido (regra do DS: estado só em memória)`);
  if (/from\s+['"]lucide-react['"]/.test(text)) failures.push(`${f}: lucide-react proibido (icones em src/components/ui/icons.tsx)`);
  if (/\.tsx$/.test(f) && /<form[\s>]/.test(text)) failures.push(`${f}: <form> nativo proibido (usar handlers onClick/onChange)`);
  if (/offlineQueue|signature-providers|Autentique|ZapSign|gov\.br/.test(text)) failures.push(`${f}: fora de escopo da V1`);
  if (/navigator\.serviceWorker\.register|registerServiceWorker/.test(text)) failures.push(`${f}: service worker de captura/offline proibido`);
}
const sw = readFileSync(join(root,'public/sw.js'),'utf8');
const core = readFileSync(join(root,'src/lib/telemetry/core.ts'),'utf8');
const mCache = sw.match(/CACHE_NAME\s*=\s*'consultegeo-geolab-(v\d+)'/);
const mApp = core.match(/APP_VERSION\s*=\s*'(v\d+)'/);
if (!mCache) failures.push('CACHE_NAME ausente/invalido em public/sw.js');
if (!mApp) failures.push('APP_VERSION ausente/invalido em src/lib/telemetry/core.ts');
if (mCache && mApp && mCache[1] !== mApp[1]) failures.push(`CACHE_NAME (${mCache[1]}) e APP_VERSION (${mApp[1]}) divergem`);
const migrations = walk(join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql'));
const allSql = migrations.map(f=>readFileSync(f,'utf8')).join('\n');
if (migrations.length && !/enable\s+row\s+level\s+security/i.test(allSql)) failures.push('RLS não encontrado nas migrations');
for (const f of migrations) {
  const text=readFileSync(f,'utf8');
  const re = /create\s+(?:or\s+replace\s+)?view\s+public\.([a-z0-9_]+)/gi;
  let m;
  while ((m=re.exec(text)) !== null) {
    const chunk = text.slice(m.index, Math.min(text.length, m.index+260));
    if (!/security_invoker\s*=\s*(on|true)/i.test(chunk)) failures.push(`${f}: view ${m[1]} sem security_invoker`);
  }
}
const fnRoot = join(root,'supabase/functions');
for (const name of readdirSync(fnRoot)) {
  if (name.startsWith('_')) continue;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) failures.push(`Edge Function fora de kebab-case: ${name}`);
  const idx=join(fnRoot,name,'index.ts');
  if (!existsSync(idx)) failures.push(`Edge Function sem index.ts: ${name}`);
  else if (readFileSync(idx,'utf8').trim().length < 300) failures.push(`Edge Function ${name} parece stub`);
}
for (const f of walk(fnRoot).filter(f=>f.endsWith('.ts'))) {
  const text=readFileSync(f,'utf8');
  if (/console\.(log|debug)\s*\(/.test(text)) failures.push(`${f}: console.log/debug proibido`);
  if (/esm\.sh/.test(text)) failures.push(`${f}: esm.sh proibido`);
  const displayPath = f.slice(root.length + 1).replaceAll('\\','/');
  const isSendNotification = displayPath === 'supabase/functions/send-notification/index.ts';
  if (!isSendNotification && (/https:\/\/api\.resend\.com\/emails/.test(text) || /Deno\.env\.get\(['"]RESEND_API_KEY['"]\)/.test(text))) {
    failures.push(`${displayPath}: saida Resend direta proibida (send-notification e o unico ponto Resend); delegue para supabase/functions/send-notification`);
  }
}
if (failures.length) { for (const f of failures) process.stderr.write(f+'\n'); process.exit(1); }
process.stdout.write('check-source OK\n');
