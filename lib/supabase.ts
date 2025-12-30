
import { createClient } from '@supabase/supabase-js';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Prevent crash if env vars are missing during build/dev
// This allows diagnostic API to run and report the error gracefully
const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase Env Vars missing in lib/supabase.ts");
}

export const supabase = createClient(safeUrl, safeKey);
