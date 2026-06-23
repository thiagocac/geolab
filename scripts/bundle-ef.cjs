const fs = require('fs');
const path = require('path');
const root = path.join(process.cwd(), 'supabase/functions');
const functions = fs.readdirSync(root).filter((name) => !name.startsWith('_') && fs.existsSync(path.join(root,name,'index.ts')));
for (const fn of functions) process.stdout.write(`${fn}\n`);
