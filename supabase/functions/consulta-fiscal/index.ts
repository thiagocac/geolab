import { serveWithTelemetry } from '../_shared/telemetry.ts';
// consulta-fiscal — lookup fiscal (CNPJ/CEP) via BrasilAPI. v1.1 GEOLAB.
// verify_jwt=true: só usuários logados do laboratório chamam. Sem DB, sem service-role.
// Dados de CNPJ/CEP são públicos; a EF apenas normaliza a resposta para os campos do form.

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function digits(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '');
}

type Rec = Record<string, unknown>;

async function fetchCnpj(cnpj: string): Promise<Rec | null> {
  const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + cnpj, { headers: { Accept: 'application/json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('brasilapi_cnpj_' + r.status);
  const d = (await r.json()) as Rec;
  const logradouro = [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' ').trim();
  return {
    tipo: 'cnpj',
    cnpj_cpf: d.cnpj ?? cnpj,
    razao_social: d.razao_social ?? d.nome ?? null,
    nome_fantasia: d.nome_fantasia ?? null,
    email: d.email ?? null,
    telefone: d.ddd_telefone_1 ?? null,
    cep: d.cep ? digits(d.cep) : null,
    endereco: logradouro || null,
    numero: d.numero ?? null,
    bairro: d.bairro ?? null,
    cidade: d.municipio ?? null,
    uf: d.uf ?? null,
    situacao: d.descricao_situacao_cadastral ?? null,
  };
}

async function fetchCep(cep: string): Promise<Rec | null> {
  const r = await fetch('https://brasilapi.com.br/api/cep/v2/' + cep, { headers: { Accept: 'application/json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('brasilapi_cep_' + r.status);
  const d = (await r.json()) as Rec;
  return {
    tipo: 'cep',
    cep: d.cep ?? cep,
    endereco: d.street ?? null,
    bairro: d.neighborhood ?? null,
    cidade: d.city ?? null,
    uf: d.state ?? null,
  };
}

serveWithTelemetry('consulta-fiscal', async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  try {
    const body = (await req.json().catch(() => ({}))) as Rec;
    const kind = String(body.kind ?? body.tipo ?? '').toLowerCase();
    const valor = digits(body.valor);
    if (kind === 'cnpj') {
      if (valor.length !== 14) return json({ ok: false, error: 'cnpj_invalido' }, 400);
      const data = await fetchCnpj(valor);
      if (!data) return json({ ok: false, error: 'nao_encontrado' }, 404);
      return json({ ok: true, data });
    }
    if (kind === 'cep') {
      if (valor.length !== 8) return json({ ok: false, error: 'cep_invalido' }, 400);
      const data = await fetchCep(valor);
      if (!data) return json({ ok: false, error: 'nao_encontrado' }, 404);
      return json({ ok: true, data });
    }
    return json({ ok: false, error: 'kind_invalido' }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 502);
  }
});
