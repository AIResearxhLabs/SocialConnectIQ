import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { Calendar, Download, RefreshCw, TrendingUp, Filter, CheckCircle, AlertCircle, Share2, Users, MousePointer, Eye, Zap } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const AnalyticsDashboard = () => {
    const [timeRange, setTimeRange] = useState('30d');
    const [selectedPlatform, setSelectedPlatform] = useState('all');

    // --- MOCK DATA FOR CHARTS ---
    const growthData = [
        { date: 'Jan 1', followers: 12000, engagement: 2400 },
        { date: 'Jan 5', followers: 12150, engagement: 2300 },
        { date: 'Jan 10', followers: 12400, engagement: 2800 },
        { date: 'Jan 15', followers: 12800, engagement: 3200 },
        { date: 'Jan 20', followers: 13100, engagement: 3600 },
        { date: 'Jan 25', followers: 13500, engagement: 4100 },
        { date: 'Jan 30', followers: 14200, engagement: 4500 },
    ];

    const demographicsData = [
        { name: '18-24', value: 35 },
        { name: '25-34', value: 45 },
        { name: '35-44', value: 15 },
        { name: '45+', value: 5 },
    ];

    const platformPerformance = [
        { name: 'Instagram', reach: 45000, engagement: 12000 },
        { name: 'Facebook', reach: 32000, engagement: 8500 },
        { name: 'Twitter', reach: 28000, engagement: 6200 },
        { name: 'LinkedIn', reach: 15000, engagement: 3100 },
    ];

    const heatmapData = [
        { hour: '9AM', day: 'Mon', value: 8 },
        { hour: '12PM', day: 'Mon', value: 6 },
        { hour: '6PM', day: 'Mon', value: 9 }, // High engagement
        // ... simplified for demo
    ];

    // --- ACTIONS ---
    const handleExport = () => {
        const csvContent = "data:text/csv;charset=utf-8,Date,Followers,Engagement\n" +
            growthData.map(e => `${e.date},${e.followers},${e.engagement}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `analytics_report_${timeRange}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter data based on range (Mock logic)
    const displayedData = timeRange === '7d' ? growthData.slice(-3) : growthData;

    return (
        <div className="p-6 space-y-8 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center">
                        <TrendingUp className="mr-3 text-blue-600 dark:text-blue-400" size={32} />
                        Analytics Overview
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Track your growth, audience, and content performance.</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Date Range Picker */}
                    <div className="relative group">
                        <button
                            onClick={() => setTimeRange(prev => prev === '30d' ? '7d' : '30d')}
                            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            <Calendar size={16} className="text-gray-500 dark:text-gray-400" />
                            <span>{timeRange === '30d' ? 'Last 30 Days' : 'Last 7 Days'}</span>
                        </button>
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 hover:scale-105 transition-transform"
                    >
                        <Download size={16} />
                        <span>Export Report</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard title="Total Followers" value="14,203" change="+12.5%" icon={Users} color="text-blue-500" bg="bg-blue-100 dark:bg-blue-900/30" />
                <KPICard title="Engagement Rate" value="5.8%" change="+1.2%" icon={Zap} color="text-yellow-500" bg="bg-yellow-100 dark:bg-yellow-900/30" />
                <KPICard title="Total Reach" value="120K" change="+24%" icon={Eye} color="text-green-500" bg="bg-green-100 dark:bg-green-900/30" />
                <KPICard title="Link Clicks" value="3,405" change="-5%" icon={MousePointer} color="text-purple-500" bg="bg-purple-100 dark:bg-purple-900/30" negative />
            </div>

            {/* Main Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Growth Trend Chart (Line) */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 min-h-[400px]">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center justify-between">
                        Audience Growth & Engagement
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Daily</span>
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={displayedData}>
                                <defs>
                                    <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    itemStyle={{ color: '#374151', fontSize: '13px' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                <Area type="monotone" dataKey="followers" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorFollowers)" name="Followers" />
                                <Area type="monotone" dataKey="engagement" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorEngagement)" name="Engagement" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Demographics Chart (Pie) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 min-h-[400px]">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Audience Age</h3>
                    <div className="h-[300px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={demographicsData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {demographicsData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text Trick */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12">
                            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">25-34</span>
                            <span className="text-xs text-gray-500 uppercase tracking-widest">Top Group</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Platform Comparison (Bar) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Platform Performance</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={platformPerformance} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 13, fontWeight: 600 }} width={80} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} />
                                <Legend />
                                <Bar dataKey="reach" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="Reach" />
                                <Bar dataKey="engagement" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} name="Engagement" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* AI Insights Section */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6 rounded-xl shadow-lg border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center mb-6">
                        <div className="p-2 bg-indigo-600 rounded-lg mr-3 shadow-md shadow-indigo-200 dark:shadow-none">
                            <TrendingUp className="text-white" size={20} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI Actionable Insights</h3>
                    </div>

                    <div className="space-y-4">
                        <InsightCard
                            type="strategy"
                            title="Video Content Dominance"
                            fullText="Your Reels are generating 2.5x more engagement than static image posts. Consider increasing video output to 3x/week."
                        />
                        <InsightCard
                            type="timing"
                            title="Optimal Posting Time"
                            fullText="Your audience activity peaks on Tuesdays at 6:00 PM. Schedule your most important announcements for this window."
                        />
                        <InsightCard
                            type="alert"
                            title="Engagement Dip Warning"
                            fullText="Engagement is down 5% this week. Try jumping on the #TechTrends topic to regain momentum."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Helper Components ---

const KPICard = ({ title, value, change, icon: Icon, color, bg, negative }) => (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl ${bg}`}>
                <Icon size={20} className={color} />
            </div>
        </div>
        <div className={`inline-flex items-center text-xs font-bold px-2 py-1 rounded ${negative ? 'bg-red-50 text-red-600 dark:bg-red-900/30' : 'bg-green-50 text-green-600 dark:bg-green-900/30'}`}>
            <span className="mr-1">{negative ? '↓' : '↑'}</span>
            {change}
            <span className="ml-1 font-normal text-gray-400">vs last month</span>
        </div>
    </div>
);

const InsightCard = ({ type, title, fullText }) => {
    let icon = <TrendingUp size={16} />;
    let colorClass = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";

    if (type === 'timing') { icon = <Calendar size={16} />; colorClass = "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"; }
    if (type === 'alert') { icon = <AlertCircle size={16} />; colorClass = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"; }

    return (
        <div className="flex gap-4 p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-indigo-50 dark:border-gray-700">
            <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm mb-1">{title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {fullText}
                </p>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
