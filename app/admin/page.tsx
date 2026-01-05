
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend
} from 'recharts';
import { Loader2, Database, Activity, Clock, Users, Zap, Award, PieChart as PieIcon, Eye, X, Copy, Check, Search, Calendar, Filter, XCircle } from 'lucide-react';

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

const TIME_COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e']; // Indigo to Rose

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
    const [timePhaseData, setTimePhaseData] = useState<any[]>([]);

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

        // 5. Time Phase Preference (TimeScale Distribution)
        // 1: 起因, 2: 鑄造, 3: 使用, 4: 流轉, 5: 未來
        const timeCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const timeLabels: Record<number, string> = {
            1: '起因 (靈感)',
            2: '鑄造 (誕生)',
            3: '使用 (全盛)',
            4: '流轉 (遺棄)',
            5: '未來 (命運)'
        };

        data.forEach(item => {
            const tScale = item.input_settings?.timeScale;
            if (tScale && tScale >= 1 && tScale <= 5) {
                timeCount[tScale]++;
            }
        });

        setTimePhaseData([
            { name: timeLabels[1], value: timeCount[1] },
            { name: timeLabels[2], value: timeCount[2] },
            { name: timeLabels[3], value: timeCount[3] },
            { name: timeLabels[4], value: timeCount[4] },
            { name: timeLabels[5], value: timeCount[5] },
        ]);
    };

    const [selectedLog, setSelectedLog] = useState<HistoryLog | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // Filter States
    const [searchQuery, setSearchQuery] = useState("");
    const [filterDate, setFilterDate] = useState("");

    // Filter Logic
    const filteredLogs = logs.filter(log => {
        // 1. Text Search (ID or Name)
        const searchLower = searchQuery.toLowerCase();
        const idMatch = log.id.toString().includes(searchLower);
        const nameMatch = (log.artifact_name || "").toLowerCase().includes(searchLower);
        const textMatch = !searchQuery || idMatch || nameMatch;

        // 2. Date Filter
        let dateMatch = true;
        if (filterDate) {
            try {
                // Normalize log date to YYYY-MM-DD
                const logDate = new Date(log.created_at).toISOString().split('T')[0];
                dateMatch = logDate === filterDate;
            } catch (e) {
                console.warn("Date parse error", e);
                dateMatch = false;
            }
        }

        return textMatch && dateMatch;
    });

    const clearFilters = () => {
        setSearchQuery("");
        setFilterDate("");
    };

    const openModal = (log: HistoryLog) => {
        setSelectedLog(log);
        setIsModalOpen(true);
        setCopied(false);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedLog(null), 300); // Clear after animation
    };

    const handleCopy = async () => {
        if (!selectedLog) return;
        const textToCopy = selectedLog.summary || selectedLog.script_prompt || "尚無內容";
        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    // Modal Component
    const LogModal = () => {
        if (!selectedLog || !isModalOpen) return null;

        const content = selectedLog.summary || selectedLog.script_prompt || "尚無資料 (No Content Available)";
        const isFallback = !selectedLog.summary;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    onClick={closeModal}
                />

                {/* Modal Content */}
                <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/50">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Database className="w-5 h-5 text-indigo-400" />
                                {selectedLog.artifact_name || "未知文物"}
                            </h3>
                            <p className="text-gray-400 text-xs mt-1">
                                編號: {selectedLog.id} • 年代: {selectedLog.era}
                            </p>
                        </div>
                        <button
                            onClick={closeModal}
                            className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto custom-scrollbar">
                        {isFallback && (
                            <div className="mb-4 px-3 py-2 bg-amber-900/20 border border-amber-800/50 rounded-lg text-amber-200 text-xs flex items-center">
                                <Activity className="w-3 h-3 mr-2" />
                                摘要缺失，顯示原始導覽詞。
                            </div>
                        )}

                        <div className="prose prose-invert max-w-none">
                            <pre className="whitespace-pre-wrap font-sans text-gray-300 text-sm leading-relaxed">
                                {content}
                            </pre>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-800 bg-gray-950/50 flex justify-end gap-3">
                        <button
                            onClick={handleCopy}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${copied
                                ? 'bg-green-600 text-white shadow-lg shadow-green-900/20'
                                : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
                                }`}
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? '已複製' : '複製內容'}
                        </button>
                        <button
                            onClick={closeModal}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-900/20 transition-all"
                        >
                            關閉
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50 text-gray-500 font-sans">
                <Loader2 className="h-10 w-10 animate-spin mr-3" />
                <span>載入數據中...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8 font-sans text-gray-800 relative">
            <LogModal />
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

            {/* Level 2: Top Artifacts (Moving to own row for better layout) */}
            <div className="mb-8">
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
            </div>

            {/* Level 3: Preference Charts (Side-by-Side) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* 3.1 Story Preference */}
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

                {/* 3.2 Time Phase Preference */}
                <ChartCard title="時空相位偏好 (Time Phase Preference)" icon={<Clock className="w-5 h-5" />}>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={timePhaseData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {timePhaseData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={TIME_COLORS[index % TIME_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={TooltipStyle} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* Level 4: Era Trends */}
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

            {/* Level 5: Raw Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Database className="w-5 h-5 text-gray-500" />
                            監控日誌
                        </h2>
                        <span className="text-sm text-gray-500 font-normal">
                            (共 {filteredLogs.length} 筆{logs.length !== filteredLogs.length ? `，篩選自 ${logs.length} 筆` : ''})
                        </span>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜尋編號或文物..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full md:w-64 transition-shadow"
                            />
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow text-gray-600"
                            />
                        </div>
                        {(searchQuery || filterDate) && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <XCircle className="w-4 h-4" />
                                清除
                            </button>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                <th className="px-6 py-4 border-b border-gray-100">編號</th>
                                <th className="px-6 py-4 border-b border-gray-100">場次</th>
                                <th className="px-6 py-4 border-b border-gray-100">紀錄時間</th>
                                <th className="px-6 py-4 border-b border-gray-100">文物名稱</th>
                                <th className="px-6 py-4 border-b border-gray-100">年代</th>
                                <th className="px-6 py-4 border-b border-gray-100">參數</th>
                                <th className="px-6 py-4 border-b border-gray-100 w-1/4">導覽詞</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-mono text-sm">
                            {filteredLogs.length > 0 ? (
                                filteredLogs.map((log) => (
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
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => openModal(log)}
                                                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                點擊查看
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Filter className="w-8 h-8 text-gray-300" />
                                            <p>沒有符合篩選條件的日誌。</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
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
