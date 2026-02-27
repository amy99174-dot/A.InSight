import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

/**
 * POST /api/log
 * Called by the native Pi app (via supabase_client.py) to log analysis results.
 * Acts as a proxy so the Pi doesn't need direct external HTTPS to Supabase.
 * 
 * Body: { result, session_id, time_scale, history_scale }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { result, session_id, time_scale, history_scale } = body;

        if (!result) {
            return NextResponse.json({ error: 'Missing result' }, { status: 400 });
        }

        const insertData = {
            session_id: typeof session_id === 'number' ? session_id : null,
            input_settings: { historyScale: history_scale, timeScale: time_scale },
            ai_result: result,
            artifact_name: result.name || 'Unknown',
            era: result.era || 'Unknown',
            category: result.category || 'Other',
            summary: result.summary || '',
            vision_prompt: result.visionPrompt || '',
            script_prompt: result.scriptPrompt || '',
            ambience_category: result.ambienceCategory || '',
            image_strength: result.imageStrength || null,
        };

        const { error } = await supabase.from('history_logs').insert(insertData);

        if (error) {
            console.error('[/api/log] Supabase insert error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`[/api/log] ✅ Logged: ${insertData.artifact_name}`);
        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('[/api/log] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
