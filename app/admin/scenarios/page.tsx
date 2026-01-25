
'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Check, Power, Edit3, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { toggleScenario, updateScenarioAction, getScenariosAction } from './actions';
import { Scenario } from '../../../lib/AppTypes';

export default function ScenariosPage() {
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await getScenariosAction();
        setScenarios(data);
        setLoading(false);
    };

    const handleToggle = async (id: string, isActive: boolean) => {
        if (isActive) return;
        setScenarios(scenarios.map(s => ({ ...s, isActive: s.id === id })));
        await toggleScenario(id);
        loadData();
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="p-2 bg-white rounded-full shadow hover:bg-gray-50 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">情境模式管理</h1>
                            <p className="text-gray-500 mt-1">管理 AI 角色、Prompt 與介面風格。</p>
                        </div>
                    </div>

                    <Link href="/admin/scenarios/builder" className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-lg hover:shadow-indigo-500/30 transition-all font-bold text-sm">
                        <Smartphone className="w-4 h-4" />
                        進入視覺化編輯器 (Visual Editor)
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {scenarios.map(s => (
                        <div key={s.id} className={`bg-white rounded-xl border-2 transition-all overflow-hidden ${s.isActive ? 'border-indigo-500 shadow-md transform scale-[1.02]' : 'border-gray-200 hover:border-gray-300'}`}>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2 rounded-lg ${s.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                                        <Power className="w-5 h-5" />
                                    </div>
                                    {s.isActive && (
                                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">使用中</span>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{s.name}</h3>
                                <p className="text-sm text-gray-500 line-clamp-2 h-10">{s.description}</p>
                            </div>
                            <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between items-center">
                                <button
                                    onClick={() => handleToggle(s.id, s.isActive)}
                                    disabled={s.isActive}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${s.isActive ? 'bg-gray-200 text-gray-400 cursor-default' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                >
                                    {s.isActive ? '啟用中' : '啟用'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
