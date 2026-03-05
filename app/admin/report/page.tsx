'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { ArrowLeft, FileText, Users, Clock, TrendingUp, Award, BarChart3, Target, Zap, Calendar } from 'lucide-react';

// Color palettes
const HOUR_COLORS = ['#6366f1', '#818cf8', '#a5b4fc'];
const ERA_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const PREF_COLORS = ['#3B82F6', '#10B981', '#F59E0B'];
const TIME_COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e'];

interface HistoryLog {
    id: number;
    created_at: string;
    artifact_name: string;
    era: string;
    category: string;
    session_id?: string | null;
    input_settings?: { historyScale: number; timeScale: number };
    duration_seconds?: number | null;
    completed?: boolean;
    interaction_count?: number;
    [key: string]: any;
}

// KPI Card Component
const KPICard = ({ icon: Icon, label, value, sub, color }: any) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-3">
            <span className={`p-2 rounded-lg ${color}`}><Icon className="w-5 h-5" /></span>
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
        </div>
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        {sub && <div className="text-sm text-gray-400 mt-1">{sub}</div>}
    </div>
);

// Chart Card
const ChartCard = ({ title, icon: Icon, children, className = "" }: any) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 text-indigo-600" />}
                {title}
            </h3>
        </div>
        <div className="p-6">{children}</div>
    </div>
);

export default function ReportPage() {
    const [logs, setLogs] = useState<HistoryLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('history_logs')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            if (data) setLogs(data);
        } catch (e) {
            console.error("Fetch Error:", e);
        } finally {
            setLoading(false);
        }
    };

    // ===== ANALYTICS COMPUTATION =====

    const totalInteractions = logs.length;
    const uniqueSessions = new Set(logs.map(d => d.session_id).filter(Boolean)).size;
    const avgPerSession = uniqueSessions > 0 ? (totalInteractions / uniqueSessions).toFixed(1) : "0";

    // Duration stats
    const durationsValid = logs.filter(l => l.duration_seconds && l.duration_seconds > 0);
    const avgDuration = durationsValid.length > 0
        ? Math.round(durationsValid.reduce((s, l) => s + (l.duration_seconds || 0), 0) / durationsValid.length)
        : 0;
    const completedCount = logs.filter(l => l.completed).length;
    const completionRate = totalInteractions > 0 ? Math.round((completedCount / totalInteractions) * 100) : 0;

    // TOP 10 Artifacts
    const artifactCount: Record<string, number> = {};
    logs.forEach(l => {
        const name = l.artifact_name || 'Unknown';
        if (name !== 'Unknown' && name !== '未知文物') artifactCount[name] = (artifactCount[name] || 0) + 1;
    });
    const topArtifacts = Object.entries(artifactCount)
        .map(([name, count]) => ({ name: name.length > 8 ? name.slice(0, 8) + '…' : name, fullName: name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // Era Distribution
    const eraCount: Record<string, number> = {};
    logs.forEach(l => {
        let era = l.era || 'Unknown';
        if (era.includes('清')) era = '清代';
        else if (era.includes('明')) era = '明代';
        else if (era.includes('宋')) era = '宋代';
        else if (era.includes('唐')) era = '唐代';
        else if (era.includes('漢')) era = '漢代';
        else if (era.includes('元')) era = '元代';
        else if (era.includes('周')) era = '周代';
        eraCount[era] = (eraCount[era] || 0) + 1;
    });
    const eraData = Object.entries(eraCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    // Hourly Distribution (0-23)
    const hourCount = new Array(24).fill(0);
    logs.forEach(l => {
        const h = new Date(l.created_at).getHours();
        hourCount[h]++;
    });
    const hourlyData = hourCount.map((count, h) => ({
        hour: `${h}時`,
        count,
        period: h < 12 ? '上午' : (h < 18 ? '下午' : '晚上')
    }));

    // Period summary (morning/afternoon/evening)
    const periodCount = { '上午 (6-12)': 0, '下午 (12-18)': 0, '晚上 (18-24)': 0, '凌晨 (0-6)': 0 };
    logs.forEach(l => {
        const h = new Date(l.created_at).getHours();
        if (h >= 6 && h < 12) periodCount['上午 (6-12)']++;
        else if (h >= 12 && h < 18) periodCount['下午 (12-18)']++;
        else if (h >= 18) periodCount['晚上 (18-24)']++;
        else periodCount['凌晨 (0-6)']++;
    });
    const periodData = Object.entries(periodCount).map(([name, value]) => ({ name, value }));

    // Daily Trend (last 30 days)
    const dayMap: Record<string, number> = {};
    logs.forEach(l => {
        const day = new Date(l.created_at).toISOString().split('T')[0];
        dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const dailyData = Object.entries(dayMap)
        .map(([date, count]) => ({ date: date.slice(5), count }))  // MM-DD
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

    // Weekday vs Weekend
    const weekdayCount = { '平日': 0, '假日': 0 };
    logs.forEach(l => {
        const dow = new Date(l.created_at).getDay();
        if (dow === 0 || dow === 6) weekdayCount['假日']++;
        else weekdayCount['平日']++;
    });
    const weekdayData = [
        { name: '平日 (一~五)', value: weekdayCount['平日'] },
        { name: '假日 (六日)', value: weekdayCount['假日'] }
    ];

    // Story Preference
    const scaleCount = { '傳說': 0, '野史': 0, '正史': 0 };
    logs.forEach(l => {
        const h = l.input_settings?.historyScale;
        if (h === 1) scaleCount['傳說']++;
        else if (h === 2) scaleCount['野史']++;
        else if (h === 3) scaleCount['正史']++;
    });
    const storyData = [
        { name: '傳說', value: scaleCount['傳說'] },
        { name: '野史', value: scaleCount['野史'] },
        { name: '正史', value: scaleCount['正史'] }
    ];

    // Time Phase Preference
    const timeLabels: Record<number, string> = { 1: '誕生前', 2: '誕生', 3: '全盛', 4: '出土', 5: '未來' };
    const timeCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    logs.forEach(l => {
        const t = l.input_settings?.timeScale;
        if (t && t >= 1 && t <= 5) timeCount[t]++;
    });
    const timeData = [1, 2, 3, 4, 5].map(i => ({ name: timeLabels[i], value: timeCount[i] }));

    // Day of week distribution
    const dowLabels = ['日', '一', '二', '三', '四', '五', '六'];
    const dowCount = new Array(7).fill(0);
    logs.forEach(l => { dowCount[new Date(l.created_at).getDay()]++; });
    const dowData = dowCount.map((count, i) => ({ name: `週${dowLabels[i]}`, count }));

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-gray-400 animate-pulse text-lg">載入中...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8 font-sans text-gray-800">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <FileText className="w-8 h-8 text-indigo-600" />
                        展覽數據報告
                    </h1>
                    <p className="text-gray-500 mt-1 ml-11">Exhibition Analytics Report</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/admin" className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md hover:bg-gray-50 text-sm font-medium transition-all flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> 數據中心
                    </Link>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <KPICard icon={Target} label="總互動次數" value={totalInteractions} color="bg-indigo-50 text-indigo-600" />
                <KPICard icon={Users} label="獨立使用者" value={uniqueSessions} sub={`平均 ${avgPerSession} 次/人`} color="bg-green-50 text-green-600" />
                <KPICard icon={Clock} label="平均互動時長" value={avgDuration > 0 ? `${avgDuration}s` : '–'} color="bg-purple-50 text-purple-600" />
                <KPICard icon={TrendingUp} label="完成率" value={`${completionRate}%`} sub={`${completedCount}/${totalInteractions}`} color="bg-amber-50 text-amber-600" />
                <KPICard icon={Zap} label="使用者黏著度" value={avgPerSession} sub="次/人" color="bg-rose-50 text-rose-600" />
            </div>

            {/* Row 1: Top Artifacts + Era */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ChartCard title="最受歡迎文物 TOP 10" icon={Award}>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topArtifacts} layout="vertical" margin={{ left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v: any, n: any, p: any) => [v, p.payload.fullName]} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                {topArtifacts.map((_, i) => <Cell key={i} fill={ERA_COLORS[i % ERA_COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="最受歡迎朝代" icon={Calendar}>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={eraData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="count" nameKey="name" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {eraData.map((_, i) => <Cell key={i} fill={ERA_COLORS[i % ERA_COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Row 2: Hourly + Daily Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ChartCard title="每小時使用分布" icon={Clock}>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={hourlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {hourlyData.map((d, i) => (
                                    <Cell key={i} fill={d.period === '上午' ? '#6366f1' : d.period === '下午' ? '#f59e0b' : '#1e1b4b'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-6 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-500"></span>上午</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span>下午</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-950"></span>晚上</span>
                    </div>
                </ChartCard>

                <ChartCard title="每日使用趨勢（近 30 天）" icon={TrendingUp}>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={dailyData}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#colorCount)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Row 3: Period + Weekday + Day of Week */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <ChartCard title="時段分布" icon={Clock}>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie data={periodData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} dataKey="value" nameKey="name" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}>
                                {periodData.map((_, i) => <Cell key={i} fill={['#6366f1', '#f59e0b', '#1e1b4b', '#94a3b8'][i]} />)}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="平日 vs 假日" icon={Calendar}>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie data={weekdayData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} dataKey="value" nameKey="name" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                <Cell fill="#6366f1" />
                                <Cell fill="#f59e0b" />
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="週間分布" icon={BarChart3}>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={dowData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Row 4: Preferences */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="參數偏好：史實度" icon={Target}>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={storyData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" nameKey="name" label={({ name, percent }: any) => percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}>
                                {storyData.map((_, i) => <Cell key={i} fill={PREF_COLORS[i]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="參數偏好：時間軸" icon={TrendingUp}>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={timeData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {timeData.map((_, i) => <Cell key={i} fill={TIME_COLORS[i]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-xs text-gray-400">
                報告產生時間：{new Date().toLocaleString('zh-TW')} ｜ 資料筆數：{totalInteractions}
            </div>
        </div>
    );
}
