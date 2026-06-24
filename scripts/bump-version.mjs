import fs from 'node:fs';
const version = process.argv[2] || 'v1';
fs.writeFileSync('src/lib/telemetry/core.ts', fs.readFileSync('src/lib/telemetry/core.ts','utf8').replace(/APP_VERSION\s*=\s*'v\d+'/, `APP_VERSION = '${version}'`));
fs.writeFileSync('public/sw.js', fs.readFileSync('public/sw.js','utf8').replace(/consultegeo-geolab-v\d+/, `consultegeo-geolab-${version}`));
