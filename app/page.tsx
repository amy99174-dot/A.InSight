'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Settings, X, Volume2, VolumeX, AlertTriangle, ArrowRight, Sliders, Terminal, RotateCw } from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import { useOrientation } from '../hooks/useOrientation';
import { KeyholeViewer } from '../components/KeyholeViewer';
import { ScannerDisplay } from '../components/ScannerDisplay';
import { getScenariosAction } from './admin/scenarios/actions';
import type { Scenario } from '../lib/AppTypes';

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

    const [config, setConfig] = useState<Scenario | any>({
        uiConfig: {
            primaryColor: 'text-lime-400',
            borderColor: 'border-white',
            audioAmbience: ''
        },
        uiTexts: {
            boot: '正在探測歷史訊號',
            scanning: '訊號偵測',
            locked: '鎖定目標'
        },
        name: 'Default Scenario'
    });

    // Fetch Active Scenario on Mount
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const scenarios = await getScenariosAction();
                const active = scenarios.find((s: Scenario) => s.isActive) || scenarios[0];
                if (active) {
                    setConfig(active);
                }
            } catch (e) {
                console.error("Failed to load scenario config", e);
            }
        };
        fetchConfig();
    }, []);

    return (
        <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
            {/* Import ScannerDisplay at top level, but I will assume it's imported or I will add import. 
                 Wait, I cannot add import with this tool if I start from line 417.
                 I need to check imports.
                 I'll assume imports are missing and need to be added.
                 But this tool is strictly line replacement.
                 I should probably use multi_replace or rewrite the whole file if imports are needed.
                 The user asked for replace?
                 Let's check imports in file.
                 Lines 1-8 are imports.
                 I should probably do a full FILE REWRITE or use MULTI_REPLACE to add imports + change body.
                 
                 Strategy: I will use REPLACE for the body first.
                 THEN I will add the import at the top.
             */}
            <ScannerDisplay
                step={step}
                config={config}
                capturedImage={capturedImage}
                historyImage={historyImage}
                historyScale={historyScale}
                timeScale={timeScale}
                artifactName={artifactName}
                scriptPages={scriptPages}
                scriptPage={scriptPage}
                analysisText={analysisText}
                isProcessing={isProcessing}
                focusRotation={focusRotation}
                focusProgress={focusProgress}

                isPlayingAudio={isPlayingAudio}
                hasGoogleKey={hasGoogleKey}

                position={{ x, y }} // Use x, y from hook
                videoRef={videoRef}

                onTrigger={handleTrigger}
                onWheel={handleWheel}
                onToggleAudio={toggleAudio}
                onShowSettings={() => setShowSettings(true)}
                onConfigChange={setConfig}
            />

            {/* KEEP SETTINGS MODAL (It's outside ScannerDisplay in original logic, but ScannerDisplay has a button for it) */}
            {/* Wait, ScannerDisplay HAS the button "KEY MISSING".
                The MODAL itself was in page.tsx.
                ScannerDisplay calls `onShowSettings`.
                So valid.
            */}
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
        </main>
    );
}
