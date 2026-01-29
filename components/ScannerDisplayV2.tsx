import React from 'react';
import { DEFAULT_CONFIG } from '../lib/defaults';
import { AlertTriangle, X, Settings, Terminal } from 'lucide-react';
import ClassicSkinV2 from './skins/ClassicSkinV2';
import IndustrialSkinV2 from './skins/IndustrialSkinV2';
import { ScannerSkinPropsV2 } from '../types/scanner_v2';

// Re-export props if needed, or use the one from types
export type ScannerDisplayPropsV2 = ScannerSkinPropsV2;

export default function ScannerDisplayV2(props: ScannerDisplayPropsV2) {
    const {
        config,
        showSettings,
        setShowSettings,
        userGoogleKey,
        setUserGoogleKey,
        userOpenAIKey,
        setUserOpenAIKey,
        hasGoogleKey,
        debugLog,
        cameraError,
        children
    } = props;

    // Destructure theme safely
    const ui = config.ui_theme || DEFAULT_CONFIG.ui_theme;

    // Determine which skin to use
    // Default to 'classic' if undefined
    const layoutMode = (ui as any).layout_mode || 'classic';

    return (
        <div className="relative w-full h-full flex items-center justify-center font-mono text-white">

            {/* Camera Filter Application (Global CSS Filter on container or overlay) */}
            {ui.camera_filter && ui.camera_filter !== 'none' && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .camera-layer video { 
                        filter: ${ui.camera_filter === 'grayscale' ? 'grayscale(100%)' :
                            ui.camera_filter === 'sepia' ? 'sepia(80%) contrast(1.2)' :
                                ui.camera_filter === 'contrast' ? 'contrast(150%)' : 'none'};
                    }
                `}} />
            )}

            {/* Development Controller / Settings Button */}
            {!hasGoogleKey && (
                <div className="fixed top-4 left-4 z-50">
                    <button onClick={() => setShowSettings(true)} className="bg-red-900/80 text-white border border-red-500 px-2 py-1 text-xs rounded animate-pulse">
                        KEY MISSING - SETTINGS
                    </button>
                </div>
            )}

            {/* Camera Error Banner  */}
            {cameraError && (
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] text-center w-[90%] max-w-sm">
                    <div className="bg-red-950/90 border border-red-500 text-white p-6 rounded-xl shadow-2xl backdrop-blur-xl">
                        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4 animate-bounce" />
                        <h3 className="text-xl font-bold mb-2">相機無法啟動</h3>
                        <p className="text-sm opacity-90 mb-4 font-mono">{cameraError}</p>
                        <div className="text-[10px] text-left bg-black/50 p-3 rounded text-red-200">
                            請檢查瀏覽器權限或 HTTPS 設定。
                        </div>
                    </div>
                </div>
            )}

            {/* --- SKIN RENDERER (V2) --- */}
            {layoutMode === 'industrial' ? (
                <IndustrialSkinV2 {...props}>
                    {children}
                </IndustrialSkinV2>
            ) : (
                <ClassicSkinV2 {...props}>
                    {children}
                </ClassicSkinV2>
            )}

            {/* KEEP SETTINGS MODAL */}
            {showSettings && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
                    <div className="w-full max-w-md bg-[#1a1816] border-2 border-[#39ff14] rounded-xl p-6 shadow-2xl relative text-lime-400 font-mono overflow-y-auto max-h-[80vh]">
                        <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-lime-700 hover:text-lime-400"><X size={24} /></button>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-lime-900/50 pb-2"><Settings className="w-5 h-5" />系統維護面板</h2>
                        {/* Settings content same, omitted for brevity, keeping original fields */}
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
