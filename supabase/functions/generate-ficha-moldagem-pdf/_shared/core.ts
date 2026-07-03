import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
export const corsHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
export function json(body: unknown, init: ResponseInit = {}) { return new Response(JSON.stringify(body), { ...init, headers: { 'content-type':'application/json; charset=utf-8', ...corsHeaders, ...(init.headers ?? {}) } }); }
export function adminClient() { const url = Deno.env.get('SUPABASE_URL') ?? ''; const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''; return createClient(url, key, { auth: { persistSession: false } }); }
