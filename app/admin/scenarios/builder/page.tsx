
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Smartphone, XCircle } from 'lucide-react';
import { ScannerDisplay, DynamicConfig, STEPS } from '../../../../components/ScannerDisplay';
import { getScenariosAction, updateScenarioAction } from '../actions';
import { Scenario } from '../../../../lib/AppTypes';

const MOCK_IMAGE_URL = "https://images.unsplash.com/photo-1599399220732-47402660a996?q=80&w=1974&auto=format&fit=crop";

const LOCALIZED_STEPS = {
    [STEPS.BOOT]: "啟動 (BOOT)",
    [STEPS.PROXIMITY]: "掃描 (PROXIMITY)",
    [STEPS.LOCKED]: "鎖定 (LOCKED)",
    [STEPS.ANALYZING]: "分析 (ANALYZING)",
    [STEPS.REVEAL]: "結果 (REVEAL)",
};

const VISIBLE_STEPS = [STEPS.BOOT, STEPS.PROXIMITY, STEPS.LOCKED, STEPS.ANALYZING, STEPS.REVEAL];

export default function VisualBuilderPage() {
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(STEPS.BOOT);
    const [config, setConfig] = useState<DynamicConfig | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [scale, setScale] = useState(1);

    // Auto-scale logic
    useEffect(() => {
        const handleResize = () => {
            const h = window.innerHeight;
            // Available height approx = height - header(64px) - padding(40px)
            const availableH = h - 64 - 40;
            // Target height = 600px + border(20px) = 620px
            const targetH = 650;
            const s = Math.min(1, availableH / targetH);
            setScale(s);
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const load = async () => {
            const data = await getScenariosAction();
            setScenarios(data);
            if (data.length > 0) {
                setSelectedScenarioId(data[0].id);
                setConfig(data[0] as unknown as DynamicConfig);
            }
        };
        load();
    }, []);

    const handleScenarioChange = (id: string) => {
        if (hasUnsavedChanges) {
            if (!confirm("這將會遺失未儲存的變更，確定要切換嗎？")) return;
        }
        setSelectedScenarioId(id);
        const s = scenarios.find(x => x.id === id);
        if (s) {
            setConfig(JSON.parse(JSON.stringify(s)) as unknown as DynamicConfig);
            setHasUnsavedChanges(false);
        }
    };

    const handleConfigChange = (newConfig: DynamicConfig) => {
        setConfig(newConfig);
        setHasUnsavedChanges(true);
    };

    const handleSave = async () => {
        if (!selectedScenarioId || !config) return;

        const updates: Partial<Scenario> = {
            uiConfig: config.uiConfig,
            uiTexts: config.uiTexts
        };

        await updateScenarioAction(selectedScenarioId, updates);
        setHasUnsavedChanges(false);
        alert("設定已儲存！");

        const data = await getScenariosAction();
        setScenarios(data);
    };

    if (!config) return <div className="min-h-screen flex items-center justify-center text-white">Loading Editor...</div>;

    return (
        <div className="h-screen w-screen flex flex-col bg-gray-950 text-white overflow-hidden font-sans">
            {/* 1. Header Toolbar */}
            <div className="h-16 flex-shrink-0 border-b border-gray-800 bg-black flex items-center justify-between px-6 z-20 shadow-lg">
                <div className="flex items-center gap-4">
                    <Link href="/admin/scenarios" className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-indigo-400" />
                        <span className="font-bold text-lg tracking-wide hidden md:block">Visual Live Editor</span>
                    </div>
                </div>

                {/* State Links (Top Bar) */}
                <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
                    {VISIBLE_STEPS.map((stepKey) => (
                        <button
                            key={stepKey}
                            onClick={() => setCurrentStep(stepKey)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${currentStep === stepKey
                                ? 'bg-indigo-600 text-white shadow'
                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }`}
                        >
                            {LOCALIZED_STEPS[stepKey]}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <select
                        value={selectedScenarioId || ""}
                        onChange={(e) => handleScenarioChange(e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-sm rounded px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none hidden md:block"
                    >
                        {scenarios.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>

                    <button
                        onClick={handleSave}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${hasUnsavedChanges
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]'
                            : 'bg-gray-800 text-gray-400 cursor-not-allowed'
                            }`}
                        disabled={!hasUnsavedChanges}
                    >
                        <Save className="w-4 h-4" />
                        儲存
                    </button>

                    <Link href="/admin/scenarios" className="p-2 hover:bg-red-900/30 text-gray-400 hover:text-red-400 rounded-lg transition-colors">
                        <XCircle className="w-5 h-5" />
                    </Link>
                </div>
            </div>

            {/* 2. Main Workspace */}
            <div className="flex-1 flex items-center justify-center bg-neutral-900 relative overflow-hidden">
                {/* Grid Background */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

                {/* Circular Simulator Container with Scale */}
                {/* 
                   We use 'transform context trap' here naturally because we apply 'scale'.
                   The container is a 600px circle.
                */}
                <div
                    style={{
                        transform: `scale(${scale})`,
                        width: '600px',
                        height: '600px',
                        transition: 'transform 0.3s ease-out'
                    }}
                    className="relative flex-shrink-0 bg-black rounded-full shadow-[0_0_50px_rgba(0,0,0,0.5)] border-[10px] border-gray-800 overflow-hidden"
                >
                    {/* Editor Component */}
                    {/* ScannerDisplay (w-full h-full) will fill this 600px circle. */}
                    <ScannerDisplay
                        step={currentStep}
                        config={config}
                        isEditor={true}
                        onConfigChange={handleConfigChange}
                        // Mock Data
                        mockImage={MOCK_IMAGE_URL}
                        capturedImage={null}
                        historyImage={null}
                        historyScale={2}
                        timeScale={3}
                        artifactName="Mock Artifact"
                        scriptPages={["This is a preview script.", "You can test longer texts here."]}
                        scriptPage={0}
                        analysisText="Mocking Analysis Process..."
                        isProcessing={true}
                        focusRotation={45}
                        focusProgress={0.45}
                        isPlayingAudio={false}
                        hasGoogleKey={true}
                        position={{ x: 0, y: 0 }}
                        videoRef={{ current: null } as any}
                        onTrigger={() => { }}
                        onWheel={() => { }}
                        onToggleAudio={() => { }}
                        onShowSettings={() => { }}
                    />
                </div>

                {/* Footer Info */}
                <div className="absolute bottom-4 text-xs text-gray-500 font-mono">
                    Circular Display: 600x600px | Scale: {Math.round(scale * 100)}%
                </div>
            </div>
        </div>
    );
}
