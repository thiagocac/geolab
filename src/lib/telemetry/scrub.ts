const RX: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [token]'],
  [/eyJ[A-Za-z0-9._-]{10,}/g, '[jwt]'],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]'],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf]'],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[cnpj]'],
  [/([?&](?:apikey|token|access_token|authorization)=)[^&#\s]+/gi, '$1[redacted]'],
  [/data:(?:image|application)\/[^;]+;base64,[A-Za-z0-9+/=]+/gi, '[base64]'],
];
function scrubString(s: string): string {
  if (/^[A-Za-z0-9+/=]{200,}$/.test(s)) return '[base64]';
  let out = s;
  for (const [rx, rep] of RX) out = out.replace(rx, rep);
  return out.slice(0, 500);
}
export function scrub(value: unknown): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.slice(0, 20).map(scrub);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (/email|token|authorization|password|secret|cpf|cnpj|senha/i.test(key)) out[key] = '[redacted]';
      else if (/base64|image_base64|arquivo|file|blob|bytes/i.test(key)) out[key] = '[binary/redacted]';
      else out[key] = scrub(raw);
    }
    return out;
  }
  return value;
}
