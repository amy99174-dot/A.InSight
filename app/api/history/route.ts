
import { NextResponse } from 'next/server';
import { analyzeArtifactServer } from '../../../lib/ai-server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { image, historyScale, timeScale, apiKey, sessionId } = body;

        // Call the server-side logic
        const result = await analyzeArtifactServer(image, apiKey, historyScale, timeScale);

        // Log to Supabase (Fire and forget, or await?)
        // Recommended: Await to catch errors, but wrap in try-catch so it doesn't block response on fail
        try {
            console.log("--- Supabase Debug Start ---");
            console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Loaded" : "MISSING");
            console.log("Supabase Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Loaded" : "MISSING");

            console.log("Attempting to insert log...");
            const { supabase } = await import('../../../lib/supabase');

            const insertData = {
                session_id: sessionId || null, // Capture Session ID
                input_settings: { historyScale, timeScale },
                // prompt_context column is deprecated/removed to save space
                ai_result: result, // Full backup

                // --- Phase 1 Fields (Core Info) ---
                artifact_name: result.name,
                era: result.era || "Unknown",
                category: result.category || "Other",
                summary: result.summary || "",

                // --- Phase 2 Fields (Content Details) ---
                vision_prompt: result.visionPrompt,
                script_prompt: result.scriptPrompt,
                ambience_category: result.ambienceCategory,
                image_strength: result.imageStrength
            };

            const { error: insertError } = await supabase.from('history_logs').insert(insertData);

            if (insertError) {
                console.error("Supabase Write Error (Detailed):", insertError);
            } else {
                console.log("Supabase Write Success!");
            }
            console.log("--- Supabase Debug End ---");

        } catch (logError) {
            console.error("Supabase Logging Exception:", logError);
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("CRITICAL API HISTORY ERROR:", error);
        return NextResponse.json({
            name: "Signal Interrupted",
            era: "Unknown",
            category: "Static",
            summary: `Connection to Chronos lost. Error: ${error.message}`,
            visionPrompt: "Static noise and glitching digital interface, monochrome high contrast",
            scriptPrompt: `訊號連線中斷... 錯誤代碼: ${error.message} ... 啟動備用模擬協議...`,
            ambienceCategory: "static",
            imageStrength: 0,
            error: error.message
        });
    }
}
