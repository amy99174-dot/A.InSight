
'use server';
import { getScenarios, getScenario, updateScenario, setActiveScenario } from '../../../lib/storage';
import type { Scenario } from '../../../lib/AppTypes';
import { revalidatePath } from 'next/cache';



export async function getScenariosAction() {
    return getScenarios();
}

export async function toggleScenario(id: string) {
    await setActiveScenario(id);
    return getScenarios();
}

export async function updateScenarioAction(id: string, data: Partial<Scenario>) {
    await updateScenario(id, data);
    revalidatePath('/', 'layout');
    return getScenarios();
}
