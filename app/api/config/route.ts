
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DEFAULT_CONFIG } from '@/lib/defaults';

// Ensure this route is always fresh
export const dynamic = 'force-dynamic';

// Deep merge helper function
function deepMerge(target: any, source: any): any {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }

    return output;
}

function isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
}

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
            // 2. Deep merge with defaults to preserve nested structure
            const userConfig = data.config;
            const mergedConfig = deepMerge(DEFAULT_CONFIG, userConfig);
            return NextResponse.json(mergedConfig);
        } else {
            return NextResponse.json(DEFAULT_CONFIG);
        }

    } catch (error) {
        console.error("API Route Error:", error);
        return NextResponse.json(DEFAULT_CONFIG);
    }
}
