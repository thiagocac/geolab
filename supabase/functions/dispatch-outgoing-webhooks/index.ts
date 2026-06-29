import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

type WebhookQueueItem = {
  id?: string;
  queue_id?: string;
  tenant_id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  url: string;
  signing_secret: string | null;
  kind?: string;
  format?: string;
  timeout_ms?: number;
  headers?: Record<string, string>;
  attempts?: number;
  attempt?: number;
};

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function headersFor(item: WebhookQueueItem, signature: string | null) {
  const h = new Headers();
  h.set('content-type', 'application/json; charset=utf-8');
  h.set('user-agent', 'Concresoft-Webhook/1.0');
  const queueId = item.queue_id ?? item.id ?? '';
  h.set('x-concresoft-event', item.event_type);
  h.set('x-concresoft-delivery', queueId);
  h.set('x-concresoft-tenant', item.tenant_id);
  h.set('x-concresoft-attempt', String(item.attempt ?? item.attempts ?? 0));
  if (signature) h.set('x-concresoft-signature-sha256', signature);
  for (const [k, v] of Object.entries(asRecord(item.headers))) {
    const key = String(k).trim().toLowerCase();
    if (!key || ['host', 'content-length', 'connection'].includes(key)) continue;
    h.set(String(k), String(v));
  }
  return h;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bodyFor(item: WebhookQueueItem) {
  const payload = asRecord(item.payload);
  const format = item.format ?? item.kind ?? 'generic';
  const queueId = item.queue_id ?? item.id ?? '';
  const attempt = item.attempt ?? item.attempts ?? 0;
  if (format === 'slack') {
    const title = String(payload.title ?? payload.titulo ?? item.event_type);
    const text = String(payload.text ?? payload.corpo ?? payload.message ?? 'Evento Concresoft');
    return { text: `*${title}*\n${text}`, metadata: { event_type: item.event_type, delivery_id: queueId } };
  }
  if (format === 'teams') {
    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: String(payload.title ?? payload.titulo ?? item.event_type),
      title: String(payload.title ?? payload.titulo ?? item.event_type),
      text: String(payload.text ?? payload.corpo ?? payload.message ?? JSON.stringify(payload)),
    };
  }
  return {
    id: queueId,
    tenant_id: item.tenant_id,
    event_type: item.event_type,
    attempt,
    occurred_at: new Date().toISOString(),
    data: payload,
  };
}

async function postWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(1000, Math.min(timeoutMs || 10000, 30000)));
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const expected = Deno.env.get('CRON_SECRET') ?? '';
  const got = req.headers.get('x-cron-secret') ?? '';
  if (!expected || got !== expected) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRole) return json({ error: 'missing_supabase_env' }, 500);

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const limit = Math.max(1, Math.min(Number(body.limit ?? 25) || 25, 100));
  const { data, error } = await admin.rpc('drain_webhook_queue', { p_limit: limit });
  if (error) return json({ error: error.message }, 500);

  const rows = (Array.isArray(data) ? data : []) as WebhookQueueItem[];
  const results: Array<Record<string, unknown>> = [];

  for (const item of rows) {
    const started = Date.now();
    try {
      const payload = JSON.stringify(bodyFor(item));
      const sig = item.signing_secret ? 'sha256=' + await hmacSha256Hex(item.signing_secret, payload) : null;
      const queueId = item.queue_id ?? item.id ?? '';
      const res = await postWithTimeout(item.url, { method: 'POST', headers: headersFor(item, sig), body: payload }, Number(item.timeout_ms ?? 10000));
      const responseBody = (await res.text()).slice(0, 4000);
      if (res.ok) {
        await admin.rpc('ack_webhook_delivery', {
          p_queue_id: queueId,
          p_status_code: res.status,
          p_response: responseBody,
        });
        results.push({ id: queueId, ok: true, status: res.status });
      } else {
        await admin.rpc('nack_webhook_delivery', {
          p_queue_id: queueId,
          p_status_code: res.status,
          p_error: responseBody || res.statusText,
        });
        results.push({ id: queueId, ok: false, status: res.status });
      }
    } catch (e) {
      await admin.rpc('nack_webhook_delivery', {
        p_queue_id: item.queue_id ?? item.id ?? '',
        p_status_code: null,
        p_error: e instanceof Error ? e.message : String(e),
      });
      results.push({ id: item.queue_id ?? item.id ?? '', ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({ drained: rows.length, results });
});
