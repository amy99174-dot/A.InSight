
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend
} from 'recharts';
import { Loader2, Database, Activity, Clock, Users, Zap, Award, PieChart as PieIcon } from 'lucide-react';

// Color palette
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B']; // Blue, Green, Yellow

interface HistoryLog {
    id: number;
    created_at: string;
    artifact_name: string;
    era: string;
    category: string;
    script_prompt: string;
    session_id?: number | null;
    input_settings?: {
        historyScale: number;
        timeScale: number;
    };
    [key: string]: any;
}

interface AnalyticsStats {
    totalQueries: number;
    totalSessions: number;
    avgQueriesPerSession: string;
    lastActivity: string;
}

export default function AdminPage() {
    const [logs, setLogs] = useState<HistoryLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AnalyticsStats>({
        totalQueries: 0,
        totalSessions: 0,
        avgQueriesPerSession: "0",
        lastActivity: "N/A"
    });

    // Chart Data States
    const [eraData, setEraData] = useState<any[]>([]);
    const [artifactData, setArtifactData] = useState<any[]>([]);
    const [storyPrefData, setStoryPrefData] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('history_logs')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setLogs(data);
                processAnalytics(data);
            }
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const processAnalytics = (data: HistoryLog[]) => {
        // 1. Basic KPIs
        const totalQueries = data.length;
        const uniqueSessions = new Set(data.map(d => d.session_id).filter(Boolean)).size;

        // Avoid division by zero
        const avgQueries = uniqueSessions > 0 ? (totalQueries / uniqueSessions).toFixed(1) : "0";
        const lastActivity = totalQueries > 0
            ? new Date(data[0].created_at).toLocaleString('zh-TW')
            : '無紀錄';

        setStats({
            totalQueries,
            totalSessions: uniqueSessions,
            avgQueriesPerSession: avgQueries,
            lastActivity
        });

        // 2. Era Normalization & Distribution
        const eraCount: Record<string, number> = {};
        data.forEach(item => {
            let era = item.era || 'Unknown';
            // Simple normalization
            if (era.includes('清') || era.toLowerCase().includes('qing')) era = '清代 (Qing)';
            else if (era.includes('明') || era.toLowerCase().includes('ming')) era = '明代 (Ming)';
            else if (era.includes('宋') || era.toLowerCase().includes('song')) era = '宋代 (Song)';
            else if (era.includes('唐') || era.toLowerCase().includes('tang')) era = '唐代 (Tang)';
            else if (era.includes('漢') || era.toLowerCase().includes('han')) era = '漢代 (Han)';

            eraCount[era] = (eraCount[era] || 0) + 1;
        });

        setEraData(Object.keys(eraCount).map(key => ({
            name: key,
            count: eraCount[key]
        })).sort((a, b) => b.count - a.count));

        // 3. Top 5 Artifacts
        const artifactCount: Record<string, number> = {};
        data.forEach(item => {
            const name = item.artifact_name || 'Unknown';
            if (name !== 'Unknown' && name !== '未知文物') {
                artifactCount[name] = (artifactCount[name] || 0) + 1;
            }
        });
        setArtifactData(Object.keys(artifactCount).map(key => ({
            name: key,
            count: artifactCount[key]
        })).sort((a, b) => b.count - a.count).slice(0, 5));

        // 4. Story Preference (HistoryScale Distribution)
        // 1: 軼聞 (Anecdote), 2: 通史 (General), 3: 正史 (Academic)
        const scaleCount: Record<string, number> = { '軼聞': 0, '通史': 0, '正史': 0 };
        data.forEach(item => {
            const hScale = item.input_settings?.historyScale;
            if (hScale === 1) scaleCount['軼聞']++;
            else if (hScale === 2) scaleCount['通史']++;
            else if (hScale === 3) scaleCount['正史']++;
        });

        setStoryPrefData([
            { name: '軼聞 (Mystery)', value: scaleCount['軼聞'] },
            { name: '通史 (General)', value: scaleCount['通史'] },
            { name: '正史 (Academic)', value: scaleCount['正史'] },
        ]);
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50 text-gray-500 font-sans">
                <Loader2 className="h-10 w-10 animate-spin mr-3" />
                <span>正在載入分析數據...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8 font-sans text-gray-800">
            {/* Header */}
            <div className="mb-10 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <Award className="w-8 h-8 text-indigo-600" />
                        A.InSight 策展數據中心
                    </h1>
                    <p className="text-gray-500 mt-1 ml-11">Curatorial Analytics & Insights</p>
                </div>
                <button
                    onClick={fetchData}
                    className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md hover:bg-gray-50 text-sm font-medium transition-all flex items-center gap-2"
                >
                    <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    重新整理 (Refresh)
                </button>
            </div>

            {/* Level 1: KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <KPICard
                    icon={<Database className="w-6 h-6 text-blue-500" />}
                    label="總探測次數 (Total Queries)"
                    value={stats.totalQueries}
                />
                <KPICard
                    icon={<Users className="w-6 h-6 text-purple-500" />}
                    label="總訪客數 (Unique Sessions)"
                    value={stats.totalSessions}
                />
                <KPICard
                    icon={<Zap className="w-6 h-6 text-yellow-500" />}
                    label="平均互動深度 (Avg. Queries/Session)"
                    value={stats.avgQueriesPerSession}
                    highlight
                />
            </div>

            {/* Level 2: Insights Charts (Grid Layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* 2.1 Top Artifacts */}
                <ChartCard title="展品人氣排行 (Most Processed Artifacts)" icon={<Award className="w-5 h-5" />}>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={artifactData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#4B5563', fontSize: 12 }} />
                                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={TooltipStyle} />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={30}>
                                    {artifactData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* 2.2 Story Preference */}
                <ChartCard title="敘事風格偏好 (Storytelling Preference)" icon={<PieIcon className="w-5 h-5" />}>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={storyPrefData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {storyPrefData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={TooltipStyle} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* Level 3: Era Trends */}
            <div className="mb-8">
                <ChartCard title="歷史斷代分佈 (Era Distribution)" icon={<Activity className="w-5 h-5" />}>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={eraData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={TooltipStyle} />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {eraData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* Level 4: Raw Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Database className="w-5 h-5 text-gray-500" />
                        監控日誌 (System Logs)
                    </h2>
                    <span className="text-sm text-gray-500">Last update: {stats.lastActivity}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                <th className="px-6 py-4 border-b border-gray-100">ID</th>
                                <th className="px-6 py-4 border-b border-gray-100">Session</th>
                                <th className="px-6 py-4 border-b border-gray-100">Timestamp</th>
                                <th className="px-6 py-4 border-b border-gray-100">Artifact</th>
                                <th className="px-6 py-4 border-b border-gray-100">Era</th>
                                <th className="px-6 py-4 border-b border-gray-100">Settings</th>
                                <th className="px-6 py-4 border-b border-gray-100 w-1/4">Summary</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-mono text-sm">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-indigo-50/40 transition-colors group">
                                    <td className="px-6 py-4 text-gray-400">#{log.id}</td>
                                    <td className="px-6 py-4">
                                        {log.session_id ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-purple-50 text-purple-600 border border-purple-100/50">
                                                S-{log.session_id}
                                            </span>
                                        ) : <span className="text-gray-300">-</span>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                                        {new Date(log.created_at).toLocaleString('zh-TW', { hour12: false })}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                        {log.artifact_name || "Unknown"}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{log.era}</td>
                                    <td className="px-6 py-4 text-xs text-gray-500">
                                        H:{log.input_settings?.historyScale} / T:{log.input_settings?.timeScale}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 truncate max-w-[200px]" title={log.summary || log.script_prompt}>
                                        {log.summary || "No Summary"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// UI Components

const KPICard = ({ icon, label, value, highlight = false }: any) => (
    <div className={`p-6 rounded-xl shadow-sm border transition-shadow hover:shadow-md flex items-start space-x-4 ${highlight ? 'bg-gradient-to-br from-white to-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
        <div className={`p-3 rounded-lg ${highlight ? 'bg-amber-100 text-amber-600' : 'bg-gray-50'}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <h3 className={`font-bold mt-1 ${highlight ? 'text-3xl text-amber-700' : 'text-2xl text-gray-900'}`}>{value}</h3>
        </div>
    </div>
);

const ChartCard = ({ title, icon, children }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
        <h2 className="text-lg font-semibold mb-6 flex items-center text-gray-800">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded mr-2">{icon}</span>
            {title}
        </h2>
        <div className="flex-grow flex items-center justify-center">
            {children}
        </div>
    </div>
);

const TooltipStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '8px',
    border: 'none',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    padding: '12px'
};
