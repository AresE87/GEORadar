import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY ?? '';
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
