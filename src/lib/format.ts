const brDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });
const brDateTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
export function formatDate(value?: string | null) { return value ? brDate.format(new Date(value)) : '-'; }
export function formatDateTime(value?: string | null) { return value ? brDateTime.format(new Date(value)) : '-'; }
export function formatNumber(value?: number | null, fractionDigits = 2) { return value === null || value === undefined || Number.isNaN(value) ? '-' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: fractionDigits }).format(value); }
export function formatVolume(value?: number | null, unit = 'm³') { return value === null || value === undefined ? '-' : `${formatNumber(value)} ${unit}`; }
export function safeText(value: unknown) { return value === null || value === undefined || value === '' ? '-' : String(value); }
