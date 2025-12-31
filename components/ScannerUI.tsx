import React, { useState, useEffect } from 'react';
import { Scan, Zap, Activity, Globe, Disc, ShieldCheck } from 'lucide-react';

interface ScannerUIProps {
    isScanning: boolean;
    isAnalyzing: boolean;
    onScan: () => void;
    statusText?: string;
    children?: React.ReactNode;
}

const DecodingText = ({ text, isAnalyzing }: { text: string; isAnalyzing: boolean }) => {
    const [display, setDisplay] = useState(text);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&*";

    useEffect(() => {
        if (!isAnalyzing) {
            setDisplay(text);
            return;
        }

        let iteration = 0;
        const interval = setInterval(() => {
            setDisplay(
                text
                    .split("")
                    .map((char, index) => {
                        if (index < iteration) return text[index];
                        return chars[Math.floor(Math.random() * chars.length)];
                    })
                    .join("")
            );

            if (iteration >= text.length) {
                clearInterval(interval);
            }

            iteration += 1 / 3;
        }, 30);

        return () => clearInterval(interval);
    }, [isAnalyzing, text]);

    return <span className="font-mono tracking-widest text-[#00ff9d]">{display}</span>;
};

const DataRing = ({ isAnalyzing }: { isAnalyzing: boolean }) => {
    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none flex items-center justify-center">
            {/* Tech Accents - Simplified for Performance & Max View */}
            <svg viewBox="0 0 100 100" className="w-full h-full absolute">
                {/* Static Outer Rim - Thin & Crisp */}
                <circle cx="50" cy="50" r="48" stroke="#00ff9d" strokeWidth="0.5" fill="none" opacity="0.6" />

                {/* Rotating Elements - Only if Analyzing to save GPU on idle */}
                {isAnalyzing ? (
                    <g className="animate-spin-slow-reverse origin-center">
                        <path d="M50 2 A48 48 0 0 1 98 50" stroke="#00ff9d" strokeWidth="1" fill="none" strokeDasharray="4 4" opacity="0.8" />
                        <path d="M50 98 A48 48 0 0 1 2 50" stroke="#00ff9d" strokeWidth="1" fill="none" strokeDasharray="4 4" opacity="0.8" />
                    </g>
                ) : (
                    // Static marks when idle for max performance
                    <>
                        <path d="M50 4 L50 8" stroke="#00ff9d" strokeWidth="2" opacity="0.5" />
                        <path d="M50 92 L50 96" stroke="#00ff9d" strokeWidth="2" opacity="0.5" />
                        <path d="M4 50 L8 50" stroke="#00ff9d" strokeWidth="2" opacity="0.5" />
                        <path d="M92 50 L96 50" stroke="#00ff9d" strokeWidth="2" opacity="0.5" />
                    </>
                )}
            </svg>

            {/* Active Analysis - Simplified overlay */}
            {isAnalyzing && (
                <svg viewBox="0 0 100 100" className="w-full h-full absolute animate-spin-slow">
                    <circle cx="50" cy="50" r="42" stroke="#00ff9d" strokeWidth="0.5" fill="none" strokeDasharray="20 20" opacity="0.5" />
                </svg>
            )}
        </div>
    );
};

export default function ScannerUI({ isScanning, isAnalyzing, onScan, statusText = "SYSTEM ONLINE", children }: ScannerUIProps) {
    const getStatusText = (text: string) => {
        if (text === "SYSTEM ONLINE") return "系統待機";
        if (text === "TARGET LOCKED") return "鎖定目標";
        if (text === "SIGNAL DETECTED") return "訊號接近";
        return text;
    };

    return (
        <div className="relative w-full h-full overflow-hidden bg-transparent text-[#00ff9d] font-mono select-none">

            {/* FULL SCREEN CAMERA VIEW - No Background Blockers */}
            <DataRing isAnalyzing={isAnalyzing} />

            {/* Center Content Slot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full z-30 pointer-events-none flex items-center justify-center">
                <div className="pointer-events-auto">
                    {children}
                </div>
            </div>

            {/* Top Status - Minimal & Clean */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-center z-10 w-full">
                <div className="text-xs font-bold tracking-[0.2em] text-[#00ff9d] drop-shadow-md bg-black/40 px-3 py-1 rounded-full inline-block backdrop-blur-sm border border-[#00ff9d]/30">
                    {isAnalyzing ? "數據解析中..." : getStatusText(statusText)}
                </div>
            </div>

            {/* Left Data - Pushed to absolute edge, minimal text */}
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 hidden md:block z-10">
                <div className="flex flex-col space-y-8 text-[9px] opacity-80 font-bold tracking-widest text-[#00ff9d]">
                    <div className="bg-black/80 px-1 py-0.5 rounded border-l-2 border-[#00ff9d]">感測</div>
                    <div className="bg-black/80 px-1 py-0.5 rounded border-l-2 border-[#00ff9d]">定位</div>
                    <div className="bg-black/80 px-1 py-0.5 rounded border-l-2 border-[#00ff9d]">能源</div>
                </div>
            </div>

            {/* Right Data */}
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 hidden md:block z-10">
                <div className="flex flex-col space-y-8 text-[9px] text-right opacity-80 font-bold tracking-widest text-[#00ff9d]">
                    <div className="bg-black/80 px-1 py-0.5 rounded border-r-2 border-[#00ff9d]">資料庫</div>
                    <div className="bg-black/80 px-1 py-0.5 rounded border-r-2 border-[#00ff9d]">視覺AI</div>
                    <div className="bg-black/80 px-1 py-0.5 rounded border-r-2 border-[#00ff9d]">語音</div>
                </div>
            </div>

            {/* Center Focus Brackets - Only relevant when locked/analyzing */}
            {!isAnalyzing && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-[#00ff9d]/30 rounded-full pointer-events-none opacity-50" />
            )}

            {/* Analysis Focus Effect - Simplified */}
            {isAnalyzing && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] border-2 border-[#00ff9d] rounded-full pointer-events-none animate-pulse opacity-80" />
            )}

            {/* Bottom Interaction Area - Moved down to maximize center view */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 text-center w-full">
                {/* Decoding Text - Only show when necessary */}
                {isAnalyzing && (
                    <div className="h-4 mb-2 text-[#00ff9d] font-bold text-xs bg-black/50 inline-block px-2 rounded tracking-widest">
                        <DecodingText text="正在解碼..." isAnalyzing={isAnalyzing} />
                    </div>
                )}

                {/* Main Action Button - Transparent center to see thru if needed */}
                <button
                    onClick={onScan}
                    disabled={isAnalyzing}
                    className={`
                        relative px-8 py-3 rounded-full 
                        border border-[#00ff9d] bg-black/60 backdrop-blur-sm
                        active:scale-95 transition-transform duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                        group
                    `}
                >
                    <span className="font-bold text-lg tracking-widest text-[#00ff9d] group-hover:text-white transition-colors">
                        {isAnalyzing ? "解析中" : "開始掃描"}
                    </span>
                </button>
            </div>

            {/* Decor Corners */}
            <div className="absolute top-10 left-10 w-4 h-4 border-t-2 border-l-2 border-[#00ff9d]"></div>
            <div className="absolute top-10 right-10 w-4 h-4 border-t-2 border-r-2 border-[#00ff9d]"></div>
            <div className="absolute bottom-10 left-10 w-4 h-4 border-b-2 border-l-2 border-[#00ff9d]"></div>
            <div className="absolute bottom-10 right-10 w-4 h-4 border-b-2 border-r-2 border-[#00ff9d]"></div>

        </div>
    );
}
