'use server';

import fs from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'scenarios.json');

export async function updateScenario(newConfig: any) {
    try {
        console.log("Saving scenario config to:", CONFIG_FILE_PATH);
        await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');

        // Revalidate the home page so it reflects the new config on next visit
        revalidatePath('/', 'layout');

        return { success: true, message: "Configuration saved successfully" };
    } catch (error) {
        console.error("Failed to save scenario config:", error);
        return { success: false, message: "Failed to save configuration" };
    }
}
