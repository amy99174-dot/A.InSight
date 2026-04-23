import React from 'react';
import { DEFAULT_CONFIG, TIME_SCALE_LABELS, HISTORY_SCALE_LABELS } from '../../lib/defaults';
import { Volume2, VolumeX } from 'lucide-react';
import { KeyholeViewer } from '../KeyholeViewer';
import { HardwareHints } from '../HardwareHints';
import { ScannerSkinPropsV2 } from '../../types/scanner_v2';

// --- Helper Functions (Copied from ScannerDisplay.tsx) ---
const getDynamicStyle = (colorValue: string | undefined, defaultClass: string, property: 'color' | 'borderColor' | 'backgroundColor' | 'stroke' = 'color') => {
    const finalValue = colorValue || defaultClass;
    const isCustomColor = finalValue.startsWith('#') || finalValue.startsWith('rgb') || finalValue.startsWith('hsl');

    return {
        className: isCustomColor ? '' : finalValue,
        style: isCustomColor ? { [property]: finalValue } : undefined
    };
};

export default function ClassicSkinV2(props: ScannerSkinPropsV2) {
    const {
        step,
        config,
        artifactName,
        analysisText,
        scriptPages,
        scriptPage,
        isProcessing,
        isPlayingAudio,
        focusRotation,
        historyScale,
        timeScale,
        onTrigger,
        onWheel,
        toggleAudio,
        historyImage,
        orientation,
        children,
        isEditable,
        onEdit
    } = props;

    const { STEPS } = config;

    // Fallback to defaults
    const txt = config.text_content || DEFAULT_CONFIG.text_content;
    const ui = config.ui_theme || DEFAULT_CONFIG.ui_theme;
    const primaryColor = ui.primary_color || "text-white";

    // --- Helper for Edit Interactions ---
    const getInteractionProps = (fieldKey: string, type: 'text' | 'ring' = 'text') => {
        if (!isEditable) return {};

        const baseStyles = "cursor-pointer transition-all duration-200";
        const textStyles = "hover:bg-white/10 hover:outline hover:outline-1 hover:outline-dashed hover:outline-yellow-400 rounded px-1 z-50";
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
        return HISTORY_SCALE_LABELS[val] || HISTORY_SCALE_LABELS[2];
    };
    
    const getTimeLabel = (val: number) => {
        return TIME_SCALE_LABELS[val] || TIME_SCALE_LABELS[3];
    };

    const focusProgress = Math.min(Math.abs(focusRotation) / 100, 1);
    const currentScriptPageText = scriptPages && scriptPages[scriptPage] ? scriptPages[scriptPage] : "...";

    // Determine Hardware Hint States based on current step
    const getHintStates = () => {
        switch (step) {
            case STEPS.BOOT:
                return { leftRight: false, dial: false, confirm: true }; // Press to start
            case STEPS.PROXIMITY:
                return { leftRight: false, dial: false, confirm: true }; // User requested confirm solid
            case STEPS.LOCKED:
                return { leftRight: false, dial: false, confirm: true }; // Press to scan
            case STEPS.TUNING:
                return { leftRight: true, dial: true, confirm: true }; // Dial to tune, L/R to switch, Confirm to scan
            case STEPS.ANALYZING:
                return { leftRight: false, dial: false, confirm: false }; // Waiting
            case STEPS.LISTEN:
                // User requested Confirm only hollow normally, but solid on the LAST page
                const isLastPage = scriptPages && scriptPage === scriptPages.length - 1;
                return { leftRight: true, dial: false, confirm: isLastPage }; // Dial not specified, assuming L/R for page
            case STEPS.FOCUSING:
                return { leftRight: false, dial: true, confirm: true }; // Dial to focus, Confirm to finish
            case STEPS.REVEAL:
                return { leftRight: false, dial: false, confirm: true }; // Confirm to restart
            default:
                return { leftRight: false, dial: false, confirm: false };
        }
    };
    const hintStates = getHintStates();

    return (
        <div
            className="screen-container cursor-pointer camera-layer"
            onClick={step !== STEPS.TUNING && step !== STEPS.FOCUSING ? onTrigger : undefined}
            onWheel={step === STEPS.FOCUSING ? onWheel : undefined}
        >
            {/* LAYER 0: Background/Video (Passed as Children) */}
            {children}

            {/* Scan Line Texture */}
            <div className="absolute inset-0 scan-line-bg opacity-10 pointer-events-none"></div>

            {/* Hardware operation hints */}
            <HardwareHints
                activeLeftRight={hintStates.leftRight}
                activeDial={hintStates.dial}
                activeConfirm={hintStates.confirm}
                colorClass={getDynamicStyle(primaryColor, 'text-white', 'color').className}
            />

            {/* LAYER 1: Global HUD */}
            <div className="absolute inset-0 pointer-events-none">
                {/* External Decoration Ring - Interactable in Edit Mode */}
                <div
                    {...getDynamicStyle(primaryColor, step === STEPS.REVEAL ? 'border-white' : 'border-white/10', 'borderColor')}
                    className={`center-xy w-[370px] h-[370px] border rounded-full pointer-events-auto ${getDynamicStyle(primaryColor, step === STEPS.REVEAL ? 'border-white' : 'border-white/10', 'borderColor').className} ${isEditable ? getInteractionProps('ui_theme.primary_color', 'ring').className : ''}`}
                    onClick={getInteractionProps('ui_theme.primary_color', 'ring').onClick}
                ></div>
                {/* Scale Ring - Clock-style Ticks */}
                <div className={`center-xy w-[350px] h-[350px]`}>
                    {[...Array(12)].map((_, i) => {
                        const angle = (i * 30) - 90; // 30 degrees per tick, start from top
                        const radius = 175; // half of 350px
                        const tickLength = i % 3 === 0 ? 12 : 8; // Longer ticks at 12, 3, 6, 9
                        const tickWidth = i % 3 === 0 ? 2 : 1;

                        return (
                            <div
                                key={i}
                                className={`absolute ${getDynamicStyle(primaryColor, 'bg-white/20', 'backgroundColor').className}`}
                                style={{
                                    ...getDynamicStyle(primaryColor, 'rgba(255,255,255,0.2)', 'backgroundColor').style,
                                    width: `${tickWidth}px`,
                                    height: `${tickLength}px`,
                                    left: '50%',
                                    top: '50%',
                                    transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px)`,
                                    transformOrigin: 'center center'
                                }}
                            />
                        );
                    })}
                </div>

                {/* Top Status Label */}
                <div
                    {...getInteractionProps('text_content.title')}
                    className={`absolute top-6 left-1/2 -translate-x-1/2 text-[9px] text-white pointer-events-auto ${isEditable ? getInteractionProps('text_content.title').className : ''}`}
                >
                    {txt.title || "A.InSight"}
                </div>
            </div>

            {/* LAYER 2: State Content */}

            {/* 1. BOOT */}
            <div id="state-BOOT" className={`state-layer ${step === STEPS.BOOT ? 'active' : ''} flex flex-col items-center justify-center`}>
                <div
                    {...getDynamicStyle(primaryColor, 'text-white', 'color')}
                    {...getInteractionProps('text_content.bootText')}
                    className={`text-2xl font-black tracking-tighter whitespace-nowrap pointer-events-auto mb-4 ${getDynamicStyle(primaryColor, 'text-white', 'color').className} ${isEditable ? getInteractionProps('text_content.bootText').className : ''}`}
                >
                    {txt.bootText || "正在探測歷史訊號"}
                </div>

                <div
                    {...getDynamicStyle(primaryColor, 'text-white', 'color')}
                    {...getInteractionProps('text_content.bootSubtext')}
                    className={`text-sm font-bold tracking-widest mb-1 pointer-events-auto ${getDynamicStyle(primaryColor, 'text-white', 'color').className} ${isEditable ? getInteractionProps('text_content.bootSubtext').className : ''}`}
                >
                    {txt.bootSubtext || "尋找中..."}
                </div>
                <div
                    {...getDynamicStyle(primaryColor, 'text-white', 'color')}
                    {...getInteractionProps('text_content.bootHint')}
                    className={`text-[9px] opacity-60 pointer-events-auto ${getDynamicStyle(primaryColor, 'text-white', 'color').className} ${isEditable ? getInteractionProps('text_content.bootHint').className : ''}`}
                >
                    {txt.bootHint || "請在展區中隨意走動"}
                </div>
            </div>

            {/* 2. PROXIMITY */}
            <div id="state-PROXIMITY" className={`state-layer ${step === STEPS.PROXIMITY ? 'active' : ''}`}>
                {/* Stepped Opacity Animation */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                        @keyframes stepped-opacity { 
                            0% { opacity: 0.1; } 
                            33% { opacity: 0.5; } \n                            66% { opacity: 1; } 
                            100% { opacity: 0.1; } 
                        }
                    `
                }} />

                {/* Only outer ring with opacity animation */}
                <div className="center-xy w-[180px] h-[180px]">
                    <div {...getDynamicStyle(primaryColor, 'border-white', 'borderColor')} className={`w-full h-full border rounded-full ${getDynamicStyle(primaryColor, 'border-white', 'borderColor').className}`} style={{ animation: 'stepped-opacity 3s steps(1) infinite' }}></div>
                </div>

                <div {...getDynamicStyle(primaryColor, 'border-white/10', 'borderColor')} className={`center-xy flex flex-col items-center text-center bg-black/80 p-6 rounded-full border text-white ${getDynamicStyle(primaryColor, 'border-white/10', 'borderColor').className}`} style={getDynamicStyle(primaryColor, 'border-white/10', 'borderColor').style}>
                    <div {...getInteractionProps('text_content.proximityTitle')} className={`text-xl font-bold pointer-events-auto ${isEditable ? getInteractionProps('text_content.proximityTitle').className : ''}`}>{txt.proximityTitle || "訊號偵測"}</div>
                    <div {...getInteractionProps('text_content.proximitySubtext')} className={`text-[9px] border-t border-white/50 w-full pt-1 mt-1 pointer-events-auto ${isEditable ? getInteractionProps('text_content.proximitySubtext').className : ''}`}>{txt.proximitySubtext || "接近目標中"}</div>
                </div>

                <div className="absolute bottom-16 w-full text-center text-white">
                    <span className="text-2xl font-bold font-mono" id="dist-val">0.8</span>
                    <span className="text-[9px] ml-1">M</span>
                </div>
            </div>

            {/* 3. LOCKED */}
            <div id="state-LOCKED" className={`state-layer ${step === STEPS.LOCKED ? 'active' : ''}`}>
                <div className="center-xy w-[200px] h-[200px]">
                    {/* All arcs synchronized - same opacity at same time */}
                    <div {...getDynamicStyle(primaryColor, 'border-white', 'borderColor')} className={`absolute top-0 left-0 w-full h-full border-t-2 rounded-full ${getDynamicStyle(primaryColor, 'border-white', 'borderColor').className}`}
                        style={{ ...getDynamicStyle(primaryColor, 'border-white', 'borderColor').style, clipPath: 'inset(0 20% 80% 20%)', animation: 'stepped-opacity 3s steps(1) infinite' }}></div>
                    <div {...getDynamicStyle(primaryColor, 'border-white', 'borderColor')} className={`absolute bottom-0 left-0 w-full h-full border-b-2 rounded-full ${getDynamicStyle(primaryColor, 'border-white', 'borderColor').className}`}
                        style={{ ...getDynamicStyle(primaryColor, 'border-white', 'borderColor').style, clipPath: 'inset(80% 20% 0 20%)', animation: 'stepped-opacity 3s steps(1) infinite' }}></div>
                    <div {...getDynamicStyle(primaryColor, 'border-white', 'borderColor')} className={`absolute top-0 left-0 w-full h-full border-l-2 rounded-full ${getDynamicStyle(primaryColor, 'border-white', 'borderColor').className}`}
                        style={{ ...getDynamicStyle(primaryColor, 'border-white', 'borderColor').style, clipPath: 'inset(40% 90% 40% 0)', animation: 'stepped-opacity 3s steps(1) infinite' }}></div>
                    <div {...getDynamicStyle(primaryColor, 'border-white', 'borderColor')} className={`absolute top-0 left-0 w-full h-full border-r-2 rounded-full ${getDynamicStyle(primaryColor, 'border-white', 'borderColor').className}`}
                        style={{ ...getDynamicStyle(primaryColor, 'border-white', 'borderColor').style, clipPath: 'inset(40% 0 40% 90%)', animation: 'stepped-opacity 3s steps(1) infinite' }}></div>
                </div>

                <div {...getDynamicStyle(primaryColor, 'bg-white', 'backgroundColor')} className={`center-xy w-2 h-2 rounded-full ${getDynamicStyle(primaryColor, 'bg-white', 'backgroundColor').className}`}></div>

                <div className="absolute top-[35%] w-full text-center">
                    <div
                        className={`text-[10px] px-2 inline-block rounded-sm font-bold border bg-black/90 pointer-events-auto ${getDynamicStyle(primaryColor, 'text-white', 'color').className} ${getDynamicStyle(primaryColor, 'border-white', 'borderColor').className} ${isEditable ? getInteractionProps('text_content.lockedTitle').className : ''}`}
                        style={{
                            ...getDynamicStyle(primaryColor, 'text-white', 'color').style,
                            ...getDynamicStyle(primaryColor, 'border-white', 'borderColor').style
                        }}
                        {...getInteractionProps('text_content.lockedTitle')}
                    >
                        {txt.lockedTitle || "鎖定目標"}
                    </div>
                </div>
                <div className="absolute bottom-[30%] w-full text-center text-white">
                    <div {...getInteractionProps('text_content.lockedSubtext')} className={`text-[10px] pointer-events-auto ${isEditable ? getInteractionProps('text_content.lockedSubtext').className : ''}`}>{txt.lockedSubtext || "[ 按下快門捕捉 ]"}</div>
                </div>
            </div>

            {/* 4. TUNING - KEYBOARD CONTROLLED */}
            <div id="state-TUNING" className={`state-layer bg-black/60 ${step === STEPS.TUNING ? 'active' : ''}`}>
                <div className="center-xy w-[260px] h-[260px]">

                    {/* Outer Ring (Time Scale) */}
                    <div className="absolute inset-0">
                        <div {...getDynamicStyle(primaryColor, 'border-white/20', 'borderColor')} className={`absolute inset-0 rounded-full border ${getDynamicStyle(primaryColor, 'border-white/20', 'borderColor').className}`}></div>
                        <div className="absolute inset-0 conic-ring"
                            style={{
                                background: `conic-gradient(${primaryColor.startsWith('#') || primaryColor.startsWith('rgb') ? primaryColor : 'white'} 0deg ${timeScale * 72}deg, transparent 0deg)`,
                                opacity: 0.8
                            }}></div>
                    </div>

                    {/* Inner Ring (History Fidelity) */}
                    <div className="absolute inset-[30px]">
                        <div {...getDynamicStyle(primaryColor, 'border-white/20', 'borderColor')} className={`absolute inset-0 rounded-full border ${getDynamicStyle(primaryColor, 'border-white/20', 'borderColor').className}`}></div>
                        <div className="absolute inset-0 conic-ring"
                            style={{
                                background: `conic-gradient(${primaryColor.startsWith('#') || primaryColor.startsWith('rgb') ? primaryColor : 'white'} 0deg ${historyScale * 120}deg, transparent 0deg)`,
                                opacity: 0.5
                            }}></div>
                    </div>

                    {/* Center Display */}
                    <div className="center-xy flex flex-col text-center z-10 gap-2 text-white">
                        <div className="flex flex-col border-b border-white/20 pb-1 w-20">
                            <span {...getInteractionProps('text_content.tuningRingOuter')} className={`text-[8px] opacity-60 pointer-events-auto ${isEditable ? getInteractionProps('text_content.tuningRingOuter').className : ''}`}>{txt.tuningRingOuter || "時間軸"}</span>
                            <span className="text-xl font-bold">{getTimeLabel(timeScale)}</span>
                        </div>
                        <div className="flex flex-col w-20">
                            <span {...getInteractionProps('text_content.tuningRingInner')} className={`text-[8px] opacity-60 pointer-events-auto ${isEditable ? getInteractionProps('text_content.tuningRingInner').className : ''}`}>{txt.tuningRingInner || "史實度"}</span>
                            <span className="text-lg font-bold">{getHistoryLabel(historyScale)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. ANALYZING */}
            <div id="state-ANALYZING" className={`state-layer ${step === STEPS.ANALYZING ? 'active' : ''}`}>
                <div {...getDynamicStyle(primaryColor, 'border-white/10', 'borderColor')} className={`center-xy w-[280px] h-[280px] border rounded-full ${getDynamicStyle(primaryColor, 'border-white/10', 'borderColor').className}`}></div>

                {/* Dotted Circle - Complete ring with round dots */}
                <div className="center-xy w-[200px] h-[200px]">
                    <svg viewBox="0 0 200 200" className="w-full h-full" style={{ animation: 'stepped-opacity 3s steps(1) infinite' }}>
                        <circle
                            cx="100"
                            cy="100"
                            r="98"
                            fill="none"
                            stroke={getDynamicStyle(primaryColor, 'rgba(255,255,255,1)', 'borderColor').style?.borderColor || 'rgba(255,255,255,1)'}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeDasharray="1 7"
                        />
                    </svg>
                </div>

                <div className="center-xy flex flex-col text-center bg-black/80 p-4 rounded-full text-white">
                    <div {...getInteractionProps('text_content.analyzingTitle')} className={`text-sm font-bold mb-1 pointer-events-auto ${isEditable ? getInteractionProps('text_content.analyzingTitle').className : ''}`}>{txt.analyzingTitle || "解析中"}</div>
                    <div className="text-[9px] opacity-60 text-stone-300">{analysisText}</div>
                    <div className="mt-2 font-mono text-xl" id="percent-txt">{isProcessing ? "..." : "解析完成"}</div>
                </div>
            </div>

            {/* 6. LISTEN */}
            <div id="state-LISTEN" className={`state-layer bg-black/80 ${step === STEPS.LISTEN ? 'active' : ''}`}>

                {/* Center group: title + divider + content — all vertically grouped */}
                <div className="center-xy w-[260px] flex flex-col items-center text-center text-white gap-4 px-2">
                    <span className="text-xl font-bold border-b border-white/80 pb-2 w-full">{artifactName}</span>
                    <p className="text-sm leading-relaxed opacity-90 font-light">
                        {currentScriptPageText}
                    </p>
                </div>

                {/* Pagination dots */}
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2">
                    {scriptPages.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i === scriptPage ? 'bg-white' : 'bg-white/30'}`}></div>
                    ))}
                </div>

                <button onClick={(e) => { e.stopPropagation(); toggleAudio(); }} className={`absolute top-24 right-10 p-2 rounded-full border ${isPlayingAudio ? 'border-lime-400/50 text-lime-400' : 'border-red-500/50 text-red-500 animate-pulse'} z-50`}>
                    {isPlayingAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>

                <div {...getInteractionProps('text_content.listenHint')} className={`absolute bottom-12 w-full text-center text-[8px] text-white/50 pointer-events-auto ${isEditable ? getInteractionProps('text_content.listenHint').className : ''}`}>
                    {txt.listenHint || "點擊畫面繼續"}
                </div>
            </div>

            {/* 7. FOCUSING - WHEEL CONTROLLED */}
            <div id="state-FOCUSING" className={`state-layer ${step === STEPS.FOCUSING ? 'active' : ''}`}>
                <div {...getDynamicStyle(primaryColor, 'border-white/20', 'borderColor')} className={`center-xy w-[280px] h-[280px] border rounded-full ${getDynamicStyle(primaryColor, 'border-white/20', 'borderColor').className}`}></div>
                {/* Sequential Blinking Animation - Inner to Outer */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                        @keyframes blink-inner { 
                            0%, 33% { opacity: 0.5; } 
                            34%, 100% { opacity: 0.1; } 
                        }
                        @keyframes blink-middle { 
                            0%, 33% { opacity: 0.1; } 
                            34%, 66% { opacity: 0.5; } 
                            67%, 100% { opacity: 0.1; } 
                        }
                        @keyframes blink-outer { 
                            0%, 66% { opacity: 0.1; } 
                            67%, 100% { opacity: 0.5; } 
                        }
                    `
                }} />

                {/* Three Concentric Circles - Sequential blinking */}
                <div className="center-xy w-[240px] h-[240px] rounded-full border-2 border-white" style={{ animation: 'blink-outer 3s ease-in-out infinite' }}></div>
                <div className="center-xy w-[180px] h-[180px] rounded-full border-2 border-white" style={{ animation: 'blink-middle 3s ease-in-out infinite' }}></div>
                <div className="center-xy w-[120px] h-[120px] rounded-full border-2 border-white" style={{ animation: 'blink-inner 3s ease-in-out infinite' }}></div>

                <div className="center-xy w-[100px] h-[100px] border border-white rounded-full flex flex-col items-center justify-center bg-black/90 text-white">
                    <div {...getInteractionProps('text_content.focusTitle')} className={`text-[10px] mb-1 pointer-events-auto ${isEditable ? getInteractionProps('text_content.focusTitle').className : ''}`}>{txt.focusTitle || "對焦"}</div>
                    <div className="text-2xl font-bold">{Math.round(focusProgress * 100)}<span className="text-[10px]">%</span></div>
                </div>

                <div className="absolute bottom-12 w-full text-center text-white">
                    <div {...getInteractionProps('text_content.focusHint')} className={`text-[10px] opacity-70 pointer-events-auto ${isEditable ? getInteractionProps('text_content.focusHint').className : ''}`}>{txt.focusHint || "[ 旋轉對焦 ]"}</div>
                </div>
            </div>

            {/* 8. REVEAL - ORIGINAL KeyholeViewer Logic Preserved */}
            <div id="state-REVEAL" className={`state-layer ${step === STEPS.REVEAL ? 'active' : ''}`} style={{ zIndex: 50 }}>
                {step === STEPS.REVEAL && historyImage && (
                    <div className="absolute inset-0 rounded-full bg-black">
                        <KeyholeViewer imageSrc={historyImage} position={orientation} />

                        <div className="absolute bottom-16 w-full text-center z-30 pointer-events-none">
                            <div className="text-[12px] text-white/70 tracking-widest animate-pulse font-mono">
                                傾斜看見更多細節
                            </div>
                        </div>

                        {/* Overlay Click-to-Reset */}
                        <div className="absolute bottom-6 w-full text-center z-30 pointer-events-auto">
                            <div
                                className={`text-[10px] bg-black text-white px-3 py-1 rounded-full border border-white/20 inline-block cursor-pointer pointer-events-auto ${isEditable ? getInteractionProps('text_content.revealHint').className : ''}`}
                                onClick={(e) => {
                                    if (isEditable) {
                                        getInteractionProps('text_content.revealHint').onClick!(e);
                                        return;
                                    }
                                    e.stopPropagation();
                                    onTrigger();
                                }}
                            >
                                {txt.revealHint || "探測下一則歷史"}
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
