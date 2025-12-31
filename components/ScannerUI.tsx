
import React, { useEffect, useState } from 'react';
import { Activity, Disc, Globe, ShieldCheck } from 'lucide-react';

interface ScannerUIProps {
    step: string; // 'BOOT' | 'PROXIMITY' | 'LOCKED' | 'TUNING' | 'ANALYZING' | 'LISTEN' | 'FOCUSING' | 'REVEAL'
    onScan: () => void;
    // Data Props
    proximityDistance?: number; // e.g., 0.8
    tuningValues?: { timeScale: number; historyScale: number };
    analysisProgress?: number; // 0-100
    artifactName?: string;
    scriptText?: string;
    focusProgress?: number; // 0-100
    // Dynamic content for REVEAL state
    resultImage?: string | null;
}

export default function ScannerUI({
    step,
    onScan,
    proximityDistance = 0.8,
    tuningValues = { timeScale: 1, historyScale: 1 },
    analysisProgress = 0,
    artifactName = "Unknown Artifact",
    scriptText = "",
    focusProgress = 0,
    resultImage
}: ScannerUIProps) {

    // Internal ticker for random UI effects (like the random numbers in the HTML)
    const [ticker, setTicker] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTicker(prev => (prev + 1) % 100);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    // Helper for Time Scale Label in Tuning
    const getTimeScaleLabel = (val: number) => {
        const labels = ["", "起源", "誕生", "全盛", "遺棄", "未來"];
        return labels[val] || "L-" + val;
    };

    // Helper for History Fidelity Label
    const getHistoryLabel = (val: number) => {
        const labels = ["", "傳說", "通史", "正史"];
        return labels[val] || "Level " + val;
    };

    return (
        <div className="relative w-full h-full text-white font-mono select-none overflow-hidden">

            {/* LAYER 0: 視覺基底 - Note: The real camera video is BEHIND this component in app/page.tsx. 
               We just layer overlays here. The HTML 'bg-layer' is replaced by transparency + CSS filters if needed.
               However, we can add the 'scan-line-bg' effect here.
            */}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,0,0,0.5)_50%,rgba(0,0,0,0.5))] bg-[length:100%_4px] opacity-30 pointer-events-none"></div>

            {/* LAYER 1: 全域 HUD (Always Visible) */}
            <div className="absolute inset-0 pointer-events-none z-10">
                {/* 外部裝飾圈 */}
                <div className="center-xy w-[370px] h-[370px] border border-white/10 rounded-full"></div>
                {/* 刻度圈 */}
                <div className="center-xy w-[350px] h-[350px] border border-white/20 rounded-full animate-spin-centered"
                    style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)' }}></div>

                {/* 頂部狀態標籤 */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[9px] bg-black/80 backdrop-blur-sm border border-white/30 px-3 py-0.5 rounded-full tracking-widest">
                    A.InSight SYS.V3.2
                </div>
            </div>

            {/* LAYER 2: 狀態內容 (Conditional Rendering) */}

            {/* 1. BOOT (啟動) */}
            {step === 'BOOT' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 animate-in fade-in duration-500">
                    <div className="relative w-24 h-24 flex items-center justify-center mb-4">
                        <div className="absolute inset-0 border border-white rounded-full animate-pulse-opacity"></div>
                        <div className="absolute inset-0 border-t border-white rounded-full animate-spin-self-slow"></div>
                        <div className="text-3xl font-black tracking-tighter">系統</div>
                    </div>
                    <div className="text-sm font-bold tracking-widest mb-1">系統校正中</div>
                    <div className="text-[9px] opacity-60">感測器初始化...</div>
                </div>
            )}

            {/* 2. PROXIMITY (接近偵測) */}
            {step === 'PROXIMITY' && (
                <div className="absolute inset-0 z-20 animate-in fade-in duration-300">
                    <div className="center-xy w-[120px] h-[120px]">
                        <div className="w-full h-full bg-white/10 rounded-full animate-ping-custom"></div>
                    </div>
                    <div className="center-xy w-[180px] h-[180px]">
                        <div className="w-full h-full border border-white/30 rounded-full animate-ping-custom" style={{ animationDelay: '0.3s' }}></div>
                    </div>

                    <div className="center-xy flex flex-col items-center text-center bg-black/60 p-6 rounded-full backdrop-blur-sm border border-white/10">
                        <div className="text-xl font-bold">訊號偵測</div>
                        <div className="text-[9px] border-t border-white/50 w-full pt-1 mt-1 tracking-widest">接近目標中</div>
                    </div>

                    <div className="absolute bottom-16 w-full text-center">
                        <span className="text-2xl font-bold font-mono">{(0.3 + (ticker / 100)).toFixed(1)}</span>
                        <span className="text-[9px] ml-1">M</span>
                    </div>
                </div>
            )}

            {/* 3. LOCKED (鎖定) */}
            {step === 'LOCKED' && (
                <div className="absolute inset-0 z-20 animate-in fade-in duration-200">
                    <div className="center-xy w-[200px] h-[200px]">
                        {/* CSS Clip Path implementation for arcs */}
                        <div className="absolute inset-0 border-t-2 border-white rounded-full" style={{ clipPath: 'inset(0 20% 80% 20%)' }}></div>
                        <div className="absolute inset-0 border-b-2 border-white rounded-full" style={{ clipPath: 'inset(80% 20% 0 20%)' }}></div>
                        <div className="absolute inset-0 border-l-2 border-white/50 rounded-full" style={{ clipPath: 'inset(40% 90% 40% 0)' }}></div>
                        <div className="absolute inset-0 border-r-2 border-white/50 rounded-full" style={{ clipPath: 'inset(40% 0 40% 90%)' }}></div>
                    </div>

                    <div className="center-xy w-2 h-2 bg-white rounded-full animate-pulse"></div>

                    <div className="absolute top-[35%] w-full text-center">
                        <div className="text-[10px] bg-white text-black px-2 inline-block rounded-sm font-bold tracking-widest">鎖定目標</div>
                    </div>
                    <div className="absolute bottom-[30%] w-full text-center">
                        <div className="text-[10px] animate-bounce tracking-widest cursor-pointer" onClick={onScan}>[ 點擊掃描 ]</div>
                    </div>
                </div>
            )}

            {/* 4. TUNING (調整) - Note: The sliders are overlayed in page.tsx, this just provides the visuals behind/around them */}
            {step === 'TUNING' && (
                <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] animate-in fade-in">
                    <div className="center-xy w-[260px] h-[260px]">
                        {/* 外圈 (時空相位) */}
                        <div className="absolute inset-0">
                            <div className="absolute inset-0 rounded-full border border-white/20"></div>
                            <div className="absolute inset-0 rounded-full conic-ring-white opacity-80" style={{ maskImage: 'radial-gradient(transparent 60%, black 61%)' }}></div>
                        </div>

                        {/* 內圈 (解析精度) */}
                        <div className="absolute inset-[30px]">
                            <div className="absolute inset-0 rounded-full border border-white/20"></div>
                            <div className="absolute inset-0 rounded-full conic-ring-inner" style={{ maskImage: 'radial-gradient(transparent 60%, black 61%)' }}></div>
                        </div>

                        {/* Note: The interactive sliders are rendered as children in page.tsx, so we leave the center relatively clear or just show values */}
                        <div className="center-xy flex flex-col text-center z-10 gap-8 pointer-events-none opacity-50">
                            {/* Visual placeholders for where the sliders are */}
                        </div>
                    </div>
                    {/* Values Display for Tuning (Replaces the static text in HTML) */}
                    <div className="center-xy flex flex-col text-center z-10 gap-1 mt-1 pointer-events-none">
                        <div className="flex flex-col border-b border-white/20 pb-1 w-24">
                            <span className="text-[8px] opacity-60 tracking-widest">時空相位</span>
                            <span className="text-lg font-bold">{getTimeScaleLabel(tuningValues.timeScale)}</span>
                        </div>
                        <div className="flex flex-col w-24 pt-1">
                            <span className="text-[8px] opacity-60 tracking-widest">解析精度</span>
                            <span className="text-md font-bold text-white/90">{getHistoryLabel(tuningValues.historyScale)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. ANALYZING (解析) */}
            {step === 'ANALYZING' && (
                <div className="absolute inset-0 z-20 animate-in fade-in">
                    <div className="center-xy w-[280px] h-[280px] border border-white/10 rounded-full"></div>
                    <div className="center-xy w-[220px] h-[220px] rounded-full border-t-2 border-white animate-spin-centered"></div>
                    <div className="center-xy w-[200px] h-[200px] rounded-full border-b border-dashed border-white/50 animate-spin-centered" style={{ animationDuration: '8s', animationDirection: 'reverse' }}></div>

                    <div className="center-xy flex flex-col text-center bg-black/80 p-6 rounded-full border border-white/10">
                        <div className="text-sm font-bold mb-1 tracking-widest">解析中</div>
                        <div className="text-[9px] opacity-60">解碼歷史數據...</div>
                        <div className="mt-2 font-mono text-xl">{Math.min(99, Math.floor(ticker + (Math.random() * 10)))}%</div>
                    </div>
                </div>
            )}

            {/* 6. LISTEN (解說) */}
            {step === 'LISTEN' && (
                <div className="absolute inset-0 z-20 bg-black/90 animate-in fade-in duration-500">
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full"></div>

                    <div className="absolute top-16 w-full text-center px-4">
                        <span className="text-xl font-bold border-b border-white/50 pb-1 tracking-widest">{artifactName}</span>
                    </div>

                    <div className="center-xy w-[260px] flex items-center justify-center text-center mt-4">
                        <p className="text-sm leading-relaxed opacity-90 font-light tracking-wide line-clamp-6">
                            {scriptText || "正在下載文物資料..."}
                        </p>
                    </div>

                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2">
                        {/* Static dots for UI decoration */}
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                        <div className="w-2 h-2 bg-white/30 rounded-full"></div>
                        <div className="w-2 h-2 bg-white/30 rounded-full"></div>
                    </div>
                </div>
            )}

            {/* 7. FOCUSING (對焦) */}
            {step === 'FOCUSING' && (
                <div className="absolute inset-0 z-20 animate-in fade-in">
                    <div className="center-xy w-[280px] h-[280px] border border-white/20 rounded-full"></div>

                    <div className="center-xy w-[260px] h-[260px]">
                        <div className="absolute inset-0 rounded-full animate-spin-self-slow opacity-60"
                            style={{
                                background: 'conic-gradient(from 0deg, transparent 0%, transparent 80%, white 100%)',
                                maskImage: 'radial-gradient(transparent 68%, black 69%)'
                            }}>
                        </div>
                    </div>

                    <div className="center-xy w-[100px] h-[100px] border border-white rounded-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="text-[10px] mb-1 tracking-widest">對焦</div>
                        <div className="text-2xl font-bold">{Math.round(focusProgress)}<span className="text-[10px]">%</span></div>
                    </div>

                    <div className="absolute bottom-12 w-full text-center">
                        <div className="text-[10px] opacity-70 tracking-widest">[ 旋轉鏡頭 ]</div>
                    </div>
                </div>
            )}

            {/* 8. REVEAL (結果) */}
            {step === 'REVEAL' && (
                <div className="absolute inset-0 z-20 animate-in zoom-in duration-700">
                    {/* 遮罩：使用超粗邊框模擬 Keyhole */}
                    <div className="center-xy pointer-events-none z-20">
                        <div className="w-[220px] h-[220px] rounded-full border-[200px] border-black shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]"></div>
                    </div>

                    {/* 清晰圖片層 */}
                    {resultImage && (
                        <div className="absolute inset-0 bg-cover bg-center z-10"
                            style={{ backgroundImage: `url('${resultImage}')` }}>
                        </div>
                    )}

                    <div className="absolute bottom-12 w-full text-center z-30">
                        <div className="text-[10px] bg-black text-white px-3 py-1 rounded-full border border-white/20 inline-block tracking-widest cursor-pointer" onClick={onScan}>
                            影像還原完成 [重啟]
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
