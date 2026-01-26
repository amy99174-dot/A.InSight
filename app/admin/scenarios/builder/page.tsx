"use client";

import React, { useState, useEffect } from 'react';
import ScannerDisplay from '../../../../components/ScannerDisplay';
import { DEFAULT_CONFIG, STEPS } from '../../../../lib/defaults';
import { supabase } from '@/lib/supabase';
// import { updateScenario } from '../actions'; // No longer needed for saving

// Reuse the props type for type safety if possible, or define locally
// import { ScannerDisplayProps } from '../../../../components/ScannerDisplay'; 
// (Assuming standard export)

export default function ScenarioBuilder() {
    // Top-Level Config State (The Source of Truth)
    const [config, setConfig] = useState(DEFAULT_CONFIG);

    // Selection State
    const [selectedField, setSelectedField] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(STEPS.BOOT);
    const [isSaving, setIsSaving] = useState(false);

    // Remote Monitoring State
    const [isMonitoring, setIsMonitoring] = useState(false);
    const videoRef = React.useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!isMonitoring) return;

        let peer: any = null;
        let call: any = null;

        const startMonitoring = async () => {
            try {
                const { Peer } = await import('peerjs');
                peer = new Peer(); // Random ID

                peer.on('open', (id: string) => {
                    console.log('Monitor Peer ID:', id);
                    // Call the display
                    call = peer.call('ainsight-display', new MediaStream()); // Minimal dummy stream to init call?
                    // Actually, to receive only, createCall options... PeerJS usually expects a stream.
                    // But newer PeerJS allows receiving only? 
                    // Standard way: We call THEM. They answer with stream.
                    // But `peer.call` usually takes `localStream`. Can we pass null? 
                    // Let's pass a dummy audio track if needed, or check docs. 
                    // Usually passing a dummy stream is safest.

                    // Simple hack: Create a dummy stream
                    // const dummyStream = new MediaStream();
                    // Does peer.call REQUIRE a stream? The types say yes usually.
                    // Let's try passing undefined/null, if it fails, I'll create a dummy canvas stream.
                    call = peer.call('ainsight-display-secure', {} as MediaStream); // Type cast cheat for now or check if it works without stream.
                    // Actually PeerJS documentation says mediaStream is optional in some versions, but standard WebRTC often wants it.
                    // If it fails, I will add a dummy stream generator.

                    if (call) {
                        call.on('stream', (remoteStream: MediaStream) => {
                            console.log("Stream received!");
                            if (videoRef.current) {
                                videoRef.current.srcObject = remoteStream;
                            }
                        });
                        call.on('close', () => console.log("Call closed"));
                        call.on('error', (e: any) => console.error("Call error", e));
                    }
                });

                peer.on('error', (err: any) => console.error("Peer Error", err));

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

    // Update Handler
    const handleConfigChange = (key: string, value: any) => {
        setConfig(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('scenario_config')
                .update({ config: config, updated_at: new Date() })
                .eq('id', 1);

            if (error) throw error;

            alert("已同步至雲端！(Synced to Cloud)");
        } catch (error) {
            console.error("Save failed:", error);
            alert("儲存失敗 (Failed)");
        } finally {
            setIsSaving(false);
        }
    };

    // Render Inspector Input based on field type
    const renderInspector = () => {
        if (!selectedField) {
            return (
                <div className="text-white/50 text-center mt-20 text-sm">
                    點擊左側介面元素以編輯屬性
                </div>
            );
        }

        const isColorField = selectedField.toLowerCase().includes('color');
        const currentValue = (config as any)[selectedField] || "";

        return (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="border-b border-white/10 pb-4">
                    <label className="text-[10px] uppercase tracking-widest text-lime-400 mb-1 block">Selected Field</label>
                    <div className="text-xl font-mono text-white break-words">{selectedField}</div>
                </div>

                <div className="space-y-4">
                    {/* Value Input */}
                    <div>
                        <label className="text-xs text-white/70 mb-2 block">Value</label>
                        {isColorField ? (
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={currentValue.startsWith('#') ? currentValue : '#ffffff'}
                                    onChange={(e) => handleConfigChange(selectedField, e.target.value)}
                                    className="h-10 w-10 bg-transparent border-0 rounded cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={currentValue}
                                    onChange={(e) => handleConfigChange(selectedField, e.target.value)}
                                    className="flex-1 bg-black/50 border border-white/20 rounded px-3 py-2 text-white font-mono text-sm focus:border-lime-400 outline-none"
                                    placeholder="Hex or Tailwind Class"
                                />
                            </div>
                        ) : (
                            <textarea
                                value={currentValue}
                                onChange={(e) => handleConfigChange(selectedField, e.target.value)}
                                className="w-full h-32 bg-black/50 border border-white/20 rounded px-3 py-2 text-white font-mono text-sm focus:border-lime-400 outline-none resize-none"
                                placeholder="Edit text content..."
                            />
                        )}
                        <p className="text-[10px] text-white/30 mt-2">
                            {isColorField ? "支援 Hex (#RRGGBB) 或 Tailwind Class (如 text-red-500)" : "支援即時預覽"}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <main className="w-screen h-screen bg-neutral-900 flex overflow-hidden font-mono">
            {/* LEFT: Preview Stage (The "Hardware" Simulator) */}
            <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-800 to-neutral-950 flex flex-col items-center justify-center p-8">

                {/* Step Selector Toolbar */}
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

                {/* 600x600 Circular Hardware Container */}
                <div className="relative w-[600px] h-[600px] border-8 border-neutral-950 rounded-full shadow-2xl bg-black overflow-hidden ring-1 ring-white/10 shrink-0">
                    <ScannerDisplay
                        step={currentStep}
                        config={config}
                        isEditable={true}
                        onEdit={(key) => setSelectedField(key)}

                        // Mock Props required by component
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
                        onTrigger={() => console.log("Trigger in Builder")}
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
                        {/* Monitor Layer */}
                        {isMonitoring ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover opacity-50 grayscale"
                            />
                        ) : null}
                    </ScannerDisplay>
                </div>

                {/* Overlay Grid / Guides (Optional visual flair) */}
                <div className="absolute inset-0 pointer-events-none opacity-20"
                    style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                </div>
            </div>

            {/* RIGHT: Inspector Panel */}
            <div className="w-[400px] border-l border-white/10 bg-neutral-900/95 backdrop-blur shadow-2xl p-6 flex flex-col z-10">
                <div className="flex items-center justify-between border-b border-lime-400/30 pb-4 mb-4">
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest">
                        Inspector
                    </h2>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-lime-400 text-black text-[10px] font-bold px-3 py-1 rounded hover:bg-lime-300 disabled:opacity-50"
                    >
                        {isSaving ? "SAVING..." : "SAVE CHANGES"}
                    </button>
                </div>

                {/* Monitor Toggle */}
                <div className="mb-6 border-b border-lime-400/30 pb-4">
                    <button
                        onClick={() => setIsMonitoring(!isMonitoring)}
                        className={`w-full py-2 text-xs font-bold rounded tracking-widest border transition-all ${isMonitoring ? 'bg-red-900/50 border-red-500 text-red-100 animate-pulse' : 'bg-black/30 border-white/20 text-white/50 hover:bg-white/5'}`}
                    >
                        {isMonitoring ? "🔴 LIVE MONITORING" : "CONNECT TO CAMERA"}
                    </button>
                </div>
                {renderInspector()}
            </div>
        </main>
    );
}
