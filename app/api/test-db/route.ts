
import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

// FORCE DYNAMIC to ensure env vars are read at runtime
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log("--- DB DIAGNOSTIC START ---");

        // 1. Check Env Vars
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        // Mask for security
        const urlStart = url ? `${url.substring(0, 15)}...` : 'MISSING';
        const keyStart = key ? `${key.substring(0, 5)}...` : 'MISSING';

        console.log(`Env Check: URL=${urlStart}, KEY=${keyStart}`);

        if (!url || !key) {
            return NextResponse.json({
                status: 'error',
                message: 'Environment variables missing',
                vars: { url: urlStart, key: keyStart }
            }, { status: 500 });
        }

        // 2. Attempt Write
        const testData = {
            input_settings: { test: true, diagnostic: "API Route" },
            prompt_context: "DB Connection Test via /api/test-db",
            ai_result: { status: "ok", timestamp: new Date().toISOString() }
        };

        console.log("Attempting insert into history_logs...");
        const { data, error } = await supabase
            .from('history_logs')
            .insert(testData)
            .select();

        if (error) {
            console.error("Diagnostic Insert Error:", error);
            return NextResponse.json({
                status: 'error',
                message: 'Supabase Insert Failed',
                error,
                details: {
                    message: error.message,
                    code: error.code,
                    hint: error.hint
                },
                env_check: { url: urlStart, key: keyStart }
            }, { status: 500 });
        }

        console.log("Diagnostic Success. Data:", data);
        return NextResponse.json({
            status: 'success',
            message: 'Write successful',
            data: data,
            env_check: { url: urlStart, key: keyStart }
        });
    } catch (e: any) {
        console.error("Diagnostic Unexpected Error:", e);
        return NextResponse.json({
            status: 'error',
            message: 'Unexpected Server Error',
            error: e.toString()
        }, { status: 500 });
    }
}
