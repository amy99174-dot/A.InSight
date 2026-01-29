import { ReactNode, WheelEvent } from 'react';
import { DEFAULT_CONFIG } from '../lib/defaults';

export interface ScannerSkinPropsV2 {
    step: string;
    config: typeof DEFAULT_CONFIG;

    // Dynamic Data
    artifactName: string;
    analysisText: string;
    scriptPages: string[];
    scriptPage: number;
    debugLog: string;
    isProcessing: boolean;
    isPlayingAudio: boolean;
    focusRotation: number;
    historyScale: number;
    timeScale: number;
    historyImage: string | null;
    orientation: { x: number, y: number };
    children?: ReactNode;
    cameraError?: string | null;

    // Callbacks
    onTrigger: () => void;
    onWheel: (e: WheelEvent) => void;
    toggleAudio: () => void;

    // Settings State (Passed down if needed by skin, mainly for overlays)
    showSettings: boolean;
    setShowSettings: (v: boolean) => void;
    userGoogleKey: string;
    setUserGoogleKey: (v: string) => void;
    userOpenAIKey: string;
    setUserOpenAIKey: (v: string) => void;
    hasGoogleKey: boolean;

    // Edit Mode
    isEditable?: boolean;
    onEdit?: (fieldKey: string) => void;
}
