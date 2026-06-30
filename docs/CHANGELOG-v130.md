# CHANGELOG v130 — FIX crítico: "Cannot read properties of undefined (reading 'rest')"

## Sintoma
Tela **Acessos › Papéis e permissões** (e outras) quebrava com `Cannot read properties of undefined (reading 'rest')`.

## Causa-raiz
Helpers que **extraíam o método do client** — `const rpc = supabase.rpc as ...` — perdiam o `this`.
No supabase-js v2.45 o `.rpc()` faz `this.rest.rpc(...)`; com `this` indefinido → o erro.
Afetava: matriz RBAC (`rbac.ts`), **Operação › Usuários** (`operacao.ts`), carregamento de permissões no login
(`auth.tsx` → `current_member_permissions` falhava em silêncio e **não-admins ficavam sem permissão**),
**Linha do tempo** (`timeline.ts`) e **Documentos e gate** (`docgate.ts`).

## Correção
`.bind` no client em todos os helpers: `supabase.rpc.bind(supabase)` / `db.rpc.bind(db)`.
Telas voltam a carregar; `can()` passa a resolver as permissões corretamente para todos os papéis.
Demais telas já chamavam `db.rpc(...)` diretamente (acopladas) e não eram afetadas.

CACHE_NAME=consultegeo-geolab-v130 · APP_VERSION=v130
