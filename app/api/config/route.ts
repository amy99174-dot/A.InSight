import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_CONFIG } from '@/lib/defaults';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'scenarios.json');

export async function GET() {
    try {
        // defined strictly for this file
        let fileExists = false;
        try {
            await fs.access(CONFIG_FILE_PATH);
            fileExists = true;
        } catch {
            fileExists = false;
        }

        if (fileExists) {
            const fileContent = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
            const userConfig = JSON.parse(fileContent);
            // Merge with defaults to ensure all keys exist
            return NextResponse.json({ ...DEFAULT_CONFIG, ...userConfig });
        } else {
            return NextResponse.json(DEFAULT_CONFIG);
        }
    } catch (error) {
        console.error("Error reading config file:", error);
        return NextResponse.json(DEFAULT_CONFIG);
    }
}
