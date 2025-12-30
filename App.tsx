
import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Ear, Sparkles, Settings, X, Volume2, VolumeX, Cloud, AlertTriangle, ArrowRight, Sliders, PlayCircle, Terminal, ScanEye, RotateCw } from 'lucide-react';
import { useCamera } from './hooks/useCamera';
import { useOrientation } from './hooks/useOrientation';
import { analyzeArtifact, generateHistoryVision, generateAudioGuide } from './services/ai';
import { KeyholeViewer } from './components/KeyholeViewer';

// Use types from provided file content if available, else locally
const STEPS = {
  BOOT: 'BOOT',
  PROXIMITY: 'PROXIMITY',
  LOCKED: 'LOCKED',
  TUNING: 'TUNING',
  ANALYZING: 'ANALYZING',
  LISTEN: 'LISTEN',
  FOCUSING: 'FOCUSING', // WAS DUST_OFF
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

export default function App() {
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
  const [userOpenAIKey, setUserOpenAIKey] = useState(() => localStorage.getItem("OPENAI_KEY") || import.meta.env.VITE_OPENAI_API_KEY || "");
  const [userGoogleKey, setUserGoogleKey] = useState(() => localStorage.getItem("GOOGLE_KEY") || "");

  useEffect(() => {
    localStorage.setItem("OPENAI_KEY", userOpenAIKey);
    localStorage.setItem("GOOGLE_KEY", userGoogleKey);
  }, [userOpenAIKey, userGoogleKey]);

  const hasGoogleKey = !!(userGoogleKey || import.meta.env.VITE_GEMINI_API_KEY);
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
      const plan = await analyzeArtifact(image, userGoogleKey, hScale, tScale);
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
      const tasks: Promise<any>[] = [
        generateHistoryVision(plan.visionPrompt, userGoogleKey, image, plan.imageStrength),
        generateAudioGuide(plan.scriptPrompt, userOpenAIKey)
      ];
      const [genImage, genAudio] = await Promise.all(tasks);
      setHistoryImage(genImage);
      setAudioUrl(genAudio);
      const ambienceCode = plan.ambienceCategory || "SOUND_QUIET";
      const categories = ambienceCode.split(',').map(s => s.trim());
      const urls = categories.map(cat => AMBIENCE_URLS[cat] || AMBIENCE_URLS["SOUND_QUIET"]);
      setBgAudioUrls(urls);
      setIsProcessing(false);
      setAnalysisText("正在聆聽關於 " + plan.name + " 的故事...");
      setStep(STEPS.LISTEN);
    } catch (error: any) {
      console.error("Process Failed", error);
      setIsProcessing(false);
      setAnalysisText(error.message || "系統錯誤");
      if (error.message.includes("API Key")) setShowSettings(true);
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
        const playPromises = [];
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

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    lastAngleRef.current = Math.atan2(e.clientY - cy, e.clientX - cx);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (lastAngleRef.current === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const currentAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    let delta = currentAngle - lastAngleRef.current;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    setFocusRotation(prev => {
      const newRotation = prev + (delta * (180 / Math.PI));
      if (Math.abs(newRotation) > 120 && step === STEPS.FOCUSING) {
        // --- VIBRATE: Focus Success ---
        if (navigator.vibrate) navigator.vibrate(80);
        setTimeout(() => setStep(STEPS.REVEAL), 100);
      }
      return newRotation;
    });
    lastAngleRef.current = currentAngle;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    lastAngleRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

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

    // ---------------------------------------------------------
    // 📳 HAPTIC FEEDBACK LOGIC
    // ---------------------------------------------------------
    if (navigator.vibrate) {
      if (step === STEPS.BOOT) {
        // Transition to PROXIMITY: Pulsing intermittent signal
        navigator.vibrate([100, 50, 100]);
      } else if (step === STEPS.PROXIMITY) {
        // Transition to LOCKED: Strong solid lock
        navigator.vibrate(200);
      } else if (step === STEPS.LOCKED) {
        // Trigger Click: Short tactile pulse
        navigator.vibrate(50);
      } else {
        // Generic UI tap
        navigator.vibrate(20);
      }
    }

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

  const focusProgress = Math.min(Math.abs(focusRotation) / 100, 1);
  const blurAmount = 12 * (1 - focusProgress);

  return (
    <>
      <div
        onClick={step !== STEPS.TUNING && step !== STEPS.FOCUSING ? handleTrigger : undefined}
        onPointerDown={step === STEPS.FOCUSING ? handlePointerDown : undefined}
        onPointerMove={step === STEPS.FOCUSING ? handlePointerMove : undefined}
        onPointerUp={step === STEPS.FOCUSING ? handlePointerUp : undefined}
        className={`relative w-[380px] h-[380px] bg-stone-950 shadow-2xl select-none rounded-full ring-4 ring-stone-800 overflow-hidden ${step !== STEPS.TUNING ? 'cursor-pointer' : ''} touch-none`}
      >
        <CircularHUD color={hasGoogleKey ? "text-lime-400" : "text-red-500"} active={true} />

        {(step === STEPS.BOOT || step === STEPS.PROXIMITY || step === STEPS.LOCKED) && (
          <div className="absolute inset-0 z-0">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-60 filter sepia-[0.3] contrast-125" />
          </div>
        )}

        {(step === STEPS.ANALYZING || step === STEPS.TUNING) && capturedImage && (
          <img src={capturedImage} className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale" />
        )}

        {(step === STEPS.LISTEN || step === STEPS.FOCUSING) && historyImage && (
          <div className="absolute inset-0 z-0">
            <img
              src={historyImage}
              style={{ filter: `blur(${step === STEPS.FOCUSING ? blurAmount : 2}px)` }}
              className="w-full h-full object-cover transition-all duration-100 opacity-40"
            />
          </div>
        )}

        {step === STEPS.BOOT && (
          <div className="absolute inset-0 rounded-full z-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(57,255,20,0.2)_0%,transparent_70%)]" />
            <div className="animate-ripple" />
            <div className="animate-ripple" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full text-center z-10">
              {!hasGoogleKey ? (
                <div className="flex flex-col items-center">
                  <AlertTriangle className="w-8 h-8 text-red-500 mb-2 animate-bounce" />
                  <p className="text-xl font-bold text-red-500 tracking-wider">KEY MISSING</p>
                  <p className="text-[10px] text-red-400 font-mono tracking-widest mt-1">OPEN SETTINGS</p>
                </div>
              ) : (
                <>
                  <p className="text-xl font-bold text-lime-400 tracking-wider leading-snug animate-pulse drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                    正在探測<br />展館中的歷史故事...
                  </p>
                  <p className="text-[10px] text-lime-400/70 font-mono tracking-[0.2em] mt-3">SYSTEM ONLINE</p>
                </>
              )}
            </div>
          </div>
        )}

        {step === STEPS.PROXIMITY && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center animate-intermittent-shake rounded-full z-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(57,255,20,0.3)_0%,transparent_60%)]" />
            <div className="animate-ripple" style={{ animationDuration: '1s', borderColor: 'rgba(57, 255, 20, 0.8)' }} />
            <div className="z-10 relative">
              <p className="text-xl font-bold text-lime-400 tracking-wider leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                訊號接近<br />請貼近展品感應區
              </p>
              <p className="text-[10px] text-lime-400/70 font-mono tracking-[0.2em] mt-2">SIGNAL DETECTED</p>
            </div>
          </div>
        )}

        {step === STEPS.LOCKED && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center rounded-full z-10">
            <div className="absolute inset-0 rounded-full border-[6px] border-lime-400/50 animate-pulse shadow-[inset_0_0_20px_#39ff14]" />
            <div className="absolute top-1/2 left-1/2 w-12 h-12 border border-lime-400 -translate-x-1/2 -translate-y-1/2" />
            <div className="z-10 relative mt-8 space-y-2">
              <p className="text-xl font-bold text-lime-400 tracking-wider drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">鎖定目標</p>
              <p className="text-[10px] text-lime-400/80 font-mono tracking-[0.2em]">TARGET LOCKED</p>
            </div>
            <div className="absolute bottom-16 z-10">
              <p className="text-[10px] text-lime-400/80 font-mono animate-bounce tracking-widest drop-shadow-md">[ 按下板機捕捉 ]</p>
            </div>
          </div>
        )}

        {step === STEPS.TUNING && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center rounded-full z-20 bg-black/60 backdrop-blur-sm p-8">
            <div className="flex items-center gap-2 text-lime-400 mb-4">
              <Sliders className="w-5 h-5" />
              <h3 className="text-lg font-bold tracking-widest">時空共振頻率</h3>
            </div>
            <div className="w-full space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-lime-400/60 uppercase tracking-widest block text-left">TIMELINE PHASE</label>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs text-lime-300 font-bold">{TIME_SCALE_LABELS[timeScale]}</span>
                  <span className="text-[10px] text-lime-400/50">LV.{timeScale}</span>
                </div>
                <input type="range" min="1" max="5" step="1" value={timeScale} onChange={(e) => setTimeScale(Number(e.target.value))} className="w-full h-1 bg-lime-900/50 rounded-lg appearance-none cursor-pointer accent-lime-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-lime-400/60 uppercase tracking-widest block text-left">HISTORICAL FIDELITY</label>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs text-lime-300 font-bold">{HISTORY_SCALE_LABELS[historyScale]}</span>
                  <span className="text-[10px] text-lime-400/50">LV.{historyScale}</span>
                </div>
                <input type="range" min="1" max="3" step="1" value={historyScale} onChange={(e) => setHistoryScale(Number(e.target.value))} className="w-full h-1 bg-lime-900/50 rounded-lg appearance-none cursor-pointer accent-lime-400" />
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleTrigger(); }} className="mt-6 px-8 py-2 bg-lime-400 text-black font-bold tracking-widest rounded hover:bg-lime-300 transition-colors shadow-[0_0_15px_rgba(57,255,20,0.5)]">啟動解析</button>
          </div>
        )}

        {step === STEPS.ANALYZING && (
          <div className="absolute inset-0 bg-stone-900/90 flex flex-col items-center justify-center text-center rounded-full z-10">
            <div className="z-10 w-[60%] space-y-4">
              <Sparkles className="w-8 h-8 text-lime-400 mx-auto animate-spin-slow opacity-80" />
              <div className="space-y-1">
                <p className="text-lg font-bold text-lime-400 tracking-wider drop-shadow-md animate-pulse">{analysisText}</p>
                <div className="flex justify-between text-lime-400/60 font-mono text-[10px] tracking-widest px-2">
                  <span>AI PROCESSING</span>
                  <span>{isProcessing ? "..." : "DONE"}</span>
                </div>
              </div>
              <div className="h-[2px] w-full bg-stone-700 relative overflow-hidden rounded-full">
                <div className="absolute top-0 left-0 h-full bg-lime-400 animate-[width_3s_ease-out_forwards] shadow-[0_0_10px_#39ff14]" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        )}

        {step === STEPS.LISTEN && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center rounded-full z-10 bg-black/60 backdrop-blur-[2px] transition-all">
            <button onClick={(e) => { e.stopPropagation(); toggleAudio(); }} className={`absolute top-16 right-10 p-2 rounded-full border ${isPlayingAudio ? 'border-lime-400/50 text-lime-400' : 'border-red-500/50 text-red-500 animate-pulse'} z-50`}>
              {isPlayingAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <div className="absolute top-12 w-full flex flex-col items-center">
              <h3 className="text-xl font-bold text-lime-300 border-b border-lime-400/30 pb-1 mb-1 inline-block drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">{artifactName}</h3>
              {!isPlayingAudio && <p className="text-[10px] text-red-400 font-mono tracking-widest">TAP ICON TO UNMUTE</p>}
            </div>
            <div className="z-10 relative px-8 mt-6 w-full max-w-[85%] min-h-[140px] flex items-center justify-center">
              <p className="text-lg font-medium text-lime-100/90 tracking-wide leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,1)] text-justify">{scriptPages[scriptPage]}</p>
            </div>
            <div className="absolute bottom-16 flex flex-col items-center gap-3 w-full">
              <div className="flex gap-1.5 justify-center">
                {scriptPages.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === scriptPage ? 'w-6 bg-lime-400' : 'w-1.5 bg-lime-900/40'}`} />
                ))}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-lime-400/60 font-mono animate-pulse">
                <span>{scriptPage < scriptPages.length - 1 ? "[ 點擊下一頁 ]" : "[ 點擊完成 ]"}</span>
                {scriptPage < scriptPages.length - 1 && <ArrowRight size={10} />}
              </div>
            </div>
          </div>
        )}

        {step === STEPS.FOCUSING && (
          <div className="absolute inset-0 overflow-hidden text-center flex flex-col items-center justify-center rounded-full z-10 cursor-grab active:cursor-grabbing">
            <div className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none transition-transform duration-75 ease-out" style={{ transform: `rotate(${focusRotation}deg)` }}>
              <div className="w-[80%] h-[80%] rounded-full border-2 border-dashed border-lime-400/30" />
              <div className="w-[85%] h-[85%] rounded-full border border-lime-400/10" />
              <div className="absolute top-8 w-1 h-3 bg-lime-400/80" />
              <div className="absolute bottom-8 w-1 h-3 bg-lime-400/30" />
              <div className="absolute left-8 w-3 h-1 bg-lime-400/30" />
              <div className="absolute right-8 w-3 h-1 bg-lime-400/30" />
            </div>
            <div className="z-10 pointer-events-none">
              <RotateCw className="w-8 h-8 text-lime-400 animate-pulse mx-auto mb-4 opacity-80" />
              <div className="space-y-1">
                <p className="text-lg font-bold text-lime-100 tracking-wider drop-shadow-md">旋轉鏡頭對焦</p>
                <p className="text-[10px] text-lime-400/60 font-mono tracking-[0.2em]">MANUAL FOCUS REQUIRED</p>
                <p className="text-[8px] text-lime-400/30 font-mono mt-1 tracking-widest">{Math.round(focusProgress * 100)}%</p>
              </div>
            </div>
          </div>
        )}

        {step === STEPS.REVEAL && historyImage && (
          <div className="absolute inset-0 z-20 rounded-full bg-black">
            <KeyholeViewer imageSrc={historyImage} position={{ x, y }} />
          </div>
        )}
      </div>

      {!hasGoogleKey && (
        <div className="fixed bottom-4 right-4 z-50">
          <button onClick={(e) => { e.stopPropagation(); setShowSettings(true); }} className={`p-3 rounded-full border shadow-lg transition-colors ${hasGoogleKey ? 'bg-stone-900/80 text-lime-400 border-lime-900/50 hover:bg-stone-800' : 'bg-red-900/80 text-white border-red-500 animate-pulse'}`}>
            <Settings size={20} />
          </button>
        </div>
      )}

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
    </>
  );
}
