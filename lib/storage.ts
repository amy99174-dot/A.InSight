
import fs from 'fs';
import path from 'path';
import { Scenario, UIConfig, UITexts } from './AppTypes';

const SCENARIOS_FILE = path.join(process.cwd(), 'lib/scenarios.json');

// Re-export for backend usage convenience if needed
export type { Scenario, UIConfig, UITexts };

// Default Data if file missing
const DEFAULT_SCENARIOS: Scenario[] = [
    {
        id: "history-default",
        name: "歷史導覽模式",
        description: "故宮標準導覽，AI 扮演專業歷史學家，提供學術與軼聞分析。",
        systemPrompt: "Default Prompt...",
        uiConfig: {
            primaryColor: "text-lime-400",
            borderColor: "border-lime-400",
            audioAmbience: "SOUND_QUIET"
        },
        uiTexts: {
            boot: "正在探測歷史訊號",
            scanning: "解析文物構造",
            locked: "鎖定目標"
        },
        isActive: true
    }
];

export function getScenarios(): Scenario[] {
    try {
        if (!fs.existsSync(SCENARIOS_FILE)) {
            fs.writeFileSync(SCENARIOS_FILE, JSON.stringify(DEFAULT_SCENARIOS, null, 2));
            return DEFAULT_SCENARIOS;
        }
        const data = fs.readFileSync(SCENARIOS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error loading scenarios:", e);
        return DEFAULT_SCENARIOS;
    }
}

export function saveScenarios(scenarios: Scenario[]) {
    fs.writeFileSync(SCENARIOS_FILE, JSON.stringify(scenarios, null, 2));
}

export async function getScenario(id: string): Promise<Scenario | undefined> {
    const scenarios = getScenarios();
    return scenarios.find(s => s.id === id);
}

export async function updateScenario(id: string, updates: Partial<Scenario>) {
    const scenarios = getScenarios();
    const index = scenarios.findIndex(s => s.id === id);
    if (index !== -1) {
        scenarios[index] = { ...scenarios[index], ...updates };
        saveScenarios(scenarios);
    }
}

export async function setActiveScenario(id: string) {
    const scenarios = getScenarios();
    const newScenarios = scenarios.map(s => ({
        ...s,
        isActive: s.id === id
    }));
    saveScenarios(newScenarios);
}

export async function getActiveScenario(): Promise<Scenario> {
    const scenarios = getScenarios();
    return scenarios.find(s => s.isActive) || scenarios[0];
}
