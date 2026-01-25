'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useOrientation } from '../hooks/useOrientation';
import ScannerDisplay from '../components/ScannerDisplay';

// Note: analyzeArtifact etc are replaced by API calls

import { STEPS, TIME_SCALE_LABELS, HISTORY_SCALE_LABELS, DEFAULT_CONFIG } from '../lib/defaults';

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

export default function Home() {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [step, setStep] = useState(STEPS.BOOT);

    // Fetch Config on Mount
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/config');
                if (res.ok) {
                    const data = await res.json();
                    setConfig(data);
                }
            } catch (err) {
                console.error("Failed to fetch scenario config:", err);
            }
        };
        fetchConfig();
    }, []);

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
            const storedId = sessionStorage.getItem('session_id');
            if (storedId) {
                setSessionId(Number(storedId));
                console.log("Restored Session ID:", storedId);
                return;
            }

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
    }, [step, handleTrigger]); // handleTrigger is constant

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

    return (
        <main className="fixed inset-0 w-screen h-screen bg-black overflow-hidden font-mono">
            {/* UI Display Layer with Nested Background */}
            <ScannerDisplay
                step={step}
                config={config}
                artifactName={artifactName}
                analysisText={analysisText}
                scriptPages={scriptPages}
                scriptPage={scriptPage}
                debugLog={debugLog}
                isProcessing={isProcessing}
                isPlayingAudio={isPlayingAudio}
                focusRotation={focusRotation}
                historyScale={historyScale}
                timeScale={timeScale}
                onTrigger={handleTrigger}
                onWheel={handleWheel}
                toggleAudio={toggleAudio}
                showSettings={showSettings}
                setShowSettings={setShowSettings}
                userGoogleKey={userGoogleKey}
                setUserGoogleKey={setUserGoogleKey}
                userOpenAIKey={userOpenAIKey}
                setUserOpenAIKey={setUserOpenAIKey}
                hasGoogleKey={hasGoogleKey}
                historyImage={historyImage}
                orientation={{ x, y }}
            >
                {/* Background Camera Layer */}
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
            </ScannerDisplay>
        </main>
    );
}
