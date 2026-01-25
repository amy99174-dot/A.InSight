import React from 'react';
import { Sparkles, Settings, X, Volume2, VolumeX, AlertTriangle, ArrowRight, Sliders, Terminal, RotateCw } from 'lucide-react';
import { KeyholeViewer } from './KeyholeViewer';

// --- Helper Components & Functions ---

const getDynamicStyle = (colorValue: string | undefined, defaultClass: string, property: 'color' | 'borderColor' | 'backgroundColor' | 'stroke' = 'color') => {
    const finalValue = colorValue || defaultClass;

    // 判斷是否為自訂色碼 (Hex/RGB/HSL)
    // Note: If defaultClass is a hex/rgb string, treat it as style. If it's a tailwind class, treat as class.
    // The previous logic assumed defaultClass is always a class. 
    // If I pass 'text-white' it's a class. If I pass '#FFF', it's a style. 
    // The helper logic:
    const isCustomColor = finalValue.startsWith('#') || finalValue.startsWith('rgb') || finalValue.startsWith('hsl');

    return {
        className: isCustomColor ? '' : finalValue,
        style: isCustomColor ? { [property]: finalValue } : undefined
    };
};

interface CircularHUDProps {
    color?: string; // Config Color Value (Hex or Class)
    defaultColorClass?: string;
    active?: boolean;
}

const CircularHUD = React.memo(({ color, defaultColorClass = "text-lime-400", active = false }: CircularHUDProps) => {
    const styleData = getDynamicStyle(color, defaultColorClass, 'color');
    return (
        <div className={`absolute inset-0 pointer-events-none z-50 ${styleData.className}`} style={styleData.style}>
            <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
                <circle cx="50" cy="50" r="49" fill="none" stroke="currentColor" strokeWidth="0.5" />
                <circle
                    cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="0.3"
                    strokeDasharray="1 3"
                    className={active ? "animate-spin-slow origin-center" : ""}
                />
                <path d="M50 2 V5" stroke="currentColor" strokeWidth="2" />
                <path d="M50 98 V95" stroke="currentColor" strokeWidth="2" />
                <path d="M2 50 H5" stroke="currentColor" strokeWidth="2" />
                <path d="M98 50 H95" stroke="currentColor" strokeWidth="2" />
            </svg>
            <div className="absolute inset-0 bg-noise mix-blend-overlay opacity-30 rounded-full" />
        </div>
    );
});

export interface ScannerDisplayProps {
    step: string;
    config: {
        // Enums / Labels
        STEPS: Record<string, string>;
        TIME_SCALE_LABELS: Record<number, string>;
        HISTORY_SCALE_LABELS: Record<number, string>;

        // Text Config
        title?: string;
        bootText?: string;
        bootSubtext?: string;
        bootHint?: string;
        proximityTitle?: string;
        proximitySubtext?: string;
        lockedTitle?: string;
        lockedSubtext?: string;
        tuningRingOuter?: string;
        tuningRingInner?: string;
        analyzingTitle?: string;
        listenHint?: string;
        focusTitle?: string;
        focusHint?: string;
        revealHint?: string;

        // Color Config
        primaryColor?: string;   // Main rings, active text (White/Lime)
        secondaryColor?: string; // Backgrounds, overlays (Black)
        alertColor?: string;     // Warnings (Red)
    };
    // Dynamic Data
    artifactName: string;
    analysisText: string;
    scriptPages: string[];
    scriptPage: number;
    debugLog: string;
    isProcessing: boolean;
    isPlayingAudio: boolean;
    focusRotation: number;

    // State/Control
    historyScale: number;
    timeScale: number;

    // Callbacks
    onTrigger: () => void;
    onWheel: (e: React.WheelEvent) => void;
    toggleAudio: () => void;

    // Settings / Keys
    showSettings: boolean;
    setShowSettings: (v: boolean) => void;
    userGoogleKey: string;
    setUserGoogleKey: (v: string) => void;
    userOpenAIKey: string;
    setUserOpenAIKey: (v: string) => void;
    hasGoogleKey: boolean;

    // Misc
    historyImage: string | null;
    orientation: { x: number, y: number };

    // Slots
    children?: React.ReactNode; // Background/Video Layer

    // Edit Mode (Native Instrumentation)
    isEditable?: boolean;
    onEdit?: (fieldKey: string) => void;
}

export default function ScannerDisplay({
    step,
    config,
    artifactName,
    analysisText,
    scriptPages,
    scriptPage,
    debugLog,
    isProcessing,
    isPlayingAudio,
    focusRotation,
    historyScale,
    timeScale,
    onTrigger,
    onWheel,
    toggleAudio,
    showSettings,
    setShowSettings,
    userGoogleKey,
    setUserGoogleKey,
    userOpenAIKey,
    setUserOpenAIKey,
    hasGoogleKey,
    historyImage,
    orientation,
    children,
    isEditable = false,
    onEdit
}: ScannerDisplayProps) {
    const { STEPS, TIME_SCALE_LABELS, HISTORY_SCALE_LABELS } = config;

    // --- Helper for Edit Interactions ---
    const getInteractionProps = (fieldKey: string, type: 'text' | 'ring' = 'text') => {
        if (!isEditable) return {};

        const baseStyles = "cursor-pointer transition-all duration-200";
        const textStyles = "hover:bg-white/10 hover:outline hover:outline-1 hover:outline-dashed hover:outline-yellow-400 rounded px-1 relative z-50";
        const ringStyles = "hover:ring-4 hover:ring-yellow-400/50 hover:border-yellow-400";

        return {
            onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                if (onEdit) onEdit(fieldKey);
            },
            className: `${baseStyles} ${type === 'ring' ? ringStyles : textStyles}`,
        };
    };

    const getHistoryLabel = (val: number) => {
        if (val === 3) return "HIGH";
        if (val === 2) return "MID";
        return "LOW";
    };

    const focusProgress = Math.min(Math.abs(focusRotation) / 100, 1);

    // Safe check for scriptPages to avoid undefined access
    const currentScriptPageText = scriptPages && scriptPages[scriptPage] ? scriptPages[scriptPage] : "...";

    // Dynamic Sytles using Helper
    // Primary: Used for rings, main text, active states. Default often white or lime.
    // Alert: Used for errors, missing keys. Default red.

    // Note: Original code hardcoded 'white' in many places.

    return (
        <div className="relative w-full h-full flex items-center justify-center font-mono text-white">
            {/* Development Controller / Settings Button */}
            {!hasGoogleKey && (
                <div className="fixed top-4 left-4 z-50">
                    <button onClick={() => setShowSettings(true)} className="bg-red-900/80 text-white border border-red-500 px-2 py-1 text-xs rounded animate-pulse">
                        KEY MISSING - SETTINGS
                    </button>
                </div>
            )}

            <div
                className="screen-container cursor-pointer"
                onClick={step !== STEPS.TUNING && step !== STEPS.FOCUSING ? onTrigger : undefined}
                onWheel={step === STEPS.FOCUSING ? onWheel : undefined}
            >
                {/* LAYER 0: Background/Video (Passed as Children) */}
                {children}

                {/* Scan Line Texture */}
                <div className="absolute inset-0 scan-line-bg opacity-30 pointer-events-none"></div>

                {/* LAYER 1: Global HUD */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* External Decoration Ring - Interactable in Edit Mode */}
                    <div
                        {...getDynamicStyle(config.primaryColor, step === STEPS.REVEAL ? 'border-white' : 'border-white/10', 'borderColor')}
                        className={`center-xy w-[370px] h-[370px] border rounded-full pointer-events-auto ${getDynamicStyle(config.primaryColor, step === STEPS.REVEAL ? 'border-white' : 'border-white/10', 'borderColor').className} ${isEditable ? getInteractionProps('primaryColor', 'ring').className : ''}`}
                        onClick={getInteractionProps('primaryColor', 'ring').onClick}
                    ></div>
                    {/* Scale Ring */}
                    <div
                        className={`center-xy w-[350px] h-[350px] rounded-full anim-spin-centered-slow ${getDynamicStyle(config.primaryColor, 'border-white/20', 'borderColor').className}`}
                        style={{
                            ...getDynamicStyle(config.primaryColor, 'border-white/20', 'borderColor').style,
                            border: `1px dashed ${getDynamicStyle(config.primaryColor, 'rgba(255,255,255,0.1)', 'borderColor').style?.borderColor || 'rgba(255,255,255,0.1)'}`
                        }}
                    ></div>

                    {/* Top Status Label */}
                    <div
                        {...getInteractionProps('title')}
                        className={`absolute top-6 left-1/2 -translate-x-1/2 text-[9px] bg-black border border-white/30 px-2 rounded-full text-white pointer-events-auto ${isEditable ? getInteractionProps('title').className : ''}`}
                    >
                        {config.title || "A.InSight"}
                    </div>
                </div>

                {/* LAYER 2: State Content */}

                {/* 1. BOOT */}
                <div id="state-BOOT" className={`state-layer ${step === STEPS.BOOT ? 'active' : ''} flex flex-col items-center justify-center`}>
                    <div className="relative w-24 h-24 flex items-center justify-center mb-4">
                        <div {...getDynamicStyle(config.primaryColor, 'border-white', 'borderColor')} className={`absolute inset-0 border rounded-full anim-pulse ${getDynamicStyle(config.primaryColor, 'border-white', 'borderColor').className}`}></div>
                        <div {...getDynamicStyle(config.primaryColor, 'border-white', 'borderColor')} className={`absolute inset-0 border-t rounded-full anim-spin-self-slow ${getDynamicStyle(config.primaryColor, 'border-white', 'borderColor').className}`}></div>
                        <div
                            {...getDynamicStyle(config.primaryColor, 'text-white', 'color')}
                            {...getInteractionProps('bootText')}
                            className={`text-2xl font-black tracking-tighter whitespace-nowrap pointer-events-auto ${getDynamicStyle(config.primaryColor, 'text-white', 'color').className} ${isEditable ? getInteractionProps('bootText').className : ''}`}
                        >
                            {config.bootText || "正在探測歷史訊號"}
                        </div>
                    </div>

                    <div
                        {...getDynamicStyle(config.primaryColor, 'text-white', 'color')}
                        {...getInteractionProps('bootSubtext')}
                        className={`text-sm font-bold tracking-widest mb-1 pointer-events-auto ${getDynamicStyle(config.primaryColor, 'text-white', 'color').className} ${isEditable ? getInteractionProps('bootSubtext').className : ''}`}
                    >
                        {config.bootSubtext || "尋找中..."}
                    </div>
                    <div
                        {...getDynamicStyle(config.primaryColor, 'text-white', 'color')}
                        {...getInteractionProps('bootHint')}
                        className={`text-[9px] opacity-60 pointer-events-auto ${getDynamicStyle(config.primaryColor, 'text-white', 'color').className} ${isEditable ? getInteractionProps('bootHint').className : ''}`}
                    >
                        {config.bootHint || "請在展區中隨意走動"}
                    </div>
                </div>

                {/* 2. PROXIMITY */}
                <div id="state-PROXIMITY" className={`state-layer ${step === STEPS.PROXIMITY ? 'active' : ''}`}>
                    <div className="center-xy w-[120px] h-[120px]">
                        <div className="w-full h-full bg-white/10 rounded-full anim-ping-wrapper"></div>
                    </div>
                    <div className="center-xy w-[180px] h-[180px]">
                        <div {...getDynamicStyle(config.primaryColor, 'border-white/30', 'borderColor')} className={`w-full h-full border rounded-full anim-ping-wrapper ${getDynamicStyle(config.primaryColor, 'border-white/30', 'borderColor').className}`} style={{ ...getDynamicStyle(config.primaryColor, 'border-white/30', 'borderColor').style, animationDelay: '0.3s' }}></div>
                    </div>

                    <div {...getDynamicStyle(config.primaryColor, 'border-white/10', 'borderColor')} className={`center-xy flex flex-col items-center text-center bg-black/60 p-6 rounded-full backdrop-blur-sm border text-white ${getDynamicStyle(config.primaryColor, 'border-white/10', 'borderColor').className}`} style={getDynamicStyle(config.primaryColor, 'border-white/10', 'borderColor').style}>
                        <div {...getInteractionProps('proximityTitle')} className={`text-xl font-bold pointer-events-auto ${isEditable ? getInteractionProps('proximityTitle').className : ''}`}>{config.proximityTitle || "訊號偵測"}</div>
                        <div {...getInteractionProps('proximitySubtext')} className={`text-[9px] border-t border-white/50 w-full pt-1 mt-1 pointer-events-auto ${isEditable ? getInteractionProps('proximitySubtext').className : ''}`}>{config.proximitySubtext || "接近目標中"}</div>
                    </div>

                    <div className="absolute bottom-16 w-full text-center text-white">
                        <span className="text-2xl font-bold font-mono" id="dist-val">0.8</span>
                        <span className="text-[9px] ml-1">M</span>
                    </div>
                </div>

                {/* 3. LOCKED */}
                <div id="state-LOCKED" className={`state-layer ${step === STEPS.LOCKED ? 'active' : ''}`}>
                    <div className="center-xy w-[200px] h-[200px]">
                        <div {...getDynamicStyle(config.primaryColor, 'border-white', 'borderColor')} className={`absolute top-0 left-0 w-full h-full border-t-2 rounded-full ${getDynamicStyle(config.primaryColor, 'border-white', 'borderColor').className}`}
                            style={{ ...getDynamicStyle(config.primaryColor, 'border-white', 'borderColor').style, clipPath: 'inset(0 20% 80% 20%)' }}></div>
                        <div {...getDynamicStyle(config.primaryColor, 'border-white', 'borderColor')} className={`absolute bottom-0 left-0 w-full h-full border-b-2 rounded-full ${getDynamicStyle(config.primaryColor, 'border-white', 'borderColor').className}`}
                            style={{ ...getDynamicStyle(config.primaryColor, 'border-white', 'borderColor').style, clipPath: 'inset(80% 20% 0 20%)' }}></div>
                        <div {...getDynamicStyle(config.primaryColor, 'border-white/50', 'borderColor')} className={`absolute top-0 left-0 w-full h-full border-l-2 rounded-full ${getDynamicStyle(config.primaryColor, 'border-white/50', 'borderColor').className}`}
                            style={{ ...getDynamicStyle(config.primaryColor, 'border-white/50', 'borderColor').style, clipPath: 'inset(40% 90% 40% 0)' }}></div>
                        <div {...getDynamicStyle(config.primaryColor, 'border-white/50', 'borderColor')} className={`absolute top-0 left-0 w-full h-full border-r-2 rounded-full ${getDynamicStyle(config.primaryColor, 'border-white/50', 'borderColor').className}`}
                            style={{ ...getDynamicStyle(config.primaryColor, 'border-white/50', 'borderColor').style, clipPath: 'inset(40% 0 40% 90%)' }}></div>
                    </div>

                    <div {...getDynamicStyle(config.primaryColor, 'bg-white', 'backgroundColor')} className={`center-xy w-2 h-2 rounded-full anim-pulse ${getDynamicStyle(config.primaryColor, 'bg-white', 'backgroundColor').className}`}></div>

                    <div className="absolute top-[35%] w-full text-center">
                        <div {...getDynamicStyle(config.primaryColor, 'bg-white', 'backgroundColor')} className={`text-[10px] text-black px-2 inline-block rounded-sm font-bold ${getDynamicStyle(config.primaryColor, 'bg-white', 'backgroundColor').className} pointer-events-auto ${isEditable ? getInteractionProps('lockedTitle').className : ''}`} {...getInteractionProps('lockedTitle')}>
                            {config.lockedTitle || "鎖定目標"}
                        </div>
                    </div>
                    <div className="absolute bottom-[30%] w-full text-center text-white">
                        <div {...getInteractionProps('lockedSubtext')} className={`text-[10px] animate-bounce pointer-events-auto ${isEditable ? getInteractionProps('lockedSubtext').className : ''}`}>{config.lockedSubtext || "[ 按下快門捕捉 ]"}</div>
                    </div>
                </div>

                {/* 4. TUNING - KEYBOARD CONTROLLED */}
                <div id="state-TUNING" className={`state-layer bg-black/60 ${step === STEPS.TUNING ? 'active' : ''}`}>
                    <div className="center-xy w-[260px] h-[260px]">

                        {/* Outer Ring (Time Scale) */}
                        <div className="absolute inset-0">
                            <div {...getDynamicStyle(config.primaryColor, 'border-white/20', 'borderColor')} className={`absolute inset-0 rounded-full border ${getDynamicStyle(config.primaryColor, 'border-white/20', 'borderColor').className}`}></div>
                            <div className="absolute inset-0 conic-ring"
                                style={{ background: `conic-gradient(white 0deg ${timeScale * 72}deg, transparent 0deg)`, opacity: 0.8 }}></div>
                        </div>

                        {/* Inner Ring (History Fidelity) */}
                        <div className="absolute inset-[30px]">
                            <div {...getDynamicStyle(config.primaryColor, 'border-white/20', 'borderColor')} className={`absolute inset-0 rounded-full border ${getDynamicStyle(config.primaryColor, 'border-white/20', 'borderColor').className}`}></div>
                            <div className="absolute inset-0 conic-ring"
                                style={{ background: `conic-gradient(rgba(255,255,255,0.5) 0deg ${historyScale * 120}deg, transparent 0deg)` }}></div>
                        </div>

                        {/* Center Display */}
                        <div className="center-xy flex flex-col text-center z-10 gap-2 text-white">
                            <div className="flex flex-col border-b border-white/20 pb-1 w-20">
                                <span {...getInteractionProps('tuningRingOuter')} className={`text-[8px] opacity-60 pointer-events-auto ${isEditable ? getInteractionProps('tuningRingOuter').className : ''}`}>{config.tuningRingOuter || "時間軸"}</span>
                                <span className="text-xl font-bold">L-0{timeScale}</span>
                            </div>
                            <div className="flex flex-col w-20">
                                <span {...getInteractionProps('tuningRingInner')} className={`text-[8px] opacity-60 pointer-events-auto ${isEditable ? getInteractionProps('tuningRingInner').className : ''}`}>{config.tuningRingInner || "史實度"}</span>
                                <span className="text-lg font-bold">{getHistoryLabel(historyScale)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. ANALYZING */}
                <div id="state-ANALYZING" className={`state-layer ${step === STEPS.ANALYZING ? 'active' : ''}`}>
                    <div {...getDynamicStyle(config.primaryColor, 'border-white/10', 'borderColor')} className={`center-xy w-[280px] h-[280px] border rounded-full ${getDynamicStyle(config.primaryColor, 'border-white/10', 'borderColor').className}`}></div>
                    <div {...getDynamicStyle(config.primaryColor, 'border-white', 'borderColor')} className={`center-xy w-[220px] h-[220px] rounded-full border-t-2 anim-spin-centered-slow ${getDynamicStyle(config.primaryColor, 'border-white', 'borderColor').className}`}></div>
                    <div {...getDynamicStyle(config.primaryColor, 'border-white/50', 'borderColor')} className={`center-xy w-[200px] h-[200px] rounded-full border-b border-dashed anim-spin-centered-slow ${getDynamicStyle(config.primaryColor, 'border-white/50', 'borderColor').className}`} style={{ ...getDynamicStyle(config.primaryColor, 'border-white/50', 'borderColor').style, animationDuration: '8s', animationDirection: 'reverse' }}></div>

                    <div className="center-xy flex flex-col text-center bg-black/80 p-4 rounded-full text-white">
                        <div {...getInteractionProps('analyzingTitle')} className={`text-sm font-bold mb-1 pointer-events-auto ${isEditable ? getInteractionProps('analyzingTitle').className : ''}`}>{config.analyzingTitle || "解析中"}</div>
                        <div className="text-[9px] opacity-60 text-stone-300">{analysisText}</div>
                        <div className="mt-2 font-mono text-xl" id="percent-txt">{isProcessing ? "..." : "DONE"}</div>
                    </div>
                </div>

                {/* 6. LISTEN */}
                <div id="state-LISTEN" className={`state-layer bg-black/80 ${step === STEPS.LISTEN ? 'active' : ''}`}>
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full"></div>

                    <div className="absolute top-16 w-full text-center text-white">
                        <span className="text-xl font-bold border-b border-white pb-1">{artifactName}</span>
                    </div>

                    <div className="center-xy w-[260px] flex items-center justify-center text-center text-white">
                        <p className="text-sm leading-relaxed opacity-90 font-light">
                            {currentScriptPageText}
                        </p>
                    </div>

                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2">
                        {scriptPages.map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full ${i === scriptPage ? 'bg-white' : 'bg-white/30'}`}></div>
                        ))}
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); toggleAudio(); }} className={`absolute top-24 right-10 p-2 rounded-full border ${isPlayingAudio ? 'border-lime-400/50 text-lime-400' : 'border-red-500/50 text-red-500 animate-pulse'} z-50`}>
                        {isPlayingAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>

                    <div {...getInteractionProps('listenHint')} className={`absolute bottom-12 w-full text-center text-[8px] text-white/50 pointer-events-auto ${isEditable ? getInteractionProps('listenHint').className : ''}`}>
                        {config.listenHint || "點擊畫面繼續"}
                    </div>
                </div>

                {/* 7. FOCUSING - WHEEL CONTROLLED */}
                <div id="state-FOCUSING" className={`state-layer ${step === STEPS.FOCUSING ? 'active' : ''}`}>
                    <div {...getDynamicStyle(config.primaryColor, 'border-white/20', 'borderColor')} className={`center-xy w-[280px] h-[280px] border rounded-full ${getDynamicStyle(config.primaryColor, 'border-white/20', 'borderColor').className}`}></div>

                    <div className="center-xy w-[260px] h-[260px]">
                        <div className="absolute inset-0 rounded-full anim-spin-self-slow opacity-60"
                            style={{
                                background: 'conic-gradient(from 0deg, transparent 0%, transparent 80%, white 100%)',
                                WebkitMask: 'radial-gradient(transparent 68%, black 69%)',
                                mask: 'radial-gradient(transparent 68%, black 69%)',
                                transform: `rotate(${focusRotation}deg)`
                            }}>
                        </div>
                    </div>

                    <div className="center-xy w-[100px] h-[100px] border border-white rounded-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm text-white">
                        <div {...getInteractionProps('focusTitle')} className={`text-[10px] mb-1 pointer-events-auto ${isEditable ? getInteractionProps('focusTitle').className : ''}`}>{config.focusTitle || "對焦"}</div>
                        <div className="text-2xl font-bold">{Math.round(focusProgress * 100)}<span className="text-[10px]">%</span></div>
                    </div>

                    <div className="absolute bottom-12 w-full text-center text-white">
                        <div {...getInteractionProps('focusHint')} className={`text-[10px] opacity-70 pointer-events-auto ${isEditable ? getInteractionProps('focusHint').className : ''}`}>{config.focusHint || "[ 旋轉對焦 ]"}</div>
                    </div>
                </div>

                {/* 8. REVEAL - ORIGINAL KeyholeViewer Logic Preserved */}
                <div id="state-REVEAL" className={`state-layer ${step === STEPS.REVEAL ? 'active' : ''}`} style={{ zIndex: 50 }}>
                    {step === STEPS.REVEAL && historyImage && (
                        <div className="absolute inset-0 rounded-full bg-black">
                            <KeyholeViewer imageSrc={historyImage} position={orientation} />

                            {/* Overlay Click-to-Reset */}
                            <div className="absolute bottom-12 w-full text-center z-30 pointer-events-auto">
                                <div
                                    className={`text-[10px] bg-black text-white px-3 py-1 rounded-full border border-white/20 inline-block cursor-pointer pointer-events-auto ${isEditable ? getInteractionProps('revealHint').className : ''}`}
                                    onClick={(e) => {
                                        if (isEditable) {
                                            getInteractionProps('revealHint').onClick!(e);
                                            return;
                                        }
                                        e.stopPropagation();
                                        onTrigger();
                                    }}
                                >
                                    {config.revealHint || "探測下一則歷史"}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* KEEP SETTINGS MODAL */}
            {showSettings && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
                    <div className="w-full max-w-md bg-[#1a1816] border-2 border-[#39ff14] rounded-xl p-6 shadow-2xl relative text-lime-400 font-mono overflow-y-auto max-h-[80vh]">
                        <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-lime-700 hover:text-lime-400"><X size={24} /></button>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-lime-900/50 pb-2"><Settings className="w-5 h-5" />系統維護面板</h2>
                        <div className="space-y-6">
                            <div className="p-3 bg-lime-900/10 rounded border border-lime-900/30">
                                <label className="block text-xs uppercase tracking-widest text-lime-400 mb-1 font-bold">Google Gemini API Key (核心)</label>
                                <input type="password" value={userGoogleKey} onChange={(e) => setUserGoogleKey(e.target.value)} placeholder="Paste AI Studio Key here..." className="w-full bg-black/50 border border-lime-900/50 rounded p-3 text-lime-100 placeholder-lime-900/30 focus:outline-none focus:border-lime-400 transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs uppercase tracking-widest text-lime-700 mb-1">OpenAI API Key (語音 TTS)</label>
                                <input type="password" value={userOpenAIKey} onChange={(e) => setUserOpenAIKey(e.target.value)} placeholder="sk-proj-..." className="w-full bg-black/50 border border-lime-900/50 rounded p-3 text-lime-100 placeholder-lime-900/30 focus:outline-none focus:border-lime-400 transition-colors" />
                            </div>
                            <div className="border-t border-lime-900/50 pt-4">
                                <h3 className="text-sm font-bold flex items-center gap-2 mb-2 text-lime-300"><Terminal className="w-4 h-4" />神經網絡日誌 (Neural Log)</h3>
                                <div className="bg-black border border-lime-900/50 rounded p-2 overflow-hidden relative">
                                    <div className="absolute top-2 right-2 flex gap-1"><div className="w-2 h-2 rounded-full bg-lime-500 animate-pulse" /></div>
                                    <textarea readOnly value={debugLog} className="w-full h-48 bg-transparent text-[10px] text-lime-400/80 font-mono resize-none focus:outline-none leading-relaxed" />
                                </div>
                            </div>
                            <div className="pt-2 flex justify-end">
                                <button onClick={() => setShowSettings(false)} className="px-6 py-2 bg-lime-900/20 border border-lime-700/50 rounded text-lime-400 hover:bg-lime-900/40 transition-colors text-sm font-bold tracking-wider">確認並關閉</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
