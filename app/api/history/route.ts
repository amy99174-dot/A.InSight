
import { NextResponse } from 'next/server';
import { analyzeArtifactServer } from '../../../lib/ai-server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { image, historyScale, timeScale, apiKey } = body;

        // Call the server-side logic
        const result = await analyzeArtifactServer(image, apiKey, historyScale, timeScale);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("API History Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
