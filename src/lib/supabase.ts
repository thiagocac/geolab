import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { env } from './env';
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 10 } }
});
export async function requireCurrentUser() { const { data, error } = await supabase.auth.getUser(); if (error) throw error; return data.user; }
