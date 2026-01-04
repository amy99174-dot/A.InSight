'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Settings, X, Volume2, VolumeX, AlertTriangle, ArrowRight, Sliders, Terminal, RotateCw } from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import { useOrientation } from '../hooks/useOrientation';
import { KeyholeViewer } from '../components/KeyholeViewer';

// Note: analyzeArtifact etc are replaced by API calls

const STEPS = {
    BOOT: 'BOOT',
    PROXIMITY: 'PROXIMITY',
    LOCKED: 'LOCKED',
    TUNING: 'TUNING',
    ANALYZING: 'ANALYZING',
    LISTEN: 'LISTEN',
    FOCUSING: 'FOCUSING',
    REVEAL: 'REVEAL',
};

// --- Background Audio Assets (Using User's MP3s) ---
const AMBIENCE_URLS: Record<string, string> = {
    "SOUND_WIND": "https://storage.googleapis.com/my-rpg-game-sounds/WINTER.mp3",
    "SOUND_WATER": "https://storage.googleapis.com/my-rpg-game-sounds/WATER.mp3",
    "SOUND_SCREAM": "https://storage.googleapis.com/my-rpg-game-sounds/SCREAM.mp3",
    "SOUND_CLANK": "https://storage.googleapis.com/my-rpg-game-sounds/CLANK.mp3",
    "SOUND_CROWD": "https://storage.googleapis.com/my-rpg-game-sounds/CROWD.mp3",
    "SOUND_QUIET": "https://storage.googleapis.com/my-rpg-game-sounds/QUIET.mp3",
    "SOUND_LOW": "https://storage.googleapis.com/my-rpg-game-sounds/LOW.mp3",
    "SOUND_HUM": "https://storage.googleapis.com/my-rpg-game-sounds/HUM.mp3",
    "SOUND_FIRE": "https://storage.googleapis.com/my-rpg-game-sounds/FIRE.mp3",
    "QUIET": "https://storage.googleapis.com/my-rpg-game-sounds/QUIET.mp3",
};

interface CircularHUDProps {
    color?: string;
    active?: boolean;
}

const CircularHUD = React.memo(({ color = "text-lime-400", active = false }: CircularHUDProps) => (
    <div className={`absolute inset-0 pointer-events-none z-50 ${color}`}>
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
));

// Helper to chunk text into pages
const splitTextIntoPages = (text: string, maxChars: number = 55): string[] => {
    if (!text) return ["..."];
    const sentences = text.split(/([。！？\n])/).filter(Boolean);
    const pages: string[] = [];
    let currentPage = "";
    for (let i = 0; i < sentences.length; i++) {
        const part = sentences[i];
        if ((currentPage + part).length > maxChars && currentPage.length > 0) {
            pages.push(currentPage);
            currentPage = part;
        } else {
            currentPage += part;
        }
    }
    if (currentPage) pages.push(currentPage);
    return pages.length > 0 ? pages : [text];
};

const TIME_SCALE_LABELS: Record<number, string> = {
    1: "起因 / 靈感 (抽象自然)",
    2: "鑄造 / 誕生 (工匠視角)",
    3: "使用 / 全盛 (歷史靜物)",
    4: "流轉 / 遺棄 (出土塵封)",
    5: "未來 / 命運 (科幻遺跡)"
};

const HISTORY_SCALE_LABELS: Record<number, string> = {
    1: "軼聞 (神秘低語)",
    2: "通史 (文化習俗)",
    3: "正史 (考據學術)"
};

export default function Home() {
    const [step, setStep] = useState(STEPS.BOOT);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [historyImage, setHistoryImage] = useState<string | null>(null);
    const [historyScale, setHistoryScale] = useState(2);
    const [timeScale, setTimeScale] = useState(3);
    const [artifactName, setArtifactName] = useState<string>("Unknown");
    const [analysisText, setAnalysisText] = useState<string>("Analyzing...");
    const [fullScript, setFullScript] = useState<string>("");
    const [scriptPage, setScriptPage] = useState(0);
    const [debugLog, setDebugLog] = useState<string>("// 等待分析數據...");
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [bgAudioUrls, setBgAudioUrls] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [focusRotation, setFocusRotation] = useState(0);
    const lastAngleRef = useRef<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const bgAudioRefs = useRef<HTMLAudioElement[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    // Default process.env is only available if we expose via NEXT_PUBLIC, but we want server to handle it.
    // We can pass empty string if not provided by user, server will use its env.
    const [userOpenAIKey, setUserOpenAIKey] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem("OPENAI_KEY") || "";
        return "";
    });
    const [userGoogleKey, setUserGoogleKey] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem("GOOGLE_KEY") || "";
        return "";
    });

    // Session Management
    const [sessionId, setSessionId] = useState<number | null>(null);

    useEffect(() => {
        const initSession = async () => {
            // 1. Check if ID exists in sessionStorage
            const storedId = sessionStorage.getItem('session_id');
            if (storedId) {
                setSessionId(Number(storedId));
                console.log("Restored Session ID:", storedId);
                return;
            }

            // 2. If not, call API to check in
            try {
                const res = await fetch('/api/session', { method: 'POST' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.id) {
                        setSessionId(data.id);
                        sessionStorage.setItem('session_id', String(data.id));
                        console.log("New Session Created:", data.id);
                    }
                }
            } catch (e) {
                console.error("Session Check-in Failed", e);
            }
        };

        initSession();
    }, []);



    // To keep UI consistent: "KEY MISSING" logic.
    // Previously: !!(userGoogleKey || import.meta.env.VITE_GEMINI_API_KEY)
    // Now: We don't have VITE_ key. We should assume if user didn't provide key, server might have it.
    // BUT the UI shows "KEY MISSING" if no key.
    // The user instructed "Maintain UI".
    // If I default hasGoogleKey to true, the warning goes away.
    // Ideally, I should expose NEXT_PUBLIC_HAS_GEMINI_KEY boolean from server? Or just assume true and handle error.
    // I will assume TRUE for now to hide the warning initially, trusting the server env.
    const hasGoogleKey = true; // Hardcoded to true because server environment should have it.

    useEffect(() => {
        localStorage.setItem("OPENAI_KEY", userOpenAIKey);
        localStorage.setItem("GOOGLE_KEY", userGoogleKey);
    }, [userOpenAIKey, userGoogleKey]);

    const { videoRef, startCamera, stopCamera, captureImage } = useCamera();
    const { x, y, resetOrigin } = useOrientation();
    const scriptPages = splitTextIntoPages(fullScript);

    useEffect(() => {
        if (step === STEPS.BOOT) startCamera();
    }, [step, startCamera]);

    useEffect(() => {
        if (step === STEPS.REVEAL) resetOrigin();
    }, [step, resetOrigin]);

    useEffect(() => {
        if (step === STEPS.FOCUSING) setFocusRotation(0);
    }, [step]);

    const processCapture = async (image: string, hScale: number, tScale: number) => {
        setIsProcessing(true);
        setAnalysisText("正在檢索歷史資訊...");
        try {
            // 1. Analyze Artifact (Calls /api/history)
            const analyzeRes = await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image,
                    historyScale: hScale,
                    timeScale: tScale,
                    apiKey: userGoogleKey, // Pass if user provided
                    sessionId: sessionId // Send Session ID
                })
            });

            const plan = await analyzeRes.json();
            if (!analyzeRes.ok || plan.error) {
                throw new Error(plan.error || "Analysis failed");
            }

            setArtifactName(plan.name);
            setFullScript(plan.scriptPrompt);
            setScriptPage(0);
            setDebugLog(`
=== [PHASE 1] CHRONOS ENGINE PROMPT ===
${plan.usedPrompt}
=== [PHASE 2] GENERATED VISION PLAN ===
${plan.visionPrompt}
=== [PHASE 3] GENERATED AUDIO SCRIPT ===
${plan.scriptPrompt}
`.trim());

            setAnalysisText("正在重構視覺與聲音...");

            // 2. Parallel Generation (Calls /api/vision and /api/audio)
            const visionPromise = fetch('/api/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: plan.visionPrompt,
                    image: image,
                    apiKey: userGoogleKey
                })
            }).then(r => r.json());

            const audioPromise = fetch('/api/audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: plan.scriptPrompt,
                    apiKey: userOpenAIKey
                })
            }).then(async r => {
                if (!r.ok) return null;
                const blob = await r.blob();
                return URL.createObjectURL(blob);
            });

            const [visionRes, genAudio] = await Promise.all([visionPromise, audioPromise]);

            if (visionRes.error) throw new Error(visionRes.error);
            const genImage = visionRes.image;

            setHistoryImage(genImage);
            setAudioUrl(genAudio);

            const ambienceCode = plan.ambienceCategory || "SOUND_QUIET";
            const categories = ambienceCode.split(',').map((s: string) => s.trim());
            const urls = categories.map((cat: string) => AMBIENCE_URLS[cat] || AMBIENCE_URLS["SOUND_QUIET"]);
            setBgAudioUrls(urls);

            setIsProcessing(false);
            setAnalysisText("正在聆聽關於 " + plan.name + " 的故事...");
            setStep(STEPS.LISTEN);
        } catch (error: any) {
            console.error("Process Failed", error);
            setIsProcessing(false);
            setAnalysisText(error.message || "系統錯誤");
            if (error.message.includes("API Key") || error.message.includes("Missing")) setShowSettings(true);
            else setTimeout(() => { setStep(STEPS.BOOT); startCamera(); }, 3000);
        }
    };

    useEffect(() => {
        const isAudioActiveMode = [STEPS.LISTEN, STEPS.FOCUSING, STEPS.REVEAL].includes(step);
        if (!isAudioActiveMode) {
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
            bgAudioRefs.current.forEach(audio => { audio.pause(); audio.src = ""; });
            bgAudioRefs.current = [];
            setIsPlayingAudio(false);
            return;
        }
        if (bgAudioRefs.current.length === 0 && bgAudioUrls.length > 0) {
            bgAudioUrls.forEach((url) => {
                const audio = new Audio(url);
                audio.loop = true;
                audio.volume = 0.6;
                bgAudioRefs.current.push(audio);
            });
        }
        if (!audioRef.current && audioUrl) {
            audioRef.current = new Audio(audioUrl);
            audioRef.current.loop = false;
        }
        let mounted = true;
        const playAll = async () => {
            try {
                const playPromises: Promise<void>[] = [];
                if (audioRef.current && audioRef.current.paused) playPromises.push(audioRef.current.play());
                bgAudioRefs.current.forEach(audio => { if (audio.paused) playPromises.push(audio.play()); });
                await Promise.all(playPromises);
                if (mounted) setIsPlayingAudio(true);
            } catch (e) {
                if (mounted) setIsPlayingAudio(false);
            }
        };
        if (!isPlayingAudio) playAll();
        return () => { mounted = false; };
    }, [step, audioUrl, bgAudioUrls]);

    const toggleAudio = () => {
        if (isPlayingAudio) {
            if (audioRef.current) audioRef.current.pause();
            bgAudioRefs.current.forEach(audio => audio.pause());
            setIsPlayingAudio(false);
        } else {
            if (audioRef.current) audioRef.current.play();
            bgAudioRefs.current.forEach(audio => audio.play().catch(() => { }));
            setIsPlayingAudio(true);
        }
    };

    const handleTrigger = async () => {
        if (!hasGoogleKey && step === STEPS.BOOT) {
            setShowSettings(true);
            return;
        }
        if (navigator.vibrate) {
            if (step === STEPS.BOOT) navigator.vibrate([100, 50, 100]);
            else if (step === STEPS.PROXIMITY) navigator.vibrate(200);
            else if (step === STEPS.LOCKED) navigator.vibrate(50);
            else navigator.vibrate(20);
        }
        switch (step) {
            case STEPS.BOOT: setStep(STEPS.PROXIMITY); break;
            case STEPS.PROXIMITY: setStep(STEPS.LOCKED); break;
            case STEPS.LOCKED:
                const img = captureImage();
                if (img) {
                    setCapturedImage(img);
                    setStep(STEPS.TUNING);
                    stopCamera();
                }
                break;
            case STEPS.TUNING:
                if (capturedImage) {
                    setStep(STEPS.ANALYZING);
                    processCapture(capturedImage, historyScale, timeScale);
                }
                break;
            case STEPS.LISTEN:
                if (scriptPage < scriptPages.length - 1) setScriptPage(prev => prev + 1);
                else setStep(STEPS.FOCUSING);
                break;
            case STEPS.FOCUSING:
                setStep(STEPS.REVEAL);
                break;
            case STEPS.REVEAL:
                setCapturedImage(null);
                setHistoryImage(null);
                setAudioUrl(null);
                setBgAudioUrls([]);
                setFullScript("");
                setScriptPage(0);
                setStep(STEPS.BOOT);
                break;
            default: break;
        }
    };

    // Keyboard Interaction for TUNING Step
    useEffect(() => {
        if (step !== STEPS.TUNING) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent default scrolling for arrow keys
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }

            if (e.key === 'ArrowUp') {
                setHistoryScale(prev => Math.min(prev + 1, 3));
            } else if (e.key === 'ArrowDown') {
                setHistoryScale(prev => Math.max(prev - 1, 1));
            } else if (e.key === 'ArrowRight') {
                setTimeScale(prev => Math.min(prev + 1, 5));
            } else if (e.key === 'ArrowLeft') {
                setTimeScale(prev => Math.max(prev - 1, 1));
            } else if (e.key === 'Enter' || e.key === ' ') {
                handleTrigger();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [step]); // handleTrigger is constant

    // Wheel Interaction for FOCUSING Step
    const handleWheel = (e: React.WheelEvent) => {
        if (step !== STEPS.FOCUSING) return;

        const delta = e.deltaY * 0.2; // Sensitivity adjustment
        const newRotation = focusRotation + delta;
        setFocusRotation(newRotation);

        // Auto trigger when rotation exceeds threshold (100 units = 100%)
        if (Math.abs(newRotation) >= 100 && Math.abs(focusRotation) < 100) {
            setTimeout(() => handleTrigger(), 500);
        }
    };

    const getHistoryLabel = (val: number) => {
        if (val === 3) return "HIGH";
        if (val === 2) return "MID";
        return "LOW";
    };

    const focusProgress = Math.min(Math.abs(focusRotation) / 100, 1);
    const blurAmount = 12 * (1 - focusProgress);

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden h-screen w-screen font-mono">

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
                onClick={step !== STEPS.TUNING && step !== STEPS.FOCUSING ? handleTrigger : undefined}
                onWheel={step === STEPS.FOCUSING ? handleWheel : undefined}
            >

                {/* LAYER 0: Visual Base (Background) */}
                <div id="bg-layer" className="absolute inset-0 bg-cover bg-center transition-all duration-500"
                    style={{
                        opacity: (step === STEPS.PROXIMITY || step === STEPS.LOCKED) ? 0.6 :
                            (step === STEPS.TUNING || step === STEPS.FOCUSING) ? 0.2 :
                                (step === STEPS.ANALYZING || step === STEPS.LISTEN) ? 0.1 :
                                    (step === STEPS.REVEAL) ? 0 : 0.3, // REVEAL: Hide background
                        filter: 'grayscale(100%) contrast(120%)'
                    }}>

                    {/* Camera Video Stream */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${capturedImage ? 'hidden' : 'block'}`}
                    />

                    {/* Captured Image Display */}
                    {capturedImage && (
                        <img src={capturedImage} className="w-full h-full object-cover" />
                    )}
                </div>

                {/* Scan Line Texture */}
                <div className="absolute inset-0 scan-line-bg opacity-30 pointer-events-none"></div>

                {/* LAYER 1: Global HUD */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* External Decoration Ring */}
                    <div className={`center-xy w-[370px] h-[370px] border rounded-full ${step === STEPS.REVEAL ? 'border-white' : 'border-white/10'}`}></div>
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
                <div id="state-BOOT" className={`state-layer ${step === STEPS.BOOT ? 'active' : ''} flex flex-col items-center justify-center`}>
                    <div className="relative w-24 h-24 flex items-center justify-center mb-4">
                        <div className="absolute inset-0 border border-white rounded-full anim-pulse"></div>
                        <div className="absolute inset-0 border-t border-white rounded-full anim-spin-self-slow"></div>
                        <div className="text-2xl font-black tracking-tighter text-white whitespace-nowrap">正在探測歷史訊號</div>
                    </div>

                    <div className="text-sm font-bold tracking-widest mb-1 text-white">尋找中...</div>
                    <div className="text-[9px] opacity-60 text-white">請在展區中隨意走動</div>
                </div>

                {/* 2. PROXIMITY */}
                <div id="state-PROXIMITY" className={`state-layer ${step === STEPS.PROXIMITY ? 'active' : ''}`}>
                    <div className="center-xy w-[120px] h-[120px]">
                        <div className="w-full h-full bg-white/10 rounded-full anim-ping-wrapper"></div>
                    </div>
                    <div className="center-xy w-[180px] h-[180px]">
                        <div className="w-full h-full border border-white/30 rounded-full anim-ping-wrapper" style={{ animationDelay: '0.3s' }}></div>
                    </div>

                    <div className="center-xy flex flex-col items-center text-center bg-black/60 p-6 rounded-full backdrop-blur-sm border border-white/10 text-white">
                        <div className="text-xl font-bold">訊號偵測</div>
                        <div className="text-[9px] border-t border-white/50 w-full pt-1 mt-1">接近目標中</div>
                    </div>

                    <div className="absolute bottom-16 w-full text-center text-white">
                        <span className="text-2xl font-bold font-mono" id="dist-val">0.8</span>
                        <span className="text-[9px] ml-1">M</span>
                    </div>
                </div>

                {/* 3. LOCKED */}
                <div id="state-LOCKED" className={`state-layer ${step === STEPS.LOCKED ? 'active' : ''}`}>
                    <div className="center-xy w-[200px] h-[200px]">
                        <div className="absolute top-0 left-0 w-full h-full border-t-2 border-white rounded-full"
                            style={{ clipPath: 'inset(0 20% 80% 20%)' }}></div>
                        <div className="absolute bottom-0 left-0 w-full h-full border-b-2 border-white rounded-full"
                            style={{ clipPath: 'inset(80% 20% 0 20%)' }}></div>
                        <div className="absolute top-0 left-0 w-full h-full border-l-2 border-white/50 rounded-full"
                            style={{ clipPath: 'inset(40% 90% 40% 0)' }}></div>
                        <div className="absolute top-0 left-0 w-full h-full border-r-2 border-white/50 rounded-full"
                            style={{ clipPath: 'inset(40% 0 40% 90%)' }}></div>
                    </div>

                    <div className="center-xy w-2 h-2 bg-white rounded-full anim-pulse"></div>

                    <div className="absolute top-[35%] w-full text-center">
                        <div className="text-[10px] bg-white text-black px-2 inline-block rounded-sm font-bold">鎖定目標</div>
                    </div>
                    <div className="absolute bottom-[30%] w-full text-center text-white">
                        <div className="text-[10px] animate-bounce">[ 按下快門捕捉 ]</div>
                    </div>
                </div>

                {/* 4. TUNING - KEYBOARD CONTROLLED */}
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

                    <button onClick={(e) => { e.stopPropagation(); toggleAudio(); }} className={`absolute top-24 right-10 p-2 rounded-full border ${isPlayingAudio ? 'border-lime-400/50 text-lime-400' : 'border-red-500/50 text-red-500 animate-pulse'} z-50`}>
                        {isPlayingAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>

                    <div className="absolute bottom-12 w-full text-center text-[8px] text-white/50">
                        點擊畫面繼續
                    </div>
                </div>

                {/* 7. FOCUSING - WHEEL CONTROLLED */}
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

                {/* 8. REVEAL - ORIGINAL KeyholeViewer Logic Preserved but SWAP GREEN TO WHITE */}
                <div id="state-REVEAL" className={`state-layer ${step === STEPS.REVEAL ? 'active' : ''}`} style={{ zIndex: 50 }}>
                    {step === STEPS.REVEAL && historyImage && (
                        <div className="absolute inset-0 rounded-full bg-black">
                            <KeyholeViewer imageSrc={historyImage} position={{ x, y }} />

                            {/* Overlay Click-to-Reset (Restoring functionality) */}
                            <div className="absolute bottom-12 w-full text-center z-30 pointer-events-auto">
                                <div
                                    className="text-[10px] bg-black text-white px-3 py-1 rounded-full border border-white/20 inline-block cursor-pointer"
                                    onClick={handleTrigger}
                                >
                                    探測下一則歷史
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
