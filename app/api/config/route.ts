
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DEFAULT_CONFIG } from '@/lib/defaults';

// Ensure this route is always fresh
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Fetch config with ID=1 from Supabase
        const { data, error } = await supabase
            .from('scenario_config')
            .select('config')
            .eq('id', 1)
            .single();

        if (error) {
            console.warn("Supabase Config Fetch Error (Using Default):", error.message);
            return NextResponse.json(DEFAULT_CONFIG);
        }

        if (data?.config) {
            // 2. Merge with defaults (shallow merge)
            const userConfig = data.config;
            return NextResponse.json({ ...DEFAULT_CONFIG, ...userConfig });
        } else {
            return NextResponse.json(DEFAULT_CONFIG);
        }

    } catch (error) {
        console.error("API Route Error:", error);
        return NextResponse.json(DEFAULT_CONFIG);
    }
}
