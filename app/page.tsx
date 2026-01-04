"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Settings, Volume2, VolumeX, ArrowRight, RotateCw, Terminal, GripHorizontal } from 'lucide-react';
import ScannerUI from '../components/ScannerUI';
import { useCamera } from '../hooks/useCamera';
import { useOrientation } from '../hooks/useOrientation';

// --- Constants (From Refactor) ---
const STEPS = {
    BOOT: 'BOOT',
    PROXIMITY: 'PROXIMITY',
    LOCKED: 'LOCKED',
    TUNING: 'TUNING',
    ANALYZING: 'ANALYZING',
    LISTEN: 'LISTEN',
    FOCUSING: 'FOCUSING',
    REVEAL: 'REVEAL'
};

const AMBIENCE_URLS: Record<string, string> = {
    "SOUND_QUIET": "https://assets.mixkit.co/sfx/preview/mixkit-space-deploy-hum-2134.mp3",
    "SOUND_WIND": "https://assets.mixkit.co/sfx/preview/mixkit-wind-desolate-souls-1457.mp3",
    "SOUND_WATER": "https://assets.mixkit.co/sfx/preview/mixkit-water-stream-in-forest-1229.mp3",
    "SOUND_CLANK": "https://assets.mixkit.co/sfx/preview/mixkit-factory-heavy-machinery-clank-1662.mp3",
    "SOUND_CROWD": "https://assets.mixkit.co/sfx/preview/mixkit-large-crowd-loop-446.mp3",
    "SOUND_LOW": "https://assets.mixkit.co/sfx/preview/mixkit-cinematic-mystery-trailer-drone-1070.mp3",
    "SOUND_HUM": "https://assets.mixkit.co/sfx/preview/mixkit-spaceship-engine-low-hum-2975.mp3",
    "SOUND_FIRE": "https://assets.mixkit.co/sfx/preview/mixkit-camp-fire-crackling-loop-1339.mp3",
    "SOUND_SCREAM": "https://assets.mixkit.co/sfx/preview/mixkit-ghost-scream-2581.mp3"
};

// Helper (From Refactor)
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

export default function Home() {
    // --- Logic State (From Refactor) ---
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
    const [focusRotation, setFocusRotation] = useState(0); // Degrees
    const lastAngleRef = useRef<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const bgAudioRefs = useRef<HTMLAudioElement[]>([]);

    // UI State (From Current / Adapters)
    const [activeTuningParam, setActiveTuningParam] = useState<'time' | 'history'>('time');
    const [showSettings, setShowSettings] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);

    // Auth State
    const [userOpenAIKey, setUserOpenAIKey] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem("OPENAI_KEY") || "";
        return "";
    });
    const [userGoogleKey, setUserGoogleKey] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem("GOOGLE_KEY") || "";
        return "";
    });
    const hasGoogleKey = true; // Hardcoded bypass as per refactor/current usage

    // Session
    const [sessionId, setSessionId] = useState<number | null>(null);

    // Hooks
    const { videoRef, startCamera, stopCamera, captureImage, error: cameraError } = useCamera();
    const { x, y, resetOrigin } = useOrientation();

    // --- Effects ---

    // 1. Session Init (Refactor Logic)
    useEffect(() => {
        const initSession = async () => {
            const storedId = sessionStorage.getItem('session_id');
            if (storedId) {
                setSessionId(Number(storedId));
                return;
            }
            try {
                const res = await fetch('/api/session', { method: 'POST' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.id) {
                        setSessionId(data.id);
                        sessionStorage.setItem('session_id', String(data.id));
                    }
                }
            } catch (e) {
                console.error("Session Check-in Failed", e);
            }
        };
        initSession();
    }, []);

    // 2. Camera Lifecycle (Refactor Logic)
    useEffect(() => {
        if (step === STEPS.BOOT) startCamera();
    }, [step, startCamera]);

    // 3. Audio Logic (Refactor Logic)
    useEffect(() => {
        // ... (Logic from Step 57) ...
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
    }, [step, audioUrl, bgAudioUrls, isPlayingAudio]); // Added isPlayingAudio dependency to prevent stale closures

    // 4. Keyboard Listener (From Current Branch - For Tuning UI)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (step === STEPS.TUNING) {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'w' || e.key === 's') {
                    setActiveTuningParam(prev => prev === 'time' ? 'history' : 'time');
                } else if (e.key === 'ArrowLeft' || e.key === 'a') {
                    if (activeTuningParam === 'time') {
                        setTimeScale(prev => Math.max(1, prev - 1));
                    } else {
                        setHistoryScale(prev => Math.max(1, prev - 1));
                    }
                } else if (e.key === 'ArrowRight' || e.key === 'd') {
                    if (activeTuningParam === 'time') {
                        setTimeScale(prev => Math.min(5, prev + 1));
                    } else {
                        setHistoryScale(prev => Math.min(3, prev + 1));
                    }
                } else if (e.key === ' ' || e.key === 'Enter') {
                    handleTrigger();
                }
            } else if (step === STEPS.FOCUSING) {
                // Focusing Logic (Rotation Simulation if Pointer not used)
                if (e.key === 'ArrowLeft' || e.key === 'a') {
                    setFocusRotation(prev => prev - 5);
                } else if (e.key === 'ArrowRight' || e.key === 'd') {
                    setFocusRotation(prev => prev + 5);
                } else if (e.key === ' ' || e.key === 'Enter') {
                    // Auto-reveal fallback
                    handleTrigger();
                }
            } else if (e.key === ' ' || e.key === 'Enter') {
                handleTrigger();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [step, activeTuningParam]); // Deps

    // 5. Auth Persistence
    useEffect(() => {
        localStorage.setItem("OPENAI_KEY", userOpenAIKey);
        localStorage.setItem("GOOGLE_KEY", userGoogleKey);
    }, [userOpenAIKey, userGoogleKey]);

    // 6. Analysis Progress Simulation (Adapter for UI)
    useEffect(() => {
        if (step === STEPS.ANALYZING) {
            setAnalysisProgress(0);
            const interval = setInterval(() => {
                setAnalysisProgress(prev => {
                    if (prev >= 95) return prev;
                    return prev + Math.floor(Math.random() * 5) + 1;
                });
            }, 500);
            return () => clearInterval(interval);
        } else {
            setAnalysisProgress(0);
        }
    }, [step]);

    // 7. Focus Transition Logic (Adapter)
    useEffect(() => {
        if (step === STEPS.FOCUSING) {
            // Check rotation
            if (Math.abs(focusRotation) > 120) {
                if (navigator.vibrate) navigator.vibrate(80);
                setTimeout(() => setStep(STEPS.REVEAL), 100);
            }
        } else {
            setFocusRotation(0);
        }
    }, [focusRotation, step]);


    // --- Core Functions (From Refactor) ---

    // Data Processing (The "Brain")
    const processCapture = async (image: string, hScale: number, tScale: number) => {
        setIsProcessing(true);
        setAnalysisText("正在檢索歷史資訊...");
        setAnalysisProgress(10); // Start progress

        try {
            // 1. Analyze Artifact
            const analyzeRes = await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image,
                    historyScale: hScale,
                    timeScale: tScale,
                    apiKey: userGoogleKey,
                    sessionId: sessionId
                })
            });

            const plan = await analyzeRes.json();
            if (!analyzeRes.ok || plan.error) {
                // Fallback for demo if API fails (Network error fix)
                console.warn("API Error, using fallback:", plan.error);
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
            setAnalysisProgress(50);

            // 2. Parallel Generation
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

            let genImage = null;
            if (visionRes && visionRes.image) {
                genImage = visionRes.image;
            } else {
                // Fallback image
                genImage = "https://images.unsplash.com/photo-1614730341194-75c60740a270?w=800&q=80";
            }

            setHistoryImage(genImage);
            setAudioUrl(genAudio);
            setAnalysisProgress(100);

            const ambienceCode = plan.ambienceCategory || "SOUND_QUIET";
            const categories = ambienceCode.split(',').map((s: string) => s.trim());
            const urls = categories.map((cat: string) => AMBIENCE_URLS[cat] || AMBIENCE_URLS["SOUND_QUIET"]);
            setBgAudioUrls(urls);

            setIsProcessing(false);
            setAnalysisText("正在聆聽關於 " + plan.name + " 的故事...");
            setStep(STEPS.LISTEN);

        } catch (error: any) {
            console.warn("Process Failed (Fallback Mode)", error);
            setIsProcessing(false);
            setAnalysisText(error.message || "系統錯誤");

            // Simulation Fallback
            setTimeout(() => {
                setArtifactName("系統覆寫 (Simulation)");
                setFullScript("訊號連線中斷... 啟動本機模擬協議... (Simulation Mode)");
                setHistoryImage("https://images.unsplash.com/photo-1614730341194-75c60740a270?w=800&q=80");
                setStep(STEPS.FOCUSING); // Skip LISTEN if no audio
            }, 1000);
        }
    };

    const handleTrigger = async () => {
        if (!hasGoogleKey && step === STEPS.BOOT) {
            setShowSettings(true);
            return;
        }
        if (navigator.vibrate) navigator.vibrate(50);

        const scriptPages = splitTextIntoPages(fullScript);

        switch (step) {
            case STEPS.BOOT:
                setStep(STEPS.PROXIMITY);
                break;
            case STEPS.PROXIMITY:
                setStep(STEPS.LOCKED);
                break;
            case STEPS.LOCKED:
                const img = captureImage();
                if (img) {
                    setCapturedImage(img);
                    setStep(STEPS.TUNING);
                    stopCamera();
                } else {
                    // Retry or force
                    console.warn("No image captured");
                }
                break;
            case STEPS.TUNING:
                if (capturedImage) {
                    setStep(STEPS.ANALYZING);
                    processCapture(capturedImage, historyScale, timeScale);
                }
                break;
            case STEPS.ANALYZING:
                // Do nothing, waiting
                break;
            case STEPS.LISTEN:
                if (scriptPage < scriptPages.length - 1) setScriptPage(prev => prev + 1);
                else setStep(STEPS.FOCUSING);
                break;
            case STEPS.FOCUSING:
                // Manual override if rotation is hard
                setStep(STEPS.REVEAL);
                break;
            case STEPS.REVEAL:
                setStep(STEPS.BOOT);
                setCapturedImage(null);
                setHistoryImage(null);
                setAudioUrl(null);
                setBgAudioUrls([]);
                setAnalysisProgress(0);
                setFullScript("");
                break;
        }
    };

    // Pointer Events for Rotation (Refactor Logic integrated)
    const handlePointerDown = (e: React.PointerEvent) => {
        if (step !== STEPS.FOCUSING) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        lastAngleRef.current = Math.atan2(e.clientY - cy, e.clientX - cx);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (lastAngleRef.current === null || step !== STEPS.FOCUSING) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const currentAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
        let delta = currentAngle - lastAngleRef.current;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;

        setFocusRotation(prev => prev + (delta * (180 / Math.PI)));
        lastAngleRef.current = currentAngle;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        lastAngleRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };


    // --- Render (From Current Branch) ---

    // Dynamic Props Logic
    const scriptPages = splitTextIntoPages(fullScript);
    const currentScriptPage = scriptPages[scriptPage] || "";
    const focusProgress = Math.min(100, Math.round((Math.abs(focusRotation) / 120) * 100)); // Normalize 0-120deg to 0-100%

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden h-screen w-screen">
            {/* 4. Circular Viewport Container (Hardware Constraint: 380px) */}
            <div
                className={`relative w-[380px] h-[380px] rounded-full overflow-hidden shadow-2xl select-none touch-none ${step !== STEPS.TUNING ? 'cursor-pointer' : ''}`}
                onClick={handleTrigger} // Unified Trigger
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                {/* 1. Camera Viewfinder (Background) */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${capturedImage ? 'opacity-0' : 'opacity-100'} z-0`}
                />

                {/* 1.1 Captured Image Layer (Freeze frame) */}
                {capturedImage && (
                    <img src={capturedImage} className="absolute inset-0 w-full h-full object-cover z-0" alt="captured" />
                )}

                {/* Global HUD Layer */}
                <div className="absolute inset-0 border border-white/20 rounded-full z-50 pointer-events-none"></div>

                {/* Scanner UI Component (Handles Internal States) */}
                <ScannerUI
                    step={step}
                    onScan={handleTrigger}
                    // Data Injection
                    tuningValues={{ timeScale, historyScale }}
                    activeParameter={activeTuningParam}
                    analysisProgress={analysisProgress}
                    artifactName={artifactName}
                    scriptText={currentScriptPage}
                    focusProgress={focusProgress}
                    resultImage={historyImage}
                />
            </div>



            {/* Debug / Settings Overlay */}
            {showSettings && (
                <div className="fixed top-4 right-4 bg-black/80 p-4 border border-white/20 rounded z-[100] text-xs font-mono" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-2">
                        <span>SYSTEM CONFIG</span>
                        <X className="w-4 h-4 cursor-pointer" onClick={() => setShowSettings(false)} />
                    </div>
                    <div className="space-y-2">
                        <div className="flex flex-col gap-1">
                            <label>OPENAI KEY (TTS)</label>
                            <input
                                type="password"
                                className="bg-transparent border border-white/30 p-1 w-full"
                                value={userOpenAIKey}
                                onChange={e => setUserOpenAIKey(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label>GOOGLE KEY (Vision)</label>
                            <input
                                type="password"
                                className="bg-transparent border border-white/30 p-1 w-full"
                                value={userGoogleKey}
                                onChange={e => setUserGoogleKey(e.target.value)}
                            />
                        </div>
                        <div className="text-[9px] text-gray-500 mt-2 border-t border-gray-700 pt-1">
                            DEBUG LOG:
                            <div className="max-h-[100px] overflow-y-auto whitespace-pre-wrap">{debugLog}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Trigger if missing keys */}
            <div className="fixed bottom-2 left-2 z-50 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}>
                <Settings className="w-4 h-4 text-white" />
            </div>

            {/* Version Watermark */}
            <div className="fixed bottom-2 right-2 text-[8px] text-white/20 font-mono pointer-events-none">
                A.InSight PROTO v1.0 // LOGIC-RESCUED
            </div>
        </div>
    );
}
