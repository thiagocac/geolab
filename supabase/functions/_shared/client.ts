import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { adminClient } from './core.ts';
export function serviceClient() { return adminClient(); }
export function userClient(req: Request) { const url = Deno.env.get('SUPABASE_URL') ?? ''; const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''; return createClient(url, anon, { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } }, auth: { persistSession: false } }); }
