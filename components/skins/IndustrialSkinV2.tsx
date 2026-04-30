import React from 'react';
import { STEPS, DEFAULT_CONFIG, TIME_SCALE_LABELS, HISTORY_SCALE_LABELS } from '../../lib/defaults';
import { Volume2, VolumeX, Crosshair, Activity, Zap, Signal } from 'lucide-react';
import { KeyholeViewer } from '../KeyholeViewer';
import { HardwareHints } from '../HardwareHints';
import { ScannerSkinPropsV2 } from '../../types/scanner_v2';

export default function IndustrialSkinV2(props: ScannerSkinPropsV2) {
    const {
        step,
        config,
        isEditable,
        onEdit,
        onTrigger,
        onWheel,
        toggleAudio,
        artifactName,
        analysisText,
        scriptPages,
        scriptPage,
        isProcessing,
        isPlayingAudio,
        focusRotation,
        historyScale,
        timeScale,
        historyImage,
        orientation,
        children
    } = props;

    const txt = config.text_content || DEFAULT_CONFIG.text_content;
    const ui = config.ui_theme || DEFAULT_CONFIG.ui_theme;
    const primaryColor = ui.primary_color || "text-lime-400";

    // --- Styling Helpers ---
    const getColorStyle = (fallbackClass: string = "text-lime-400") => {
        const color = primaryColor;
        const isCustom = color.startsWith('#') || color.startsWith('rgb');
        return {
            className: isCustom ? '' : color,
            style: isCustom ? { color: color, borderColor: color, backgroundColor: color } : undefined
        };
    };

    const colorStyle = getColorStyle();

    const getInteractionProps = (fieldKey: string) => {
        if (!isEditable) return {};
        return {
            onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                if (onEdit) onEdit(fieldKey);
            },
            className: "cursor-pointer hover:bg-white/10 hover:outline hover:outline-1 hover:outline-dashed hover:outline-yellow-400 rounded px-1 z-50 transition-all",
        };
    };

    const focusProgress = Math.min(Math.abs(focusRotation) / 100, 1);
    const currentScriptPageText = scriptPages && scriptPages[scriptPage] ? scriptPages[scriptPage] : "...";

    // Determine Hardware Hint States based on current step
    const getHintStates = () => {
        switch (step) {
            case STEPS.BOOT:
                return { leftRight: false, dial: false, confirm: true };
            case STEPS.PROXIMITY:
                return { leftRight: false, dial: false, confirm: true };
            case STEPS.LOCKED:
                return { leftRight: false, dial: false, confirm: true };
            case STEPS.TUNING:
                return { leftRight: true, dial: true, confirm: true };
            case STEPS.ANALYZING:
                return { leftRight: false, dial: false, confirm: false };
            case STEPS.LISTEN:
                const isLastPage = scriptPages && scriptPage === scriptPages.length - 1;
                return { leftRight: true, dial: false, confirm: isLastPage };
            case STEPS.FOCUSING:
                return { leftRight: false, dial: true, confirm: true };
            case STEPS.REVEAL:
                return { leftRight: false, dial: false, confirm: true };
            default:
                return { leftRight: false, dial: false, confirm: false };
        }
    };
    const hintStates = getHintStates();

    // --- V2 Container Style with Mac Fix ---
    const v2ContainerStyle: React.CSSProperties = {
        width: '380px',
        height: '380px',
        background: 'var(--bg, #000)',
        borderRadius: '50%',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 0 0 2px #333, 0 0 0 10px #000',

        // THE FIX: Strict Masking for Safari/Mac
        transform: 'translateZ(0)', // Force GPU
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        maskImage: 'radial-gradient(white, black)',
        isolation: 'isolate'
    };

    return (
        <div
            className="cursor-pointer camera-layer flex items-center justify-center bg-black"
            style={v2ContainerStyle}
            onClick={step !== STEPS.TUNING && step !== STEPS.FOCUSING ? onTrigger : undefined}
            onWheel={step === STEPS.FOCUSING ? onWheel : undefined}
        >
            {/* LAYER 0: Background/Video */}
            {children}

            {/* Hardware operation hints */}
            <HardwareHints
                activeLeftRight={hintStates.leftRight}
                activeDial={hintStates.dial}
                activeConfirm={hintStates.confirm}
                colorClass={colorStyle.className}
            />

            {/* Industrial Overlay Grid - Fits inside 380px Circle */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                {/* Vintage Terminal Scanlines - Stronger */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_1px] opacity-20"></div>

                {/* Vignette to emphasize circular viewport */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,black_100%)]"></div>

                {/* Crosshairs & HUD Elements - Gemini Star Shape (Transparent Block, No Blur for Performance) */}
                {/* Hides during REVEAL step to clear the background for results */}
                {/* Stepped Opacity Animation */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                        @keyframes stepped-opacity-industrial { 
                            0% { opacity: 0.1; } 
                            33% { opacity: 0.3; } 
                            66% { opacity: 0.6; } 
                            100% { opacity: 0.1; } 
                        }
                    `
                }} />

                {/* Central Gemini star - static opacity, no blinking */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] ${step === STEPS.REVEAL ? 'opacity-0' : 'opacity-20'} ${colorStyle.className}`} style={{ color: colorStyle.style?.color }}>
                    <svg viewBox="0 0 100 100" className="w-full h-full fill-current stroke-none">
                        <path d="M50 0 C50 25, 25 50, 0 50 C25 50, 50 75, 50 100 C50 75, 75 50, 100 50 C75 50, 50 25, 50 0 Z" />
                    </svg>
                </div>

                {/* Corner Stars - All blinking with clockwise delays */}
                {/* Top-left corner */}
                <div className={`absolute top-12 left-12 w-4 h-4 ${colorStyle.className}`} style={{ color: colorStyle.style?.color, animation: 'stepped-opacity-industrial 3s steps(1) infinite 2.625s' }}>
                    <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" /></svg>
                </div>
                {/* Top-right corner */}
                <div className={`absolute top-12 right-12 w-4 h-4 ${colorStyle.className}`} style={{ color: colorStyle.style?.color, animation: 'stepped-opacity-industrial 3s steps(1) infinite 0.375s' }}>
                    <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" /></svg>
                </div>
                {/* Bottom-left corner */}
                <div className={`absolute bottom-12 left-12 w-4 h-4 ${colorStyle.className}`} style={{ color: colorStyle.style?.color, animation: 'stepped-opacity-industrial 3s steps(1) infinite 1.875s' }}>
                    <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" /></svg>
                </div>
                {/* Bottom-right corner */}
                <div className={`absolute bottom-12 right-12 w-4 h-4 ${colorStyle.className}`} style={{ color: colorStyle.style?.color, animation: 'stepped-opacity-industrial 3s steps(1) infinite 1.125s' }}>
                    <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" /></svg>
                </div>

                {/* Cardinal Stars (Top/Bottom/Left/Right) - All blinking with clockwise delays */}
                {/* Top */}
                <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 ${colorStyle.className}`} style={{ top: '-7.5px', color: colorStyle.style?.color, animation: 'stepped-opacity-industrial 3s steps(1) infinite' }}>
                    <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" /></svg>
                </div>
                {/* Bottom */}
                <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 ${colorStyle.className}`} style={{ bottom: '-7.5px', color: colorStyle.style?.color, animation: 'stepped-opacity-industrial 3s steps(1) infinite 1.5s' }}>
                    <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" /></svg>
                </div>
                {/* Left */}
                <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 ${colorStyle.className}`} style={{ left: '-7.5px', color: colorStyle.style?.color, animation: 'stepped-opacity-industrial 3s steps(1) infinite 2.25s' }}>
                    <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" /></svg>
                </div>
                {/* Right */}
                <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 ${colorStyle.className}`} style={{ right: '-7.5px', color: colorStyle.style?.color, animation: 'stepped-opacity-industrial 3s steps(1) infinite 0.75s' }}>
                    <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" /></svg>
                </div>

                {/* Top Status Bar */}
                <div className="absolute top-6 w-full flex justify-center items-center gap-2 opacity-80">
                    <Activity size={10} className={colorStyle.className} style={{ color: colorStyle.style?.color }} />
                    <span {...getInteractionProps('text_content.title')} className={`text-[9px] text-white ${colorStyle.className}`} style={{ color: colorStyle.style?.color }}>
                        {txt.title || "A.InSight"}
                    </span>
                </div>
            </div>

            {/* LAYER 2: Content States */}

            {/* BOOT */}
            {/* BOOT */}
            <div className={`absolute inset-0 ${step === STEPS.BOOT ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
                {/* Title: Perfectly Centered */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-end gap-1">
                    <span {...getInteractionProps('text_content.bootText')} className={`text-2xl font-black tracking-tighter whitespace-nowrap pointer-events-auto ${colorStyle.className} ${isEditable ? getInteractionProps('text_content.bootText').className : ''}`} style={{ color: colorStyle.style?.color }}>{txt.bootText || "正在探測歷史訊號"}</span>
                </div>
                {/* Subtext: Positioned below center */}
                <div {...getInteractionProps('text_content.bootSubtext')} className={`absolute top-1/2 left-1/2 -translate-x-1/2 mt-8 text-sm font-bold tracking-widest text-center w-full pointer-events-auto ${isEditable ? getInteractionProps('text_content.bootSubtext').className : ''}`}>
                    {txt.bootSubtext || "尋找中..."}
                </div>
            </div>

            {/* PROXIMITY */}
            {/* PROXIMITY */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${step === STEPS.PROXIMITY ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>

                {/* CSS Animation for Running Line - Removed */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    /* Animation removed for performance */
                 `}} />


                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                    {/* Match Classic: Title and Subtext */}
                    <div {...getInteractionProps('text_content.proximityTitle')} className={`text-xl font-bold pointer-events-auto ${isEditable ? getInteractionProps('text_content.proximityTitle').className : ''}`}>{txt.proximityTitle || "訊號偵測"}</div>
                    <div {...getInteractionProps('text_content.proximitySubtext')} className={`text-[9px] border-t border-white/50 w-full pt-1 mt-1 text-center pointer-events-auto ${isEditable ? getInteractionProps('text_content.proximitySubtext').className : ''}`}>{txt.proximitySubtext || "接近目標中"}</div>
                </div>
                <div className="absolute bottom-16 w-full text-center text-white">
                    <span className="text-2xl font-bold font-mono">0.8</span>
                    <span className="text-[9px] ml-1">M</span>
                </div>
            </div>

            {/* LOCKED */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${step === STEPS.LOCKED ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
                {/* Solid Star Removed as requested */}
                {/* Solid Star Removed as requested */}
                {/* Centered and Enlarged Title */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <div {...getInteractionProps('text_content.lockedTitle')} className={`text-xl px-2 inline-block rounded-sm font-bold border bg-black/90 pointer-events-auto ${colorStyle.className} ${isEditable ? getInteractionProps('text_content.lockedTitle').className : ''}`}
                        style={{ color: colorStyle.style?.color, borderColor: colorStyle.style?.color }}>
                        {txt.lockedTitle || "鎖定目標"}
                    </div>
                </div>
                <div className="absolute bottom-[30%] w-full text-center text-white">
                    <div {...getInteractionProps('text_content.lockedSubtext')} className={`text-[10px] pointer-events-auto ${isEditable ? getInteractionProps('text_content.lockedSubtext').className : ''}`}>{txt.lockedSubtext || "[ 按下快門捕捉 ]"}</div>
                </div>
            </div>

            {/* TUNING - Vertical Sliders */}
            <div className={`absolute inset-0 flex items-center justify-center gap-8 bg-black/90 ${step === STEPS.TUNING ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
                {/* Time Scale Slider */}
                <div className={`flex flex-col items-center gap-2 ${colorStyle.className}`} style={{ color: colorStyle.style?.color }}>
                    <span {...getInteractionProps('text_content.tuningRingOuter')} className={`text-[8px] tracking-widest opacity-70 pointer-events-auto ${isEditable ? getInteractionProps('text_content.tuningRingOuter').className : ''}`}>{txt.tuningRingOuter || "TIME"}</span>
                    <div className="w-8 h-32 border border-current/30 relative bg-black/50">
                        {/* Split Opacity Fill: Left 10% vs Right 40% (Theme Color) */}
                        <div className="absolute bottom-0 left-0 w-full transition-all duration-300" style={{ height: `${(timeScale / 9) * 100}%` }}>
                            <div className="absolute left-0 top-0 w-1/2 h-full bg-current/10"></div>
                            <div className="absolute right-0 top-0 w-1/2 h-full bg-current/40"></div>
                        </div>
                        {/* Indicator Line - No Glow */}
                        <div className="absolute left-0 w-full h-[2px] bg-current transition-all duration-300" style={{ bottom: `${(timeScale / 9) * 100}%` }}></div>
                    </div>
                    <span className="text-xl font-bold font-mono">{TIME_SCALE_LABELS[timeScale] || TIME_SCALE_LABELS[3]}</span>
                </div>

                {/* History Slider */}
                <div className={`flex flex-col items-center gap-2 ${colorStyle.className}`} style={{ color: colorStyle.style?.color }}>
                    <span {...getInteractionProps('text_content.tuningRingInner')} className={`text-[8px] tracking-widest opacity-70 pointer-events-auto ${isEditable ? getInteractionProps('text_content.tuningRingInner').className : ''}`}>{txt.tuningRingInner || "DATA"}</span>
                    <div className="w-8 h-32 border border-current/30 relative bg-black/50">
                        {/* Split Opacity Fill: Left 10% vs Right 40% (Theme Color) */}
                        <div className="absolute bottom-0 left-0 w-full transition-all duration-300" style={{ height: `${(historyScale / 3) * 100}%` }}>
                            <div className="absolute left-0 top-0 w-1/2 h-full bg-current/10"></div>
                            <div className="absolute right-0 top-0 w-1/2 h-full bg-current/40"></div>
                        </div>
                        <div className="absolute left-0 w-full h-[2px] bg-current transition-all duration-300" style={{ bottom: `${(historyScale / 3) * 100}%` }}></div>
                    </div>
                    <span className="text-lg font-bold font-mono">{HISTORY_SCALE_LABELS[historyScale] || HISTORY_SCALE_LABELS[2]}</span>
                </div>
            </div>

            {/* ANALYZING */}
            {/* ANALYZING */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${step === STEPS.ANALYZING ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
                <div className="center-xy flex flex-col text-center bg-black/80 p-4 rounded-full text-white">
                    <div {...getInteractionProps('text_content.analyzingTitle')} className={`text-sm font-bold mb-1 pointer-events-auto ${isEditable ? getInteractionProps('text_content.analyzingTitle').className : ''}`}>{txt.analyzingTitle || "解析中"}</div>
                    <div className="text-[9px] opacity-60 text-stone-300">{analysisText}</div>
                    <div className="mt-2 font-mono text-xl">{isProcessing ? "..." : "解析完成"}</div>
                </div>
            </div>

            {/* LISTEN / RESULT */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 bg-black/85 ${step === STEPS.LISTEN ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
                <div className={`w-full border-b py-2 mb-4 text-center ${colorStyle.className}`} style={{ borderColor: colorStyle.style?.color }}>
                    <h2 className="text-xl font-bold">{artifactName}</h2>
                </div>

                <div className="h-[150px] overflow-y-auto w-full text-center text-sm leading-relaxed opacity-90 font-light scrollbar-hide">
                    {currentScriptPageText}
                </div>

                <div className="flex gap-1 mt-4">
                    {scriptPages.map((_, i) => (
                        <div key={i} className={`w-1 h-1 ${i === scriptPage ? 'bg-white' : 'bg-white/20'}`}></div>
                    ))}
                </div>

                <button onClick={(e) => { e.stopPropagation(); toggleAudio && toggleAudio(); }} className={`mt-4 p-2 border ${isPlayingAudio ? 'border-lime-400 text-lime-400' : 'border-red-500 text-red-500'} hover:bg-white/5`}>
                    {isPlayingAudio ? <Volume2 size={12} /> : <VolumeX size={12} />}
                </button>
            </div>

            {/* FOCUSING */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${step === STEPS.FOCUSING ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    {/* Rotating ticks */}
                    <div className="w-[300px] h-[300px] border border-dashed rounded-full" style={{ transform: `rotate(${focusRotation}deg)` }}></div>
                </div>

                <div className="relative w-[120px] h-[120px] flex items-center justify-center">
                    {/* Inner Solid Star Removed as requested */}
                    {/* Background Box Removed as requested */}
                    <div className="flex flex-col items-center">
                        <div {...getInteractionProps('text_content.focusTitle')} className={`text-[10px] mb-1 pointer-events-auto ${isEditable ? getInteractionProps('text_content.focusTitle').className : ''}`}>{txt.focusTitle || "對焦"}</div>
                        <span className="text-2xl font-bold">{Math.round(focusProgress * 100)}<span className="text-[10px]">%</span></span>
                        <div {...getInteractionProps('text_content.focusHint')} className={`text-[10px] opacity-70 mt-1 pointer-events-auto ${isEditable ? getInteractionProps('text_content.focusHint').className : ''}`}>{txt.focusHint || "[ 旋轉對焦 ]"}</div>
                    </div>
                </div>
            </div>

            {/* REVEAL */}
            <div className={`absolute inset-0 z-30 transition-opacity duration-300 ${step === STEPS.REVEAL ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                {step === STEPS.REVEAL && historyImage && (
                    <div className="w-full h-full relative">
                        <KeyholeViewer imageSrc={historyImage} position={orientation} />

                        <div className="absolute bottom-16 w-full text-center z-30 pointer-events-none">
                            <div className="text-[12px] text-white/70 tracking-widest animate-pulse font-mono">
                                傾斜看見更多細節
                            </div>
                        </div>

                        <div className="absolute bottom-8 w-full flex justify-center pointer-events-auto">
                            <button
                                onClick={(e) => { e.stopPropagation(); onTrigger && onTrigger(); }}
                                className="bg-black text-white text-[9px] font-bold px-4 py-2 border border-white hover:bg-white hover:text-black transition-colors"
                            >
                                START NEW SCAN
                            </button>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
