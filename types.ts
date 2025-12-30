
export enum AppStep {
  BOOT = 'BOOT',          // Startup / Searching loop
  PROXIMITY = 'PROXIMITY', // NFC Weak signal (Intermittent vibration)
  LOCKED = 'LOCKED',      // NFC Strong signal (Long vibration)
  TUNING = 'TUNING',      // New Step: Adjust parameters before analyzing
  CAPTURE = 'CAPTURE',    // Camera active, waiting for Trigger
  ANALYZING = 'ANALYZING',// Processing animation
  LISTEN = 'LISTEN',      // Lift earpiece prompt
  FOCUSING = 'FOCUSING',  // REPLACED: Rotate lens to focus (was DUST_OFF)
  REVEAL = 'REVEAL',      // Keyhole effect (Clear image)
}

export interface ArtifactData {
  id: string;
  name: string;
  originalImage: string;
  historyImage: string;
  description: string;
}

export interface AnalysisResult {
  name: string;
  visionPrompt: string;
  scriptPrompt: string;
  ambienceCategory: string;
  era?: string;
  imageStrength?: number;
  usedPrompt?: string;
  category?: string; // New field
  summary?: string;  // New field
}
