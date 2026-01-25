
import React, { useRef, useEffect } from 'react';
import { Volume2, VolumeX, X, Settings } from 'lucide-react';
import { EditableText } from './EditableText';
import { EditableColor } from './EditableColor';
import { KeyholeViewer } from './KeyholeViewer';

export interface DynamicConfig {
    uiConfig: {
        primaryColor: string;
        borderColor: string;
        audioAmbience: string;
    };
    uiTexts: {
        boot: string;
        scanning: string;
        locked: string;
    };
    name: string;
}

export const STEPS = {
    BOOT: 'BOOT',
    PROXIMITY: 'PROXIMITY',
    LOCKED: 'LOCKED',
    TUNING: 'TUNING',
    ANALYZING: 'ANALYZING',
    LISTEN: 'LISTEN',
    FOCUSING: 'FOCUSING',
    REVEAL: 'REVEAL',
};

interface ScannerDisplayProps {
    step: string;
    config: DynamicConfig;
    isEditor?: boolean;
    onConfigChange?: (newConfig: DynamicConfig) => void;

    // Data Props
    capturedImage: string | null;
    historyImage: string | null;
    historyScale: number;
    timeScale: number;
    artifactName: string;
    scriptPages: string[];
    scriptPage: number;
    analysisText: string;
    isProcessing: boolean;

    // Interactive State
    focusRotation: number;
    focusProgress: number;
    isPlayingAudio: boolean;
    hasGoogleKey: boolean;

    // Position for Keyhole
    position: { x: number, y: number };

    // Refs (Passed from parent if needed, or we just handle events)
    // For videoRef, we need to pass the ref object so the hook in parent can control it
    videoRef: React.RefObject<HTMLVideoElement>;

    // Callbacks
    onTrigger: () => void;
    onWheel?: (e: React.WheelEvent) => void;
    onToggleAudio: () => void;
    onShowSettings: () => void;

    // Mock Data for Editor (Optional)
    mockImage?: string;
}

// Helper to determine color style (Hybrid: Class vs Hex)
const getDynamicStyle = (colorValue: string, property: 'borderColor' | 'color' | 'backgroundColor' = 'borderColor') => {
    if (!colorValue) return { className: '', style: {} };
    if (colorValue.startsWith('#')) {
        return { style: { [property]: colorValue }, className: '' };
    }
    return { style: {}, className: colorValue }; // Assume tailwind class
};

export const ScannerDisplay: React.FC<ScannerDisplayProps> = ({
    step,
    config,
    isEditor = false,
    onConfigChange,
    capturedImage,
    historyImage,
    historyScale,
    timeScale,
    artifactName,
    scriptPages,
    scriptPage,
    analysisText,
    isProcessing,
    focusRotation,
    focusProgress,
    isPlayingAudio,
    hasGoogleKey,
    position,
    videoRef,
    onTrigger,
    onWheel,
    onToggleAudio,
    onShowSettings,
    mockImage,
}) => {

    // Safety check for config - provide defaults if missing to prevent crash
    const safeConfig = config || {
        uiConfig: { primaryColor: 'text-lime-400', borderColor: 'border-white', audioAmbience: '' },
        uiTexts: { boot: '正在探測歷史訊號', scanning: '訊號偵測', locked: '鎖定目標' },
        name: 'Default Scenario'
    };

    const updateConfig = (path: string, value: string) => {
        if (!onConfigChange) return;
        const newConfig = JSON.parse(JSON.stringify(safeConfig));

        if (path === 'uiTexts.boot') newConfig.uiTexts.boot = value;
        if (path === 'uiTexts.scanning') newConfig.uiTexts.scanning = value;
        if (path === 'uiTexts.locked') newConfig.uiTexts.locked = value;
        if (path === 'uiConfig.primaryColor') newConfig.uiConfig.primaryColor = value;
        if (path === 'uiConfig.borderColor') newConfig.uiConfig.borderColor = value;

        onConfigChange(newConfig);
    };

    // Derived Styles
    const primaryColorStyle = getDynamicStyle(safeConfig.uiConfig.primaryColor, 'color'); // text
    const borderColorStyle = getDynamicStyle(safeConfig.uiConfig.borderColor, 'borderColor'); // border

    // Helper to get history label
    const getHistoryLabel = (val: number) => {
        if (val === 3) return "HIGH";
        if (val === 2) return "MID";
        return "LOW";
    };

    return (
        <div
            className={`
                relative w-full h-full
                overflow-hidden bg-transparent font-mono flex items-center justify-center 
                ${primaryColorStyle.className}
            `}
            style={primaryColorStyle.style}
        >

            {/* Development Controller / Settings Button */}
            {!hasGoogleKey && !isEditor && (
                <div className="absolute top-4 left-4 z-50">
                    <button onClick={onShowSettings} className="bg-red-900/80 text-white border border-red-500 px-2 py-1 text-xs rounded animate-pulse">
                        KEY MISSING - SETTINGS
                    </button>
                </div>
            )}

            <div
                className="screen-container cursor-pointer relative"
                onClick={!isEditor && step !== STEPS.TUNING && step !== STEPS.FOCUSING ? onTrigger : undefined}
                onWheel={step === STEPS.FOCUSING ? onWheel : undefined}
            >

                {/* LAYER 0: Visual Base (Background) */}
                <div id="bg-layer" className="absolute inset-0 bg-cover bg-center transition-all duration-500"
                    style={{
                        opacity: (step === STEPS.PROXIMITY || step === STEPS.LOCKED) ? 0.6 :
                            (step === STEPS.TUNING || step === STEPS.FOCUSING) ? 0.2 :
                                (step === STEPS.ANALYZING || step === STEPS.LISTEN) ? 0.1 :
                                    (step === STEPS.REVEAL) ? 0 : 0.3, // REVEAL: Hide background
                        filter: 'grayscale(100%) contrast(120%)',
                        backgroundImage: (capturedImage || mockImage) ? `url(${capturedImage || mockImage})` : 'none'
                    }}>

                    {/* Camera Video Stream - Only render if no image captured yet and not in Editor mode (or handle mock video) */}
                    {/* The extracting logic keeps the video element HERE inside the UI component because it's part of the visual layer */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${capturedImage || mockImage ? 'hidden' : 'block'}`}
                    />
                </div>

                {/* Scan Line Texture */}
                <div className="absolute inset-0 scan-line-bg opacity-30 pointer-events-none"></div>

                {/* LAYER 1: Global HUD */}
                {/* LAYER 1: Global HUD - RENDERED FIRST (BOTTOM LAYER) */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0">
                    {/* External Decoration Ring */}
                    {/* External Decoration Ring */}
                    {/* External Decoration Ring */}
                    <EditableColor isEditable={isEditor} value={safeConfig.uiConfig.borderColor} onChange={v => updateConfig('uiConfig.borderColor', v)} className="absolute inset-0 z-0">
                        <div
                            className={`w-[370px] h-[370px] center-xy border rounded-full flex items-center justify-center pointer-events-auto cursor-pointer ${step === STEPS.REVEAL ? 'border-white' : 'border-white/10'} ${borderColorStyle.className}`}
                            style={borderColorStyle.style}
                        ></div>
                    </EditableColor>

                    {/* Scale Ring */}
                    <div className="center-xy w-[350px] h-[350px] border-white/20 rounded-full anim-spin-centered-slow"
                        style={{ border: '1px dashed rgba(255,255,255,0.1)' }}></div>

                    {/* Top Status Label */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[9px] bg-black border border-white/30 px-2 rounded-full text-white">
                        A.InSight
                    </div>
                </div>

                {/* LAYER 2: State Content */}

                {/* 1. BOOT */}
                {/* 1. BOOT - RENDERED SECOND (TOP LAYER) */}
                <div id="state-BOOT" className={`state-layer ${step === STEPS.BOOT ? 'active' : ''} flex flex-col items-center justify-center z-[100] pointer-events-none`}>
                    <div className="relative w-24 h-24 flex items-center justify-center mb-4">
                        <div className="absolute inset-0 border border-white rounded-full anim-pulse"></div>
                        <div className="absolute inset-0 border-t border-white rounded-full anim-spin-self-slow"></div>
                        <div className="text-2xl font-black tracking-tighter text-white whitespace-nowrap z-50 relative pointer-events-auto">
                            <EditableText isEditable={isEditor} value={safeConfig.uiTexts.boot} onChange={v => updateConfig('uiTexts.boot', v)} />
                        </div>
                    </div>

                    <div className="text-sm font-bold tracking-widest mb-1 text-white">尋找中...</div>
                    <div className="text-[9px] opacity-60 text-white">請在展區中隨意走動</div>
                </div>

                {/* 2. PROXIMITY */}
                {/* 2. PROXIMITY */}
                <div id="state-PROXIMITY" className={`state-layer ${step === STEPS.PROXIMITY ? 'active' : ''} z-[100] pointer-events-none`}>
                    <div className="center-xy w-[120px] h-[120px]">
                        <div className="w-full h-full bg-white/10 rounded-full anim-ping-wrapper"></div>
                    </div>
                    <EditableColor isEditable={isEditor} value={safeConfig.uiConfig.borderColor} onChange={v => updateConfig('uiConfig.borderColor', v)} className="center-xy w-[180px] h-[180px] z-0">
                        <div className="w-full h-full border border-white/30 rounded-full anim-ping-wrapper pointer-events-auto cursor-pointer" style={{ animationDelay: '0.3s' }}></div>
                    </EditableColor>

                    <div className="center-xy flex flex-col items-center text-center bg-black/60 p-6 rounded-full backdrop-blur-sm border border-white/10 text-white">
                        <div className="text-xl font-bold z-50 relative pointer-events-auto">
                            <EditableText isEditable={isEditor} value={safeConfig.uiTexts.scanning} onChange={v => updateConfig('uiTexts.scanning', v)} />
                        </div>
                        <div className="text-[9px] border-t border-white/50 w-full pt-1 mt-1">接近目標中</div>
                    </div>

                    <div className="absolute bottom-16 w-full text-center text-white">
                        <span className="text-2xl font-bold font-mono" id="dist-val">0.8</span>
                        <span className="text-[9px] ml-1">M</span>
                    </div>
                </div>

                {/* 3. LOCKED */}
                {/* 3. LOCKED */}
                <div id="state-LOCKED" className={`state-layer ${step === STEPS.LOCKED ? 'active' : ''} z-[100] pointer-events-none`}>
                    <div className="center-xy w-[200px] h-[200px]">
                        <div className={`absolute top-0 left-0 w-full h-full border-t-2 rounded-full ${borderColorStyle.className}`}
                            style={{ clipPath: 'inset(0 20% 80% 20%)', ...borderColorStyle.style }}></div>
                        <div className={`absolute bottom-0 left-0 w-full h-full border-b-2 rounded-full ${borderColorStyle.className}`}
                            style={{ clipPath: 'inset(80% 20% 0 20%)', ...borderColorStyle.style }}></div>
                        <div className="absolute top-0 left-0 w-full h-full border-l-2 border-white/50 rounded-full"
                            style={{ clipPath: 'inset(40% 90% 40% 0)' }}></div>
                        <div className="absolute top-0 left-0 w-full h-full border-r-2 border-white/50 rounded-full"
                            style={{ clipPath: 'inset(40% 0 40% 90%)' }}></div>
                    </div>

                    <div className="center-xy w-2 h-2 bg-white rounded-full anim-pulse"></div>

                    <div className="absolute top-[35%] w-full text-center">
                        <div className="text-[10px] bg-white text-black px-2 inline-block rounded-sm font-bold z-50 relative pointer-events-auto">
                            <EditableText isEditable={isEditor} value={safeConfig.uiTexts.locked} onChange={v => updateConfig('uiTexts.locked', v)} />
                        </div>
                    </div>
                    <div className="absolute bottom-[30%] w-full text-center text-white">
                        <div className="text-[10px] animate-bounce">[ 按下快門捕捉 ]</div>
                    </div>
                </div>

                {/* 4. TUNING */}
                <div id="state-TUNING" className={`state-layer bg-black/60 ${step === STEPS.TUNING ? 'active' : ''}`}>
                    <div className="center-xy w-[260px] h-[260px]">

                        {/* Outer Ring (Time Scale) */}
                        <div className="absolute inset-0">
                            <div className="absolute inset-0 rounded-full border border-white/20"></div>
                            <div className="absolute inset-0 conic-ring"
                                style={{ background: `conic-gradient(white 0deg ${timeScale * 72}deg, transparent 0deg)`, opacity: 0.8 }}></div>
                        </div>

                        {/* Inner Ring (History Fidelity) */}
                        <div className="absolute inset-[30px]">
                            <div className="absolute inset-0 rounded-full border border-white/20"></div>
                            <div className="absolute inset-0 conic-ring"
                                style={{ background: `conic-gradient(rgba(255,255,255,0.5) 0deg ${historyScale * 120}deg, transparent 0deg)` }}></div>
                        </div>

                        {/* Center Display */}
                        <div className="center-xy flex flex-col text-center z-10 gap-2 text-white">
                            <div className="flex flex-col border-b border-white/20 pb-1 w-20">
                                <span className="text-[8px] opacity-60">時間軸</span>
                                <span className="text-xl font-bold">L-0{timeScale}</span>
                            </div>
                            <div className="flex flex-col w-20">
                                <span className="text-[8px] opacity-60">史實度</span>
                                <span className="text-lg font-bold">{getHistoryLabel(historyScale)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. ANALYZING */}
                <div id="state-ANALYZING" className={`state-layer ${step === STEPS.ANALYZING ? 'active' : ''}`}>
                    <div className="center-xy w-[280px] h-[280px] border border-white/10 rounded-full"></div>
                    <div className="center-xy w-[220px] h-[220px] rounded-full border-t-2 border-white anim-spin-centered-slow"></div>
                    <div className="center-xy w-[200px] h-[200px] rounded-full border-b border-dashed border-white/50 anim-spin-centered-slow" style={{ animationDuration: '8s', animationDirection: 'reverse' }}></div>

                    <div className="center-xy flex flex-col text-center bg-black/80 p-4 rounded-full text-white">
                        <div className="text-sm font-bold mb-1">解析中</div>
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
                            {scriptPages[scriptPage]}
                        </p>
                    </div>

                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2">
                        {scriptPages.map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full ${i === scriptPage ? 'bg-white' : 'bg-white/30'}`}></div>
                        ))}
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); onToggleAudio(); }} className={`absolute top-24 right-10 p-2 rounded-full border ${isPlayingAudio ? 'border-lime-400/50 text-lime-400' : 'border-red-500/50 text-red-500 animate-pulse'} z-50`}>
                        {isPlayingAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                    <div className="absolute bottom-12 w-full text-center text-[8px] text-white/50">點擊畫面繼續</div>
                </div>

                {/* 7. FOCUSING */}
                <div id="state-FOCUSING" className={`state-layer ${step === STEPS.FOCUSING ? 'active' : ''}`}>
                    <div className="center-xy w-[280px] h-[280px] border border-white/20 rounded-full"></div>

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
                        <div className="text-[10px] mb-1">對焦</div>
                        <div className="text-2xl font-bold">{Math.round(focusProgress * 100)}<span className="text-[10px]">%</span></div>
                    </div>

                    <div className="absolute bottom-12 w-full text-center text-white">
                        <div className="text-[10px] opacity-70">[ 旋轉對焦 ]</div>
                    </div>
                </div>

                {/* 8. REVEAL */}
                {step === STEPS.REVEAL && (historyImage || mockImage) && (
                    <div id="state-REVEAL" className={`state-layer active`} style={{ zIndex: 50 }}>
                        <div className="absolute inset-0 rounded-full bg-black">
                            <KeyholeViewer imageSrc={historyImage || mockImage || ''} position={position} />

                            <div className="absolute bottom-12 w-full text-center z-30 pointer-events-auto">
                                <div
                                    className="text-[10px] bg-black text-white px-3 py-1 rounded-full border border-white/20 inline-block cursor-pointer"
                                    onClick={!isEditor ? onTrigger : undefined}
                                >
                                    探測下一則歷史
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
