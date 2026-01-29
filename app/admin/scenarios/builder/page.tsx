"use client";

import React, { useState, useEffect } from 'react';
import ScannerDisplay from '../../../../components/ScannerDisplayV2';
import { DEFAULT_CONFIG, STEPS } from '../../../../lib/defaults';
import { supabase } from '@/lib/supabase';
import { Palette, Brain, Type, Save, Radio, Camera, MonitorPlay } from 'lucide-react';

export default function ScenarioBuilder() {
    // Top-Level Config State (The Source of Truth)
    const [config, setConfig] = useState(DEFAULT_CONFIG);

    // Selection State
    const [selectedField, setSelectedField] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(STEPS.BOOT);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'visuals' | 'brain' | 'texts'>('visuals');

    // Remote Monitoring State
    const [isMonitoring, setIsMonitoring] = useState(false);
    const videoRef = React.useRef<HTMLVideoElement>(null);

    // Deep Update Helper
    const handleDeepConfigChange = (path: string, value: any) => {
        setConfig(prev => {
            const newConfig = { ...prev };
            const keys = path.split('.');
            let current: any = newConfig;

            for (let i = 0; i < keys.length - 1; i++) {
                // If key missing, create object (shouldn't happen with default init)
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return newConfig;
        });
    };

    // Load initial config from DB (on mount) to ensuring syncing
    useEffect(() => {
        const loadConfig = async () => {
            const { data } = await supabase.from('scenario_config').select('config').eq('id', 1).single();
            if (data?.config) {
                // Deep merge with defaults to ensure new keys exist if old config is loaded
                setConfig(prev => ({ ...prev, ...data.config }));
            }
        };
        loadConfig();
    }, []);

    // PeerJS Monitoring Logic (Same as before)
    useEffect(() => {
        if (!isMonitoring) return;
        let peer: any = null;
        let call: any = null;
        const startMonitoring = async () => {
            try {
                const { Peer } = await import('peerjs');
                peer = new Peer();
                peer.on('open', (id: string) => {
                    call = peer.call('ainsight-display-secure', {} as MediaStream);
                    if (call) {
                        call.on('stream', (remoteStream: MediaStream) => {
                            if (videoRef.current) videoRef.current.srcObject = remoteStream;
                        });
                    }
                });
            } catch (e) {
                console.error("Peer Init Failed", e);
            }
        };
        startMonitoring();
        return () => {
            if (call) call.close();
            if (peer) peer.destroy();
        };
    }, [isMonitoring]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('scenario_config')
                .update({ config: config, updated_at: new Date() })
                .eq('id', 1);

            if (error) throw error;
            alert("已同步至雲端！");
        } catch (error) {
            console.error("Save failed:", error);
            alert("儲存失敗");
        } finally {
            setIsSaving(false);
        }
    };

    // Render Inspector based on Active Tab
    const renderInspector = () => {
        return (
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">

                {/* --- VISUALS TAB --- */}
                {activeTab === 'visuals' && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        <section>
                            <h3 className="text-xs font-bold text-lime-400 mb-4 uppercase tracking-widest border-b border-lime-900/50 pb-2">
                                主題與濾鏡
                            </h3>

                            {/* Preset Buttons */}
                            <div className="grid grid-cols-2 gap-2 mb-6">
                                {[
                                    { id: 'default', label: '預設暗黑', color: '#ffffff', filter: 'none' },
                                    { id: 'cyberpunk', label: '賽博龐克', color: '#39ff14', filter: 'contrast' },
                                    { id: 'archive', label: '歷史檔案', color: '#d4af37', filter: 'sepia' },
                                    { id: 'minimal', label: '極簡風格', color: '#a1a1aa', filter: 'grayscale' },
                                ].map(theme => (
                                    <button
                                        key={theme.id}
                                        onClick={() => {
                                            handleDeepConfigChange('ui_theme.primary_color', theme.color);
                                            handleDeepConfigChange('ui_theme.camera_filter', theme.filter);
                                        }}
                                        className="bg-white/5 hover:bg-white/10 border border-white/10 rounded p-3 text-left transition-all hover:border-lime-400/50"
                                    >
                                        <div className="text-[10px] text-white/50 mb-1">{theme.label}</div>
                                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: theme.color }}></div>
                                    </button>
                                ))}
                            </div>

                            {/* Layout Mode Selector (Added back) */}
                            <div className="mb-6">
                                <label className="text-[10px] text-white/50 block mb-2 uppercase tracking-widest font-bold">介面佈局 (Layout Mode)</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDeepConfigChange('ui_theme.layout_mode', 'classic')}
                                        className={`flex-1 py-3 border rounded text-[10px] font-bold uppercase transition-all ${config.ui_theme?.layout_mode !== 'industrial' ? 'bg-lime-400 text-black border-lime-400' : 'bg-black/50 text-white/50 border-white/20 hover:border-white/50'}`}
                                    >
                                        Classic Radar
                                    </button>
                                    <button
                                        onClick={() => handleDeepConfigChange('ui_theme.layout_mode', 'industrial')}
                                        className={`flex-1 py-3 border rounded text-[10px] font-bold uppercase transition-all ${config.ui_theme?.layout_mode === 'industrial' ? 'bg-lime-400 text-black border-lime-400' : 'bg-black/50 text-white/50 border-white/20 hover:border-white/50'}`}
                                    >
                                        Industrial HUD
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-white/50 block mb-2">主色調 (Hex)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={config.ui_theme?.primary_color || '#ffffff'}
                                            onChange={(e) => handleDeepConfigChange('ui_theme.primary_color', e.target.value)}
                                            className="h-8 w-8 bg-transparent border-0 rounded cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={config.ui_theme?.primary_color || ''}
                                            onChange={(e) => handleDeepConfigChange('ui_theme.primary_color', e.target.value)}
                                            className="flex-1 bg-black/50 border border-white/20 rounded px-2 text-xs text-white font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] text-white/50 block mb-2">相機濾鏡</label>
                                    <select
                                        value={config.ui_theme?.camera_filter || 'none'}
                                        onChange={(e) => handleDeepConfigChange('ui_theme.camera_filter', e.target.value)}
                                        className="w-full bg-black/50 border border-white/20 rounded px-2 py-2 text-xs text-white font-mono outline-none focus:border-lime-400"
                                    >
                                        <option value="none">無 (原色)</option>
                                        <option value="grayscale">黑白 (Noir)</option>
                                        <option value="sepia">懷舊 (Historical)</option>
                                        <option value="contrast">高反差 (Cyber)</option>
                                    </select>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* --- BRAIN TAB --- */}
                {activeTab === 'brain' && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        <div className="p-3 bg-indigo-900/20 border border-indigo-500/30 rounded text-[10px] text-indigo-200 mb-4">
                            此處設定用於辨識古物與講述故事的 AI 人格。
                        </div>

                        <section className="space-y-4">
                            <div>
                                <label className="text-[10px] text-white/50 block mb-2 uppercase">角色身分</label>
                                <input
                                    type="text"
                                    value={config.ai_brain?.role || ''}
                                    onChange={(e) => handleDeepConfigChange('ai_brain.role', e.target.value)}
                                    placeholder="例如：資深考古學家"
                                    className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white font-mono text-xs focus:border-indigo-400 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-white/50 block mb-2 uppercase">說話語氣</label>
                                <input
                                    type="text"
                                    value={config.ai_brain?.tone || ''}
                                    onChange={(e) => handleDeepConfigChange('ai_brain.tone', e.target.value)}
                                    placeholder="例如：正式、學術、神秘"
                                    className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white font-mono text-xs focus:border-indigo-400 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-white/50 block mb-2 uppercase">視覺生成關鍵字</label>
                                <textarea
                                    value={config.ai_brain?.vision_style_keywords || ''}
                                    onChange={(e) => handleDeepConfigChange('ai_brain.vision_style_keywords', e.target.value)}
                                    placeholder="用於生成歷史圖像的風格關鍵字..."
                                    className="w-full h-20 bg-black/50 border border-white/20 rounded px-3 py-2 text-white font-mono text-xs focus:border-indigo-400 outline-none resize-none"
                                />
                            </div>
                        </section>
                    </div>
                )}

                {/* --- TEXTS TAB --- */}
                {activeTab === 'texts' && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        {selectedField ? (
                            <div className="space-y-4">
                                <div className="border-b border-white/10 pb-2 mb-2">
                                    <label className="text-[10px] uppercase tracking-widest text-lime-400 mb-1 block">已選欄位</label>
                                    <div className="text-sm font-mono text-white break-words">{selectedField.split('.').pop()}</div>
                                </div>
                                <textarea
                                    value={(config.text_content as any)[selectedField.split('.').pop() as string] || ""}
                                    onChange={(e) => handleDeepConfigChange(`text_content.${selectedField.split('.').pop()}`, e.target.value)}
                                    className="w-full h-32 bg-black/50 border border-white/20 rounded px-3 py-2 text-white font-mono text-sm focus:border-lime-400 outline-none resize-none"
                                    placeholder="編輯文字內容..."
                                />
                            </div>
                        ) : (
                            <div className="text-center py-10 text-white/30 text-xs">
                                請點擊預覽畫面中的文字進行編輯。
                            </div>
                        )}
                    </div>
                )}

            </div>
        );
    };

    return (
        <main className="w-screen h-screen bg-neutral-900 flex overflow-hidden font-mono text-sm">
            {/* LEFT: Preview Stage */}
            <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-800 to-neutral-950 flex flex-col items-center justify-center p-8">

                {/* Step Selector */}
                <div className="mb-6 flex gap-2 flex-wrap justify-center z-10 w-full max-w-2xl bg-black/30 p-2 rounded-lg backdrop-blur-sm">
                    {Object.entries(STEPS).map(([key, value]) => (
                        <button
                            key={key}
                            onClick={() => setCurrentStep(value)}
                            className={`px-3 py-1 text-[10px] font-bold tracking-widest rounded transition-all ${currentStep === value ? 'bg-lime-400 text-black shadow-lg shadow-lime-400/20' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                        >
                            {key}
                        </button>
                    ))}
                </div>

                {/* Hardware Simulator */}
                <div className="relative w-[600px] h-[600px] border-8 border-neutral-950 rounded-full shadow-2xl bg-black overflow-hidden ring-1 ring-white/10 shrink-0">
                    <ScannerDisplay
                        step={currentStep}
                        config={config}
                        isEditable={true}
                        onEdit={(key) => {
                            setActiveTab('texts'); // Switch to texts tab on click
                            setSelectedField(key);
                        }}

                        // Mock Props
                        artifactName="Builder Preview"
                        analysisText="Editing Mode..."
                        scriptPages={["Preview Content"]}
                        scriptPage={0}
                        debugLog="// Builder Mode Active"
                        isProcessing={false}
                        isPlayingAudio={false}
                        focusRotation={0}
                        historyScale={2}
                        timeScale={3}
                        onTrigger={() => { }}
                        onWheel={() => { }}
                        toggleAudio={() => { }}
                        showSettings={false}
                        setShowSettings={() => { }}
                        userGoogleKey=""
                        setUserGoogleKey={() => { }}
                        userOpenAIKey=""
                        setUserOpenAIKey={() => { }}
                        hasGoogleKey={true}
                        historyImage={null}
                        orientation={{ x: 0, y: 0 }}
                    >
                        {/* Mock Camera Layer - Simulates the real app environment */}
                        <div id="bg-layer" className="absolute inset-0 bg-cover bg-center transition-all duration-500 pointer-events-none"
                            style={{
                                backgroundImage: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800&auto=format&fit=crop")', // Clean Office/Indoor Space
                                opacity: (currentStep === STEPS.REVEAL) ? 0 : 0.6,
                                backgroundSize: 'cover'
                            }}>
                            {/* Mock Scan Lines */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_1px] pointer-events-none z-10" />
                        </div>

                        {/* Monitor Layer */}
                        {isMonitoring ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover opacity-50 grayscale absolute inset-0 z-20"
                            />
                        ) : null}
                    </ScannerDisplay>
                </div>
            </div>

            {/* RIGHT: Inspector Panel */}
            <div className="w-[400px] border-l border-white/10 bg-neutral-900/95 backdrop-blur shadow-2xl flex flex-col z-20">
                {/* Header Actions */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsMonitoring(!isMonitoring)}
                            className={`p-2 rounded border transition-all ${isMonitoring ? 'bg-red-900/50 border-red-500 text-red-100 animate-pulse' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}
                            title="Toggle Remote Monitor"
                        >
                            {isMonitoring ? <MonitorPlay size={16} /> : <Camera size={16} />}
                        </button>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-lime-400 text-black text-xs font-bold px-4 py-2 rounded hover:bg-lime-300 disabled:opacity-50 transition-colors"
                    >
                        <Save size={14} />
                        {isSaving ? "儲存中..." : "儲存變更"}
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => setActiveTab('visuals')}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'visuals' ? 'border-lime-400 text-lime-400' : 'border-transparent text-white/30 hover:text-white/70'}`}
                    >
                        <Palette size={14} /> 視覺設計
                    </button>
                    <button
                        onClick={() => setActiveTab('brain')}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'brain' ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-white/30 hover:text-white/70'}`}
                    >
                        <Brain size={14} /> AI 大腦
                    </button>
                    <button
                        onClick={() => setActiveTab('texts')}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'texts' ? 'border-yellow-400 text-yellow-400' : 'border-transparent text-white/30 hover:text-white/70'}`}
                    >
                        <Type size={14} /> 欄位設定
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden p-6 relative">
                    {renderInspector()}
                </div>
            </div>
        </main>
    );
}
