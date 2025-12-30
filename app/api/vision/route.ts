
import { NextResponse } from 'next/server';
import { generateHistoryVisionServer } from '../../../lib/ai-server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, image, apiKey } = body;

        const result = await generateHistoryVisionServer(prompt, apiKey, image);

        return NextResponse.json({ image: result });
    } catch (error: any) {
        console.error("API Vision Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
