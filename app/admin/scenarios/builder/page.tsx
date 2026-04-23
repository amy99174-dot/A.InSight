"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ScannerDisplay from '../../../../components/ScannerDisplayV2';
import { DEFAULT_CONFIG, STEPS } from '../../../../lib/defaults';
import { supabase } from '@/lib/supabase';
import { Palette, Brain, Type, Save, Camera, MonitorPlay, ArrowLeft, Loader2, Settings } from 'lucide-react';

export default function ScenarioBuilder() {
    // Top-Level Config State (The Source of Truth)
    const [config, setConfig] = useState(DEFAULT_CONFIG);

    // Selection State
    const [selectedField, setSelectedField] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(STEPS.BOOT);
    const [isSaving, setIsSaving] = useState(false);
    const [autoSaved, setAutoSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<'visuals' | 'brain' | 'texts'>('visuals');
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstRender = useRef(true);

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
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return newConfig;
        });
    };

    // Load initial config from DB (on mount)
    useEffect(() => {
        const loadConfig = async () => {
            const { data } = await supabase.from('scenario_config').select('config').eq('id', 1).single();
            if (data?.config) {
                setConfig(prev => ({ ...prev, ...data.config }));
            }
        };
        loadConfig();
    }, []);

    // Auto-save: debounce 1.5s after any config change
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(async () => {
            try {
                const { error } = await supabase
                    .from('scenario_config')
                    .update({ config: config, updated_at: new Date() })
                    .eq('id', 1);
                if (!error) {
                    setAutoSaved(true);
                    setTimeout(() => setAutoSaved(false), 2000);
                }
            } catch (e) {
                console.error('Auto-save failed:', e);
            }
        }, 1500);
        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [config]);

    // PeerJS Monitoring Logic
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
                            <h3 className="text-xs font-bold text-[#6CB4A8] mb-4 uppercase tracking-widest border-b border-[#E8D4AF] pb-2">
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
                                        className="bg-[#E8D4AF]/20 hover:bg-[#E8D4AF]/30 border border-[#E8D4AF] rounded-lg p-3 text-left transition-all hover:border-[#6CB4A8] hover:shadow-sm"
                                    >
                                        <div className="text-[10px] text-[#442916]/70 mb-1 font-medium">{theme.label}</div>
                                        <div className="w-full h-2 rounded-full border border-[#E8D4AF]" style={{ backgroundColor: theme.color }}></div>
                                    </button>
                                ))}
                            </div>

                            {/* Layout Mode Selector */}
                            <div className="mb-6">
                                <label className="text-[10px] text-[#442916]/70 block mb-2 uppercase tracking-widest font-bold">介面佈局 (Layout Mode)</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDeepConfigChange('ui_theme.layout_mode', 'classic')}
                                        className={`flex-1 py-3 border rounded-lg text-[10px] font-bold uppercase transition-all ${config.ui_theme?.layout_mode !== 'industrial' ? 'bg-[#6CB4A8] text-white border-[#6CB4A8] shadow-sm' : 'bg-white text-[#442916]/70 border-[#A84714]/30 hover:border-[#6CB4A8]'}`}
                                    >
                                        Classic Radar
                                    </button>
                                    <button
                                        onClick={() => handleDeepConfigChange('ui_theme.layout_mode', 'industrial')}
                                        className={`flex-1 py-3 border rounded-lg text-[10px] font-bold uppercase transition-all ${config.ui_theme?.layout_mode === 'industrial' ? 'bg-[#6CB4A8] text-white border-[#6CB4A8] shadow-sm' : 'bg-white text-[#442916]/70 border-[#A84714]/30 hover:border-[#6CB4A8]'}`}
                                    >
                                        Industrial HUD
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-[#442916]/70 block mb-2 font-medium">主色調 (Hex)</label>
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
                                            className="flex-1 bg-white border border-[#A84714]/30 rounded-lg px-3 text-xs text-[#442916] font-mono focus:outline-none focus:ring-2 focus:ring-[#6CB4A8]/50"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] text-[#442916]/70 block mb-2 font-medium">相機濾鏡</label>
                                    <select
                                        value={config.ui_theme?.camera_filter || 'none'}
                                        onChange={(e) => handleDeepConfigChange('ui_theme.camera_filter', e.target.value)}
                                        className="w-full bg-white border border-[#A84714]/30 rounded-lg px-3 py-2 text-xs text-[#442916] font-mono outline-none focus:ring-2 focus:ring-[#6CB4A8]/50"
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
                        <div className="p-3 bg-[#6CB4A8]/10 border border-[#6CB4A8]/30 rounded-lg text-[10px] text-[#442916] mb-4">
                            此處設定用於辨識古物與講述故事的 AI 人格。
                        </div>

                        <section className="space-y-4">
                            <div>
                                <label className="text-[10px] text-[#442916]/70 block mb-2 uppercase font-medium">角色身分</label>
                                <input
                                    type="text"
                                    value={config.ai_brain?.role || ''}
                                    onChange={(e) => handleDeepConfigChange('ai_brain.role', e.target.value)}
                                    placeholder="例如：資深考古學家"
                                    className="w-full bg-white border border-[#A84714]/30 rounded-lg px-3 py-2 text-[#442916] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#6CB4A8]/50"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[#442916]/70 block mb-2 uppercase font-medium">說話語氣</label>
                                <input
                                    type="text"
                                    value={config.ai_brain?.tone || ''}
                                    onChange={(e) => handleDeepConfigChange('ai_brain.tone', e.target.value)}
                                    placeholder="例如：正式、學術、神秘"
                                    className="w-full bg-white border border-[#A84714]/30 rounded-lg px-3 py-2 text-[#442916] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#6CB4A8]/50"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[#442916]/70 block mb-2 uppercase font-medium">視覺生成關鍵字</label>
                                <textarea
                                    value={config.ai_brain?.vision_style_keywords || ''}
                                    onChange={(e) => handleDeepConfigChange('ai_brain.vision_style_keywords', e.target.value)}
                                    placeholder="用於生成歷史圖像的風格關鍵字..."
                                    className="w-full h-20 bg-white border border-[#A84714]/30 rounded-lg px-3 py-2 text-[#442916] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#6CB4A8]/50 resize-none"
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
                                <div className="border-b border-[#E8D4AF] pb-2 mb-2">
                                    <label className="text-[10px] uppercase tracking-widest text-[#6CB4A8] mb-1 block font-bold">已選欄位</label>
                                    <div className="text-sm font-mono text-[#442916] break-words">{selectedField.split('.').pop()}</div>
                                </div>
                                <textarea
                                    value={(config.text_content as any)[selectedField.split('.').pop() as string] || ""}
                                    onChange={(e) => handleDeepConfigChange(`text_content.${selectedField.split('.').pop()}`, e.target.value)}
                                    className="w-full h-32 bg-white border border-[#A84714]/30 rounded-lg px-3 py-2 text-[#442916] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#6CB4A8]/50 resize-none"
                                    placeholder="編輯文字內容..."
                                />
                            </div>
                        ) : (
                            <div className="text-center py-10 text-[#442916]/50 text-xs">
                                請點擊預覽畫面中的文字進行編輯。
                            </div>
                        )}
                    </div>
                )}

            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#E8D4AF]/30 p-8 font-sans text-[#442916]">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[#442916] tracking-tight flex items-center gap-3">
                        <Settings className="w-8 h-8 text-[#6CB4A8]" />
                        A.InSight UI 編輯器
                    </h1>
                    <p className="text-[#442916]/70 mt-1 ml-11 flex items-center gap-2">
                        Scenario Builder &amp; Visual Designer
                        {autoSaved && (
                            <span className="text-[10px] bg-green-100 text-green-700 border border-green-300 px-2 py-0.5 rounded-full font-medium animate-in fade-in duration-300">
                                ✓ 已自動儲存
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin"
                        className="px-5 py-2.5 bg-white border border-[#A84714]/30 rounded-lg shadow-sm hover:shadow-md hover:bg-[#E8D4AF]/20 text-sm font-medium transition-all flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        數據中心
                    </Link>
                    <button
                        onClick={() => setIsMonitoring(!isMonitoring)}
                        className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isMonitoring
                            ? 'bg-red-100 text-red-700 border border-red-200 animate-pulse'
                            : 'bg-white border border-[#A84714]/30 text-[#A84714] hover:bg-[#E8D4AF]/20 shadow-sm'}`}
                    >
                        {isMonitoring ? <MonitorPlay className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                        {isMonitoring ? '監控中' : '遠端監控'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-[#6CB4A8] hover:bg-[#6CB4A8] text-white text-sm font-medium px-5 py-2.5 rounded-lg shadow-sm disabled:opacity-50 transition-all"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? "儲存中..." : "儲存變更"}
                    </button>
                </div>
            </div>

            {/* Main Content: Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT: Preview Stage (2/3 width) */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-[#E8D4AF] overflow-hidden">
                        {/* Card Header */}
                        <div className="px-6 py-4 border-b border-[#E8D4AF]/50 bg-[#E8D4AF]/20">
                            <h2 className="text-lg font-semibold text-[#442916] flex items-center gap-2">
                                <span className="p-1.5 bg-[#6CB4A8]/10 text-[#6CB4A8] rounded"><Palette className="w-5 h-5" /></span>
                                即時預覽
                            </h2>
                        </div>

                        {/* Preview Content */}
                        <div className="p-8 flex flex-col items-center justify-center bg-gradient-to-b from-[#E8D4AF]/20 to-[#E8D4AF]/30">
                            {/* Step Selector */}
                            <div className="mb-6 flex gap-2 flex-wrap justify-center w-full max-w-2xl">
                                {Object.entries(STEPS).filter(([key]) => key !== 'PROXIMITY').map(([key, value]) => (
                                    <button
                                        key={key}
                                        onClick={() => setCurrentStep(value as string)}
                                        className={`px-3 py-1.5 text-[10px] font-bold tracking-widest rounded-lg transition-all ${currentStep === value
                                            ? 'bg-[#6CB4A8] text-white shadow-sm'
                                            : 'bg-white text-[#442916]/70 border border-[#E8D4AF] hover:bg-[#E8D4AF]/20 hover:border-[#6CB4A8]/30'}`}
                                    >
                                        {key}
                                    </button>
                                ))}
                            </div>

                            {/* Hardware Simulator */}
                            <div className="relative w-[500px] h-[500px] border-8 border-[#442916] rounded-full shadow-2xl bg-black overflow-hidden ring-1 ring-[#A84714]/30 shrink-0">
                                <ScannerDisplay
                                    step={currentStep}
                                    config={config}
                                    isEditable={true}
                                    onEdit={(key) => {
                                        setActiveTab('texts');
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
                                    {/* Mock Camera Layer */}
                                    <div id="bg-layer" className="absolute inset-0 bg-cover bg-center transition-all duration-500 pointer-events-none"
                                        style={{
                                            backgroundImage: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800&auto=format&fit=crop")',
                                            opacity: (currentStep === STEPS.REVEAL) ? 0 : 0.6,
                                            backgroundSize: 'cover'
                                        }}>
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
                    </div>
                </div>

                {/* RIGHT: Inspector Panel (1/3 width) */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-[#E8D4AF] overflow-hidden sticky top-8">
                        {/* Tabs */}
                        <div className="flex border-b border-[#E8D4AF]">
                            <button
                                onClick={() => setActiveTab('visuals')}
                                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'visuals' ? 'border-[#6CB4A8] text-[#6CB4A8] bg-[#6CB4A8]/10' : 'border-transparent text-[#442916]/50 hover:text-[#A84714]'}`}
                            >
                                <Palette size={14} /> 視覺
                            </button>
                            <button
                                onClick={() => setActiveTab('brain')}
                                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'brain' ? 'border-[#A84714] text-[#A84714] bg-[#A84714]/10' : 'border-transparent text-[#442916]/50 hover:text-[#A84714]'}`}
                            >
                                <Brain size={14} /> AI
                            </button>
                            <button
                                onClick={() => setActiveTab('texts')}
                                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'texts' ? 'border-[#F3B86B] text-[#F3B86B] bg-[#F3B86B]/10' : 'border-transparent text-[#442916]/50 hover:text-[#A84714]'}`}
                            >
                                <Type size={14} /> 文字
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="p-6">
                            {renderInspector()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
