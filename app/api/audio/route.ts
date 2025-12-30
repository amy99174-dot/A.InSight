
import { NextResponse } from 'next/server';
import { generateAudioGuideServer } from '../../../lib/ai-server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { script, apiKey } = body;

        const buffer = await generateAudioGuideServer(script, apiKey);
        if (!buffer) {
            throw new Error("Failed to generate audio");
        }

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': buffer.byteLength.toString(),
            }
        });
    } catch (error: any) {
        console.error("API Audio Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
