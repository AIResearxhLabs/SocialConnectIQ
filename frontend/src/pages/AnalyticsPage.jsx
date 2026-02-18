import React, { useState, useEffect } from 'react';
import { fetchAnalyticsOverview } from '../api/analytics';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Users, Activity, Share2, Award, Zap, TrendingUp, Globe, MapPin, X, Calendar, Clock, Image as ImageIcon } from 'lucide-react';

const AnalyticsPage = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPost, setSelectedPost] = useState(null);

    const formatDate = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const overview = await fetchAnalyticsOverview();
            setData(overview);
        } catch (err) {
            setError("Failed to load analytics data. Ensure the service is running.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full w-full min-h-[500px]">
                <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Activity className="text-blue-500/50" size={24} />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="p-4 bg-red-500/10 rounded-full mb-4">
                    <Zap className="text-red-500 h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">{error}</p>
                <button
                    onClick={loadData}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 font-medium"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    if (!data) return null;

    // Check for empty state (no real data)
    if (data.has_data === false) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 min-h-[500px]">
                <div className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-3xl mb-6">
                    <Activity className="text-blue-500 h-12 w-12" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No Analytics Yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                    {data.message || "Connect your accounts and start posting to see your analytics!"}
                </p>
                <button
                    onClick={loadData}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 font-medium"
                >
                    Refresh
                </button>
            </div>
        );
    }

    // Local tracking view (when has_data is true but from Firestore)
    if (data.has_data === true && data.total_posts !== undefined) {
        return (
            <div className="w-full p-4 lg:p-8 space-y-8 animate-fade-in pb-24">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                            Your Activity
                        </h1>
                        <p className="text-lg text-gray-500 dark:text-gray-400 mt-2 font-light">
                            Posts made through SocialConnectIQ
                        </p>
                    </div>
                    <button
                        onClick={loadData}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm font-medium"
                    >
                        Refresh
                    </button>
                </div>

                {/* Summary Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Share2 className="h-6 w-6 opacity-80" />
                            <span className="font-medium">Total Posts</span>
                        </div>
                        <div className="text-5xl font-black">{data.total_posts}</div>
                    </div>

                    {data.platform_stats?.map((platform, index) => (
                        <div key={index} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-4">
                                <Globe className="h-6 w-6 text-gray-400" />
                                <span className="font-medium capitalize text-gray-700 dark:text-gray-300">{platform.platform}</span>
                            </div>
                            <div className="text-4xl font-black text-gray-900 dark:text-white">{platform.posts}</div>
                            <div className="text-sm text-gray-500 mt-1">posts</div>
                        </div>
                    ))}
                </div>

                {/* Recent Posts */}
                {data.recent_posts && data.recent_posts.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Posts</h3>
                        <div className="space-y-3">
                            {data.recent_posts.map((post, index) => (
                                <div
                                    key={index}
                                    onClick={() => setSelectedPost(post)}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                                >
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{post.content}</p>
                                            {post.image && <ImageIcon size={14} className="text-blue-500 flex-shrink-0" />}
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <div className="flex gap-1">
                                                {post.platforms?.map((p, i) => (
                                                    <span key={i} className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded capitalize">
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                                <span>•</span>
                                                <Clock size={12} />
                                                <span>{formatDate(post.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded capitalize ${post.status === 'posted' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                        {post.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Note about engagement metrics */}
                {data.note && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                            💡 {data.note}
                        </p>
                    </div>
                )}

                {/* Post Detail Modal */}
                {selectedPost && (
                    <PostDetailModal
                        post={selectedPost}
                        onClose={() => setSelectedPost(null)}
                        formatDate={formatDate}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="w-full p-4 lg:p-8 space-y-8 animate-fade-in pb-24">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                        Analytics Overview
                    </h1>
                    <p className="text-lg text-gray-500 dark:text-gray-400 mt-2 font-light">
                        Real-time insights across your digital ecosystem
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-gray-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700/50 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Live Data: {new Date(data.last_updated).toLocaleTimeString()}
                    </span>
                </div>
            </div>

            {/* KPI Grid - Bento Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Audience"
                    value={data.total_followers.toLocaleString()}
                    icon={Users}
                    trend={data.followers_growth_pct}
                    color="from-blue-500/20 to-indigo-500/5"
                    borderColor="border-blue-500/20"
                    iconColor="text-blue-500"
                />
                <StatCard
                    title="Total Reach"
                    value={data.total_reach.toLocaleString()}
                    icon={Globe}
                    trend={12.5}
                    color="from-purple-500/20 to-pink-500/5"
                    borderColor="border-purple-500/20"
                    iconColor="text-purple-500"
                />
                <StatCard
                    title="Engagement Rate"
                    value={`${data.avg_engagement_rate}%`}
                    icon={Activity}
                    trend={-0.8}
                    color="from-emerald-500/20 to-teal-500/5"
                    borderColor="border-emerald-500/20"
                    iconColor="text-emerald-500"
                />
                <StatCard
                    title="Top Platform"
                    value="Twitter/X"
                    icon={Award}
                    subtext="Highest Interaction"
                    color="from-amber-500/20 to-orange-500/5"
                    borderColor="border-amber-500/20"
                    iconColor="text-amber-500"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:h-[500px]">

                {/* Growth Chart - Takes up 2 columns */}
                <div className="xl:col-span-2 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <TrendingUp className="text-blue-500" size={20} />
                                Audience Growth
                            </h3>
                            <p className="text-sm text-gray-500">Net follower gain over last 30 days</p>
                        </div>
                        <select className="bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-gray-300">
                            <option>Last 30 Days</option>
                            <option>Last 7 Days</option>
                            <option>Year to Date</option>
                        </select>
                    </div>

                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.daily_trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(str) => new Date(str).getDate()}
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dx={-10}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                                        backdropFilter: 'blur(8px)',
                                        borderColor: 'rgba(55, 65, 81, 0.5)',
                                        color: '#fff',
                                        borderRadius: '12px',
                                        borderWidth: '1px',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: '5 5' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="followers_total"
                                    stroke="#3B82F6"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorFollowers)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Platform Demographics - Takes up 1 column */}
                <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none flex flex-col">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <MapPin className="text-purple-500" size={20} />
                        Top Locations
                    </h3>
                    <div className="flex-1 flex flex-col justify-center space-y-6">
                        {Object.entries(data.audience.locations).map(([label, value], index) => (
                            <div key={label} className="relative group">
                                <div className="flex justify-between text-sm font-medium mb-2 z-10 relative">
                                    <span className="text-gray-700 dark:text-gray-300">{label}</span>
                                    <span className="text-gray-900 dark:text-white">{Math.round(value * 100)}%</span>
                                </div>
                                <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${index === 0 ? 'from-blue-500 to-cyan-400' :
                                            index === 1 ? 'from-purple-500 to-pink-400' :
                                                'from-gray-500 to-gray-400'
                                            }`}
                                        style={{ width: `${value * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Mini Gender Stats at Bottom */}
                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700/50 flex items-center justify-around">
                        <div className="text-center">
                            <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">
                                {Math.round(data.audience.gender_split.Male * 100)}%
                            </div>
                            <div className="text-xs uppercase tracking-wider font-semibold text-gray-400 mt-1">Male</div>
                        </div>
                        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
                        <div className="text-center">
                            <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-rose-500">
                                {Math.round(data.audience.gender_split.Female * 100)}%
                            </div>
                            <div className="text-xs uppercase tracking-wider font-semibold text-gray-400 mt-1">Female</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Platform Performance Footer - Horizontal Layout */}
            <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Platform Performance</h3>
                        <p className="text-sm text-gray-500">Engagement breakdown by channel</p>
                    </div>
                    <div className="flex gap-2">
                        {['Followers', 'Posts', 'Engagement'].map((tab, i) => (
                            <button
                                key={tab}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${i === 0
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                                    : 'bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.platform_breakdown} barSize={40}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                            <XAxis
                                dataKey="platform_name"
                                stroke="#9CA3AF"
                                fontSize={14}
                                fontWeight={600}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{
                                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                                    backdropFilter: 'blur(8px)',
                                    borderColor: 'rgba(55, 65, 81, 0.5)',
                                    color: '#fff',
                                    borderRadius: '12px'
                                }}
                            />
                            <Bar
                                dataKey="followers"
                                name="Followers"
                                radius={[8, 8, 8, 8]} // Fully rounded bars
                            >
                                {data.platform_breakdown.map((entry, index) => (
                                    <cell key={`cell-${index}`} fill={
                                        index === 0 ? '#1DA1F2' : // Twitter Blue
                                            index === 1 ? '#0A66C2' : // LinkedIn Blue
                                                '#E1306C' // Instagram gradient-ish pink
                                    } />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Post Detail Modal (fallback) */}
            {selectedPost && (
                <PostDetailModal
                    post={selectedPost}
                    onClose={() => setSelectedPost(null)}
                    formatDate={formatDate}
                />
            )}
        </div>
    );
};

// --- Styled Components ---

const StatCard = ({ title, value, icon: Icon, trend, subtext, color, borderColor, iconColor }) => {
    const isPositive = trend > 0;

    return (
        <div className={`relative overflow-hidden bg-gradient-to-br ${color} backdrop-blur-xl p-6 rounded-3xl border ${borderColor} shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl group`}>
            {/* Background Decor */}
            <div className="absolute -right-4 -top-4 opacity-10 transform rotate-12 group-hover:rotate-45 transition-transform duration-500">
                <Icon size={120} />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm ${iconColor}`}>
                        <Icon size={24} />
                    </div>
                    {trend && (
                        <div className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-lg backdrop-blur-sm ${isPositive
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                            }`}>
                            {isPositive ? <ArrowUpRight size={16} strokeWidth={3} /> : <ArrowDownRight size={16} strokeWidth={3} />}
                            {Math.abs(trend)}%
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="text-gray-600 dark:text-gray-400 text-sm font-semibold tracking-wide uppercase mb-1 opacity-80">{title}</h3>
                    <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{value}</div>
                    {subtext && <div className="text-xs text-gray-500 dark:text-gray-300 mt-2 font-medium bg-white/30 dark:bg-black/20 w-fit px-2 py-0.5 rounded-md">{subtext}</div>}
                </div>
            </div>
        </div>
    );
};

const PostDetailModal = ({ post, onClose, formatDate }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-scale-in">
                {/* Modal Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Activity size={20} className="text-blue-500" />
                        Post Details
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 space-y-6">
                    {/* Text Content */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Content</h4>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl text-gray-800 dark:text-gray-200 text-lg leading-relaxed whitespace-pre-wrap">
                            {post.full_content || post.content}
                        </div>
                    </div>

                    {/* Image */}
                    {post.image && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <ImageIcon size={16} /> Attached Image
                            </h4>
                            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
                                <img
                                    src={post.image}
                                    alt="Post attachment"
                                    className="w-full h-auto object-contain max-h-[400px]"
                                />
                            </div>
                        </div>
                    )}

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1 flex items-center gap-2">
                                <Calendar size={16} /> Posted At
                            </div>
                            <div className="text-gray-900 dark:text-white font-semibold">
                                {formatDate(post.created_at)}
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
                            <div className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1 flex items-center gap-2">
                                <Share2 size={16} /> Platforms
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {post.platforms?.map((p, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-white dark:bg-gray-800 rounded text-xs border border-purple-200 dark:border-purple-800 shadow-sm capitalize">
                                        {p}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
