import React, { useEffect, useState } from 'react';
import { Activity, Disc, Globe, ShieldCheck } from 'lucide-react';

interface ScannerUIProps {
    step: string; // 'BOOT' | 'PROXIMITY' | 'LOCKED' | 'TUNING' | 'ANALYZING' | 'LISTEN' | 'FOCUSING' | 'REVEAL'
    onScan: () => void;
    // Data Props
    proximityDistance?: number; // e.g., 0.8
    tuningValues?: { timeScale: number; historyScale: number };
    activeParameter?: 'time' | 'history'; // New Prop for Active Ring
    analysisProgress?: number; // 0-100
    artifactName?: string;
    scriptText?: string;
    focusProgress?: number;
    resultImage?: string | null;
}

export default function ScannerUI({
    step,
    onScan,
    proximityDistance = 0.8,
    tuningValues = { timeScale: 1, historyScale: 1 },
    activeParameter = 'time',
    analysisProgress = 0,
    artifactName = "Unknown Artifact",
    scriptText = "",
    focusProgress = 0,
    resultImage
}: ScannerUIProps) {

    // Internal ticker for random UI numbers
    const [ticker, setTicker] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTicker(prev => (prev + 1) % 100);
        }, 200);
        return () => clearInterval(interval);
    }, []);

    // Helper for Time Scale Label in Tuning
    // Display: 01 - 05
    const getTimeScaleLabel = (val: number) => {
        return "0" + val;
    };

    // Helper for History Fidelity Label
    // Display: HIGH / MID / LOW
    const getHistoryLabel = (val: number) => {
        if (val === 3) return "HIGH";
        if (val === 2) return "MID";
        return "LOW";
    };

    return (
        <div className="relative w-full h-full text-white font-mono pointer-events-none">

            {/* --- STATE: BOOT (系統啟動) --- */}
            {step === 'BOOT' && (
                <div className="absolute inset-0 animate-in fade-in duration-500">
                    <div className="center-xy">
                        {/* Pulse Ring */}
                        <div className="absolute w-[180px] h-[180px] border border-white rounded-full opacity-60 animate-ping-custom"></div>
                        {/* OS Logo */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="text-3xl font-black tracking-tighter">OS</div>
                            <div className="text-[10px] tracking-widest border-t border-white pt-1">正在探測歷史訊號</div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- STATE: PROXIMITY (訊號偵測) --- */}
            {step === 'PROXIMITY' && (
                <div className="absolute inset-0 animate-in fade-in duration-300">
                    {/* Double Ripple Radar */}
                    <div className="center-xy">
                        <div className="absolute w-[120px] h-[120px] bg-white/20 rounded-full animate-ping-custom"></div>
                    </div>
                    <div className="center-xy">
                        <div className="absolute w-[200px] h-[200px] border border-white/40 rounded-full animate-ping-custom" style={{ animationDelay: '0.4s' }}></div>
                    </div>

                    {/* Center Info */}
                    <div className="center-xy flex flex-col items-center bg-black/60 p-4 rounded-full backdrop-blur-[2px] border border-white/10">
                        <div className="text-xl font-bold tracking-tight">訊號偵測</div>
                        <div className="text-[9px] tracking-widest mt-1 opacity-80">接近目標中</div>
                    </div>

                    {/* Distance Metric */}
                    <div className="absolute bottom-16 left-0 right-0 text-center">
                        <span className="text-2xl font-bold">{(0.3 + (ticker / 100)).toFixed(1)}</span>
                        <span className="text-[9px] ml-1">M</span>
                    </div>
                </div>
            )}

            {/* --- STATE: LOCKED (鎖定目標) --- */}
            {step === 'LOCKED' && (
                <div className="absolute inset-0 animate-in fade-in duration-200">
                    {/* Arcs via clip-path */}
                    <div className="center-xy w-[240px] h-[240px]">
                        {/* Top Arc */}
                        <div className="absolute inset-0 border-2 border-white rounded-full" style={{ clipPath: 'inset(0 0 80% 0)' }}></div>
                        {/* Bottom Arc */}
                        <div className="absolute inset-0 border-2 border-white rounded-full" style={{ clipPath: 'inset(80% 0 0 0)' }}></div>
                        {/* Left Bracket */}
                        <div className="absolute inset-0 border-l-2 border-white rounded-full" style={{ clipPath: 'inset(25% 0 25% 0)' }}></div>
                        {/* Right Bracket */}
                        <div className="absolute inset-0 border-r-2 border-white rounded-full" style={{ clipPath: 'inset(25% 0 25% 0)' }}></div>
                    </div>

                    {/* Center Target */}
                    <div className="center-xy w-2 h-2 bg-white rounded-full animate-pulse"></div>

                    {/* Status Label */}
                    <div className="absolute top-[32%] w-full text-center">
                        <span className="bg-white text-black px-2 py-0.5 text-[10px] font-bold tracking-widest rounded-sm">鎖定目標</span>
                    </div>

                    {/* Action Prompt */}
                    <div className="absolute bottom-[28%] w-full text-center">
                        <div className="text-[10px] tracking-widest animate-bounce">[ 按下快門捕捉 ]</div>
                    </div>
                </div>
            )}

            {/* --- STATE: TUNING (參數調整) --- */}
            {step === 'TUNING' && (
                <div className="absolute inset-0 animate-in fade-in bg-black/80 backdrop-blur-[1px]">
                    <div className="center-xy w-[280px] h-[280px]">

                        {/* === Outer Ring: Time Scale === */}
                        <div className={`absolute inset-0 transition-opacity duration-300 ${activeParameter === 'time' ? 'opacity-100' : 'opacity-30'}`}>
                            {/* CSS Ticks via Repeating Conic Gradient */}
                            <div className="absolute inset-0 rounded-full"
                                style={{
                                    background: 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.8) 0deg 2deg, transparent 2deg 10deg)',
                                    maskImage: 'radial-gradient(transparent 65%, black 66%)', // Ring mask
                                    WebkitMaskImage: 'radial-gradient(transparent 65%, black 66%)',
                                }}>
                            </div>

                            {/* Value Fill */}
                            <div className="absolute inset-0 rounded-full"
                                style={{
                                    background: `conic-gradient(white 0deg ${tuningValues.timeScale * 72}deg, transparent 0deg)`,
                                    WebkitMaskImage: 'radial-gradient(transparent 65%, black 66%)',
                                    maskImage: 'radial-gradient(transparent 65%, black 66%)',
                                    mixBlendMode: 'overlay'
                                }}></div>

                            {/* Active Indicator (Glow when active) */}
                            {activeParameter === 'time' && (
                                <div className="absolute inset-[-5px] rounded-full border border-white/50 animate-pulse"></div>
                            )}
                        </div>

                        {/* === Inner Ring: History Scale === */}
                        <div className={`absolute inset-[35px] transition-opacity duration-300 ${activeParameter === 'history' ? 'opacity-100' : 'opacity-30'}`}>
                            {/* CSS Ticks */}
                            <div className="absolute inset-0 rounded-full"
                                style={{
                                    background: 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.8) 0deg 2deg, transparent 2deg 30deg)',
                                    maskImage: 'radial-gradient(transparent 60%, black 61%)',
                                    WebkitMaskImage: 'radial-gradient(transparent 60%, black 61%)',
                                    transform: 'rotate(180deg)'
                                }}>
                            </div>

                            {/* Value Fill */}
                            <div className="absolute inset-0 rounded-full"
                                style={{
                                    background: `conic-gradient(white 0deg ${tuningValues.historyScale * 120}deg, transparent 0deg)`,
                                    WebkitMaskImage: 'radial-gradient(transparent 60%, black 61%)',
                                    maskImage: 'radial-gradient(transparent 60%, black 61%)',
                                    transform: 'rotate(180deg)'
                                }}></div>

                            {/* Active Indicator */}
                            {activeParameter === 'history' && (
                                <div className="absolute inset-[-5px] rounded-full border border-white/50 animate-pulse"></div>
                            )}
                        </div>

                        {/* Center Values Overlay (Integrated) */}
                        <div className="center-xy flex flex-col items-center gap-4 z-20">
                            {/* Top Value (TimeScale) */}
                            <div className={`flex flex-col items-center pt-2 transition-opacity duration-300 ${activeParameter === 'time' ? 'opacity-100' : 'opacity-40'}`}>
                                <span className="text-[9px] tracking-widest mb-0.5">時間軸</span>
                                <span className="text-3xl font-bold tracking-tighter">{getTimeScaleLabel(tuningValues.timeScale)}</span>
                            </div>

                            {/* Divider */}
                            <div className="w-8 h-[1px] bg-white/30"></div>

                            {/* Bottom Value (HistoryScale) */}
                            <div className={`flex flex-col items-center pb-2 transition-opacity duration-300 ${activeParameter === 'history' ? 'opacity-100' : 'opacity-40'}`}>
                                <span className="text-[9px] tracking-widest mb-0.5">史實度</span>
                                <span className="text-xl font-bold tracking-tighter">{getHistoryLabel(tuningValues.historyScale)}</span>
                            </div>
                        </div>

                    </div>

                    {/* Helper Prompt */}
                    <div className="absolute bottom-16 w-full text-center">
                        <div className="text-[9px] opacity-50 tracking-widest animate-pulse">
                            [ ⟵ 調頻 ⟶ ] [ ↕ 切換 ]
                        </div>
                    </div>
                </div>
            )}

            {/* 5. ANALYZING (解析) */}
            {step === 'ANALYZING' && (
                <div className="absolute inset-0 animate-in fade-in">
                    {/* Rotating Rings */}
                    <div className="center-xy">
                        <div className="absolute w-[200px] h-[200px] border-t-2 border-white rounded-full animate-spin-slow"></div>
                        <div className="absolute w-[180px] h-[180px] border-b-2 border-white/50 rounded-full animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }}></div>
                    </div>

                    {/* Center Progress Pulse */}
                    <div className="center-xy flex flex-col items-center bg-black/50 p-6 rounded-full backpack-blur-sm">
                        <div className="text-2xl font-black animate-pulse">{analysisProgress}%</div>
                        <div className="text-[9px] tracking-widest mt-1">數據解析中</div>
                        {/* Optional: Show what is happening */}
                        <div className="text-[8px] opacity-50 mt-1">歷史訊號重構...</div>
                    </div>
                </div>
            )}

            {/* 6. LISTEN (聆聽) */}
            {step === 'LISTEN' && (
                <div className="absolute inset-0 animate-in fade-in duration-1000">
                    <div className="absolute inset-0 bg-black/40"></div>
                    {/* Subtitles at bottom */}
                    <div className="absolute bottom-12 left-6 right-6 text-center">
                        <p className="text-sm font-medium leading-relaxed drop-shadow-md bg-black/50 p-2 rounded-lg">
                            {scriptText || "..."}
                        </p>
                    </div>

                    {/* Play Indicator */}
                    <div className="absolute top-8 right-8 animate-pulse">
                        <div className="flex gap-1">
                            <div className="w-1 h-3 bg-white"></div>
                            <div className="w-1 h-3 bg-white"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. FOCUSING (對焦) */}
            {step === 'FOCUSING' && (
                <div className="absolute inset-0 animate-in fade-in">
                    {/* Rotational Guide */}
                    <div className="center-xy w-[280px] h-[280px] opacity-50">
                        <div className="absolute inset-0 border border-white/30 rounded-full border-dashed"></div>
                        {/* Focus Marker */}
                        <div className="absolute top-0 left-1/2 w-1 h-4 bg-red-500 -translate-x-1/2 -translate-y-2"></div>
                    </div>

                    {/* Dynamic Rotation Helper */}
                    <div
                        className="center-xy w-[280px] h-[280px] transition-transform duration-75 ease-out"
                        style={{ transform: `translate(-50%, -50%) rotate(${focusProgress * 180}deg)` }} // Visual feedback
                    >
                        <div className="absolute top-0 left-1/2 w-4 h-4 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 bg-black"></div>
                    </div>

                    {/* Center Status */}
                    <div className="center-xy">
                        <div className="text-[10px] bg-black px-2 py-1 border border-white">
                            對焦中 {Math.round(focusProgress)}%
                        </div>
                    </div>
                </div>
            )}

            {/* 8. REVEAL (影像還原完成) */}
            {step === 'REVEAL' && (
                <div className="absolute inset-0 animate-in zoom-in duration-1000">
                    {/* Keyhole Mask - Thick Borders used to create keyhole */}
                    <div className="absolute inset-0 border-[100px] border-black rounded-full pointer-events-none transition-all duration-1000"
                        style={{ borderWidth: '0px' }}> {/* Animate border to 0 to Reveal full image? Or keep keyhole? User said "Keyhole effect" */}
                        {/* Actually, user prototype had a static keyhole or expanding? 
                            "Keyhole effect using very thick border"
                            Let's keep a subtle vignette or keyhole frame
                        */}
                    </div>

                    {/* Info Overlay */}
                    <div className="absolute top-1/4 left-0 right-0 text-center pointer-events-none">
                        <div className="inline-block border border-white/50 bg-black/60 px-3 py-1 backdrop-blur-md">
                            <h2 className="text-xl font-bold tracking-wider">{artifactName}</h2>
                            <div className="w-full h-[1px] bg-white/50 my-1"></div>
                            <div className="text-[9px] tracking-widest">影像還原完成</div>
                        </div>
                    </div>

                    {/* Reset Prompt */}
                    <div className="absolute bottom-12 w-full text-center pointer-events-auto">
                        <div className="text-[9px] animate-bounce cursor-pointer opacity-80" onClick={onScan}>
                            [ 點擊重置系統 ]
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
