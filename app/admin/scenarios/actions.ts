'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function updateScenario(newConfig: any) {
    try {
        console.log("Saving scenario config to Supabase...");
        
        const { error } = await supabase
            .from('scenario_config')
            .upsert({ id: 1, config: newConfig });

        if (error) {
            throw error;
        }

        // Revalidate the home page so it reflects the new config on next visit
        revalidatePath('/', 'layout');

        return { success: true, message: "Configuration saved successfully" };
    } catch (error) {
        console.error("Failed to save scenario config:", error);
        return { success: false, message: "Failed to save configuration" };
    }
}
