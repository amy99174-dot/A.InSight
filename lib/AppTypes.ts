
export interface UIConfig {
    primaryColor: string;
    borderColor: string;
    audioAmbience: string;
}

export interface UITexts {
    boot: string;
    scanning: string;
    locked: string;
}

export interface Scenario {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    uiConfig: UIConfig;
    uiTexts: UITexts;
    isActive: boolean;
}
