import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import {
    onAuthStateChanged,
    signInAnonymously,
    signInWithCustomToken,
    signOut
} from "firebase/auth";
import {
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    collection,
    query,
    serverTimestamp,
    orderBy,
    increment
} from "firebase/firestore";
import { aiService } from './api/ai';
import { auth, db } from "./firebase";
import BillingContent from './components/BillingContent';
import Billing from './components/Billing';
import AdBanner from './components/AdBanner';
import { Sun, Moon, LayoutDashboard, Send, BarChart2, Settings, Zap, Facebook, Instagram, Twitter, Linkedin, Cloud, MessageSquare, LogIn, X, Clock, Image as ImageIcon, Upload, Menu, Phone, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight, ThumbsUp, MessageSquare as CommentIcon, Share2, TrendingUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Bell, MoreVertical, Trash2, Sparkles, Eye, FileText, Save, History, CheckCircle2, Info, Hash, LogOut, Download, RefreshCw, Plus, Check, User, CreditCard, Lock } from 'lucide-react';


// --- API INTEGRATION LAYER ---
import {
    authenticateLinkedIn,
    authenticateFacebook,
    authenticateTwitter,
    authenticateInstagram,
    sendWhatsAppOTP,
    verifyWhatsAppOTP,
    getAllIntegrationsStatus,
    disconnectLinkedIn,
    disconnectFacebook,
    disconnectTwitter,
    disconnectInstagram,
    disconnectWhatsApp,
    postToLinkedIn, // Ensure this is imported
    postToFacebook, // NEW: Import Facebook posting function
    fetchTrendingTopics,
    fetchTrendingTopicsFast,
    draftFromTrending,
    clearTrendingCache,
} from './api/social';

import { autoSignInWithLastProvider, getLastProvider } from './api/auth';
import AnalyticsPage from './pages/AnalyticsPage';
import UserTypeOnboarding from './components/UserTypeOnboarding';

// --- GLOBAL FIREBASE VARIABLE SETUP (MANDATORY) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- MOCK DATA AND CONSTANTS ---

const PLATFORMS = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600', hover: 'hover:bg-blue-700', description: 'Schedule posts and track page performance.' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-600', hover: 'hover:bg-pink-700', description: 'Publish Reels, Stories, and carousel posts.' },
    { id: 'twitter', name: 'Twitter (X)', icon: Twitter, color: 'bg-sky-500', hover: 'hover:bg-sky-600', description: 'Monitor engagement and publish tweets.' },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'bg-sky-700', hover: 'hover:bg-sky-800', description: 'Manage company pages and professional profiles.' },
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'bg-green-600', hover: 'hover:bg-green-700', description: 'Manage customer communications via WhatsApp API.' },
    { id: 'onedrive', name: 'OneDrive', icon: Cloud, color: 'bg-blue-500', hover: 'hover:bg-blue-600', description: 'Access media files directly from cloud storage.' },
];

// UPDATED MOCK ANALYTICS: All values set to 0
const MOCK_ANALYTICS = [
    { platform: 'Facebook', posts: 0, reach: 0, engagement: 0 },
    { platform: 'Instagram', posts: 0, reach: 0, engagement: 0 },
    { platform: 'WhatsApp', posts: 0, reach: 0, engagement: 0 },
    { platform: 'LinkedIn', posts: 0, reach: 0, engagement: 0 },
];

// --- Toast Notification Component ---
const ToastNotification = ({ toasts, removeToast }) => {
    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 animate-slide-in
                        ${toast.type === 'success'
                            ? 'bg-green-500 text-white'
                            : toast.type === 'error'
                                ? 'bg-red-500 text-white'
                                : toast.type === 'info'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-700 text-white'
                        }`}
                >
                    <span className="text-lg">
                        {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '🔔'}
                    </span>
                    <p className="flex-1 text-sm font-medium">{toast.message}</p>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="p-1 hover:bg-white/20 rounded transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
};

// --- Post Detail Modal Component ---
const PostDetailModal = ({ post, isOpen, onClose, onDelete, onDeletePlatform, deleting }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [activeTab, setActiveTab] = useState(null);

    // Set default active tab when post opens
    useEffect(() => {
        if (post && post.platforms && post.platforms.length > 0) {
            setActiveTab(post.platforms[0]);
        } else if (post) {
            setActiveTab('default');
        }
    }, [post]);

    if (!isOpen || !post) return null;

    const scheduledDate = post.scheduledTime?.seconds
        ? new Date(post.scheduledTime.seconds * 1000)
        : new Date(post.scheduledTime);

    const handleDeleteClick = () => {
        setShowMenu(false);
        setConfirmDelete(true);
    };

    const handleConfirmDelete = async () => {
        if (onDeletePlatform && activeTab && activeTab !== 'default') {
            await onDeletePlatform(post, activeTab);
        } else {
            await onDelete(post);
        }
        setConfirmDelete(false);
        // We generally close, but if there are other platforms remaining, parent should handle update.
        // For simplicity, we close for now as the parent usually refreshes state.
        onClose();
    };

    const activePlatform = PLATFORMS.find(p => p.id === activeTab);
    // Get content specific to the active platform (if tailored), else fallback to generic content
    const displayContent = (activeTab && post.platformDrafts && post.platformDrafts[activeTab])
        ? post.platformDrafts[activeTab]
        : post.content;

    // Determine status for this platform (if we track per-platform status in the future)
    // Currently we only have global status, so we use that.
    const displayStatus = post.status;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header with Tabs */}
                <div className="flex flex-col border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="flex items-center justify-between p-4 pb-2">
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${displayStatus === 'posted' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                displayStatus === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                                    'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                }`}>
                                {displayStatus || 'pending'}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {scheduledDate.toLocaleDateString()} • {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tabs */}
                    {post.platforms && post.platforms.length > 0 && (
                        <div className="flex px-4 gap-2 overflow-x-auto no-scrollbar">
                            {post.platforms.map(pId => {
                                const p = PLATFORMS.find(pl => pl.id === pId);
                                if (!p) return null;
                                const Icon = p.icon;
                                const isActive = activeTab === pId;
                                return (
                                    <button
                                        key={pId}
                                        onClick={() => setActiveTab(pId)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${isActive
                                            ? `border-${p.color.split('-')[1]}-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                    >
                                        <Icon size={16} className={isActive ? `text-${p.color.split('-')[1]}-500` : ''} />
                                        {p.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Content Body */}
                <div className="p-0 overflow-y-auto flex-1 bg-white dark:bg-gray-800">
                    <div className="p-6">
                        {/* Content Text */}
                        <div className="mb-6">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                {activePlatform ? `${activePlatform.name} Post Content` : 'Content'}
                            </h4>
                            <p className="text-base text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                                {displayContent}
                            </p>
                        </div>

                        {/* Image Preview */}
                        {post.image && (
                            <div className="mb-6 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                                <img src={post.image} alt="Post image" className="w-full max-h-[300px] object-cover" />
                            </div>
                        )}

                        {/* Metadata / IDs */}
                        {post.platformPostIds && post.platformPostIds[activeTab] && (
                            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs font-mono text-gray-500 break-all">
                                <span className="font-bold text-gray-400 select-none mr-2">REMOTE ID:</span>
                                {post.platformPostIds[activeTab]}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer / Actions */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
                    <div className="text-xs text-gray-400 italic">
                        {post.platforms?.length > 1 ? 'Deleting removes only this platform.' : 'Deleting removes this post entirely.'}
                    </div>

                    {/* Delete Button */}
                    <button
                        onClick={() => setConfirmDelete(true)}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Trash2 size={16} />
                        Delete from {activePlatform?.name || 'Platform'}
                    </button>
                </div>

                {/* Delete Confirmation Modal (Nested) */}
                {confirmDelete && (
                    <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 z-[60] flex items-center justify-center p-6 backdrop-blur-[2px] transition-all">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 text-center max-w-xs animate-in fade-in zoom-in duration-200 border border-gray-100 dark:border-gray-700">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Delete from {activePlatform?.name}?</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                {post.platforms?.length > 1
                                    ? `This will remove the post from ${activePlatform?.name} but keep others.`
                                    : "This will permanently delete this post from your calendar."}
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    disabled={deleting}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-lg shadow-red-500/30 transition-colors"
                                >
                                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Posts List Panel Component ---
const PostsListPanel = ({ posts, selectedDate, onClose, onPostClick }) => {
    if (!posts || posts.length === 0) return null;

    const dateStr = selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                        {dateStr}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Posts List */}
                <div className="p-2 max-h-[60vh] overflow-y-auto">
                    {posts.map((post) => {
                        const scheduledDate = post.scheduledTime?.seconds
                            ? new Date(post.scheduledTime.seconds * 1000)
                            : new Date(post.scheduledTime);

                        return (
                            <div
                                key={post.id}
                                onClick={() => onPostClick(post)}
                                className={`p-4 mb-3 rounded-xl border cursor-pointer transition-all hover:shadow-lg relative min-h-[100px] ${post.status === 'posted'
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                    }`}
                            >
                                {/* Top row: Status badge + Time */}
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${post.status === 'posted'
                                        ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                                        }`}>
                                        {post.status || 'pending'}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {/* Content area with space for image */}
                                <div className={`${post.image ? 'pr-24' : ''}`}>
                                    <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed line-clamp-4">
                                        {post.content}
                                    </p>
                                </div>

                                {/* Image thumbnail - BOTTOM RIGHT (absolute positioned) */}
                                {post.image && (
                                    <div className="absolute bottom-3 right-3 w-20 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm">
                                        <img src={post.image} alt="" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const MOCK_TRENDING_CONTENT = [
    { id: 1, platformId: 'instagram', title: 'Sunset Views from Bali', metrics: { likes: '1.2K', comments: 85, shares: 120 }, imageUrl: 'https://picsum.photos/id/1015/300/200', summary: 'Gorgeous 4K reel showcasing the best hidden beaches and local cuisine in Bali. Check out the top spots for photography!' },
    { id: 2, platformId: 'facebook', title: 'New Product Launch Video', metrics: { likes: '3.5K', comments: 410, shares: 900 }, imageUrl: 'https://picsum.photos/id/200/300/200', summary: 'See how our latest software update streamlines your workflow. Early customer feedback has been overwhelmingly positive—watch the full demo now.' },
    { id: 3, platformId: 'twitter', title: '#TechTrends 2025 Prediction', metrics: { likes: '8.1K', comments: 1.1, shares: '2.4K' }, imageUrl: 'https://picsum.photos/id/250/300/200', summary: 'A bold prediction thread on the future of generative AI and its impact on creative industries. Join the debate with your own predictions.' },
    { id: 4, platformId: 'linkedin', title: 'Leadership Workshop Summary', metrics: { likes: 500, comments: 22, shares: 15 }, imageUrl: 'https://picsum.photos/id/160/300/200', summary: 'Key takeaways from our recent workshop on ethical leadership in remote teams. Focus points include communication strategies and trust-building.' },
    { id: 5, platformId: 'instagram', title: 'Travel Vlog Episode 2', metrics: { likes: 980, comments: 45, shares: 60 }, imageUrl: 'https://picsum.photos/id/1040/300/200', summary: 'Our second episode explores sustainable travel practices in Patagonia. Learn how to minimize your environmental footprint on your next adventure.' },
    { id: 6, platformId: 'twitter', title: 'Breaking News: AI Update', metrics: { likes: '15K', comments: 3.2, shares: '5.1K' }, imageUrl: 'https://picsum.photos/id/270/300/200', summary: 'Latest regulatory news regarding large language models (LLMs) in Europe. The market reacted strongly to the announcement this morning.' },
    { id: 7, platformId: 'facebook', title: 'Viral Recipe Video - 5 Minute Meals', metrics: { likes: '2.1K', comments: 110, shares: 350 }, imageUrl: 'https://picsum.photos/id/150/300/200', summary: 'The simplest one-pot pasta recipe that took the culinary world by storm! Perfect for busy weeknights.' }, // Changed to ID 150 which loads reliably
    { id: 8, platformId: 'linkedin', title: 'Remote Work Policy Announcement', metrics: { likes: 320, comments: 9, shares: 5 }, imageUrl: 'https://picsum.photos/id/10/300/200', summary: 'Official announcement of our transition to a fully hybrid work model. See the details of the policy update inside.' },
    { id: 9, platformId: 'instagram', title: 'Gym Motivation Reel', metrics: { likes: '6.8K', comments: 195, shares: 80 }, imageUrl: 'https://picsum.photos/id/1060/300/200', summary: 'New workout routine dropped! Targeting core strength and endurance. Tag a gym buddy!' },
    { id: 10, platformId: 'twitter', title: 'Cryptocurrency Crash Analysis', metrics: { likes: '12K', comments: 4.5, shares: '3.1K' }, imageUrl: 'https://picsum.photos/id/1050/300/200', summary: 'Detailed analysis of the market correction in Bitcoin and Ethereum. Is this a buying opportunity or the start of a bear market?' },
];

const INTEREST_CATEGORIES = {
    'Sports': { icon: '⚽', subs: ['Cricket', 'Football', 'Tennis', 'Basketball', 'Formula 1', 'Badminton', 'Athletics'] },
    'Technology': { icon: '💻', subs: ['Artificial Intelligence', 'Cybersecurity', 'Gadgets', 'Software', 'Cloud Computing', 'Blockchain'] },
    'Entertainment': { icon: '🎬', subs: ['Movies', 'TV Shows', 'Bollywood', 'Hollywood', 'Anime', 'Web Series'] },
    'Gaming': { icon: '🎮', subs: ['Video Games', 'Esports', 'Mobile Gaming', 'PC Gaming', 'Console Gaming'] },
    'Music': { icon: '🎵', subs: ['Pop Music', 'Hip Hop', 'Bollywood Music', 'Classical', 'Rock', 'Electronic'] },
    'Business & Finance': { icon: '💼', subs: ['Startups', 'Stock Market', 'Cryptocurrency', 'Investing', 'Economy', 'Entrepreneurship'] },
    'Science': { icon: '🔬', subs: ['Space Exploration', 'Astrophysics', 'Environmental Science', 'Biology', 'Physics'] },
    'Health & Wellness': { icon: '🏥', subs: ['Fitness', 'Nutrition', 'Mental Health', 'Yoga', 'Medical Research'] },
    'Art & Culture': { icon: '🎨', subs: ['Photography', 'Literature', 'Fashion', 'History', 'Design', 'Architecture'] },
    'Food & Travel': { icon: '✈️', subs: ['Cooking', 'Street Food', 'Travel Destinations', 'Food Reviews', 'Adventure Travel'] },
    'Education': { icon: '📚', subs: ['Language Learning', 'Online Courses', 'Career Development', 'Study Tips', 'Scholarships'] },
    'Lifestyle': { icon: '🏡', subs: ['DIY/Home Improvement', 'Home Design', 'Volunteering', 'Podcasts', 'Pets'] },
};


// --- Landing Page Component (for unauthenticated users) ---
const LandingPage = ({ onGetStarted, onSignIn, isDarkMode, toggleTheme }) => {
    const features = [
        {
            icon: '📅',
            title: 'Schedule Posts',
            description: 'Plan and schedule your content across multiple platforms from one dashboard.',
        },
        {
            icon: '📊',
            title: 'Analytics & Insights',
            description: 'Track engagement, reach, and performance with detailed analytics.',
        },
        {
            icon: '🔗',
            title: 'Multi-Platform Integration',
            description: 'Connect LinkedIn, Facebook, Instagram, Twitter, and WhatsApp seamlessly.',
        },
        {
            icon: '🤖',
            title: 'AI Content Refinement',
            description: 'Enhance your posts with AI-powered suggestions and optimization.',
        },
        {
            icon: '📱',
            title: 'WhatsApp Automation',
            description: 'Automate WhatsApp messaging and manage business communications.',
        },
        {
            icon: '🔔',
            title: 'Smart Notifications',
            description: 'Stay updated with real-time alerts on post performance and engagement.',
        },
    ];

    const platforms = [
        { name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-700' },
        { name: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
        { name: 'Instagram', icon: Instagram, color: 'bg-pink-600' },
        { name: 'Twitter', icon: Twitter, color: 'bg-sky-500' },
        { name: 'WhatsApp', icon: MessageSquare, color: 'bg-green-500' },
    ];

    return (
        <div className={`min-h-screen relative overflow-hidden ${isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-blue-100'}`}>
            {/* Watermark Background - Single Large Centered Logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <img
                    src="/logo_siq.png"
                    alt=""
                    className="w-[800px] h-[800px] object-contain opacity-[0.08] dark:opacity-[0.05]"
                />
            </div>

            {/* Header with Theme Toggle */}
            <header className="relative z-10 flex items-center justify-between p-6">
                <div className="flex items-center">
                    <img
                        src="/logo_siq.png"
                        alt="SocialConnectIQ Logo"
                        className="w-10 h-10 object-contain"
                    />
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={toggleTheme}
                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-md'}`}
                        aria-label="Toggle theme"
                    >
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button
                        onClick={onSignIn}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        Sign In
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            <section className="flex flex-col items-center justify-center text-center px-6 py-20">
                <div className="max-w-4xl mx-auto">
                    {/* Main Branding */}
                    <h1 className={`text-5xl md:text-7xl font-extrabold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        <span className="text-blue-600">Social</span>ConnectIQ
                    </h1>
                    <p className={`text-xl md:text-2xl mb-2 max-w-2xl mx-auto ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Your all-in-one social media management platform.
                    </p>
                    <p className={`text-lg md:text-xl mb-8 max-w-2xl mx-auto ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Connect, create, and conquer across all platforms.
                    </p>

                    {/* CTA Button */}
                    <div className="flex items-center justify-center mb-6">
                        <button
                            onClick={onGetStarted}
                            className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                        >
                            🚀 Get Started
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className={`py-20 px-6 ${isDarkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                <div className="max-w-6xl mx-auto">
                    <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Everything you need to manage your social presence
                    </h2>
                    <p className={`text-center mb-12 max-w-2xl mx-auto ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Powerful tools designed to help you grow your brand and engage your audience.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className={`p-6 rounded-2xl transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${isDarkMode
                                    ? 'bg-gray-800 border border-gray-700 hover:border-blue-500'
                                    : 'bg-white border border-gray-100 shadow-md hover:border-blue-200'}`}
                            >
                                <div className="text-4xl mb-4">{feature.icon}</div>
                                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {feature.title}
                                </h3>
                                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Platforms Section */}
            <section className={`py-20 px-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-white'}`}>
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Connect with all major platforms
                    </h2>
                    <p className={`mb-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Seamlessly integrate and manage your presence across these platforms.
                    </p>

                    <div className="flex flex-wrap justify-center gap-6">
                        {platforms.map((platform, index) => {
                            const Icon = platform.icon;
                            return (
                                <div
                                    key={index}
                                    className={`flex flex-col items-center p-6 rounded-2xl transition-all duration-200 hover:scale-105 ${isDarkMode
                                        ? 'bg-gray-800 hover:bg-gray-750'
                                        : 'bg-white shadow-lg hover:shadow-xl'}`}
                                >
                                    <div className={`w-16 h-16 ${platform.color} rounded-2xl flex items-center justify-center text-white mb-3`}>
                                        <Icon size={32} />
                                    </div>
                                    <span className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {platform.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="py-20 px-6 bg-blue-600">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Ready to transform your social media strategy?
                    </h2>
                    <p className="text-blue-100 mb-8 text-lg">
                        Join thousands of creators and businesses managing their social presence with SocialConnectIQ.
                    </p>
                    <button
                        onClick={onGetStarted}
                        className="px-10 py-4 bg-white text-blue-600 text-lg font-semibold rounded-xl shadow-lg hover:bg-gray-100 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                    >
                        Get Started for Free
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className={`py-8 px-6 text-center ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-600'}`}>
                <div className="flex items-center justify-center space-x-2 mb-2">
                    <img src="/logo_siq.png" alt="Logo" className="w-6 h-6 object-contain" />
                    <span className="font-medium">SocialConnectIQ</span>
                </div>
                <p className="text-sm">© {new Date().getFullYear()} SocialConnectIQ. All rights reserved.</p>
            </footer>
        </div>
    );
};


/**
 * Custom hook for Firebase Initialization and Authentication
 */
const useFirebase = () => {
    const [userId, setUserId] = useState(null);
    const [user, setUser] = useState(null); // Full user object for display

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const uid = firebaseUser.uid;
                setUserId(uid);
                localStorage.setItem('userId', uid); // Persist for services

                setUser({
                    uid: uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL,
                    isAnonymous: firebaseUser.isAnonymous,
                });
            } else {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (e) {
                    console.error("Auth error:", e);
                    const newId = crypto.randomUUID();
                    setUserId(newId);
                    localStorage.setItem('userId', newId); // Persist fallback ID
                    setUser({ uid: newId, isAnonymous: true });
                }
            }
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('userId'); // Clear persistence
            setUserId(null);
            setUser(null);
            console.log('✅ Logged out successfully');
        } catch (e) {
            console.error('❌ Logout error:', e);
        }
    };

    return { db, auth, userId, user, isAuthReady: !!userId, handleLogout };
};


/**
 * Saves or updates the user's interest preference to Firestore.
 */
const saveInterestsPreference = async (db, userId, interests) => {
    if (!db || !userId) return false;
    const docRef = doc(db, `users/${userId}/preferences/onboarding`);
    try {
        await setDoc(docRef, { interestsCompleted: true, selectedInterests: interests, updatedAt: serverTimestamp() }, { merge: true });
        console.log("Interests saved to Firestore.");
        return true;
    } catch (e) {
        console.error("Error saving interest preference:", e);
        return false;
    }
};

/**
 * Saves the current theme preference to Firestore.
 */
const saveThemePreference = async (db, userId, isDarkMode) => {
    if (!db || !userId) return;
    const docRef = doc(db, `users/${userId}/preferences/theme`);
    try {
        await setDoc(docRef, { isDarkMode, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
        console.error("Error saving theme preference:", e);
    }
};

/**
 * Component for the Dark/Light Mode Toggle
 */
const ThemeToggle = ({ isDarkMode, toggleTheme }) => {
    const Icon = isDarkMode ? Sun : Moon;
    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
            aria-label="Toggle Dark Mode"
        >
            <Icon size={20} />
        </button>
    );
};

// --- Calendar Component ---

const CalendarView = ({ scheduledPosts = [], onDeleteFromPlatform, onDeleteSinglePlatform, deleting, highlightedDate }) => {
    // Initialize state with current month and year
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [error, setError] = useState(null);

    // State for post panels
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedDatePosts, setSelectedDatePosts] = useState([]);
    const [selectedPost, setSelectedPost] = useState(null);

    // Navigate to highlighted date's month when it changes
    useEffect(() => {
        if (highlightedDate) {
            setCurrentDate(new Date(highlightedDate.getFullYear(), highlightedDate.getMonth(), 1));
        }
    }, [highlightedDate]);

    // Handle date click
    const handleDateClick = (year, month, day) => {
        const posts = getPostsForDate(year, month, day);
        if (posts.length > 0) {
            setSelectedDate(new Date(year, month, day));
            setSelectedDatePosts(posts);
        }
    };

    // Handle post click from list
    const handlePostClick = (post) => {
        setSelectedPost(post);
        setSelectedDatePosts([]); // Close list panel
    };

    // Close all panels
    const closeListPanel = () => {
        setSelectedDate(null);
        setSelectedDatePosts([]);
    };

    const closeDetailModal = () => {
        setSelectedPost(null);
    };

    // Helper to get posts for a specific date
    const getPostsForDate = (year, month, day) => {
        return scheduledPosts.filter(post => {
            const postDate = post.scheduledTime?.seconds
                ? new Date(post.scheduledTime.seconds * 1000)
                : new Date(post.scheduledTime);
            return postDate.getFullYear() === year &&
                postDate.getMonth() === month &&
                postDate.getDate() === day;
        });
    };

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear();

    // Get number of days in the current month
    const daysInMonth = new Date(currentYear, currentDate.getMonth() + 1, 0).getDate();
    // Get the index of the first day of the month (0=Sun, 1=Mon, etc.)
    const startDayIndex = currentDate.getDay();

    const totalCells = startDayIndex + daysInMonth;
    const weeks = Math.ceil(totalCells / 7);

    const dates = [];
    // Add leading blank days
    for (let i = 0; i < startDayIndex; i++) {
        dates.push(null);
    }
    // Add month days
    for (let i = 1; i <= daysInMonth; i++) {
        dates.push(i);
    }
    // Add trailing blank days to fill the last week
    while (dates.length < weeks * 7) {
        dates.push(null);
    }

    const navigateMonth = useCallback((amount) => {
        setError(null);
        setCurrentDate(prevDate => {
            const newDate = new Date(prevDate.getTime());
            newDate.setMonth(prevDate.getMonth() + amount);

            // Optional: Basic validation to prevent decades of navigation
            if (newDate.getFullYear() < 2000 || newDate.getFullYear() > 2100) {
                setError("Navigation limited to years between 2000 and 2100.");
                return prevDate;
            }

            // Reset day to 1 to prevent month skipping issues (e.g., navigating from 31st Jan to Feb)
            newDate.setDate(1);
            return newDate;
        });
    }, []);

    const navigateYear = useCallback((amount) => {
        setError(null);
        setCurrentDate(prevDate => {
            const newYear = prevDate.getFullYear() + amount;

            if (newYear < 2000 || newYear > 2100) {
                setError("Navigation limited to years between 2000 and 2100.");
                return prevDate;
            }

            const newDate = new Date(prevDate.getTime());
            newDate.setFullYear(newYear);
            // Reset day to 1 to prevent issues
            newDate.setDate(1);
            return newDate;
        });
    }, []);


    return (
        <>
            <div className="flex flex-col h-full">
                <div className="flex flex-col mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                    <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                        Content Calendar View
                    </h2>
                    <div className="flex items-center justify-between mt-2">
                        {/* Previous Year Button */}
                        <button
                            onClick={() => navigateYear(-1)}
                            className="p-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Previous Year"
                        >
                            <ChevronsLeft size={20} />
                        </button>

                        {/* Previous Month Button */}
                        <button
                            onClick={() => navigateMonth(-1)}
                            className="p-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Previous Month"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        {/* Month & Year Display */}
                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mx-4 w-32 text-center select-none">
                            {monthName} {currentYear}
                        </span>

                        {/* Next Month Button */}
                        <button
                            onClick={() => navigateMonth(1)}
                            className="p-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Next Month"
                        >
                            <ChevronRight size={20} />
                        </button>

                        {/* Next Year Button */}
                        <button
                            onClick={() => navigateYear(1)}
                            className="p-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Next Year"
                        >
                            <ChevronsRight size={20} />
                        </button>
                    </div>
                    {/* Error Message Display */}
                    {error && (
                        <div className="mt-2 p-2 text-sm text-center text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded-lg border border-red-300 flex items-center justify-center">
                            <AlertTriangle size={16} className="mr-2 flex-shrink-0" />
                            {error}
                        </div>
                    )}
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-sm mb-1">
                    {daysOfWeek.map((day, index) => (
                        <div
                            key={day}
                            className={`py-1 rounded-lg ${index === 0 || index === 6 // Sun and Sat
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-gray-600 dark:text-gray-300'
                                }`}
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Date Grid */}
                <div className="flex-1 grid grid-cols-7 gap-1 overflow-y-auto">
                    {dates.map((date, index) => {
                        const isWeekend = index % 7 === 0 || (index + 1) % 7 === 0;
                        const isToday = date === today.getDate() && currentDate.getMonth() === today.getMonth() && currentYear === today.getFullYear();
                        const postsOnDate = date ? getPostsForDate(currentYear, currentDate.getMonth(), date) : [];
                        const hasScheduledPosts = postsOnDate.length > 0;

                        // Check post statuses for this date
                        const hasPendingPosts = postsOnDate.some(p => p.status === 'pending');
                        const hasPostedPosts = postsOnDate.some(p => p.status === 'posted');

                        // Determine background color based on status - posted always shows green
                        let bgClass = '';
                        let borderClass = 'border-gray-200 dark:border-gray-700';
                        let isRinged = false;

                        if (hasPostedPosts && !hasPendingPosts) {
                            // All posts on this date are posted - GREEN
                            bgClass = 'bg-green-100 dark:bg-green-900/40';
                            borderClass = 'border-green-400 dark:border-green-600';
                            if (isToday) isRinged = true;
                        } else if (hasPendingPosts) {
                            // Has pending posts - GREY
                            bgClass = 'bg-gray-200 dark:bg-gray-600/50';
                            borderClass = 'border-gray-400 dark:border-gray-500';
                            if (isToday) isRinged = true;
                        } else if (isToday) {
                            // Today with no posts - BLUE
                            bgClass = 'bg-blue-100 dark:bg-blue-900/70';
                            borderClass = 'border-blue-500';
                            isRinged = true;
                        } else if (isWeekend) {
                            bgClass = 'bg-gray-50/50 dark:bg-gray-700/50';
                        } else {
                            bgClass = 'bg-white dark:bg-gray-800';
                        }

                        // Check if this date should be highlighted (navigated from scheduled posts panel)
                        const isHighlighted = highlightedDate &&
                            date === highlightedDate.getDate() &&
                            currentDate.getMonth() === highlightedDate.getMonth() &&
                            currentYear === highlightedDate.getFullYear();

                        return (
                            <div
                                key={index}
                                onClick={() => date && hasScheduledPosts && handleDateClick(currentYear, currentDate.getMonth(), date)}
                                className={`p-1 border ${borderClass} ${bgClass} rounded-lg min-h-[80px] text-xs transition-all duration-300 cursor-pointer
                                ${isRinged ? 'ring-2 ring-blue-500/50' : ''}
                                ${!date ? 'opacity-50 pointer-events-none' : ''}
                                ${isHighlighted ? 'shadow-[0_0_15px_rgba(59,130,246,0.6)] ring-2 ring-blue-400 scale-105' : ''}
                                hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400`}
                            >
                                <div className="flex flex-col h-full justify-between">
                                    {/* Top row: Date + Scheduled badge */}
                                    <div className="flex items-start justify-between">
                                        <div className={`font-semibold ${isToday ? 'text-blue-700 dark:text-blue-200' : hasPostedPosts && !hasPendingPosts ? 'text-green-700 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>
                                            {date}
                                        </div>
                                        {/* Scheduled badge - only for pending posts */}
                                        {hasPendingPosts && (
                                            <span className="px-1.5 py-0.5 text-[8px] italic rounded-full bg-gray-500/30 text-gray-500 dark:text-gray-400 border border-gray-400/30">
                                                Scheduled
                                            </span>
                                        )}
                                    </div>
                                    {/* Bottom-right: Post count with neon text glow */}
                                    {hasScheduledPosts && (
                                        <div className="flex justify-end">
                                            <span
                                                className={`text-[13px] font-bold tracking-tight ${hasPostedPosts && !hasPendingPosts
                                                    ? 'text-green-400'
                                                    : 'text-gray-500 dark:text-gray-400'
                                                    }`}
                                                style={{
                                                    textShadow: hasPostedPosts && !hasPendingPosts
                                                        ? '0 0 10px rgba(34,197,94,0.9), 0 0 20px rgba(34,197,94,0.5)'
                                                        : '0 0 6px rgba(156,163,175,0.4)'
                                                }}
                                            >
                                                {postsOnDate.length === 1 ? '1 post' : `${postsOnDate.length} posts`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Posts List Panel - shown when date is clicked */}
            <PostsListPanel
                posts={selectedDatePosts}
                selectedDate={selectedDate}
                onClose={closeListPanel}
                onPostClick={handlePostClick}
            />

            {/* Post Detail Modal - shown when post is clicked */}
            <PostDetailModal
                post={selectedPost}
                isOpen={!!selectedPost}
                onClose={closeDetailModal}
                onDelete={onDeleteFromPlatform}
                onDeletePlatform={onDeleteSinglePlatform}
                deleting={deleting}
            />
        </>
    );
};

// --- MODIFIED AnalyticsCard with connection status ---
const AnalyticsCard = ({ platform, posts, reach, engagement, color, isConnected, onConnectClick }) => {
    const isWhatsApp = platform === 'WhatsApp';

    // Dynamic Labels
    const postsLabel = isWhatsApp ? 'Sent Messages' : 'Posts';
    const reachLabel = isWhatsApp ? 'Delivery Rate' : 'Reach';
    const engagementLabel = isWhatsApp ? 'User Replies' : 'Engagement';

    // Dynamic Values & Formatting
    const reachValue = isWhatsApp ? `${reach.toFixed(1)}%` : reach.toLocaleString();
    const engagementValue = engagement.toLocaleString();
    const postsCount = posts.toLocaleString();

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 transition duration-300 transform hover:scale-[1.02]">
            <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{platform}</h3>
                {/* Uses generic 'posts' variable but dynamic label 'postsLabel' */}
                <span className={`px-3 py-1 text-sm font-medium rounded-full text-white ${color}`}>{postsCount} {postsLabel}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div>
                    <p className="text-gray-500 dark:text-gray-400">{reachLabel}</p>
                    {/* Uses dynamic 'reachValue' */}
                    <p className={`text-xl font-bold ${isWhatsApp ? 'text-green-500' : 'text-green-500'}`}>{reachValue}</p>
                </div>
                <div>
                    <p className="text-gray-500 dark:text-gray-400">{engagementLabel}</p>
                    {/* Uses dynamic 'engagementValue' */}
                    <p className="text-xl font-bold text-purple-500">{engagementValue}</p>
                </div>
            </div>
            {/* Connection Status Indicator */}
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-center">
                <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${isConnected
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'
                    }`}>
                    {isConnected ? '● Connected' : '○ Not Connected'}
                </span>
            </div>
        </div>
    );
};
// --- END MODIFIED AnalyticsCard ---



const ScheduledPostItem = ({ post, onNavigateToCalendar, onDelete }) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const scheduledDate = post.scheduledTime?.seconds
        ? new Date(post.scheduledTime.seconds * 1000)
        : new Date(post.scheduledTime);

    // Handle click on post content - navigate to calendar
    const handlePostClick = () => {
        if (onNavigateToCalendar) {
            onNavigateToCalendar(scheduledDate);
        }
    };

    // Handle delete click - stop propagation to prevent navigation
    const handleDeleteClick = async (e) => {
        e.stopPropagation(); // Prevent triggering post click
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            await onDelete(post.id);
        } catch (err) {
            console.error('Failed to delete:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div
            onClick={handlePostClick}
            className="p-3 mb-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition-all group"
        >
            {/* Header: Date, Status, Delete Button */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {scheduledDate.toLocaleDateString()} at {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        pending
                    </span>
                </div>
                {/* X Delete Button */}
                <button
                    onClick={handleDeleteClick}
                    disabled={isDeleting}
                    className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                    title="Cancel scheduled post"
                >
                    {isDeleting ? (
                        <span className="text-xs">...</span>
                    ) : (
                        <X size={16} />
                    )}
                </button>
            </div>

            {/* Content preview */}
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-2">
                {post.content}
            </p>

            {/* Platforms */}
            <div className="flex gap-1">
                {post.platforms.map(pId => {
                    const platform = PLATFORMS.find(p => p.id === pId);
                    if (!platform) return null;
                    const Icon = platform.icon;
                    return <Icon key={pId} size={14} className={`text-white p-0.5 rounded ${platform.color}`} title={platform.name} />;
                })}
            </div>
        </div>
    );
};

const ScheduledPostsPanel = ({ scheduledPosts, onNavigateToCalendar, onDelete, onCancelAll }) => {
    const pendingPosts = scheduledPosts.filter(p => p.status === 'pending');
    const [cancellingAll, setCancellingAll] = useState(false);

    const handleCancelAll = async () => {
        if (!onCancelAll || pendingPosts.length === 0) return;
        if (!confirm(`Cancel all ${pendingPosts.length} scheduled posts?`)) return;
        setCancellingAll(true);
        try {
            await onCancelAll();
        } finally {
            setCancellingAll(false);
        }
    };

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                    <Clock className="inline mr-2 h-5 w-5" /> Scheduled
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400 ml-2">({pendingPosts.length})</span>
                </h2>
                {pendingPosts.length > 0 && (
                    <button
                        onClick={handleCancelAll}
                        disabled={cancellingAll}
                        className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                    >
                        {cancellingAll ? 'Cancelling...' : 'Cancel All'}
                    </button>
                )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1">
                Click on post to view in calendar • Click <span className="inline-flex items-center justify-center w-4 h-4 bg-red-500 rounded text-white text-[10px] font-bold">✕</span> to cancel
            </p>
            <div className="flex-1 overflow-y-auto pr-2">
                {pendingPosts.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                        No posts scheduled yet! Click 'New Post' to start.
                    </div>
                ) : (
                    pendingPosts.map((post) => (
                        <ScheduledPostItem
                            key={post.id}
                            post={post}
                            onNavigateToCalendar={onNavigateToCalendar}
                            onDelete={onDelete}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// --- Composer Modal (Simplified) ---

const ComposerModal = ({ isOpen, onClose, db, userId, addToast, addNotification }) => {
    const fileInputRef = useRef(null);
    const [content, setContent] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [imageBase64, setImageBase64] = useState(null);
    const [imageMimeType, setImageMimeType] = useState(null);
    const [imageError, setImageError] = useState(null);

    // Schedule date/time state
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduleError, setScheduleError] = useState(null);
    const [showSchedulePicker, setShowSchedulePicker] = useState(false);

    // Post result feedback (success/error message)
    const [postResult, setPostResult] = useState(null); // { type: 'success'|'error', message: string }

    // Reset all state when modal opens/closes to prevent stuck states
    useEffect(() => {
        if (isOpen) {
            // Reset all states when modal opens
            setContent('');
            setSelectedPlatforms([]);
            setLoading(false);
            setUploadedImage(null);
            setImageBase64(null);
            setImageMimeType(null);
            setImageError(null);
            setScheduleDate('');
            setScheduleTime('');
            setScheduleError(null);
            setShowSchedulePicker(false);
            setPostResult(null);
        }
    }, [isOpen]);

    const MAX_FILE_SIZE_MB = 5;
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        setImageError(null);
        const file = event.target.files[0];

        if (!file) return;

        // 1. Validate file type
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            setImageError(`Unsupported file type: ${file.type}. Please use JPEG, PNG, or GIF.`);
            setUploadedImage(null);
            setImageBase64(null);
            setImageMimeType(null);
            return;
        }

        // 2. Validate file size
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setImageError(`File size exceeds limit (${MAX_FILE_SIZE_MB}MB).`);
            setUploadedImage(null);
            setImageBase64(null);
            setImageMimeType(null);
            return;
        }

        // 3. Display preview
        setUploadedImage(URL.createObjectURL(file));
        setImageMimeType(file.type);

        // 4. Convert to base64 for API upload
        setLoading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            // Remove the data:image/...;base64, prefix to get pure base64
            const base64String = reader.result.split(',')[1];
            setImageBase64(base64String);
            setLoading(false);
            console.log(`✅ Image "${file.name}" ready for upload (${Math.round(base64String.length / 1024)}KB base64)`);
        };
        reader.onerror = () => {
            setImageError('Failed to read image file');
            setLoading(false);
        };
        reader.readAsDataURL(file);
    };

    const togglePlatform = (id) => {
        setSelectedPlatforms(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleSchedule = async () => {
        setScheduleError(null);

        if (!content.trim() || selectedPlatforms.length === 0 || !db || !userId) {
            setScheduleError("Please add content and select at least one platform.");
            return;
        }

        if (!scheduleDate || !scheduleTime) {
            setScheduleError("Please select a date and time for scheduling.");
            return;
        }

        // Combine date and time into a Date object
        const scheduledTime = new Date(`${scheduleDate}T${scheduleTime}`);

        // Validate it's in the future
        if (scheduledTime <= new Date()) {
            setScheduleError("Scheduled time must be in the future.");
            return;
        }

        setLoading(true);

        try {
            const path = `users/${userId}/scheduled_posts`;
            const docRef = doc(collection(db, path));

            const postData = {
                content: content.trim(),
                platforms: selectedPlatforms,
                // FIX: Store base64 data URL instead of blob URL which expires
                image: imageBase64 ? `data:${imageMimeType};base64,${imageBase64}` : null,
                scheduledTime: scheduledTime,
                status: 'pending',
                createdAt: serverTimestamp(),
            };

            // Fire-and-forget - don't await, let UI proceed
            setDoc(docRef, postData)
                .then(() => console.log("✅ Post scheduled successfully"))
                .catch((err) => console.error("❌ Failed to save post:", err.message));

            console.log("📅 Post scheduled for:", scheduledTime.toLocaleString());

            // Show toast notification
            if (addToast) {
                addToast(`📅 Post scheduled for ${scheduledTime.toLocaleString()}`, 'success');
            }

            // Add to notifications panel
            if (addNotification) {
                addNotification(`Post scheduled for ${scheduledTime.toLocaleString()}`, 'scheduled');
            }

            setLoading(false);

            // Close modal immediately
            onClose();
            setContent('');
            setSelectedPlatforms([]);
            setUploadedImage(null);
            setScheduleDate('');
            setScheduleTime('');
            setShowSchedulePicker(false);
        } catch (e) {
            console.error("Error scheduling post:", e);
            setScheduleError(e.message || "Failed to schedule post. Please try again.");
            setLoading(false);
        }
    };

    // POST NOW - Actually post to social media via backend API
    const handlePostNow = async () => {
        if (!content.trim() || selectedPlatforms.length === 0) {
            console.error("Missing content or platforms.");
            return;
        }

        setLoading(true);
        const results = { success: [], failed: [] };
        const platformPostIds = {}; // Track platform post IDs for deletion

        try {
            const { postToLinkedIn, postToFacebook, postToTwitter, postToInstagram } = await import('./api/social');

            for (const platformId of selectedPlatforms) {
                try {
                    console.log(`📤 Posting to ${platformId}...`);
                    let response;
                    switch (platformId) {
                        case 'linkedin':
                            response = await postToLinkedIn(content.trim(), imageBase64, imageMimeType);
                            results.success.push('LinkedIn');
                            // Debug log the full response to understand structure
                            console.log('📋 LinkedIn API Response:', JSON.stringify(response, null, 2));
                            // Capture post_id from response - check multiple possible locations
                            const linkedInPostId =
                                response?.result?.post_id ||
                                response?.result?.id ||
                                response?.result?.urn ||
                                response?.result?.share_urn ||
                                response?.post_id ||
                                response?.id ||
                                response?.urn;
                            if (linkedInPostId) {
                                platformPostIds.linkedin = linkedInPostId;
                                console.log(`📌 LinkedIn post_id captured: ${linkedInPostId}`);
                            } else {
                                console.warn('⚠️ No post_id found in LinkedIn response');
                            }
                            break;
                        case 'facebook':
                            response = await postToFacebook(content.trim(), imageBase64, imageMimeType);
                            results.success.push('Facebook');
                            if (response?.post_id || response?.id) {
                                platformPostIds.facebook = response.post_id || response.id;
                            }
                            break;
                        case 'twitter':
                            response = await postToTwitter(content.trim());
                            results.success.push('Twitter');
                            if (response?.post_id || response?.id) {
                                platformPostIds.twitter = response.post_id || response.id;
                            }
                            break;
                        case 'instagram':
                            response = await postToInstagram(content.trim());
                            results.success.push('Instagram');
                            if (response?.post_id || response?.id) {
                                platformPostIds.instagram = response.post_id || response.id;
                            }
                            break;
                        default:
                            console.log(`Skipping ${platformId} - posting not supported`);
                    }
                } catch (err) {
                    console.error(`❌ Failed to post to ${platformId}:`, err);
                    results.failed.push(platformId);
                }
            }

            if (results.success.length > 0) {
                console.log(`✅ Successfully posted to: ${results.success.join(', ')}`);

                // Save to Firestore for calendar tracking
                try {
                    const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
                    await addDoc(collection(db, `users/${userId}/scheduled_posts`), {
                        content: content.trim(),
                        platforms: selectedPlatforms,
                        scheduledTime: new Date(), // Use current time as "scheduled" time
                        status: 'posted',
                        postedAt: serverTimestamp(),
                        platformPostIds: Object.keys(platformPostIds).length > 0 ? platformPostIds : null,
                        postResults: results,
                        createdAt: serverTimestamp(),
                        type: 'immediate' // Mark as immediate post vs scheduled
                    });
                    console.log('✅ Saved to Firestore for calendar tracking');
                } catch (firestoreErr) {
                    console.warn('⚠️ Could not save to Firestore:', firestoreErr);
                    // Don't fail the whole operation if Firestore save fails
                }

                // Show toast notification instead of in-modal message
                const successMsg = `Posted to: ${results.success.join(', ')}`;
                if (addToast) {
                    addToast(`✅ ${successMsg}`, 'success');
                }
                if (addNotification) {
                    addNotification(successMsg, 'success');
                }

                // Show partial failure if any platforms failed
                if (results.failed.length > 0) {
                    if (addToast) {
                        addToast(`⚠️ Failed: ${results.failed.join(', ')}`, 'error');
                    }
                }

                // Close modal immediately
                onClose();
                setContent('');
                setSelectedPlatforms([]);
                setUploadedImage(null);
            } else {
                // All platforms failed - show error toast
                if (addToast) {
                    addToast('❌ Failed to post to all platforms', 'error');
                }
            }
        } catch (e) {
            console.error("Error posting:", e);
            if (addToast) {
                addToast(`❌ Error: ${e.message}`, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // Clean up the object URL when modal is closed
        if (uploadedImage) {
            URL.revokeObjectURL(uploadedImage);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 dark:bg-opacity-80 p-4">
            <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-xl shadow-2xl p-6 transition-all duration-300 transform scale-100 relative">
                {/* New Dismiss 'X' Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    aria-label="Close composer"
                >
                    <X size={20} />
                </button>

                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100 border-b pb-2">New Post Composer</h3>



                {/* File Error Message */}
                {imageError && (
                    <div className="mb-4 p-3 text-sm font-medium text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded-lg border border-red-300">
                        {imageError}
                    </div>
                )}

                {/* Text Area and Upload Button Wrapper */}
                <div className="relative mb-4">
                    {/* Hidden File Input (Accessibility) */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept={ALLOWED_MIME_TYPES.join(',')}
                        className="hidden"
                        id="image-upload-input"
                        aria-label="File selector for image upload"
                    />

                    {/* Upload Button */}
                    <label
                        htmlFor="image-upload-input"
                        className="absolute left-2 top-2 px-3 py-1.5 flex items-center bg-white dark:bg-gray-700 rounded-lg shadow-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-semibold text-blue-600 dark:text-blue-400"
                        aria-label="Upload Image"
                    >
                        {loading ? <Upload size={16} className="mr-2 animate-pulse" /> : <ImageIcon size={16} className="mr-2" />}
                        Upload Image
                    </label>

                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="What would you like to post?"
                        rows="6"
                        className="w-full p-3 pt-12 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />

                    {/* Image Preview - Below text area */}
                    {uploadedImage && (
                        <div className="mt-3 relative">
                            <img
                                src={uploadedImage}
                                alt="Uploaded media preview"
                                className="max-h-48 w-full object-cover rounded-lg border border-gray-300 dark:border-gray-700"
                            />
                            <button
                                onClick={() => { URL.revokeObjectURL(uploadedImage); setUploadedImage(null); setImageBase64(null); setImageMimeType(null); }}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-700 transition"
                                aria-label="Remove uploaded image"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Select Platforms</label>
                    <div className="flex flex-wrap gap-2">
                        {PLATFORMS.filter(p => p.id !== 'onedrive').map(platform => {
                            const Icon = platform.icon;
                            const isSelected = selectedPlatforms.includes(platform.id);
                            return (
                                <button
                                    key={platform.id}
                                    onClick={() => togglePlatform(platform.id)}
                                    className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${isSelected
                                        ? `${platform.color} text-white shadow-lg shadow-gray-500/50 dark:shadow-blue-500/20`
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    <Icon size={16} className="mr-2" />
                                    {platform.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Schedule Date/Time Picker - Only visible when Schedule is clicked */}
                {showSchedulePicker && (
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                📅 Schedule Post For
                            </label>
                            <button
                                onClick={() => {
                                    setShowSchedulePicker(false);
                                    setScheduleDate('');
                                    setScheduleTime('');
                                    setScheduleError(null);
                                }}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <div className="flex-1 min-w-[140px]">
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={scheduleDate}
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="flex-1 min-w-[120px]">
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Time</label>
                                <input
                                    type="time"
                                    value={scheduleTime}
                                    onChange={(e) => setScheduleTime(e.target.value)}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                        {scheduleDate && scheduleTime && (
                            <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                                Will be posted: {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}
                            </p>
                        )}
                        {scheduleError && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                ⚠️ {scheduleError}
                            </p>
                        )}
                    </div>
                )}

                {/* Post Result Feedback */}
                {postResult && (
                    <div className={`p-3 rounded-lg text-sm font-medium ${postResult.type === 'success'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                        {postResult.message}
                    </div>
                )}

                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePostNow}
                        className={`px-4 py-2 text-white rounded-lg transition-colors duration-200 ${loading || selectedPlatforms.length === 0 || !content.trim()
                            ? 'bg-green-400 opacity-60 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 shadow-md shadow-green-500/50'
                            }`}
                        disabled={loading || selectedPlatforms.length === 0 || !content.trim()}
                    >
                        {loading ? 'Posting...' : '🚀 Post Now'}
                    </button>
                    <button
                        onClick={() => {
                            if (!showSchedulePicker) {
                                // First click: show the date picker
                                setShowSchedulePicker(true);
                            } else {
                                // Second click: submit the schedule
                                handleSchedule();
                            }
                        }}
                        className={`px-4 py-2 text-white rounded-lg transition-colors duration-200 ${loading || selectedPlatforms.length === 0 || !content.trim()
                            ? 'bg-blue-400 dark:bg-blue-600 opacity-60 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-md shadow-blue-500/50'
                            }`}
                        disabled={loading || selectedPlatforms.length === 0 || !content.trim()}
                    >
                        {loading ? 'Scheduling...' : (showSchedulePicker ? '✓ Confirm Schedule' : '📅 Schedule')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Login Modal (Admin Access) ---

const LoginModal = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Auth mode: 'signin' or 'signup'
    const [authMode, setAuthMode] = useState('signin');

    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [username, setUsername] = useState('');
    const [gender, setGender] = useState('');

    // Reset form when modal closes or mode changes
    const resetForm = () => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setUsername('');
        setGender('');
        setError(null);
        setSuccess(null);
    };

    const switchMode = (mode) => {
        resetForm();
        setAuthMode(mode);
    };

    if (!isOpen) return null;

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { signInWithEmail, signUpWithEmail } = await import('./api/auth');

            if (authMode === 'signin') {
                await signInWithEmail(email, password);
                console.log('✅ Successfully signed in with email');
                onClose();
            } else {
                // Validate sign up
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }
                if (password.length < 6) {
                    throw new Error('Password must be at least 6 characters');
                }
                if (!username.trim()) {
                    throw new Error('Username is required');
                }

                await signUpWithEmail(email, password, username.trim(), gender || 'not_specified');
                console.log('✅ Successfully signed up');
                setSuccess('Account created successfully! You are now signed in.');
                setTimeout(() => onClose(), 1500);
            }
        } catch (err) {
            console.error(`❌ Email auth failed:`, err);
            // Format Firebase error messages
            let errorMessage = err.message;
            if (err.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered. Try signing in instead.';
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                errorMessage = 'Invalid email or password.';
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleOAuth = async (provider) => {
        setLoading(true);
        setError(null);

        try {
            const { signInWithGoogle, signInWithMicrosoft } = await import('./api/auth');

            if (provider === 'Google') {
                await signInWithGoogle();
            } else if (provider === 'Microsoft') {
                await signInWithMicrosoft();
            }

            console.log(`✅ Successfully signed in with ${provider}`);
            onClose();
        } catch (err) {
            console.error(`❌ ${provider} login failed:`, err);
            setError(err.message || `Failed to sign in with ${provider}`);
        } finally {
            setLoading(false);
        }
    };

    const GoogleIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18px" height="18px" className="mr-2">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.343c-1.77,2.677-4.92,4.516-8.843,4.516c-6.6,0-11.983-5.383-11.983-11.983c0-6.6,5.383-11.983,11.983-11.983c3.342,0,6.48,1.442,8.665,3.771l6.096-6.096C38.006,5.138,32.748,3,24,3C12.44,3,3,12.44,3,24c0,11.56,9.44,21,21,21c9.47,0,16.529-6.521,17.158-17.917L43.611,20.083z" />
            <path fill="#FF3D00" d="M6.306,14.691L1.401,9.786C4.888,5.432,9.757,3,15,3c8.156,0,13.298,5.08,13.298,5.08L22.997,14.51C20.628,11.323,17.47,9.516,13.543,9.516C8.82,9.516,4.86,12.783,3.31,17.373L6.306,14.691z" />
            <path fill="#4CAF50" d="M24,45c6.883,0,12.593-3.267,16.634-7.857L33.729,32.14c-1.928,2.837-5.086,4.86-8.729,4.86c-4.723,0-8.683-3.267-10.233-7.857L6.306,33.309C10.65,39.816,17.44,45,24,45z" />
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.343c-1.181,1.866-2.915,3.197-4.843,3.743c-2.091,0.612-4.188,0.76-6.177,0.443L6.306,33.309L3.31,30.597c2.618-5.719,7.668-9.088,14.69-9.088c4.29,0,8.349,1.673,11.141,4.402L39.167,14.73C34.549,10.655,29.349,9.516,24,9.516c4.608,0,8.966,1.444,12.454,3.772l3.771-3.771c-3.149-2.73-7.391-4.402-12.225-4.402c-7.25,0-13.67,3.615-17.387,9.088L1.401,9.786C4.888,5.432,9.757,3,15,3c8.611,0,15.611,6.864,16.892,16.083H43.611z" />
        </svg>
    );

    const MicrosoftIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18px" height="18px" className="mr-2">
            <rect x="1" y="1" width="10" height="10" fill="#f25022" />
            <rect x="13" y="1" width="10" height="10" fill="#7fba00" />
            <rect x="1" y="13" width="10" height="10" fill="#00a4ef" />
            <rect x="13" y="13" width="10" height="10" fill="#ffb900" />
        </svg>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 dark:bg-opacity-80 p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-xl shadow-2xl p-6 transition-all duration-300 transform scale-100 relative max-h-[90vh] overflow-y-auto">
                {/* Dismiss 'X' Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    aria-label="Close login modal"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {authMode === 'signin' ? 'Welcome Back!' : 'Create Account'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {authMode === 'signin'
                            ? 'Sign in to access your dashboard'
                            : 'Join SocialConnectIQ today'}
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-4 p-3 text-sm font-medium text-red-700 bg-red-100 dark:bg-red-900/50 dark:text-red-300 rounded-lg border border-red-300 dark:border-red-700">
                        {error}
                    </div>
                )}

                {/* Success Display */}
                {success && (
                    <div className="mb-4 p-3 text-sm font-medium text-green-700 bg-green-100 dark:bg-green-900/50 dark:text-green-300 rounded-lg border border-green-300 dark:border-green-700">
                        {success}
                    </div>
                )}

                {/* Email/Password Form */}
                <form onSubmit={handleEmailAuth} className="space-y-4">
                    {authMode === 'signup' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Choose a username"
                                required
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={authMode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {authMode === 'signup' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter your password"
                                    required
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 px-4 rounded-lg text-white font-semibold transition-all ${loading
                            ? 'bg-blue-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50'
                            }`}
                    >
                        {loading
                            ? (authMode === 'signin' ? 'Signing in...' : 'Creating account...')
                            : (authMode === 'signin' ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-3 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            or continue with
                        </span>
                    </div>
                </div>

                {/* OAuth Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => handleOAuth('Google')}
                        disabled={loading}
                        className={`flex items-center justify-center px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400'
                            }`}
                    >
                        <GoogleIcon />
                        Google
                    </button>
                    <button
                        onClick={() => handleOAuth('Microsoft')}
                        disabled={loading}
                        className={`flex items-center justify-center px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400'
                            }`}
                    >
                        <MicrosoftIcon />
                        Microsoft
                    </button>
                </div>

                {/* Mode Toggle */}
                <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                    {authMode === 'signin' ? (
                        <>
                            Don't have an account?{' '}
                            <button
                                onClick={() => switchMode('signup')}
                                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                            >
                                Sign Up
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{' '}
                            <button
                                onClick={() => switchMode('signin')}
                                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                            >
                                Sign In
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
};


// --- SideBar Component ---
const Sidebar = ({ isDarkMode, handleNavClick, isSidebarOpen, toggleSidebar, view, user, userPlan }) => {
    // Determine the color of "Connect" based on dark mode state
    const connectColorClass = isDarkMode ? 'text-gray-100' : 'text-blue-600';

    const sidebarWidth = isSidebarOpen ? 'w-56' : 'w-20';
    const paddingClass = isSidebarOpen ? 'p-4' : 'p-3';

    // Get first name from user
    const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

    // The Menu icon acts as the toggle button
    const ToggleButton = () => (
        <button
            onClick={toggleSidebar}
            className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
            <Menu size={24} />
        </button>
    );

    const NavItems = [
        { name: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
        { name: 'Composer', icon: Send, path: 'composer' },
        { name: 'Analytics', icon: BarChart2, path: 'analytics' },
        { name: 'Integrations', icon: Zap, path: 'integrations_page' },
        { name: 'Trending', icon: TrendingUp, path: 'trending_panel' }, // NEW TRENDING PATH
        { name: 'Billing', icon: CreditCard, path: 'billing' },
        { name: 'Settings', icon: Settings, path: 'settings' },
    ];

    return (
        <div
            className={`hidden md:flex flex-col ${sidebarWidth} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-xl transition-all duration-300 ease-in-out h-full`}
        >
            {/* Header / Logo Section - FIXED BUG HERE */}
            <div className={`flex items-center h-16 mb-4 border-b border-gray-200 dark:border-gray-800 ${isSidebarOpen ? 'justify-between px-4' : 'justify-center gap-2 px-2'}`}>
                {isSidebarOpen ? (
                    <>
                        {/* Expanded State: Title on left, Button on right (justify-between) */}
                        <h1 className="text-xl font-extrabold flex items-center">
                            <span className="text-blue-600 dark:text-blue-400">Social</span>
                            <span className="text-gray-900 dark:text-gray-100">ConnectIQ</span>
                        </h1>
                        <ToggleButton />
                    </>
                ) : (
                    <>
                        {/* Collapsed State: Logo + Button side by side */}
                        <img
                            src="/logo_siq.png"
                            alt="SocialConnectIQ"
                            className="w-8 h-8 object-contain cursor-pointer"
                            onClick={toggleSidebar}
                        />
                        <ToggleButton />
                    </>
                )}
            </div>

            {/* User Profile Section - Above Navigation */}
            {user && !user.isAnonymous && (
                <div className={`mb-4 flex flex-col items-center ${isSidebarOpen ? 'px-4' : 'px-2'}`}>
                    {/* Avatar */}
                    {user.photoURL ? (
                        <img
                            src={user.photoURL}
                            alt="Profile"
                            referrerPolicy="no-referrer"
                            className={`rounded-full border-2 border-blue-500 shadow ${isSidebarOpen ? 'w-14 h-14' : 'w-8 h-8'}`}
                        />
                    ) : (
                        <div className={`rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shadow ${isSidebarOpen ? 'w-14 h-14 text-2xl' : 'w-8 h-8 text-sm'}`}>
                            {firstName.charAt(0).toUpperCase()}
                        </div>
                    )}

                    {/* Name and Status - Only when expanded */}
                    {isSidebarOpen && (
                        <div className="mt-2 text-center">
                            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {firstName}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                Active
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation Links */}
            <nav className="flex-1 space-y-2">
                {NavItems.map((item) => {
                    // FIX: Use the passed 'view' state to determine the current active link
                    const isCurrent = item.path === view;

                    return (
                        <button
                            key={item.name}
                            onClick={() => handleNavClick(item.path)}
                            className={`w-full flex items-center rounded-xl text-sm font-medium transition-colors group ${paddingClass} ${isCurrent
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            title={!isSidebarOpen ? item.name : undefined} // Tooltip when closed
                            aria-current={isCurrent ? 'page' : undefined}
                        >
                            {/* Icon Styling: Inherits 'text-white' from active state or 'text-gray-600/300' from inactive state */}
                            <item.icon className={`h-5 w-5 ${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                            {isSidebarOpen && item.name}

                            {/* Hidden text for screen readers when closed */}
                            {!isSidebarOpen && (
                                <span className="sr-only">{item.name}</span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* User ID Footer (Collapsed/Expanded) */}
            <div className={`mt-auto overflow-hidden ${isSidebarOpen ? 'px-4' : 'px-2'}`}>
                {/* Ad Banner for Basic Users */}
                {userPlan === 'basic' && (
                    <div className="mb-4">
                        <AdBanner userPlan={userPlan} isSidebar={true} isCollapsed={!isSidebarOpen} />
                    </div>
                )}
            </div>

            <div className={`pt-4 border-t border-gray-200 dark:border-gray-800 ${isSidebarOpen ? 'text-left px-4' : 'text-center'}`}>
                {isSidebarOpen && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 break-all">App ID: {appId}</p>
                )}
                {!isSidebarOpen && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 rotate-90 w-4 mx-auto my-3">App ID</p>
                )}
            </div>
        </div>
    );
};

// --- TopBar Component ---
const TopBar = ({ toggleTheme, isDarkMode, user, openComposer, openLoginModal, handleLogout, notifications = [], onClearNotification, isNotificationPanelOpen, toggleNotificationPanel, isProfileDropdownOpen, toggleProfileDropdown, onNavigateToProfile, userPlan }) => {
    // Check if user is logged in with a real account (not anonymous)
    const isRealUser = user && !user.isAnonymous && (user.email || user.displayName);
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 shadow-sm">
            <div className="md:hidden text-xl font-extrabold">
                <span className="text-blue-600 dark:text-blue-400">Social</span>
                <span className="text-gray-900 dark:text-gray-100">ConnectIQ</span>
            </div>

            {/* Search Bar - Shortened and Centered */}
            <div className="flex-1 flex justify-center max-w-lg mx-auto hidden sm:block">
                <input
                    type="text"
                    placeholder="Search posts, metrics, or settings..."
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100"
                />
            </div>

            {/* Action Items */}
            <div className="flex items-center space-x-3 ml-4">
                {/* Ad for Basic Plan in Top Bar */}
                {userPlan === 'basic' && (
                    <button
                        onClick={() => openComposer()} // Or navigate to billing
                        className="hidden md:flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-full text-xs font-bold shadow-md hover:scale-105 transition-transform"
                    >
                        <Zap size={12} fill="currentColor" />
                        <span>Upgrade</span>
                    </button>
                )}
                <button
                    onClick={openComposer}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors text-sm font-semibold"
                >
                    <Send className="w-4 h-4 mr-2" /> New Post
                </button>

                {/* Notifications Bell */}
                <div className="relative">
                    <button
                        onClick={toggleNotificationPanel}
                        className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
                        aria-label="Notifications"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notifications Dropdown */}
                    {isNotificationPanelOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Notifications</h3>
                                {notifications.length > 0 && (
                                    <button
                                        onClick={() => onClearNotification('all')}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        Clear all
                                    </button>
                                )}
                            </div>
                            {notifications.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                    No notifications yet
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        className={`p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-start gap-3 ${!notif.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                    >
                                        <span className="text-lg">
                                            {notif.type === 'success' ? '✅' : notif.type === 'error' ? '❌' : notif.type === 'scheduled' ? '📅' : '🔔'}
                                        </span>
                                        <div className="flex-1">
                                            <p className="text-sm text-gray-700 dark:text-gray-200">{notif.message}</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{notif.time}</p>
                                        </div>
                                        <button
                                            onClick={() => onClearNotification(notif.id)}
                                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                        >
                                            <X size={14} className="text-gray-400" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Conditional: Show User Info or Login Button */}
                {isRealUser ? (
                    <div className="relative">
                        {/* Clickable Avatar + Name */}
                        <button
                            onClick={toggleProfileDropdown}
                            className="flex items-center space-x-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            {/* User Avatar */}
                            {user.photoURL ? (
                                <img
                                    src={user.photoURL}
                                    alt="User avatar"
                                    referrerPolicy="no-referrer"
                                    className="w-8 h-8 rounded-full border-2 border-blue-500"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                                </div>
                            )}
                            {/* User Name + Dropdown Arrow */}
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:flex items-center gap-1 max-w-[120px]">
                                <span className="truncate">{user.displayName || user.email?.split('@')[0] || 'User'}</span>
                                <ChevronDown size={14} className={`transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                            </span>
                        </button>

                        {/* Profile Dropdown Menu */}
                        {isProfileDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                                {/* User Info Header */}
                                <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                                    <div className="flex items-center gap-3">
                                        {user.photoURL ? (
                                            <img
                                                src={user.photoURL}
                                                alt="User avatar"
                                                referrerPolicy="no-referrer"
                                                className="w-12 h-12 rounded-full border-2 border-white/50"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                                                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">
                                                {user.displayName || 'User'}
                                            </p>
                                            <p className="text-xs text-blue-100 truncate">
                                                {user.email || 'No email'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu Items */}
                                <div className="py-2">
                                    <button
                                        onClick={() => {
                                            onNavigateToProfile();
                                            toggleProfileDropdown();
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                                    >
                                        <Settings size={18} className="text-gray-500 dark:text-gray-400" />
                                        Account Settings
                                    </button>
                                </div>

                                {/* Logout */}
                                <div className="border-t border-gray-200 dark:border-gray-700 py-2">
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            toggleProfileDropdown();
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-sm"
                                    >
                                        <LogIn size={18} className="rotate-180" />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={openLoginModal}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors text-sm font-semibold"
                        aria-label="Admin Login"
                    >
                        <LogIn className="w-4 h-4 mr-2" /> Login
                    </button>
                )}

                <ThemeToggle isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
            </div>
        </header>
    );
};

// --- Interest Selection View Component ---

const InterestSelectionView = ({ onComplete, db, userId, isDarkMode }) => {
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedCategories, setExpandedCategories] = useState({});

    const MIN_SELECTION = 3;

    const handleToggleInterest = (interest) => {
        setSelectedInterests(prev =>
            prev.includes(interest)
                ? prev.filter(i => i !== interest)
                : [...prev, interest]
        );
        setError(null);
    };

    const toggleCategory = (cat) => {
        setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const getCategorySelectedCount = (cat) => {
        return INTEREST_CATEGORIES[cat].subs.filter(s => selectedInterests.includes(s)).length;
    };

    const handleSubmit = async () => {
        if (selectedInterests.length < MIN_SELECTION) {
            setError(`Please select at least ${MIN_SELECTION} fields.`);
            return;
        }

        setLoading(true);
        setError(null);

        // 1. Save preferences to Firestore (mock persistence)
        const success = await saveInterestsPreference(db, userId, selectedInterests);

        setLoading(false);

        if (success) {
            // 2. Transition to the main dashboard
            onComplete(true);
        } else {
            setError("Failed to save preferences. Please try again.");
        }
    };

    // Determine card background based on overall theme
    const cardBgClass = isDarkMode ? 'bg-gray-800' : 'bg-white';

    return (
        <div className={`flex items-center justify-center flex-1 p-4 sm:p-8 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <div className={`w-full max-w-2xl ${cardBgClass} rounded-xl shadow-2xl p-6 md:p-8 border border-gray-200 dark:border-gray-700`}>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-2 text-center">
                    Welcome to ConnectIQ!
                </h1>
                <p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-6">
                    To personalize your dashboard and recommendations, please select your primary fields of interest.
                </p>

                <label className="block text-xl font-semibold text-blue-600 dark:text-blue-400 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                    In which fields are you more interested in?
                </label>

                {/* Categorized Interest Accordion */}
                <div
                    className="max-h-96 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg divide-y divide-gray-200 dark:divide-gray-700"
                    role="group"
                    aria-describedby="error-message-interest"
                >
                    {Object.entries(INTEREST_CATEGORIES).map(([category, { icon, subs }]) => {
                        const isExpanded = expandedCategories[category];
                        const selectedCount = getCategorySelectedCount(category);
                        return (
                            <div key={category}>
                                <button
                                    type="button"
                                    onClick={() => toggleCategory(category)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{icon}</span>
                                        <span className="font-semibold text-gray-800 dark:text-gray-200">{category}</span>
                                        {selectedCount > 0 && (
                                            <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 rounded-full">
                                                {selectedCount}
                                            </span>
                                        )}
                                    </div>
                                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                {isExpanded && (
                                    <div className="px-4 pb-3 pt-1 space-y-1 bg-gray-50/50 dark:bg-gray-800/50">
                                        {subs.map(sub => {
                                            const isSelected = selectedInterests.includes(sub);
                                            return (
                                                <label
                                                    key={sub}
                                                    className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleInterest(sub)}
                                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500"
                                                    />
                                                    <span className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                                                        {sub}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Error Message Display */}
                {error && (
                    <div id="error-message-interest" className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 dark:bg-red-900 dark:text-red-300 rounded-lg text-sm font-medium transition-all duration-300 flex items-center" role="alert">
                        <AlertTriangle size={20} className="mr-2 flex-shrink-0" />
                        {error}
                    </div>
                )}


                {/* Submit Button Container (Bottom Right) */}
                <div className="flex justify-end mt-6">
                    <button
                        onClick={handleSubmit}
                        disabled={loading || selectedInterests.length < MIN_SELECTION}
                        className={`px-8 py-3 text-white font-semibold rounded-xl shadow-lg transition duration-150 transform hover:scale-[1.02] flex items-center justify-center
                            ${loading || selectedInterests.length < MIN_SELECTION
                                ? 'bg-blue-400 cursor-not-allowed opacity-75'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/50 dark:bg-blue-500 dark:hover:bg-blue-600'
                            }`}
                    >
                        {loading ? (
                            <>
                                <Clock size={20} className="animate-spin mr-2" />
                                Saving Selections...
                            </>
                        ) : (
                            <>
                                Submit and Go to Dashboard
                                <ArrowRight size={20} className="ml-2" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Integrations Status Panel (Dashboard Footer) ---
const IntegrationsStatusPanel = React.forwardRef(({ platformConnections, isTargetingIntegrations }, ref) => (
    // Pass platformConnections prop
    <div
        ref={ref}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 transition-all duration-500 ${isTargetingIntegrations ? 'ring-4 ring-yellow-400/50 dark:ring-yellow-300/50' : ''}`}
    >
        <h2 className="text-2xl font-extrabold mb-4 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
            Integrations Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {PLATFORMS.map(platform => {
                const Icon = platform.icon;
                // READ from platformConnections state
                const isConnected = platformConnections[platform.id] || false;
                return (
                    <div key={platform.id} className="flex flex-col items-center p-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div className={`p-2 rounded-full ${platform.color} mb-2`}>
                            <Icon size={24} className="text-white" />
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{platform.name}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isConnected ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                );
            })}
        </div>
    </div>
));


// --- Trending Content Component (Displayed on Dashboard) ---
const TrendingContent = ({ openTrendingModal, onExploreMore, hasInterests, onEnablePersonalization, trendingTopics = [], loadingTrending, trendingError, onRefreshTrending }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                🔥 Trending Today
            </h2>
        </div>

        {/* Show personalization prompt if no interests saved */}
        {!hasInterests ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Personalize Your Feed
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                    Turn on personalization to see trending content tailored to your interests.
                </p>
                <button
                    onClick={onEnablePersonalization}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Turn on Personalization →
                </button>
            </div>
        ) : (
            <>
                {/* Show trending posts when interests are enabled */}
                {loadingTrending ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                        <p className="text-gray-500 dark:text-gray-400">Fetching trending news...</p>
                    </div>
                ) : trendingError ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-red-500 dark:text-red-400 mb-4">{trendingError}</p>
                        <button onClick={onRefreshTrending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            Try Again
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(trendingTopics.length > 0 ? trendingTopics.slice(0, 4) : []).map((post) => (
                            <div
                                key={post.id}
                                onClick={() => openTrendingModal(post)}
                                className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:shadow-xl hover:ring-2 ring-blue-500 transition duration-200 transform hover:scale-[1.02]"
                            >
                                {/* Image */}
                                <div className="h-24 mb-3 overflow-hidden rounded-md">
                                    <img
                                        src={post.imageUrl || `https://placehold.co/600x400/2563eb/ffffff?text=News`}
                                        alt={post.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                {/* Title */}
                                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2" title={post.title}>
                                    {post.title}
                                </h4>
                                {/* Category + Date */}
                                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">{post.category}</span>
                                    {post.pubDate && <span>{new Date(post.pubDate).toLocaleDateString()}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {/* Explore More Button */}
                <div className="flex justify-center mt-6">
                    <button
                        onClick={onExploreMore}
                        className="px-6 py-2 text-blue-600 dark:text-blue-400 font-semibold rounded-lg border-2 border-blue-600 dark:border-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 transition-all duration-200"
                    >
                        Explore More →
                    </button>
                </div>
            </>
        )}
    </div>
);


// --- NEW DEDICATED TRENDING CONTENT VIEW ---
const TrendingSidebarContent = ({ openTrendingModal, onManageInterests, trendingTopics = [], loadingTrending, trendingError, onRefreshTrending, hasInterests }) => (
    <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 min-h-[500px]">
            {/* Header with Manage Interests button */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
                    <TrendingUp className="inline mr-2 h-7 w-7 text-red-500" /> Personalized Trending Feed
                </h1>
                <button
                    onClick={onManageInterests}
                    className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 transition-colors"
                >
                    ⚙️ Manage Interests
                </button>
            </div>

            {/* Show prompt if personalization is off */}
            {!hasInterests ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        Personalize Your Feed
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                        Turn on personalization in Settings and select your interests to see trending content tailored just for you.
                    </p>
                    <button
                        onClick={onManageInterests}
                        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Enable Personalization →
                    </button>
                </div>
            ) : loadingTrending ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">Fetching trending news...</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">This may take a few seconds...</p>
                </div>
            ) : trendingError ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-red-500 dark:text-red-400 mb-4 text-lg">{trendingError}</p>
                    <button onClick={onRefreshTrending} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                        Try Again
                    </button>
                </div>
            ) : (
                <>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Explore the top <strong>{trendingTopics.length}</strong> trending topics based on your interests. Click any card to read more.
                    </p>
                    <ol className="space-y-4">
                        {trendingTopics.map((post, index) => (
                            <li
                                key={post.id}
                                onClick={() => openTrendingModal(post)}
                                className="flex items-start p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 cursor-pointer hover:shadow-lg hover:ring-1 ring-blue-500 transition duration-200"
                            >
                                <span className="text-2xl font-black mr-4 text-blue-600 dark:text-blue-400 w-8 flex-shrink-0 text-right">{index + 1}.</span>

                                {/* Thumbnail */}
                                <div className="w-16 h-16 mr-4 overflow-hidden rounded-md flex-shrink-0">
                                    <img
                                        src={post.imageUrl || `https://placehold.co/150x150/2563eb/ffffff?text=News`}
                                        alt={post.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate" title={post.title}>
                                        {post.title}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">{post.category}</span>
                                        {post.pubDate && <span className="text-xs text-gray-500">{new Date(post.pubDate).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={onRefreshTrending}
                            className="px-6 py-2 text-blue-600 dark:text-blue-400 font-semibold rounded-lg border-2 border-blue-600 dark:border-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                        >
                            Refresh Trending
                        </button>
                    </div>
                </>
            )}
        </div>
    </div>
);


const DashboardContent = ({ scheduledPosts, integrationsRef, isTargetingIntegrations, openTrendingModal, platformConnections, handleNavClick, hasInterests, db, userId, onDeleteFromPlatform, onDeleteSinglePlatform, deleting, onNavigateToCalendar, highlightedDate, onDeleteScheduledPost, onCancelAllScheduledPosts, trendingTopics, loadingTrending, trendingError, onRefreshTrending, userPlan }) => (

    <div className="p-6 space-y-6">
        {/* Ad Banner for Basic Plan */}
        {userPlan === 'basic' && (
            <div className="mb-6">
                <AdBanner userPlan={userPlan} />
            </div>
        )}

        {/* Section 1: Platforms */}
        <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                📱 Platforms
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {MOCK_ANALYTICS.map(data => {
                    // Map platform display name to platform ID for connection lookup
                    const platformIdMap = {
                        'Facebook': 'facebook',
                        'Instagram': 'instagram',
                        'WhatsApp': 'whatsapp',
                        'LinkedIn': 'linkedin'
                    };
                    const platformId = platformIdMap[data.platform] || data.platform.toLowerCase();
                    const isConnected = platformConnections[platformId] || false;

                    // Calculate actual post count for this platform from scheduledPosts
                    const postedCount = scheduledPosts.filter(post =>
                        post.status === 'posted' &&
                        post.platforms?.includes(platformId)
                    ).length;

                    return (
                        <AnalyticsCard
                            key={data.platform}
                            {...data}
                            posts={postedCount}
                            color={PLATFORMS.find(p => p.name === data.platform)?.color || 'bg-gray-500'}
                            isConnected={isConnected}
                            onConnectClick={() => handleNavClick('integrations_page')}
                        />
                    );
                })}
            </div>
            {/* See More Button */}
            <div className="flex justify-end mt-4">
                <button
                    onClick={() => handleNavClick('integrations_page')}
                    className="px-6 py-2 text-blue-600 dark:text-blue-400 font-semibold rounded-lg border-2 border-blue-600 dark:border-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 transition-all duration-200"
                >
                    See More →
                </button>
            </div>
        </div>



        {/* Section 2: Trending Content (Limited view with Explore more) */}
        <TrendingContent
            openTrendingModal={openTrendingModal}
            onExploreMore={() => handleNavClick('trending_panel')}
            hasInterests={hasInterests}
            onEnablePersonalization={() => handleNavClick('settings')}
            trendingTopics={trendingTopics}
            loadingTrending={loadingTrending}
            trendingError={trendingError}
            onRefreshTrending={onRefreshTrending}
        />

        {/* Section 3: Calendar and Scheduled Posts Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl min-h-[400px]">
                <CalendarView
                    scheduledPosts={scheduledPosts}
                    onDeleteFromPlatform={onDeleteFromPlatform}
                    deleting={deleting}
                    highlightedDate={highlightedDate}
                />
            </div>
            <ScheduledPostsPanel
                scheduledPosts={scheduledPosts}
                onNavigateToCalendar={onNavigateToCalendar}
                onDelete={onDeleteScheduledPost}
                onCancelAll={onCancelAllScheduledPosts}
            />
        </div>
    </div>
);

// --- Trending Detail Modal ---
const TrendingDetailModal = ({ isOpen, onClose, topic, onDraft, onUpdateImage }) => {
    // Local state for image (allows regeneration)
    const [modalImageUrl, setModalImageUrl] = useState(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [cooldown, setCooldown] = useState(0); // Cooldown timer in seconds

    // Sync state when topic opens
    useEffect(() => {
        if (topic) {
            setModalImageUrl(topic.imageUrl);
        }
    }, [topic]);

    // Cooldown countdown timer
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    // Regenerate handler - uses Pollinations via backend proxy
    const handleRegenerateImage = (e) => {
        e.stopPropagation();
        if (cooldown > 0 || isRegenerating) return; // Prevent clicking during cooldown or loading

        setIsRegenerating(true);
        setCooldown(15); // Start 15-second cooldown

        // Generate a completely new URL with different seed
        // Use full topic data for better image generation
        if (topic?.title) {
            // Build a rich prompt from topic data (title + category + summary keywords)
            const cleanTitle = topic.title.slice(0, 40).replace(/['"]/g, '');
            const category = topic.category || '';
            // Extract key words from summary (first 50 chars)
            const summaryPart = topic.summary ? topic.summary.slice(0, 50).replace(/['"]/g, '') : '';

            // Combine for a more contextual prompt
            const fullPrompt = `${cleanTitle}, ${category} theme, ${summaryPart}, professional illustration, modern digital art`;
            const encodedPrompt = encodeURIComponent(fullPrompt);
            const newSeed = Math.floor(Math.random() * 100000);
            const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${newSeed}&width=800&height=400`;

            // Use backend proxy to fetch the image (avoids CORS and rate limit display issues)
            const proxyUrl = `http://localhost:8006/proxy-image?url=${encodeURIComponent(pollinationsUrl)}`;

            console.log("Regenerating with rich prompt:", fullPrompt.slice(0, 80) + "...");
            console.log("Seed:", newSeed);

            fetch(proxyUrl)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    return res.blob();
                })
                .then(blob => {
                    const objectUrl = URL.createObjectURL(blob);
                    setModalImageUrl(objectUrl);
                    setIsRegenerating(false);

                    // Update the dashboard thumbnail by calling the parent callback
                    if (onUpdateImage) {
                        onUpdateImage(topic.id, objectUrl);
                    }
                })
                .catch(err => {
                    console.error("Failed to regenerate image:", err);
                    setIsRegenerating(false);
                });
        }
    };

    // Handler for when image finishes loading (for non-blob URLs)
    const handleImageLoad = () => {
        // Only stop regenerating if we're not using blob URLs (which are set after fetch completes)
        if (!modalImageUrl?.startsWith('blob:')) {
            setIsRegenerating(false);
        }
    };

    if (!isOpen || !topic) return null;

    const platform = PLATFORMS.find(p => p.id === topic.platformId);
    const Icon = platform ? platform.icon : Zap;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">

                {/* Image Header */}
                <div className="h-48 w-full relative flex-shrink-0">
                    <img
                        src={modalImageUrl || `https://placehold.co/800x400/2563eb/ffffff?text=${encodeURIComponent(topic.title)}`}
                        alt={topic.title}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isRegenerating ? 'opacity-50' : 'opacity-100'}`}
                        onLoad={handleImageLoad}
                    />
                    {/* Loading spinner overlay */}
                    {isRegenerating && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors backdrop-blur-sm"
                    >
                        <X size={20} />
                    </button>
                    <div className="absolute bottom-4 left-6 text-white">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`p-1 rounded-full ${platform?.color || 'bg-gray-500'} text-white shadow-sm`}>
                                <Icon size={14} />
                            </span>
                            <span className="text-xs font-bold uppercase tracking-wider opacity-90">{platform?.name || 'Trending'}</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                            {topic.category}
                        </span>
                        <span className="text-gray-400 text-xs">•</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center">
                            <TrendingUp size={12} className="mr-1" /> Trending Now
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
                        {topic.title}
                    </h2>

                    {/* Article Preview */}
                    {topic.summary && (
                        <div className="text-gray-600 dark:text-gray-300 text-base mb-6 leading-relaxed">
                            {topic.summary.split(/\n\s*\n/).map((paragraph, index) => (
                                <p key={index} className="mb-3">
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                    )}

                    {/* Read complete news link */}
                    {topic.sourceUrl && (
                        <a
                            href={topic.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium mb-6"
                        >
                            Read complete news →
                        </a>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-medium transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => onDraft({ ...topic, imageUrl: modalImageUrl })}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                        >
                            <Sparkles size={18} />
                            Compose with AI
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Onboarding Modal Component ---
const OnboardingModal = ({ isOpen, userId, db, onComplete }) => {
    const [formData, setFormData] = useState({
        username: '',
        gender: '',
        dateOfBirth: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load initial data (e.g. from Auth provider)
    useEffect(() => {
        if (isOpen && userId && db) {
            // Optional: Fetch existing incomplete data if needed
            // For now, we assume if it's open, we need fresh input or just use what we have locally if we were lifting state
        }
    }, [isOpen, userId, db]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!formData.username.trim() || !formData.gender || !formData.dateOfBirth) {
            setError('Please fill in all fields to continue.');
            return;
        }

        setLoading(true);
        try {
            // using top-level imports
            const userRef = doc(db, 'users', userId);

            await setDoc(userRef, {
                username: formData.username,
                gender: formData.gender,
                dateOfBirth: formData.dateOfBirth,
                onboardingCompleted: true,
                updatedAt: serverTimestamp()
            }, { merge: true });

            onComplete();
        } catch (err) {
            console.error("Error saving profile:", err);
            setError("Failed to save details. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4">
                            <User size={32} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Welcome!</h2>
                        <p className="text-gray-500 dark:text-gray-400">
                            Let's set up your profile to personalize your experience.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center">
                                <AlertTriangle size={16} className="mr-2 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username / Display Name</label>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                placeholder="How should we call you?"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Gender</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['Male', 'Female', 'Other'].map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, gender: option.toLowerCase() })}
                                        className={`py-2.5 px-2 rounded-lg text-sm font-medium border transition-all ${formData.gender === option.toLowerCase()
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                                            }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date of Birth</label>
                            <input
                                type="date"
                                value={formData.dateOfBirth}
                                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3.5 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                                }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Saving...
                                </span>
                            ) : (
                                "Get Started →"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};


// --- Full-Screen Integration View Component ---

const AuthFields = ({ platformId, loading, mobileNumber, setMobileNumber, otpInput, setOtpInput, handleSendOTP, handleVerifyOTP, handleLogin }) => {

    // Determine the type of authentication needed
    const isEmailPassword = ['facebook', 'linkedin', 'onedrive'].includes(platformId);
    const isUserIdPassword = ['instagram', 'twitter'].includes(platformId);
    const isWhatsApp = platformId === 'whatsapp';

    const [emailOrUser, setEmailOrUser] = useState('');
    const [password, setPassword] = useState('');
    const [otpFlow, setOtpFlow] = useState('phone_input'); // Re-initiate OTP flow state here for this component

    // --- Standard Login Fields (Email/Password or UserID/Password) ---
    // MODIFIED: For OAuth platforms, we don't need user input.
    if (isEmailPassword || isUserIdPassword) {
        return (
            <div className="w-full">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Connect your account securely via OAuth. You will be redirected to the provider's login page.
                </p>
                <button
                    onClick={() => handleLogin(platformId)}
                    disabled={loading}
                    className={`w-full py-3 rounded-lg text-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Redirecting...
                        </>
                    ) : (
                        `Connect with ${PLATFORMS.find(p => p.id === platformId)?.name || 'Account'}`
                    )}
                </button>
            </div>
        );
    }

    // --- WhatsApp OTP Fields (Mock Flow) ---
    if (isWhatsApp) {
        // NOTE: This area handles the WhatsApp flow, simplified for the full-screen view.

        const isOTPPhase = otpFlow === 'otp_verification';
        const isLocked = false; // Mocking lock state is complex, keeping simple here

        return (
            <div className="w-full">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Verify your WhatsApp number to establish a secure connection.
                </p>

                {/* Phone Number Input Phase */}
                {!isOTPPhase && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Mobile Number (with Country Code)</label>
                            <input
                                type="tel"
                                value={mobileNumber}
                                onChange={(e) => setMobileNumber(e.target.value)}
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                placeholder="+1234567890"
                            />
                        </div>
                        <button
                            onClick={() => { handleSendOTP(); setOtpFlow('otp_verification'); }}
                            disabled={loading || mobileNumber.length < 9}
                            className={`w-full mt-2 py-3 rounded-lg text-lg font-semibold text-white transition-colors ${loading ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                                }`}
                        >
                            {loading ? 'Sending OTP...' : 'Send Verification Code'}
                        </button>
                    </div>
                )}

                {/* OTP Verification Phase */}
                {isOTPPhase && (
                    <div className="space-y-4 p-4 border border-green-300 dark:border-green-700 rounded-lg bg-green-50 dark:bg-green-900/50">
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                            Enter the 6-digit code sent to **{mobileNumber}**.
                        </p>
                        <div>
                            <input
                                type="text"
                                value={otpInput}
                                onChange={(e) => setOtpInput(e.target.value)}
                                maxLength="6"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center text-xl font-mono"
                                placeholder="------"
                                disabled={isLocked}
                            />
                        </div>
                        <button
                            onClick={handleVerifyOTP}
                            disabled={loading || otpInput.length !== 6 || isLocked}
                            className={`w-full py-3 rounded-lg text-lg font-semibold text-white transition-colors ${loading || isLocked ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                        >
                            Verify & Connect
                        </button>
                        <button onClick={() => setOtpFlow('phone_input')} className="w-full mt-2 py-2 text-gray-700 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Change Number</button>
                    </div>
                )}
            </div>
        );
    }

    return <div className="text-red-500">Authentication method not defined for this platform.</div>;
};


const FullIntegrationView = ({ platformId, onBack, onComplete }) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    const [step, setStep] = useState(1); // 1: Permissions, 2: Authorization, 3: Success
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- WhatsApp State Management (Integrated) ---
    const [mobileNumber, setMobileNumber] = useState('');
    const [otpSent, setOtpSent] = useState('');
    const [otpInput, setOtpInput] = useState('');
    // --- End WhatsApp State Management ---

    if (!platform) {
        return <div className="p-10 text-red-500">Error: Platform not found.</div>;
    }

    const Icon = platform.icon;
    const steps = ['Grant Permissions', 'Authorize Account', 'Finalizing'];
    const progress = Math.min(step, steps.length);

    // --- Common Auth Handler for standard logins (REAL API CALLS) ---
    const handleLogin = async (id) => {
        if (id === 'whatsapp') return; // Handled separately by OTP flow

        setLoading(true);
        setError(null);
        setStep(2); // Move to Authorization/Loading Step

        try {
            let authUrl;
            switch (id) {
                case 'linkedin':
                    authUrl = await authenticateLinkedIn();
                    break;
                case 'facebook':
                    authUrl = await authenticateFacebook();
                    break;
                case 'twitter':
                    authUrl = await authenticateTwitter();
                    break;
                case 'instagram':
                    authUrl = await authenticateInstagram();
                    break;
                default:
                    throw new Error(`Unsupported platform: ${id}`);
            }

            if (authUrl) {
                // Open OAuth in popup window (keeps parent window open for callback)
                console.log(`🔗 Opening OAuth popup: ${authUrl}`);
                const popup = window.open(
                    authUrl,
                    `${id}_oauth`,
                    'width=600,height=700,scrollbars=yes,resizable=yes,left=200,top=100'
                );

                // Check if popup was blocked
                if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                    throw new Error('Popup was blocked. Please allow popups for this site.');
                }

                // Reset loading state - the message listener will handle completion
                setLoading(false);
            } else {
                throw new Error('No authorization URL received from server');
            }
        } catch (err) {
            console.error(`❌ Authentication error for ${id}:`, err);
            setLoading(false);
            setError(err.message || 'Authentication failed. Please try again.');
            setStep(1);
        }
    };

    // --- WhatsApp Handlers (REAL API CALLS) ---
    const handleSendOTP = async () => {
        const phoneRegex = /^\+\d{8,15}$/;
        if (!phoneRegex.test(mobileNumber)) {
            setError('Invalid mobile number format. Please include country code, e.g., +1234567890.');
            return;
        }
        setError(null);
        setLoading(true);

        try {
            const response = await sendWhatsAppOTP(mobileNumber);
            setLoading(false);
            if (response.success) {
                setOtpSent('sent'); // Mark that OTP was sent
                setError('OTP sent successfully! Check your WhatsApp.');
            } else {
                setError(response.message || 'Failed to send OTP');
            }
        } catch (err) {
            setLoading(false);
            console.error('WhatsApp OTP error:', err);
            setError(err.message || 'Failed to send OTP. Please try again.');
        }
    };

    const handleVerifyOTP = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await verifyWhatsAppOTP(mobileNumber, otpInput);
            setLoading(false);
            if (response.success || response.verified) {
                setStep(3);
                onComplete(platformId, true);
            } else {
                setError(response.message || 'Incorrect OTP. Please try again.');
            }
        } catch (err) {
            setLoading(false);
            console.error('WhatsApp verification error:', err);
            setError(err.message || 'Verification failed. Please try again.');
        }
    };
    // --- End WhatsApp Handlers ---


    const PermissionsList = () => (
        <ul className="space-y-3 mt-4 text-gray-700 dark:text-gray-300">
            <li className="flex items-start">
                <CheckCircle size={18} className="text-green-500 mr-3 mt-1 flex-shrink-0" />
                <div>
                    <p className="font-semibold">Read Posts & Engagement</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Required to pull analytics data, comments, and likes for the dashboard reports.</p>
                </div>
            </li>
            <li className="flex items-start">
                <CheckCircle size={18} className="text-green-500 mr-3 mt-1 flex-shrink-0" />
                <div>
                    <p className="font-semibold">Publish Content</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Required to publish scheduled posts, including images and videos, directly to your profile/page.</p>
                </div>
            </li>
            <li className="flex items-start">
                <CheckCircle size={18} className="text-green-500 mr-3 mt-1 flex-shrink-0" />
                <div>
                    <p className="font-semibold">Access Profile/Page Data</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Required to identify and list the specific pages or accounts you wish to manage in ConnectIQ.</p>
                </div>
            </li>
        </ul>
    );

    const RenderStepContent = () => {
        switch (step) {
            case 1:
            case 2: // Permissions and Authorization
                return (
                    <>
                        <div className="lg:col-span-2">
                            <h2 className="text-3xl font-extrabold mb-4 text-gray-900 dark:text-gray-100">
                                {step === 1 ? `Connect to ${platform.name}` : `Authorizing...`}
                            </h2>
                            <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                                {step === 1
                                    ? `Please securely authorize ConnectIQ by providing your credentials and granting permissions below.`
                                    : `Please wait while we securely establish the connection with ${platform.name}. This may take a moment.`
                                }
                            </p>

                            {step === 1 && (
                                <>
                                    {/* Authorization Fields based on platform type */}
                                    <h3 className="text-xl font-semibold border-b pb-2 mb-4 text-blue-600 dark:text-blue-400">Credentials</h3>
                                    <AuthFields
                                        // KEY FIX applied here to preserve AuthFields identity across re-renders
                                        key={platformId}
                                        platformId={platformId}
                                        loading={loading}
                                        mobileNumber={mobileNumber}
                                        setMobileNumber={setMobileNumber}
                                        otpInput={otpInput}
                                        setOtpInput={setOtpInput}
                                        handleSendOTP={handleSendOTP}
                                        handleVerifyOTP={handleVerifyOTP}
                                        handleLogin={handleLogin}
                                    />

                                    <h3 className="text-xl font-semibold border-b pb-2 mt-8 mb-4 text-blue-600 dark:text-blue-400">Required Permissions</h3>
                                    <PermissionsList />
                                </>
                            )}
                            {step === 2 && (
                                <div className="text-center py-10">
                                    <Clock size={48} className="mx-auto text-blue-500 dark:text-blue-400 animate-spin" />
                                    <p className="mt-4 text-lg font-medium">Processing authorization token...</p>
                                </div>
                            )}
                        </div>

                        <div className="lg:col-span-1 bg-gray-50 dark:bg-gray-700 p-6 rounded-xl shadow-inner">
                            <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">Quick Guide</h3>
                            <ol className="space-y-3 text-gray-700 dark:text-gray-300">
                                <li>1. Enter your credentials above.</li>
                                <li>2. Click the **Secure Login** button.</li>
                                <li>3. A window (or OTP field) will confirm access.</li>
                                <li>4. If asked, select the accounts/pages to manage.</li>
                                <li>5. Authorize the connection.</li>
                            </ol>
                            {error && (
                                <div className="mt-6 p-3 text-sm font-medium text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded-lg border border-red-300 flex items-center">
                                    <AlertTriangle size={18} className="mr-2" />
                                    <p className="text-sm">{error}</p>
                                </div>
                            )}
                        </div>
                    </>
                );
            case 3: // Success
                return (
                    <div className="lg:col-span-3 text-center py-20 bg-green-50 dark:bg-green-900/50 rounded-xl">
                        <CheckCircle size={64} className="mx-auto text-green-600" />
                        <h2 className="text-3xl font-extrabold mt-4 text-green-700 dark:text-green-300">
                            Success! {platform.name} is now connected.
                        </h2>
                        <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">
                            You can now schedule posts and view analytics from your dashboard.
                        </p>
                        <button
                            onClick={() => onComplete(platformId, true)}
                            className="mt-6 py-3 px-8 rounded-lg text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                        >
                            Return to Integrations
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Header / Progress Bar */}
            <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-md">
                <button
                    onClick={() => onBack(platformId)}
                    className="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors px-3 py-1 rounded-lg"
                >
                    <ArrowLeft size={20} className="mr-2" /> Back to Integrations
                </button>

                {/* FIX: Centered Title Container */}
                {/* Ensure the centered element doesn't overlap the buttons on narrow screens */}
                <div className="absolute left-1/2 transform -translate-x-1/2 hidden sm:flex items-center">
                    <div className={`p-2 rounded-full ${platform.color} mr-3`}>
                        <Icon size={24} className="text-white" />
                    </div>
                    <h1 className={`text-2xl font-bold text-gray-900 dark:text-gray-100`}>
                        {platform.name} Integration
                    </h1>
                </div>

                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Step {progress} of {steps.length}
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-10">
                <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 min-h-[calc(100vh-140px)]">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <RenderStepContent />
                    </div>
                </div>
            </main>
        </div>
    );
};


// --- Integrations Management Page ---

const IntegrationsPageContent = ({ setFullIntegration, platformConnections, setPlatformConnections, addToast }) => {
    // Track loading state per platform for spinner
    const [connectingPlatform, setConnectingPlatform] = useState(null);

    const handleLogin = async (id) => {
        const platform = PLATFORMS.find(p => p.id === id);

        if (platformConnections[id]) {
            // === DISCONNECT FLOW ===
            setConnectingPlatform(id);
            try {
                const {
                    disconnectLinkedIn,
                    disconnectFacebook,
                    disconnectTwitter,
                    disconnectInstagram,
                    disconnectWhatsApp
                } = await import('./api/social');

                switch (id) {
                    case 'linkedin': await disconnectLinkedIn(); break;
                    case 'facebook': await disconnectFacebook(); break;
                    case 'twitter': await disconnectTwitter(); break;
                    case 'instagram': await disconnectInstagram(); break;
                    case 'whatsapp': await disconnectWhatsApp(); break;
                }

                setPlatformConnections(prev => ({ ...prev, [id]: false }));
                addToast(`${platform.name} disconnected successfully`, 'success');
            } catch (error) {
                console.error(`Failed to disconnect ${platform.name}:`, error);
                addToast(`Failed to disconnect ${platform.name}: ${error.message}`, 'error');
            } finally {
                setConnectingPlatform(null);
            }
        } else if (id === 'whatsapp') {
            // === WHATSAPP — still needs its OTP flow ===
            setFullIntegration(id);
        } else {
            // === DIRECT OAUTH FLOW (LinkedIn, Facebook, Twitter, Instagram) ===
            setConnectingPlatform(id);
            try {
                let authUrl;
                switch (id) {
                    case 'linkedin': authUrl = await authenticateLinkedIn(); break;
                    case 'facebook': authUrl = await authenticateFacebook(); break;
                    case 'twitter': authUrl = await authenticateTwitter(); break;
                    case 'instagram': authUrl = await authenticateInstagram(); break;
                    default: throw new Error(`Unsupported platform: ${id}`);
                }

                if (authUrl) {
                    console.log(`🔗 [INTEGRATIONS] Opening OAuth popup for ${platform.name}`);
                    const popup = window.open(
                        authUrl,
                        `${id}_oauth`,
                        'width=600,height=700,scrollbars=yes,resizable=yes,left=200,top=100'
                    );

                    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                        throw new Error('Popup was blocked. Please allow popups for this site.');
                    }

                    // Poll to detect if user manually closed the popup
                    const popupChecker = setInterval(() => {
                        if (popup.closed) {
                            clearInterval(popupChecker);
                            // Only reset if still in connecting state (i.e., postMessage didn't already handle it)
                            setConnectingPlatform(prev => {
                                if (prev === id) {
                                    console.log(`⚠️ [INTEGRATIONS] ${platform.name} popup was closed manually`);
                                    addToast(`${platform.name} connection was cancelled.`, 'error');
                                    return null;
                                }
                                return prev;
                            });
                        }
                    }, 500);
                } else {
                    throw new Error('No authorization URL received from server');
                }
            } catch (err) {
                console.error(`❌ Authentication error for ${id}:`, err);
                addToast(`Connection failed: ${err.message}`, 'error');
                setConnectingPlatform(null);
            }
        }
    };

    // Expose setConnectingPlatform so the parent OAuth handler can clear it
    // We use a ref callback pattern via window for simplicity
    useEffect(() => {
        window.__clearConnectingPlatform = () => setConnectingPlatform(null);
        return () => { delete window.__clearConnectingPlatform; };
    }, []);

    return (
        <div className="p-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 min-h-[500px]">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-6">
                    Manage Integrations
                </h1>

                <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-4 border-b pb-2">
                    Connect Accounts
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Connect your social media and cloud accounts to enable scheduling and analytics.
                </p>

                {/* Integration Blocks Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {PLATFORMS.map(platform => {
                        const Icon = platform.icon;
                        const isConnected = platformConnections[platform.id];
                        const isConnecting = connectingPlatform === platform.id;

                        let buttonLabel = isConnected ? 'Disconnect' : 'Connect Account';
                        if (isConnecting) {
                            buttonLabel = isConnected ? 'Disconnecting...' : 'Connecting...';
                        }

                        return (
                            <div
                                key={platform.id}
                                className="flex flex-col p-4 border border-gray-200 dark:border-gray-700 rounded-xl shadow-md bg-gray-50 dark:bg-gray-900/50 transition-all duration-200 hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center">
                                        <div className={`p-2 rounded-full ${platform.color} mr-3`}>
                                            <Icon size={20} className="text-white" />
                                        </div>
                                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{platform.name}</p>
                                    </div>
                                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${isConnected
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                        }`}>
                                        {isConnected ? 'Connected' : 'Disconnected'}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 h-10">
                                    {platform.description}
                                </p>

                                {/* Connect/Disconnect Button with spinner */}
                                <button
                                    onClick={() => handleLogin(platform.id)}
                                    disabled={isConnecting}
                                    className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${isConnecting
                                        ? 'bg-gray-400 cursor-not-allowed text-white'
                                        : isConnected
                                            ? 'bg-red-500 hover:bg-red-600 text-white'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                >
                                    {isConnecting && (
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    )}
                                    {buttonLabel}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};


const SettingsContent = ({ db, userId, user }) => {
    const [personalizationEnabled, setPersonalizationEnabled] = useState(false);
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Profile editing state
    const [activeSection, setActiveSection] = useState(null); // 'personal' | null
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState({
        username: '',
        gender: '',
        dateOfBirth: ''
    });
    const [savingProfile, setSavingProfile] = useState(false);

    // Load user profile from Firestore
    useEffect(() => {
        if (!db || !userId) return;

        const profileDocRef = doc(db, 'users', userId);
        const onboardingDocRef = doc(db, `users/${userId}/preferences/onboarding`);

        // Load profile
        const unsubProfile = onSnapshot(profileDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfileData({
                    username: data.username || user?.displayName || '',
                    gender: data.gender || '',
                    dateOfBirth: data.dateOfBirth || ''
                });
            } else {
                // Default to user display name
                setProfileData({
                    username: user?.displayName || user?.email?.split('@')[0] || '',
                    gender: '',
                    dateOfBirth: ''
                });
            }
        });

        // Load interests
        const unsubOnboarding = onSnapshot(onboardingDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSelectedInterests(data.selectedInterests || []);
                setPersonalizationEnabled(data.personalizationEnabled ?? (data.selectedInterests?.length > 0));
            }
            setLoading(false);
        });

        return () => {
            unsubProfile();
            unsubOnboarding();
        };
    }, [db, userId, user?.displayName, user?.email]);

    const handleToggleInterest = (interest) => {
        setSelectedInterests(prev =>
            prev.includes(interest)
                ? prev.filter(i => i !== interest)
                : [...prev, interest]
        );
        setMessage(null);
    };

    const [expandedCategories, setExpandedCategories] = useState({});

    const toggleCategory = (cat) => {
        setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const getCategorySelectedCount = (cat) => {
        return INTEREST_CATEGORIES[cat].subs.filter(s => selectedInterests.includes(s)).length;
    };

    const handleSave = async () => {
        if (!db || !userId) return;

        // Prevent saving while data is still loading (race condition protection)
        if (loading) {
            setMessage({ type: 'error', text: 'Please wait for settings to load before saving.' });
            return;
        }

        // If personalization is on but no interests selected, revert toggle and show error
        if (personalizationEnabled && selectedInterests.length === 0) {
            setPersonalizationEnabled(false);
            setMessage({ type: 'error', text: 'Please select at least one interest to enable personalization.' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const docRef = doc(db, `users/${userId}/preferences/onboarding`);
            await setDoc(docRef, {
                interestsCompleted: true,
                personalizationEnabled,
                selectedInterests: personalizationEnabled ? selectedInterests : [],
                updatedAt: serverTimestamp()
            }, { merge: true });

            setMessage({ type: 'success', text: 'Personalization settings saved!' });
        } catch (e) {
            console.error("Error saving personalization:", e);
            setMessage({ type: 'error', text: 'Failed to save. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    // Save profile changes
    const handleSaveProfile = async () => {
        if (!db || !userId) return;

        setSavingProfile(true);
        try {
            const profileDocRef = doc(db, 'users', userId);
            await setDoc(profileDocRef, {
                username: profileData.username,
                gender: profileData.gender,
                dateOfBirth: profileData.dateOfBirth,
                updatedAt: serverTimestamp()
            }, { merge: true });

            setIsEditing(false);
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (e) {
            console.error("Error saving profile:", e);
            setMessage({ type: 'error', text: 'Failed to save profile.' });
        } finally {
            setSavingProfile(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-6">Settings</h1>

                {/* Profile Section */}
                <div className="mb-8">
                    <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-4 border-b pb-2">
                        Profile
                    </h3>

                    {/* Personal Details Option */}
                    <button
                        onClick={() => setActiveSection(activeSection === 'personal' ? null : 'personal')}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                <Settings size={18} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="text-left">
                                <p className="font-medium text-gray-900 dark:text-gray-100">Personal Details</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Name, gender, date of birth</p>
                            </div>
                        </div>
                        <ChevronDown
                            size={20}
                            className={`text-gray-400 transition-transform ${activeSection === 'personal' ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {/* Personal Details Panel */}
                    {activeSection === 'personal' && (
                        <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            {/* Header with Edit button */}
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Personal Details</h4>
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        Edit
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>

                            {/* Fields */}
                            {/* Profile Photo Display */}
                            <div className="mb-6 flex items-center gap-4">
                                <div className="relative">
                                    {user?.photoURL ? (
                                        <img
                                            src={user.photoURL}
                                            alt="Profile"
                                            referrerPolicy="no-referrer"
                                            className="w-16 h-16 rounded-full border-2 border-gray-200 dark:border-gray-700 shadow-sm object-cover"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-2xl border-2 border-gray-200 dark:border-gray-700">
                                            {(profileData.username || user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Profile Photo</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Synced from your login account</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Username</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={profileData.username}
                                            onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                        />
                                    ) : (
                                        <p className="text-gray-900 dark:text-gray-100">{profileData.username || 'Not set'}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Email</label>
                                    <p className="text-gray-900 dark:text-gray-100">{user?.email || 'Not available'}</p>
                                    <p className="text-xs text-gray-400 mt-1">Email cannot be changed here</p>
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Gender</label>
                                    {isEditing ? (
                                        <select
                                            value={profileData.gender}
                                            onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Prefer not to say</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    ) : (
                                        <p className="text-gray-900 dark:text-gray-100 capitalize">{profileData.gender || 'Not set'}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date of Birth</label>
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            value={profileData.dateOfBirth}
                                            onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                        />
                                    ) : (
                                        <p className="text-gray-900 dark:text-gray-100">
                                            {profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Save Button */}
                            {isEditing && (
                                <div className="flex justify-end mt-6">
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={savingProfile}
                                        className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors ${savingProfile ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                                            }`}
                                    >
                                        {savingProfile ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Personalization Section */}
                <div className="mb-8">
                    <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-2 border-b pb-2">
                        Personalization
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Add your interests so that your feed can show trending content tailored to you.
                    </p>

                    {/* Toggle Switch */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">Enable Personalization</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Show content based on your interests</p>
                        </div>
                        <button
                            onClick={() => setPersonalizationEnabled(!personalizationEnabled)}
                            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${personalizationEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${personalizationEnabled ? 'translate-x-6' : 'translate-x-0'
                                }`} />
                        </button>
                    </div>

                    {/* Interests Selection (shown when enabled) */}
                    {personalizationEnabled && (
                        <div className="mt-4">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Select your interests ({selectedInterests.length} selected)
                            </p>
                            <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                                {Object.entries(INTEREST_CATEGORIES).map(([category, { icon, subs }]) => {
                                    const isExpanded = expandedCategories[category];
                                    const selectedCount = getCategorySelectedCount(category);
                                    return (
                                        <div key={category}>
                                            <button
                                                type="button"
                                                onClick={() => toggleCategory(category)}
                                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{icon}</span>
                                                    <span className="font-semibold text-gray-800 dark:text-gray-200">{category}</span>
                                                    {selectedCount > 0 && (
                                                        <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 rounded-full">
                                                            {selectedCount}
                                                        </span>
                                                    )}
                                                </div>
                                                <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                            {isExpanded && (
                                                <div className="px-4 pb-3 pt-1 space-y-1 bg-gray-50/50 dark:bg-gray-800/50">
                                                    {subs.map(sub => {
                                                        const isSelected = selectedInterests.includes(sub);
                                                        return (
                                                            <label
                                                                key={sub}
                                                                className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => handleToggleInterest(sub)}
                                                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500"
                                                                />
                                                                <span className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                                                                    {sub}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="mt-6 flex items-center gap-4">
                        <button
                            onClick={handleSave}
                            disabled={saving || (personalizationEnabled && selectedInterests.length === 0)}
                            className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors ${saving || (personalizationEnabled && selectedInterests.length === 0) ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                        >
                            {saving ? 'Saving...' : 'Save Preferences'}
                        </button>
                        {message && (
                            <span className={`text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {message.text}
                            </span>
                        )}
                    </div>
                </div>

                {/* User Experience Section */}
                <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-4 border-b pb-2">User Experience</h3>
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <label htmlFor="scroll-speed" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Navigation Scroll Speed (Smoothness)
                    </label>
                    <select id="scroll-speed" disabled className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-48">
                        <option>Fast (Default)</option>
                        <option>Medium</option>
                        <option>Slow</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Currently using browser's default smooth scrolling.
                    </p>
                </div>

                {/* Account Management Section */}
                <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mt-8 mb-4 border-b pb-2">Account Management</h3>
                <p className="text-gray-600 dark:text-gray-300">Manage API keys and connected accounts here.</p>
            </div>
        </div>
    );
};


const AnalyticsContent = () => (
    <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 min-h-[500px]">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-6">Analytics & Reporting</h1>
            <div className="flex flex-col space-y-4">
                <p className="text-lg text-gray-600 dark:text-gray-300">
                    View performance charts and engagement metrics across all connected platforms here.
                </p>
                <div className="p-4 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/50">
                    <h3 className="font-semibold text-blue-700 dark:text-blue-300">Feature Placeholder</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Detailed charts, post trend lines, and audience demographic reports will be displayed in this area.
                    </p>
                </div>
            </div>
        </div>
    </div>
);


// --- Composer 2.0 Full-Page View ---
const ComposerContent = ({ db, userId, platformConnections, addToast, addNotification, onUnsavedContentChange, saveDraftRef, initialData, onClearInitialData, userPlan, monthlyPostCount, scheduledPostsCount, updateUserUsage }) => {
    // Post content state - PER PLATFORM
    const [platformDrafts, setPlatformDrafts] = useState({});     // { linkedin: "...", twitter: "..." }
    const [platformTones, setPlatformTones] = useState({});        // { linkedin: "professional", ... }
    const [activePlatform, setActivePlatform] = useState(null);    // currently viewed tab
    const [toneDropdownOpen, setToneDropdownOpen] = useState(false);
    const [showPlatformDropdown, setShowPlatformDropdown] = useState(false); // For adding platforms
    const [isRefining, setIsRefining] = useState(false);

    const [selectedPlatforms, setSelectedPlatforms] = useState([]);

    // Platform tone defaults & tone options
    const PLATFORM_DEFAULT_TONES = {
        linkedin: 'professional', twitter: 'casual',
        facebook: 'enthusiastic', instagram: 'casual',
    };
    const TONE_OPTIONS = [
        { value: 'professional', label: '💼 Professional' },
        { value: 'casual', label: '😊 Casual' },
        { value: 'humorous', label: '😄 Humorous' },
        { value: 'enthusiastic', label: '🔥 Enthusiastic' },
        { value: 'informative', label: '📚 Informative' },
        { value: 'neutral', label: '⚖️ Neutral' },
    ];

    // Helper: get current active platform's content
    const content = activePlatform ? (platformDrafts[activePlatform] || '') : '';
    const setContent = (val) => {
        if (activePlatform) {
            setPlatformDrafts(prev => ({ ...prev, [activePlatform]: val }));
        }
    };
    // Helper: check if any platform has content
    const anyPlatformHasContent = () => Object.values(platformDrafts).some(c => c && c.trim().length > 0);

    // Image state
    const [uploadedImage, setUploadedImage] = useState(null);
    const [imageBase64, setImageBase64] = useState(null);
    const [imageMimeType, setImageMimeType] = useState(null);

    // Guard to prevent multiple image loads
    const imageLoadedRef = useRef(false);
    const lastImageUrlRef = useRef(null);

    // Trending topic context for Compose with AI flow
    const trendingTopicRef = useRef(null);
    const [pendingPlatformSelection, setPendingPlatformSelection] = useState([]);

    // Upgrade Modal State (from PR)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Load initial data if provided (e.g. from Trending Topics or Drafts)
    useEffect(() => {
        if (initialData) {
            console.log("Loading initial data into composer:", initialData);

            // --- Compose with AI mode: open AI chat with interactive platform selection ---
            if (initialData.mode === 'composeWithAI') {
                const connectedPlatformIds = Object.keys(platformConnections || {}).filter(k => platformConnections[k]);
                trendingTopicRef.current = {
                    title: initialData.topicTitle,
                    summary: initialData.topicSummary,
                    category: initialData.topicCategory,
                    sourceUrl: initialData.sourceUrl,
                    imageUrl: initialData.imageUrl
                };
                // Pre-select all connected platforms
                setPendingPlatformSelection(connectedPlatformIds);
                // Open AI chat and inject the interactive platform selection message
                setShowAiChat(true);
                setChatMessages([
                    {
                        role: 'assistant',
                        type: 'platform_select',
                        content: `📝 Content request received for:\n\n"${initialData.topicTitle}"\n\nWhich platforms would you like me to draft for?`,
                        topicTitle: initialData.topicTitle,
                        topicSummary: initialData.topicSummary,
                        topicCategory: initialData.topicCategory,
                        sourceUrl: initialData.sourceUrl,
                        connectedPlatforms: connectedPlatformIds
                    }
                ]);
                // Load image if provided
                if (initialData.imageUrl && initialData.imageUrl !== lastImageUrlRef.current) {
                    lastImageUrlRef.current = initialData.imageUrl;
                    const proxyUrl = `http://localhost:8006/proxy-image?url=${encodeURIComponent(initialData.imageUrl)}`;
                    fetch(proxyUrl)
                        .then(res => { if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`); return res.blob(); })
                        .then(blob => {
                            if (blob.size < 100) throw new Error("Image blob too small");
                            const objectUrl = URL.createObjectURL(blob);
                            setUploadedImage(objectUrl);
                            setImageMimeType("image/jpeg");
                            const reader = new FileReader();
                            reader.onloadend = () => { setImageBase64(reader.result); imageLoadedRef.current = true; };
                            reader.readAsDataURL(blob);
                        })
                        .catch(err => { console.warn('Image load failed:', err.message); });
                }
                if (onClearInitialData) setTimeout(onClearInitialData, 50);
                return; // Don't run legacy loading below
            }

            // Load per-platform drafts if available, else fallback to single content
            if (initialData.platformDrafts) {
                setPlatformDrafts(initialData.platformDrafts);
                if (initialData.platformTones) setPlatformTones(initialData.platformTones);
            } else if (initialData.content) {
                // Legacy single-content draft: load into all selected platforms
                const platforms = initialData.platforms || [];
                if (platforms.length > 0) {
                    const drafts = {};
                    platforms.forEach(p => { drafts[p] = initialData.content; });
                    setPlatformDrafts(drafts);
                }
            }

            if (initialData.platforms) {
                setSelectedPlatforms(initialData.platforms);
                setActivePlatform(initialData.platforms[0] || null);
                // Initialize tones (merged logic)
                const tones = {};
                initialData.platforms.forEach(p => {
                    tones[p] = (initialData.platformTones && initialData.platformTones[p]) || PLATFORM_DEFAULT_TONES[p] || 'neutral';
                });
                setPlatformTones(prev => ({ ...prev, ...tones }));
            }
        }
    }, [initialData]);

    // AI Chat state
    const [chatMessages, setChatMessages] = useState([
        { role: 'assistant', content: '\ud83d\udc4b Hi! I\'m your AI writing assistant. Tell me what kind of post you\'d like to create, or paste your draft and I\'ll help you refine it!' }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [isAiTyping, setIsAiTyping] = useState(false);

    // Scheduling state
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [showScheduler, setShowScheduler] = useState(false);

    // Loading/status state
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null);

    // Merged Conflict 2: Tone & Refine State
    const [isAiRefining, setIsAiRefining] = useState(false);
    const [selectedTone, setSelectedTone] = useState('Professional');
    const TONES = ['Professional', 'Casual', 'Funny', 'Excited', 'Witty', 'Sarcastic', 'Dramatic', 'Grumpy'];
    const BASIC_TONES = ['Professional', 'Casual', 'Excited'];
    const [regenCooldown, setRegenCooldown] = useState(0);

    // Auto-dismiss status messages after 3 seconds
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => setStatusMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    // Cooldown countdown timer
    useEffect(() => {
        if (regenCooldown > 0) {
            const timer = setTimeout(() => setRegenCooldown(regenCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [regenCooldown]);

    // Drafts state
    const [drafts, setDrafts] = useState([]);
    const [showSaveDraftPopup, setShowSaveDraftPopup] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const [draftFilter, setDraftFilter] = useState(null); // Platform filter for drafts view

    // View state: 'composer' or 'drafts'
    const [composerView, setComposerView] = useState('composer');
    const [showAiChat, setShowAiChat] = useState(false);
    const [showSeeMore, setShowSeeMore] = useState(false);

    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Auto-resize textarea when content changes
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [content]);

    // Load drafts from Firestore on mount
    useEffect(() => {
        if (!db || !userId) return;

        const draftsRef = collection(db, `users/${userId}/drafts`);
        const q = query(draftsRef, orderBy('updatedAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedDrafts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setDrafts(loadedDrafts);
        });

        return () => unsubscribe();
    }, [db, userId]);

    // Auto-select first connected platform if none selected
    useEffect(() => {
        if (!activePlatform && selectedPlatforms.length === 0 && platformConnections) {
            const connected = Object.keys(platformConnections).filter(k => platformConnections[k]);
            if (connected.length > 0) {
                const first = connected[0];
                setSelectedPlatforms([first]);
                setActivePlatform(first);
            }
        }
    }, [platformConnections]);

    // Check for unsaved content
    const hasUnsavedContent = () => {
        return anyPlatformHasContent() || uploadedImage;
    };

    // Report unsaved content state to parent
    useEffect(() => {
        onUnsavedContentChange?.(hasUnsavedContent());
    }, [platformDrafts, selectedPlatforms, uploadedImage, onUnsavedContentChange]);

    // Auto-scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const togglePlatform = (id) => {
        setSelectedPlatforms(prev => {
            const isCurrentlySelected = prev.includes(id);
            const newSelected = isCurrentlySelected ? prev.filter(p => p !== id) : [...prev, id];

            if (!isCurrentlySelected) {
                // Just checked a new platform
                setActivePlatform(id);
                // Initialize default tone if not set
                setPlatformTones(prevTones => ({
                    ...prevTones,
                    [id]: prevTones[id] || PLATFORM_DEFAULT_TONES[id] || 'neutral'
                }));
                // If content already exists for other platforms, prompt to generate?
                if (anyPlatformHasContent() && !platformDrafts[id]) {
                    // We'll let the user know they can generate for this platform
                    setStatusMessage({ type: 'info', text: `✨ Use AI Chat to generate ${id.charAt(0).toUpperCase() + id.slice(1)} content!` });
                }
            } else {
                // Unchecked a platform - switch active to another selected one
                if (activePlatform === id) {
                    setActivePlatform(newSelected.length > 0 ? newSelected[0] : null);
                }
            }
            return newSelected;
        });
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            setStatusMessage({ type: 'error', text: 'Please use JPEG, PNG, or GIF images.' });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setStatusMessage({ type: 'error', text: 'Image must be under 5MB.' });
            return;
        }

        setUploadedImage(URL.createObjectURL(file));
        setImageMimeType(file.type);

        const reader = new FileReader();
        reader.onloadend = () => {
            setImageBase64(reader.result.split(',')[1]);
        };
        reader.readAsDataURL(file);
    };

    const handleRefineContent = async () => {
        if (!content.trim()) return;

        if (!userId) {
            addToast('Please log in to use AI refinement.', 'error');
            return;
        }

        // Basic Plan Restriction: Word Limit for AI
        if (userPlan === 'basic') {
            const wordCount = content.trim().split(/\s+/).length;
            if (wordCount > 100) {
                setStatusMessage({ type: 'error', text: 'Basic plan limit: Please reduce content to under 100 words for AI refinement.' });
                return;
            }
        }
        // Pro Plan Restriction: Word Limit for AI
        if (userPlan === 'pro') {
            const wordCount = content.trim().split(/\s+/).length;
            if (wordCount > 1000) {
                setStatusMessage({ type: 'error', text: 'Pro plan limit: Please reduce content to under 1000 words for AI refinement.' });
                return;
            }
        }

        // Basic Plan Restriction: Tones
        // Uses component-level BASIC_TONES constant
        if (userPlan === 'basic' && selectedTone && !BASIC_TONES.includes(selectedTone)) {
            setStatusMessage({ type: 'error', text: `Basic plan is limited to ${BASIC_TONES.join(', ')} tones. Upgrade to Pro.` });
            return;
        }

        setIsAiRefining(true);
        console.log(`🤖 Refining content for user ${userId} with tone ${selectedTone}`);

        try {
            const result = await aiService.refineContent(content, userId, selectedTone);

            if (result.success && result.refined_content) {
                setContent(result.refined_content);
                addToast('Content refined by AI successfully!', 'success');

                // Show suggestions if available (optional enhancement)
                if (result.suggestions && result.suggestions.length > 0) {
                    console.log('AI Suggestions:', result.suggestions);
                }
            } else {
                throw new Error(result.error || 'Failed to refine content');
            }
        } catch (error) {
            console.error('Refinement failed:', error);
            addToast(`Refinement failed: ${error.message}`, 'error');
        } finally {
            setIsAiRefining(false);
        }
    };

    const removeImage = () => {
        if (uploadedImage) URL.revokeObjectURL(uploadedImage);
        setUploadedImage(null);
        setImageBase64(null);
        setImageMimeType(null);
    };

    // Generate AI image from post content
    const generateAIImage = async () => {
        if (!content.trim()) {
            addToast('Write some content first to generate a relevant image', 'error');
            return;
        }

        if (regenCooldown > 0) {
            addToast(`Please wait ${regenCooldown}s before generating`, 'warning');
            return;
        }

        setLoading(true);
        setRegenCooldown(15); // Start 15-second cooldown

        try {
            // Generate image prompt from content (first 80 chars for better context)
            const prompt = content.slice(0, 80) || 'abstract professional';
            const seed = Math.floor(Math.random() * 100000);
            const encodedPrompt = encodeURIComponent(`${prompt}, professional illustration, digital art, modern design`);
            const imageUrl = `http://localhost:8006/proxy-image?url=${encodeURIComponent(`https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${seed}&width=800&height=400`)}`;

            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error('Failed to generate image');

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            setUploadedImage(objectUrl);

            // Convert to base64 for API usage
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result.split(',')[1];
                setImageBase64(base64String);
                setImageMimeType(blob.type || "image/jpeg");
                addToast("✨ AI image generated!", "success");
            };
            reader.onerror = () => {
                console.error("Failed to convert AI image to base64");
                addToast("Image generated (preview only)", "warning");
            };
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error('AI image generation failed:', error);
            addToast("Failed to generate AI image. Try again later.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSendChat = async () => {
        if (!chatInput.trim() && !currentContent) return;

        // Default to all connected platforms if none selected
        const connectedPlatformIds = Object.keys(platformConnections).filter(k => platformConnections[k]);
        const targetPlatforms = selectedPlatforms.length > 0 ? selectedPlatforms : connectedPlatformIds;

        const newUserMsg = { role: 'user', content: chatInput };
        const newMessages = [...chatMessages, newUserMsg];
        setChatMessages(newMessages);
        setChatInput('');
        setIsAiTyping(true);

        try {
            // Import the chatWithAI function dynamically
            const { chatWithAI } = await import('./api/social');

            const response = await chatWithAI(
                chatInput,
                content,
                chatMessages,
                selectedPlatforms,
                connectedPlatformIds,
                imageBase64,
                imageMimeType,
                {
                    selected_platforms: targetPlatforms,
                    connected_platforms: connectedPlatformIds,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }
            );

            if (response.success) {
                const aiMessage = {
                    role: 'assistant',
                    content: response.reply,
                    suggestedContent: response.suggested_content,
                    action: response.action,
                    actionResult: response.action_result
                };
                setChatMessages(prev => [...prev, aiMessage]);

                // Handle actions (post/schedule)
                if (response.action === 'posted') {
                    addToast('✅ Posted successfully!', 'success');
                    setPlatformDrafts({});
                    setSelectedPlatforms([]);
                    setActivePlatform(null);
                    if (uploadedImage) URL.revokeObjectURL(uploadedImage);
                    setUploadedImage(null);
                    setImageBase64(null);
                    setImageMimeType(null);
                } else if (response.action === 'scheduled') {
                    setStatusMessage({
                        type: 'success',
                        text: `📅 Scheduled successfully for ${response.action_result?.scheduled_time || 'later'}! Check your calendar.`
                    });
                    setPlatformDrafts({});
                    setSelectedPlatforms([]);
                    setActivePlatform(null);
                    if (uploadedImage) URL.revokeObjectURL(uploadedImage);
                    setUploadedImage(null);
                    setImageBase64(null);
                    setImageMimeType(null);
                } else if (response.suggested_platforms) {
                    // Per-platform content received
                    setPlatformDrafts(prev => ({
                        ...prev,
                        ...response.suggested_platforms
                    }));
                    // Initialize tones for any new platforms
                    const newTones = {};
                    Object.keys(response.suggested_platforms).forEach(p => {
                        if (!platformTones[p]) {
                            newTones[p] = PLATFORM_DEFAULT_TONES[p] || 'neutral';
                        }
                    });
                    if (Object.keys(newTones).length > 0) {
                        setPlatformTones(prev => ({ ...prev, ...newTones }));
                    }
                    // Set active platform if none is active
                    if (!activePlatform && Object.keys(response.suggested_platforms).length > 0) {
                        setActivePlatform(Object.keys(response.suggested_platforms)[0]);
                    }
                    setStatusMessage({ type: 'success', text: '✨ Content generated for each platform!' });
                } else if (response.suggested_content) {
                    // Single content (legacy / single platform) - apply to active platform or all selected
                    if (selectedPlatforms.length === 1) {
                        setPlatformDrafts(prev => ({ ...prev, [selectedPlatforms[0]]: response.suggested_content }));
                        if (!activePlatform) setActivePlatform(selectedPlatforms[0]);
                    } else if (activePlatform) {
                        setPlatformDrafts(prev => ({ ...prev, [activePlatform]: response.suggested_content }));
                    }
                }
            } else {
                setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '❌ Sorry, I encountered an error. Please try again.'
                }]);
            }
        } catch (error) {
            console.error('Chat error:', error);
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ Could not reach AI service. Is the agent-service running?'
            }]);
        } finally {
            setIsAiTyping(false);
        }
    };

    // --- Compose from Trending: called when user selects platforms and clicks Continue ---
    const handleComposeFromTrending = async (selectedPlatformIds) => {
        const topic = trendingTopicRef.current;
        if (!topic || selectedPlatformIds.length === 0) return;

        // Add user-like message showing what was selected
        const platformNames = selectedPlatformIds.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
        setChatMessages(prev => [...prev,
        { role: 'user', content: `Generate drafts for: ${platformNames}` }
        ]);
        setIsAiTyping(true);

        try {
            const { draftFromTrending } = await import('./api/social');
            const response = await draftFromTrending(
                topic.title,
                topic.summary || '',
                topic.sourceUrl || '',
                selectedPlatformIds
            );

            if (response.success && response.drafts) {
                // Load each platform's draft into tabs
                setPlatformDrafts(prev => ({ ...prev, ...response.drafts }));
                setSelectedPlatforms(selectedPlatformIds);
                setActivePlatform(selectedPlatformIds[0]);

                // Initialize tones
                const newTones = {};
                selectedPlatformIds.forEach(p => {
                    newTones[p] = PLATFORM_DEFAULT_TONES[p] || 'neutral';
                });
                setPlatformTones(prev => ({ ...prev, ...newTones }));

                setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `✨ Drafts generated for ${selectedPlatformIds.length} platform${selectedPlatformIds.length > 1 ? 's' : ''}! Review them in the tabs on the left.\n\nFeel free to ask me to refine the content, change tone, or add hashtags.`
                }]);
                setStatusMessage({ type: 'success', text: '✨ AI drafts loaded into platform tabs!' });
            } else {
                setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `❌ Failed to generate drafts: ${response.error || 'Unknown error'}. You can try again using the chat.`
                }]);
            }
        } catch (error) {
            console.error('Compose from trending error:', error);
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ Could not reach AI service. Is the agent-service running?'
            }]);
        } finally {
            setIsAiTyping(false);
        }
    };

    // --- Tailor existing content for a newly-added platform ---
    const handleTailorForPlatform = async (platformId) => {
        // Find existing content from another platform to use as base
        const existingContent = Object.entries(platformDrafts).find(([key, val]) => val && val.trim());
        if (!existingContent) return;

        const [sourcePlatform, sourceContent] = existingContent;
        setIsAiTyping(true);
        setShowAiChat(true);
        const platformName = platformId.charAt(0).toUpperCase() + platformId.slice(1);

        setChatMessages(prev => [...prev,
        { role: 'user', content: `Tailor the existing post for ${platformName}` }
        ]);

        try {
            const { chatWithAI } = await import('./api/social');
            const connectedPlatformIds = Object.keys(platformConnections).filter(k => platformConnections[k]);

            const response = await chatWithAI(
                `Tailor the following post for ${platformName}. Adapt the tone, length, and style for ${platformName}'s audience. Keep the same core message but optimize for the platform:\n\n${sourceContent}`,
                sourceContent,
                [],
                [platformId],
                connectedPlatformIds,
                imageBase64,
                imageMimeType,
                {
                    selected_platforms: [platformId],
                    connected_platforms: connectedPlatformIds,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }
            );

            if (response.success) {
                // Use suggested_platforms if available, otherwise suggested_content
                let tailoredContent = '';
                if (response.suggested_platforms && response.suggested_platforms[platformId]) {
                    tailoredContent = response.suggested_platforms[platformId];
                } else if (response.suggested_content) {
                    tailoredContent = response.suggested_content;
                }

                if (tailoredContent) {
                    setPlatformDrafts(prev => ({ ...prev, [platformId]: tailoredContent }));
                    setChatMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✨ ${platformName} version ready! Check the ${platformName} tab to review.\n\n${response.reply || ''}`
                    }]);
                    setStatusMessage({ type: 'success', text: `✨ ${platformName} draft generated!` });
                } else {
                    setChatMessages(prev => [...prev, {
                        role: 'assistant',
                        content: response.reply || '❌ Could not generate content for this platform.'
                    }]);
                }
            } else {
                setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '❌ Failed to tailor content. Please try again.'
                }]);
            }
        } catch (error) {
            console.error('Tailor error:', error);
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ Could not reach AI service.'
            }]);
        } finally {
            setIsAiTyping(false);
        }
    };

    // --- DRAFTS FUNCTIONS ---
    const saveDraft = async () => {
        if (!anyPlatformHasContent() && !uploadedImage) {
            addToast('Nothing to save as draft.', 'error');
            return;
        }

        try {
            const path = `users/${userId}/drafts`;
            const docRef = doc(collection(db, path));

            // Generate title from first platform's content (first 50 chars)
            const firstContent = Object.values(platformDrafts).find(c => c && c.trim());
            const title = firstContent ? firstContent.trim().substring(0, 50) + (firstContent.length > 50 ? '...' : '') : 'Untitled Draft';

            await setDoc(docRef, {
                title,
                platformDrafts: platformDrafts,
                platformTones: platformTones,
                platforms: selectedPlatforms,
                image: imageBase64
                    ? (imageBase64.startsWith('data:') ? imageBase64 : `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}`)
                    : null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            addToast('📝 Draft saved!', 'success');
            console.log('✅ [COMPOSER] Draft saved');
        } catch (error) {
            console.error('❌ [COMPOSER] Failed to save draft:', error);
            addToast(`Failed to save draft: ${error.message}`, 'error');
        }
    };

    // Expose saveDraft to parent via ref
    useEffect(() => {
        if (saveDraftRef) {
            saveDraftRef.current = saveDraft;
        }
    }, [saveDraftRef, saveDraft]);



    const handlePostNow = async () => {
        if (!anyPlatformHasContent() || selectedPlatforms.length === 0) {
            setStatusMessage({ type: 'error', text: 'Add content and select at least one platform.' });
            return;
        }

        // Basic Plan Restriction: Monthly Post Limit
        if (userPlan === 'basic' && monthlyPostCount >= 14) {
            setStatusMessage({ type: 'error', text: 'Free trial for this month is completed. Plan will be renewed from next month on 1st.' });
            return;
        }
        // Pro Plan Restriction: Monthly Post Limit
        if (userPlan === 'pro' && monthlyPostCount >= 35) {
            setStatusMessage({ type: 'error', text: 'Pro plan limit reached (35 posts/month). Upgrade to Enterprise.' });
            return;
        }

        setLoading(true);
        setStatusMessage({ type: 'info', text: '⏳ Posting...' });

        try {
            const { postToLinkedIn } = await import('./api/social');

            console.log('📤 [COMPOSER] Starting post to platforms:', selectedPlatforms);

            let platformPostIds = {};

            for (const platformId of selectedPlatforms) {
                const platformContent = platformDrafts[platformId] || '';
                if (!platformContent.trim()) {
                    console.warn(`⚠️ [COMPOSER] Skipping ${platformId} - no content`);
                    continue;
                }

                if (platformId === 'linkedin') {
                    const result = await postToLinkedIn(platformContent, imageBase64, imageMimeType);
                    console.log('✅ [COMPOSER] LinkedIn post result:', result);
                    const linkedInPostId =
                        result?.result?.post_id ||
                        result?.result?.id ||
                        result?.result?.urn ||
                        result?.result?.share_urn ||
                        result?.post_id ||
                        result?.id ||
                        result?.urn;
                    if (linkedInPostId) {
                        platformPostIds.linkedin = linkedInPostId;
                        console.log(`📌 [COMPOSER] LinkedIn post_id captured: ${linkedInPostId}`);
                    }
                }
                // Add other platforms as needed
            }

            // Save to Firestore (posts collection for immediate posts)
            if (db && userId) {
                const path = `users/${userId}/posts`;
                const docRef = doc(collection(db, path));

                await setDoc(docRef, {
                    content: Object.values(platformDrafts).find(c => c && c.trim()) || '',
                    platformDrafts: platformDrafts,
                    platforms: selectedPlatforms,
                    image: imageBase64 ? `data:${imageMimeType};base64,${imageBase64}` : null,
                    scheduledTime: new Date(),

                    status: 'posted',
                    platformPostIds: platformPostIds,
                    createdAt: serverTimestamp(),
                    postedAt: serverTimestamp(),
                });
                console.log('✅ [COMPOSER] Saved to Firestore posts collection');
            }

            // Update Usage Stats
            if (updateUserUsage) {
                updateUserUsage('post');
            }

            setStatusMessage({ type: 'success', text: '✅ Posted successfully! Check your calendar.' });

            // Reset form after 2 seconds
            setTimeout(() => {
                setPlatformDrafts({});
                setUploadedImage(null);
                setImageBase64(null);
                setImageMimeType(null);
                setSelectedPlatforms([]);
                setActivePlatform(null);
                console.log('✅ [COMPOSER] Form reset complete');
            }, 2000);

        } catch (error) {
            console.error('❌ [COMPOSER] Post failed:', error);
            const errorMessage = typeof error?.message === 'string'
                ? error.message
                : (typeof error === 'string' ? error : 'Unknown error occurred');
            setStatusMessage({ type: 'error', text: `Failed: ${errorMessage}` });
        } finally {
            setLoading(false);
        }
    };

    const handleSchedule = async () => {
        if (!anyPlatformHasContent() || selectedPlatforms.length === 0 || !scheduleDate || !scheduleTime) {
            setStatusMessage({ type: 'error', text: 'Fill in all fields including date/time.' });
            return;
        }

        const scheduledTime = new Date(`${scheduleDate}T${scheduleTime}`);
        if (scheduledTime <= new Date()) {
            setStatusMessage({ type: 'error', text: 'Schedule time must be in the future.' });
            return;
        }

        // Basic Plan Restriction: Scheduled Post Limit
        if (userPlan === 'basic' && scheduledPostsCount >= 2) {
            setStatusMessage({ type: 'error', text: 'Basic plan limit reached (2 scheduled posts). Upgrade to Pro.' });
            return;
        }
        // Pro Plan Restriction: Scheduled Post Limit
        if (userPlan === 'pro' && scheduledPostsCount >= 15) {
            setStatusMessage({ type: 'error', text: 'Pro plan limit reached (15 scheduled posts). Upgrade to Enterprise.' });
            return;
        }

        setLoading(true);
        try {
            const path = `users/${userId}/scheduled_posts`;
            const docRef = doc(collection(db, path));

            await setDoc(docRef, {
                content: Object.values(platformDrafts).find(c => c && c.trim()) || '',
                platformDrafts: platformDrafts,
                platforms: selectedPlatforms,
                image: imageBase64
                    ? (imageBase64.startsWith('data:') ? imageBase64 : `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}`)
                    : null,
                scheduledTime: scheduledTime,
                status: 'pending',
                createdAt: serverTimestamp(),
            });

            // Update Usage Stats
            if (updateUserUsage) {
                updateUserUsage('schedule');
            }

            setStatusMessage({ type: 'success', text: '📅 Post scheduled!' });
            addNotification?.({ type: 'scheduled', message: `Post scheduled for ${scheduledTime.toLocaleString()}` });

            // Reset
            setPlatformDrafts({});
            setUploadedImage(null);
            setImageBase64(null);
            setSelectedPlatforms([]);
            setActivePlatform(null);
            setShowScheduler(false);
        } catch (error) {
            setStatusMessage({ type: 'error', text: `Failed to schedule: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    // --- REFINE TONE FUNCTION ---
    const handleRefineTone = async () => {
        if (!activePlatform || !platformDrafts[activePlatform]?.trim()) {
            setStatusMessage({ type: 'error', text: 'No content to refine.' });
            return;
        }

        setIsRefining(true);
        try {
            const { refineTone } = await import('./api/social');
            const currentTone = platformTones[activePlatform] || PLATFORM_DEFAULT_TONES[activePlatform] || 'neutral';
            const result = await refineTone(platformDrafts[activePlatform], activePlatform, currentTone);

            if (result.success && result.refined_content) {
                setPlatformDrafts(prev => ({ ...prev, [activePlatform]: result.refined_content }));
                setStatusMessage({ type: 'success', text: `✨ ${activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1)} content refined with ${currentTone} tone!` });
            } else {
                setStatusMessage({ type: 'error', text: result.error || 'Refinement failed.' });
            }
        } catch (error) {
            console.error('Refine tone error:', error);
            setStatusMessage({ type: 'error', text: `Refine failed: ${error.message}` });
        } finally {
            setIsRefining(false);
        }
    };

    // --- DRAFT NAVIGATION & LOADING ---
    const handleNavigateToDrafts = () => {
        if (hasUnsavedContent()) {
            setPendingNavigation('drafts');
            setShowSaveDraftPopup(true);
        } else {
            setComposerView('drafts');
            setDraftFilter(null);
        }
    };

    const handleSaveDraftAndLeave = async () => {
        await saveDraft();
        setShowSaveDraftPopup(false);
        if (pendingNavigation === 'drafts') {
            setComposerView('drafts');
            setDraftFilter(null);
        }
        setPendingNavigation(null);
    };

    const handleDiscardAndLeave = () => {
        setShowSaveDraftPopup(false);
        // Clear content
        setPlatformDrafts({});
        setPlatformTones({});
        setSelectedPlatforms([]);
        setActivePlatform(null);
        setUploadedImage(null);
        setImageBase64(null);
        setImageMimeType(null);

        if (pendingNavigation === 'drafts') {
            setComposerView('drafts');
            setDraftFilter(null);
        }
        setPendingNavigation(null);
    };

    const deleteDraft = async (draftId) => {
        if (!confirm('Are you sure you want to delete this draft?')) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/drafts`, draftId));
            addToast('Draft deleted', 'success');
        } catch (error) {
            console.error('Error deleting draft:', error);
            addToast('Failed to delete draft', 'error');
        }
    };

    const loadDraft = (draft) => {
        // 1. Load platforms
        if (draft.platforms && draft.platforms.length > 0) {
            setSelectedPlatforms(draft.platforms);
            setActivePlatform(draft.platforms[0]);
        } else {
            setSelectedPlatforms([]);
            setActivePlatform(null);
        }

        // 2. Load Content
        if (draft.platformDrafts) {
            setPlatformDrafts(draft.platformDrafts);
            // Load tones if available
            if (draft.platformTones) {
                setPlatformTones(prev => ({ ...prev, ...draft.platformTones }));
            }
        } else if (draft.content) {
            // Backward compatibility: load single content into all platforms
            const newDrafts = {};
            (draft.platforms || []).forEach(p => newDrafts[p] = draft.content);
            setPlatformDrafts(newDrafts);
        }

        // 3. Initialize tones for platforms that don't have them
        if (draft.platforms) {
            const newTones = {};
            draft.platforms.forEach(p => {
                if (!draft.platformTones?.[p] && !platformTones[p]) {
                    newTones[p] = PLATFORM_DEFAULT_TONES[p] || 'neutral';
                }
            });
            setPlatformTones(prev => ({ ...prev, ...newTones }));
        }

        // 4. Load Image
        if (draft.image) {
            setUploadedImage(draft.image);
            if (draft.image.startsWith('data:')) {
                const base64 = draft.image.split(',')[1];
                setImageBase64(base64);
                const matches = draft.image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
                if (matches && matches.length > 1) setImageMimeType(matches[1]);
            }
        } else {
            setUploadedImage(null);
            setImageBase64(null);
            setImageMimeType(null);
        }

        setComposerView('composer');
        setStatusMessage({ type: 'success', text: 'Draft loaded!' });
    };

    return (
        <div className="p-6 h-full overflow-hidden">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl h-full flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <Sparkles className="h-6 w-6 text-blue-500" />
                            AI Composer
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Create and refine posts with AI assistance</p>
                    </div>

                    {/* Right side: Status + Post Now Button */}
                    <div className="flex items-center gap-4">
                        {/* Status Message */}
                        {statusMessage && (
                            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${statusMessage.type === 'success'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : statusMessage.type === 'info'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                }`}>
                                {statusMessage.text}
                            </div>
                        )}

                        {/* Post Now Button - Only show when platforms selected */}
                        {selectedPlatforms.length > 0 && (
                            <button
                                onClick={handlePostNow}
                                disabled={loading || !content.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                            >
                                {loading ? <Clock className="animate-spin" size={16} /> : <Send size={16} />}
                                Post Now
                            </button>
                        )}
                    </div>
                </div>

                {/* Save Draft Popup Modal */}
                {showSaveDraftPopup && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Save Draft?</h3>
                                {/* X button to stay and dismiss popup */}
                                <button
                                    onClick={() => { setShowSaveDraftPopup(false); setPendingNavigation(null); }}
                                    className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer shadow-md"
                                    title="Close"
                                >
                                    <X size={20} strokeWidth={3} />
                                </button>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">You have unsaved content. Would you like to save it as a draft before leaving?</p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={handleDiscardAndLeave}
                                    className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Discard
                                </button>
                                <button
                                    onClick={handleSaveDraftAndLeave}
                                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                >
                                    Save Draft
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* DRAFTS VIEW */}
                {composerView === 'drafts' && (
                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Back to Composer Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setComposerView('composer')}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    title="Back to Composer"
                                >
                                    <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
                                </button>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Your Drafts</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{drafts.length} saved drafts</p>
                                </div>
                            </div>
                        </div>

                        {/* Platform Filter */}
                        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                            <button
                                onClick={() => setDraftFilter(null)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!draftFilter
                                    ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-900'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                All Drafts
                            </button>
                            {PLATFORMS.filter(p => ['linkedin', 'twitter', 'facebook', 'instagram'].includes(p.id)).map(p => {
                                const Icon = p.icon;
                                const isActive = draftFilter === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => setDraftFilter(p.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${isActive
                                            ? `${p.color} text-white border-transparent`
                                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                    >
                                        <Icon size={14} />
                                        {p.name}
                                    </button>
                                );
                            })}
                        </div>

                        {drafts.length === 0 ? (
                            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                                <FileText size={64} className="mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium">No drafts saved yet</p>
                                <p className="text-sm">Click "Save Draft" while composing to save your work</p>
                                <button
                                    onClick={() => setComposerView('composer')}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Start Composing
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-4 max-w-2xl mx-auto pb-8">
                                {drafts.filter(d => !draftFilter || (d.platforms && d.platforms.includes(draftFilter))).map(draft => {
                                    // Determine preview content
                                    const previewContent = draft.platformDrafts
                                        ? (Object.values(draft.platformDrafts).find(c => c && c.trim()) || '')
                                        : (draft.content || '');

                                    return (
                                        <div
                                            key={draft.id}
                                            className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 transition-all shadow-sm hover:shadow-md group"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 flex-1 mr-4">
                                                    {draft.title || 'Untitled Draft'}
                                                </h3>
                                                <span className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {draft.updatedAt?.seconds
                                                        ? new Date(draft.updatedAt.seconds * 1000).toLocaleDateString()
                                                        : 'Just now'}
                                                </span>
                                            </div>

                                            <div className="flex items-start gap-4 mb-4">
                                                {draft.image && (
                                                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                                        <img src={draft.image} alt="Draft" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed flex-1">
                                                    {previewContent || <span className="italic text-gray-400">No content preview available</span>}
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                                                <div className="flex items-center gap-2">
                                                    {draft.platforms?.map(p => {
                                                        const platform = PLATFORMS.find(pl => pl.id === p);
                                                        const Icon = platform?.icon;
                                                        return Icon ? (
                                                            <div key={p} className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400" title={platform.name}>
                                                                <Icon size={14} />
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>

                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => loadDraft(draft)}
                                                        className="px-4 py-1.5 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                                                    >
                                                        Open
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteDraft(draft.id); }}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Delete draft"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* COMPOSER VIEW - Flex Layout */}
                {composerView === 'composer' && (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Left: Live Preview */}
                        <div className={`${showAiChat ? 'w-1/2' : 'w-full'} flex flex-col transition-all`}>
                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                        <Eye className="h-5 w-5" /> Live Preview
                                    </h2>
                                    {/* Drafts Button */}
                                    <button
                                        onClick={handleNavigateToDrafts}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${composerView === 'drafts'
                                            ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-purple-400'
                                            }`}
                                    >
                                        <FileText size={18} />
                                        <span className="text-sm font-medium">Drafts</span>
                                        {drafts.length > 0 && (
                                            <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">{drafts.length}</span>
                                        )}
                                    </button>
                                </div>


                                {/* Unified Composer Card */}
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                                    {/* Tabs Header */}
                                    <div className="flex items-center justify-between px-2 pt-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 rounded-t-xl">
                                        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1">
                                            {selectedPlatforms.map(pId => {
                                                const platform = PLATFORMS.find(p => p.id === pId);
                                                const isActive = activePlatform === pId;
                                                return (
                                                    <button
                                                        key={pId}
                                                        onClick={() => setActivePlatform(pId)}
                                                        className={`relative flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-all rounded-t-lg -mb-[1px] whitespace-nowrap ${isActive
                                                            ? `border-${platform.color.split('-')[1] || 'blue'}-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white`
                                                            : 'border-transparent hover:bg-white/50 dark:hover:bg-gray-800/50 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                                            }`}
                                                    >
                                                        <platform.icon size={16} className={isActive ? platform.color.replace('bg-', 'text-') : ''} />
                                                        {platform.name}
                                                        {isActive && <span className={`absolute bottom-[-2px] left-0 right-0 h-[2px] ${platform.color}`}></span>}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Add Platform Button */}
                                        <div className="relative ml-2 mb-0.5 flex-shrink-0">
                                            <button
                                                onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
                                                className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors uppercase tracking-wide"
                                            >
                                                <Plus size={16} />
                                                Add
                                            </button>
                                            {showPlatformDropdown && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setShowPlatformDropdown(false)}></div>
                                                    <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 p-1.5">
                                                        {PLATFORMS.filter(p => ['linkedin', 'twitter', 'facebook', 'instagram'].includes(p.id) && !selectedPlatforms.includes(p.id)).length === 0 ? (
                                                            <div className="px-3 py-2 text-xs text-center text-gray-500 dark:text-gray-400">All platforms added</div>
                                                        ) : (
                                                            PLATFORMS.filter(p => ['linkedin', 'twitter', 'facebook', 'instagram'].includes(p.id) && !selectedPlatforms.includes(p.id)).map(p => {
                                                                const isConnected = platformConnections?.[p.id];
                                                                return (
                                                                    <button
                                                                        key={p.id}
                                                                        onClick={() => {
                                                                            if (isConnected) {
                                                                                togglePlatform(p.id);
                                                                            } else {
                                                                                handleNavClick('integrations_page');
                                                                            }
                                                                            setShowPlatformDropdown(false);
                                                                        }}
                                                                        className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 group"
                                                                    >
                                                                        <span className={`flex items-center gap-2 ${isConnected ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                                                                            <p.icon size={14} className={isConnected ? p.color.replace('bg-', 'text-') : 'text-gray-400'} />
                                                                            {p.name}
                                                                        </span>
                                                                        {isConnected ? (
                                                                            <Plus size={14} className="text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300" />
                                                                        ) : (
                                                                            <span className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1">
                                                                                Connect
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Toolbar (Tone) */}
                                    {
                                        activePlatform && (
                                            <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setToneDropdownOpen(!toneDropdownOpen)}
                                                            className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
                                                        >
                                                            <span className="text-gray-400 dark:text-gray-500 font-normal">Tone:</span>
                                                            {TONE_OPTIONS.find(t => t.value === (platformTones[activePlatform] || PLATFORM_DEFAULT_TONES[activePlatform]))?.label || 'Select'}
                                                            <ChevronDown size={14} className="text-gray-400" />
                                                        </button>
                                                        {toneDropdownOpen && (
                                                            <>
                                                                <div className="fixed inset-0 z-10" onClick={() => setToneDropdownOpen(false)}></div>
                                                                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl z-20 min-w-[180px]">
                                                                    {TONE_OPTIONS.map(tone => (
                                                                        <button
                                                                            key={tone.value}
                                                                            onClick={() => {
                                                                                setPlatformTones(prev => ({ ...prev, [activePlatform]: tone.value }));
                                                                                setToneDropdownOpen(false);
                                                                            }}
                                                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors first:rounded-t-lg last:rounded-b-lg ${(platformTones[activePlatform] || PLATFORM_DEFAULT_TONES[activePlatform]) === tone.value
                                                                                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium'
                                                                                : 'text-gray-700 dark:text-gray-300'
                                                                                }`}
                                                                        >
                                                                            {tone.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>


                                                <button
                                                    onClick={handleRefineTone}
                                                    disabled={isRefining || !platformDrafts[activePlatform]?.trim()}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isRefining || !platformDrafts[activePlatform]?.trim()
                                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                        }`}
                                                >
                                                    {isRefining ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                                    Refine with AI
                                                </button>
                                            </div>
                                        )
                                    }

                                    {/* Content Area */}
                                    <div className="p-4 bg-white dark:bg-gray-800 flex gap-4 rounded-b-xl">
                                        {/* Avatar */}
                                        <div className="flex-shrink-0 pt-1">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                                You
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-col">
                                            {/* Header */}
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Your Name</span>
                                                {activePlatform && <span className="text-xs text-gray-400 capitalize">• {activePlatform}</span>}
                                            </div>

                                            <textarea
                                                ref={textareaRef}
                                                value={content}
                                                onChange={(e) => {
                                                    setContent(e.target.value);
                                                    // Auto-grow: reset height then set to scrollHeight
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                }}
                                                placeholder={activePlatform ? `What do you want to share on ${activePlatform}?` : 'Select or add a platform to start writing...'}
                                                className="w-full min-h-[120px] p-0 bg-transparent border-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-0 leading-relaxed text-base"
                                                style={{ fontFamily: 'inherit', overflow: 'hidden' }}
                                            />

                                            {/* Tailor this post button — shows when platform has no content but others do */}
                                            {activePlatform && !content.trim() && anyPlatformHasContent() && (
                                                <button
                                                    onClick={() => handleTailorForPlatform(activePlatform)}
                                                    disabled={isAiTyping}
                                                    className="mb-3 w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-semibold rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                                                >
                                                    <Sparkles size={16} />
                                                    {isAiTyping ? 'Generating...' : `✨ Tailor this post for ${activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1)}`}
                                                </button>
                                            )}

                                            {/* Character count - right below textarea */}
                                            <p className="text-xs text-gray-500 mb-3 text-right">{content.length}/3000</p>

                                            {/* Image Preview */}
                                            {uploadedImage && (
                                                <div className="relative rounded-lg overflow-hidden mb-3">
                                                    <img
                                                        src={uploadedImage}
                                                        alt="Preview"
                                                        className={`w-full object-contain max-h-80 ${loading ? 'opacity-50' : ''}`}
                                                    />
                                                    {/* Loading overlay for regeneration */}
                                                    {loading && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        </div>
                                                    )}
                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={removeImage}
                                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
                                                        title="Remove image"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                    {/* Regenerate/Generate AI Button - shown for all images */}
                                                    {!loading && (
                                                        <button
                                                            onClick={generateAIImage}
                                                            disabled={regenCooldown > 0 || !content.trim()}
                                                            className={`absolute top-2 right-12 p-1.5 rounded-full text-white shadow-lg transition-colors ${regenCooldown > 0 || !content.trim()
                                                                ? 'bg-gray-400 cursor-not-allowed'
                                                                : 'bg-purple-500 hover:bg-purple-600'
                                                                }`}
                                                            title={
                                                                !content.trim()
                                                                    ? "Add content first"
                                                                    : regenCooldown > 0
                                                                        ? `Wait ${regenCooldown}s`
                                                                        : uploadedImage?.startsWith('blob:')
                                                                            ? "Regenerate AI image"
                                                                            : "Replace with AI image"
                                                            }
                                                        >
                                                            {regenCooldown > 0 ? (
                                                                <span className="text-xs font-bold px-0.5">{regenCooldown}</span>
                                                            ) : uploadedImage?.startsWith('blob:') ? (
                                                                <RefreshCw size={16} />
                                                            ) : (
                                                                <Sparkles size={16} />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Image Buttons - Upload or Generate AI */}
                                            {!uploadedImage && (
                                                <div className="flex gap-3">
                                                    {/* Upload Image Button */}
                                                    <button
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="flex-1 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <Upload size={18} />
                                                        Upload Image
                                                    </button>
                                                    {/* Generate AI Image Button */}
                                                    <button
                                                        onClick={generateAIImage}
                                                        disabled={loading || regenCooldown > 0 || !content.trim()}
                                                        className={`flex-1 py-3 border-2 border-dashed rounded-lg transition-colors flex items-center justify-center gap-2 ${loading || regenCooldown > 0 || !content.trim()
                                                            ? 'border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                                                            : 'border-purple-300 dark:border-purple-600 text-purple-500 hover:border-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                                                            }`}
                                                        title={!content.trim() ? "Add content first" : regenCooldown > 0 ? `Wait ${regenCooldown}s` : "Generate AI image from your content"}
                                                    >
                                                        {loading ? (
                                                            <RefreshCw size={18} className="animate-spin" />
                                                        ) : (
                                                            <Sparkles size={18} />
                                                        )}
                                                        {loading ? 'Generating...' : regenCooldown > 0 ? `Wait ${regenCooldown}s` : 'Generate AI Image'}
                                                    </button>
                                                </div>
                                            )}
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/jpeg,image/png,image/gif"
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                        </div>
                                    </div>


                                </div >
                            </div >


                            {/* Sticky Footer: Schedule Section */}
                            < div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" >
                                {
                                    showScheduler ? (
                                        <div className="flex items-center gap-3 flex-wrap" >
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Schedule for:</span>
                                            <input
                                                type="date"
                                                value={scheduleDate}
                                                onChange={(e) => setScheduleDate(e.target.value)}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                            />
                                            <input
                                                type="time"
                                                value={scheduleTime}
                                                onChange={(e) => setScheduleTime(e.target.value)}
                                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                            />
                                            <button
                                                onClick={handleSchedule}
                                                disabled={loading || !content.trim() || selectedPlatforms.length === 0 || !scheduleDate || !scheduleTime}
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                                            >
                                                {loading ? <Clock className="animate-spin" size={16} /> : <Clock size={16} />}
                                                Schedule
                                            </button>
                                            <button
                                                onClick={() => setShowScheduler(false)}
                                                className="p-2 text-gray-500 hover:text-gray-700"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <button
                                                onClick={() => setShowScheduler(true)}
                                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                                            >
                                                <Clock size={16} />
                                                Schedule
                                            </button>

                                            {/* Save Draft Icon */}
                                            <button
                                                onClick={saveDraft}
                                                disabled={!hasUnsavedContent()}
                                                title="Save Draft"
                                                className={`p-2 rounded-lg border transition-all ${hasUnsavedContent()
                                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-green-400 hover:text-green-600'
                                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-50'
                                                    }`}
                                            >
                                                <Save size={18} />
                                            </button>
                                        </div>
                                    )}
                            </div >
                        </div >

                        {/* Right: AI Chat Panel (inline, not overlay) */}
                        {
                            showAiChat && (
                                <div className="w-1/2 flex flex-col border-l border-gray-200 dark:border-gray-700">
                                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                            <MessageSquare className="h-5 w-5 text-purple-500" /> AI Assistant
                                        </h2>
                                        <button
                                            onClick={() => setShowAiChat(false)}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                        >
                                            <X size={20} className="text-gray-500" />
                                        </button>
                                    </div>
                                    <p className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                        Ask me to write, refine, or improve your post
                                    </p>

                                    {/* Chat Messages */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {chatMessages.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${msg.role === 'user'
                                                    ? 'bg-blue-600 text-white rounded-br-sm'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
                                                    }`}>
                                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                                                    {/* Interactive platform selection (Compose with AI flow) */}
                                                    {msg.type === 'platform_select' && msg.connectedPlatforms && (
                                                        <div className="mt-3 pt-3 border-t border-gray-300/50 dark:border-gray-600/50">
                                                            <div className="space-y-2 mb-3">
                                                                {msg.connectedPlatforms.map(pId => {
                                                                    const platform = PLATFORMS.find(p => p.id === pId);
                                                                    if (!platform) return null;
                                                                    const isChecked = pendingPlatformSelection.includes(pId);
                                                                    return (
                                                                        <label
                                                                            key={pId}
                                                                            className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${isChecked
                                                                                ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400'
                                                                                : 'hover:bg-gray-200/50 dark:hover:bg-gray-600/50'
                                                                                }`}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isChecked}
                                                                                onChange={() => {
                                                                                    setPendingPlatformSelection(prev =>
                                                                                        prev.includes(pId)
                                                                                            ? prev.filter(x => x !== pId)
                                                                                            : [...prev, pId]
                                                                                    );
                                                                                }}
                                                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                            />
                                                                            <platform.icon size={18} className={platform.color.replace('bg-', 'text-')} />
                                                                            <span className="text-sm font-medium">{platform.name}</span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                            {pendingPlatformSelection.length > 0 && (
                                                                <button
                                                                    onClick={() => handleComposeFromTrending(pendingPlatformSelection)}
                                                                    disabled={isAiTyping}
                                                                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                                                                >
                                                                    <Sparkles size={16} />
                                                                    Continue →
                                                                </button>
                                                            )}
                                                            {pendingPlatformSelection.length === 0 && (
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Select at least one platform to continue</p>
                                                            )}
                                                        </div>
                                                    )}

                                                    {msg.suggestedContent && (
                                                        <div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-80">
                                                            ✅ Applied to preview
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {isAiTyping && (
                                            <div className="flex justify-start">
                                                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-sm">
                                                    <div className="flex space-x-1">
                                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex gap-2 flex-wrap">
                                            <button
                                                onClick={() => setChatInput('Write a professional LinkedIn post about ')}
                                                className="text-xs px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50"
                                            >
                                                ✍️ Write about...
                                            </button>
                                            <button
                                                onClick={() => setChatInput('Make my post more engaging and add emojis')}
                                                className="text-xs px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50"
                                            >
                                                ✨ Engaging
                                            </button>
                                            <button
                                                onClick={() => setChatInput('Shorten my post')}
                                                className="text-xs px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50"
                                            >
                                                📏 Shorten
                                            </button>
                                        </div>
                                    </div>

                                    {/* Chat Input */}
                                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                                                placeholder="Ask AI for help..."
                                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            />
                                            <button
                                                onClick={handleSendChat}
                                                disabled={isAiTyping || !chatInput.trim()}
                                                className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <Send size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    </div >
                )}

                {/* Floating AI Toggle Button - Always show when AI chat is closed */}
                {
                    !showAiChat && (
                        <button
                            onClick={() => setShowAiChat(true)}
                            className="fixed bottom-20 right-6 p-4 rounded-full shadow-2xl transition-all z-50 bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:scale-110"
                            title="Open AI Assistant"
                        >
                            <MessageSquare size={24} />
                        </button>
                    )
                }
            </div >
        </div >
    );
};


// --- Main Application Component ---
const App = () => {
    const { db, userId, user, isAuthReady, handleLogout } = useFirebase();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [scheduledPosts, setScheduledPosts] = useState([]);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    // Default view is 'dashboard' - but now conditional on onboarding state
    const [view, setView] = useState('dashboard');
    const [isTargetingIntegrations, setIsTargetingIntegrations] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Composer unsaved content tracking
    const [composerHasUnsavedContent, setComposerHasUnsavedContent] = useState(false);
    const [showComposerSavePopup, setShowComposerSavePopup] = useState(false);
    const [pendingNavPath, setPendingNavPath] = useState(null);
    const [showNoPlatformPopup, setShowNoPlatformPopup] = useState(false);
    const composerSaveDraftRef = useRef(null); // Ref to call saveDraft from ComposerContent

    // --- NEW ONBOARDING STATE ---
    const [interestsCompleted, setInterestsCompleted] = useState(null); // null, true, or false
    const [userTypeCompleted, setUserTypeCompleted] = useState(null); // null = loading, true = done, false = needs selection

    // --- BILLING STATE ---
    const [userPlan, setUserPlan] = useState('basic'); // default to basic
    const [monthlyPostCount, setMonthlyPostCount] = useState(0);
    const [scheduledPostsCount, setScheduledPostsCount] = useState(0);

    useEffect(() => {
        if (!db || !userId) return;

        // Fetch user plan and usage from Firestore
        const usageDocRef = doc(db, `users/${userId}/preferences/usage`);
        const unsubUsage = onSnapshot(usageDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMonthlyPostCount(data.monthlyPostCount || 0);
                setScheduledPostsCount(data.scheduledPostsCount || 0);
                // Plan could be stored here or in the main user doc. Assuming default 'basic' for now.
                // If plan is stored in user doc, we'd fetch it there.
            } else {
                // Initialize usage doc if not exists
                setDoc(usageDocRef, { monthlyPostCount: 0, scheduledPostsCount: 0 }, { merge: true });
            }
        });

        return () => unsubUsage();
    }, [db, userId]);

    const updateUserUsage = useCallback((type) => {
        if (!db || !userId) return;
        const usageDocRef = doc(db, `users/${userId}/preferences/usage`);
        // const { increment } = require('firebase/firestore'); // Removed require

        if (type === 'post') {
            setDoc(usageDocRef, { monthlyPostCount: increment(1) }, { merge: true });
        } else if (type === 'schedule') {
            setDoc(usageDocRef, { scheduledPostsCount: increment(1) }, { merge: true });
        }
    }, [db, userId]);

    // --- TRENDING TOPICS STATE ---
    const [trendingTopics, setTrendingTopics] = useState([]);
    const [loadingTrending, setLoadingTrending] = useState(false);
    const [trendingError, setTrendingError] = useState(null);
    const [trendingFetched, setTrendingFetched] = useState(false); // Prevents infinite loop

    // Fetch trending topics from backend
    const loadTrendingTopics = useCallback(async (forceRefresh = false) => {
        if (!user || user.isAnonymous) return;

        setLoadingTrending(true);
        setTrendingError(null);

        try {
            const result = await fetchTrendingTopicsFast(forceRefresh);

            if (result.success) {
                setTrendingTopics(result.topics);
                console.log(`✅ Loaded ${result.topics.length} trending topics (cached: ${result.cached})`);
            } else {
                setTrendingError(result.error || 'Failed to load trending topics');
                console.error('❌ Trending error:', result.error);
            }
        } catch (error) {
            setTrendingError(error.message);
            console.error('❌ Trending exception:', error);
        } finally {
            setLoadingTrending(false);
            setTrendingFetched(true); // Mark as attempted
        }
    }, [user]);

    // Auto-fetch trending topics when view changes to dashboard or on initial load
    // Only fetch ONCE - don't retry if it returned 0 topics
    useEffect(() => {
        if (view === 'dashboard' && user && !user.isAnonymous && !trendingFetched && !loadingTrending) {
            loadTrendingTopics();
        }
    }, [view, user, trendingFetched, loadingTrending, loadTrendingTopics]);

    // Update a topic's image in the trending topics list (for regenerate functionality)
    const handleUpdateTopicImage = useCallback((topicId, newImageUrl) => {
        setTrendingTopics(prevTopics =>
            prevTopics.map(topic =>
                topic.id === topicId
                    ? { ...topic, imageUrl: newImageUrl }
                    : topic
            )
        );
        // Also update the modalTopic if it's the same topic
        setModalTopic(prev =>
            prev && prev.id === topicId
                ? { ...prev, imageUrl: newImageUrl }
                : prev
        );
    }, []);

    const [platformConnections, setPlatformConnections] = useState({
        'facebook': false,
        'instagram': false,
        'twitter': false,
        'linkedin': false,
        'whatsapp': false,
        'onedrive': false
    });


    // New state for full-screen integration view
    const [fullIntegration, setFullIntegration] = useState(null); // 'facebook' | 'twitter' | null

    // New state for Trending Content Modal
    const [isTrendingModalOpen, setIsTrendingModalOpen] = useState(false);
    const [modalTopic, setModalTopic] = useState(null);
    const [modalPlatformId, setModalPlatformId] = useState(null); // Keep for legacy compat if needed

    // Pending draft state (for passing data to composer)
    const [pendingDraft, setPendingDraft] = useState(null);

    // Toast notification state
    const [toasts, setToasts] = useState([]);

    // Highlighted date for calendar navigation (from scheduled posts panel)
    const [highlightedDate, setHighlightedDate] = useState(null);

    // Add toast function
    const addToast = useCallback((message, type = 'success', duration = 4000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        // Auto-remove after duration
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    // Remove toast function
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Notifications state
    const [notifications, setNotifications] = useState([]);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

    // Profile dropdown state
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

    // Toggle profile dropdown
    const toggleProfileDropdown = useCallback(() => {
        setIsProfileDropdownOpen(prev => !prev);
        // Close notification panel when opening profile dropdown
        if (!isProfileDropdownOpen) {
            setIsNotificationPanelOpen(false);
        }
    }, [isProfileDropdownOpen]);

    // Add notification function
    const addNotification = useCallback((message, type = 'info') => {
        const id = Date.now();
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setNotifications(prev => [{ id, message, type, time, read: false }, ...prev]);
    }, []);

    // Clear notification function
    const clearNotification = useCallback((id) => {
        if (id === 'all') {
            setNotifications([]);
        } else {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }
    }, []);

    // Toggle notification panel
    const toggleNotificationPanel = useCallback(() => {
        setIsNotificationPanelOpen(prev => {
            if (!prev) {
                // Mark all as read when opening
                setNotifications(n => n.map(notif => ({ ...notif, read: true })));
            }
            return !prev;
        });
    }, []);

    // --- ONBOARDING LOGIC ---
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
    const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);

    useEffect(() => {
        if (!user || !db || !userId) return;

        // Don't check again if we've already determined the status for this session/user match
        // But we need to listen for real-time updates in case they update settings elsewhere

        // Using top-level imports for doc and onSnapshot

        const unsub = onSnapshot(doc(db, 'users', userId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Check if critical fields are missing
                const isProfileComplete =
                    data.username &&
                    data.gender &&
                    data.dateOfBirth;

                // Also check a specific flag if we want to be explicit
                // But user asked for "if fields are there" logic implied.

                if (!isProfileComplete && !data.onboardingCompleted) {
                    setIsOnboardingOpen(true);
                } else {
                    setIsOnboardingOpen(false);
                }
            } else {
                // User doc doesn't exist yet - trigger onboarding
                setIsOnboardingOpen(true);
            }
            setHasCheckedOnboarding(true);
        });

        return () => unsub();
    }, [user, db, userId]);
    // --- END ONBOARDING LOGIC ---


    // Delete from platform state and handler
    const [deleting, setDeleting] = useState(false);

    // Delete a single platform from a multi-platform scheduled post
    const handleDeleteSinglePlatform = useCallback(async (post, platformId) => {
        setDeleting(true);
        if (!db || !userId) return;

        try {
            const { deleteDoc, updateDoc, deleteField, doc } = await import('firebase/firestore');

            // 1. Remote Delete (if applicable/posted)
            if (post.status === 'posted') {
                const remoteId = post.platformPostIds?.[platformId];
                if (remoteId && platformId === 'linkedin') {
                    try {
                        const socialApi = await import('./api/social.js');
                        if (socialApi.deleteFromLinkedIn) {
                            await socialApi.deleteFromLinkedIn(remoteId);
                            addToast('Deleted from LinkedIn remote', 'success');
                        }
                    } catch (e) {
                        console.warn('Remote delete failed', e);
                    }
                }
            }

            // 2. Firestore Update
            // Check if this is the last platform
            const currentPlatforms = post.platforms || [];
            const remainingPlatforms = currentPlatforms.filter(p => p !== platformId);

            if (remainingPlatforms.length === 0) {
                // Delete entire doc
                await deleteDoc(doc(db, `users/${userId}/scheduled_posts/${post.id}`));
                addToast('Post deleted completely', 'success');
            } else {
                // Update doc to remove platform data
                const postRef = doc(db, `users/${userId}/scheduled_posts/${post.id}`);
                const updates = {
                    platforms: remainingPlatforms
                };
                // Remove platform specific fields
                if (post.platformDrafts?.[platformId]) updates[`platformDrafts.${platformId}`] = deleteField();
                if (post.platformTones?.[platformId]) updates[`platformTones.${platformId}`] = deleteField();
                if (post.platformPostIds?.[platformId]) updates[`platformPostIds.${platformId}`] = deleteField();

                await updateDoc(postRef, updates);
                const pName = PLATFORMS.find(p => p.id === platformId)?.name || platformId;
                addToast(`Removed from ${pName}`, 'success');
            }
        } catch (error) {
            console.error('Delete error:', error);
            addToast(`Failed to delete: ${error.message}`, 'error');
        } finally {
            setDeleting(false);
        }
    }, [db, userId, addToast]);

    const handleDeleteFromPlatform = useCallback(async (post) => {
        setDeleting(true);
        try {
            const hasLinkedInId = post.platformPostIds?.linkedin;

            // If post has LinkedIn ID, try to delete from LinkedIn first
            if (hasLinkedInId) {
                try {
                    const socialApi = await import('./api/social.js');
                    if (socialApi.deleteFromLinkedIn && typeof socialApi.deleteFromLinkedIn === 'function') {
                        await socialApi.deleteFromLinkedIn(post.platformPostIds.linkedin);
                        console.log('✅ Successfully deleted from LinkedIn');
                    } else {
                        console.warn('⚠️ deleteFromLinkedIn API not implemented/exported, skipping remote delete.');
                        // Optional: Inform user that remote delete didn't happen
                        // addToast('Skipped LinkedIn delete (feature pending), removing from calendar.', 'info');
                    }
                } catch (linkedInError) {
                    console.warn('⚠️ Could not delete from LinkedIn:', linkedInError.message);
                    // Continue to delete from Firestore even if LinkedIn delete fails
                }
            }

            // Always delete from Firestore (remove from calendar)
            // Using top-level imports for reliability
            await deleteDoc(doc(db, `users/${userId}/scheduled_posts/${post.id}`));

            if (hasLinkedInId) {
                addToast('Post deleted from LinkedIn and calendar', 'success');
                addNotification('Post deleted from LinkedIn', 'success');
            } else {
                addToast('Post removed from calendar', 'success');
                addNotification('Post removed from calendar (no LinkedIn ID - was posted before feature was added)', 'info');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            // Fallback alert in case Toast fails or isn't seen
            alert(`Failed to delete: ${error.message}`);
            addToast(`Failed to delete: ${error.message}`, 'error');
        } finally {
            setDeleting(false);
        }
    }, [db, userId, addToast, addNotification]);

    // Navigate to calendar and highlight a specific date (from scheduled posts panel)
    const handleNavigateToCalendar = useCallback((date) => {
        setView('dashboard');
        setHighlightedDate(date);
        setTimeout(() => {
            setHighlightedDate(null);
        }, 3000);
    }, []);

    // Delete a single scheduled post from Firestore
    const handleDeleteScheduledPost = useCallback(async (postId) => {
        if (!db || !userId) return;
        try {
            const { deleteDoc, doc } = await import('firebase/firestore');
            await deleteDoc(doc(db, `users/${userId}/scheduled_posts/${postId}`));
            addToast('Scheduled post cancelled', 'success');
        } catch (err) {
            console.error('Failed to delete scheduled post:', err);
            addToast('Failed to cancel post', 'error');
        }
    }, [db, userId, addToast]);

    // Cancel all pending scheduled posts
    const handleCancelAllScheduledPosts = useCallback(async () => {
        if (!db || !userId) return;
        try {
            const { deleteDoc, doc, collection, query, where, getDocs } = await import('firebase/firestore');
            const postsRef = collection(db, `users/${userId}/scheduled_posts`);
            const q = query(postsRef, where('status', '==', 'pending'));
            const snapshot = await getDocs(q);

            const deletePromises = snapshot.docs.map(docSnap =>
                deleteDoc(doc(db, `users/${userId}/scheduled_posts/${docSnap.id}`))
            );
            await Promise.all(deletePromises);
            addToast(`Cancelled ${snapshot.size} scheduled posts`, 'success');
        } catch (err) {
            console.error('Failed to cancel all posts:', err);
            addToast('Failed to cancel all posts', 'error');
        }
    }, [db, userId, addToast]);

    // Refs for scrolling
    const mainContentRef = useRef(null);
    const integrationsRef = useRef(null);


    // Toggle function for sidebar
    const toggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    // Callback to handle completion from the full-screen view (Authorization successful)
    const handleIntegrationComplete = useCallback((platformId, status) => {
        // REQUIRED: Update centralized state upon success
        setPlatformConnections(prev => ({
            ...prev,
            [platformId]: status // status is true on successful completion
        }));
        setFullIntegration(null);
        setView('integrations_page');
    }, []);

    // Callback to handle back click from the full-screen view
    const handleIntegrationBack = useCallback((platformId) => {
        setFullIntegration(null);
        setView('integrations_page');
    }, []);

    // Browser back button support - listen for popstate events
    useEffect(() => {
        const handlePopState = (event) => {
            const targetView = (event.state && event.state.view) ? event.state.view : 'dashboard';

            // Check if we're leaving composer with unsaved content
            if (view === 'composer' && targetView !== 'composer' && composerHasUnsavedContent) {
                // Prevent the back navigation and show popup
                window.history.pushState({ view: 'composer' }, '', '#composer');
                setPendingNavPath(targetView);
                setShowComposerSavePopup(true);
                return;
            }

            setView(targetView);
        };

        window.addEventListener('popstate', handlePopState);

        // Ensure URLs always match the current view (force Dashboard on reload regardless of hash)
        window.history.replaceState({ view }, '', `#${view}`);

        return () => window.removeEventListener('popstate', handlePopState);
    }, [view, composerHasUnsavedContent]);

    // OAuth Callback Message Listener - handles messages from oauth-callback.html popup
    useEffect(() => {
        const handleOAuthMessage = (event) => {
            // Verify origin for security
            if (event.origin !== window.location.origin) return;

            const { type, status, platform, message } = event.data || {};

            if (type === 'OAUTH_CALLBACK') {
                console.log(`🔔 [APP] OAuth callback received for ${platform}: ${status}`);

                // Clear the spinner on the Connect button
                if (window.__clearConnectingPlatform) {
                    window.__clearConnectingPlatform();
                }

                const platformName = PLATFORMS.find(p => p.id === platform)?.name || platform;

                if (status === 'success' && platform) {
                    // Update platform connection state
                    setPlatformConnections(prev => ({
                        ...prev,
                        [platform]: true
                    }));

                    // Show success toast
                    addToast(`${platformName} connected successfully!`, 'success');

                    // If we're in full integration view (WhatsApp), complete it
                    if (fullIntegration === platform) {
                        setFullIntegration(null);
                        setView('integrations_page');
                    }

                    console.log(`✅ [APP] ${platform} connected successfully!`);
                } else if (status === 'error') {
                    const errorDetail = message || 'Unknown error';
                    addToast(`Failed to connect ${platformName}: ${errorDetail}`, 'error');
                    console.error(`❌ [APP] OAuth failed for ${platform}: ${errorDetail}`);
                }
            }
        };

        window.addEventListener('message', handleOAuthMessage);
        return () => window.removeEventListener('message', handleOAuthMessage);
    }, [fullIntegration, addToast]);

    // Fetch platform connection statuses from backend on app load
    useEffect(() => {
        const fetchPlatformStatuses = async () => {
            try {
                console.log('📡 [APP] Fetching platform connection statuses...');
                const statuses = await getAllIntegrationsStatus();
                console.log('📥 [APP] Received statuses:', statuses);

                setPlatformConnections({
                    linkedin: statuses.linkedin?.connected || false,
                    facebook: statuses.facebook?.connected || false,
                    twitter: statuses.twitter?.connected || false,
                    instagram: statuses.instagram?.connected || false,
                    whatsapp: statuses.whatsapp?.connected || false,
                    onedrive: false, // Not implemented in backend
                });
            } catch (error) {
                console.error('❌ [APP] Error fetching platform statuses:', error);
            }
        };

        if (isAuthReady && userId) {
            fetchPlatformStatuses();
        }
    }, [isAuthReady, userId]);

    // Trending Content Handlers
    const openTrendingModal = useCallback((topic) => {
        setModalTopic(topic);
        setIsTrendingModalOpen(true);
    }, []);

    const closeTrendingModal = useCallback(() => {
        setIsTrendingModalOpen(false);
        setModalTopic(null);
    }, []);

    // Handler to start a draft from a trending topic — opens Composer with AI chat
    const handleDraftTrendingPost = useCallback((topic) => {
        // Guard: check if at least one platform is connected
        const connectedPlatforms = Object.keys(platformConnections || {}).filter(k => platformConnections[k]);
        if (connectedPlatforms.length === 0) {
            setShowNoPlatformPopup(true);
            return;
        }

        setPendingDraft({
            mode: 'composeWithAI',
            topicTitle: topic.title,
            topicSummary: topic.summary,
            topicCategory: topic.category,
            sourceUrl: topic.sourceUrl,
            imageUrl: topic.imageUrl
        });

        setIsTrendingModalOpen(false);
        setView('composer');
        addToast(`✨ Opening AI Composer for: ${topic.title?.slice(0, 50)}...`, 'success');
    }, [addToast, platformConnections]);

    // Handler for Trending Auth Modal completion (updates centralized state)
    const handleTrendingConnect = useCallback((platformId, status) => {
        setPlatformConnections(prev => ({
            ...prev,
            [platformId]: status // status is true on successful connection
        }));
    }, []);


    // Scroll and Navigation handler
    const handleNavClick = useCallback((path) => {
        // Check if we're leaving composer with unsaved content
        if (view === 'composer' && path !== 'composer' && composerHasUnsavedContent) {
            setPendingNavPath(path);
            setShowComposerSavePopup(true);
            return; // Don't navigate yet
        }

        // All navigation goes to setView now (including composer which is now full-page)
        setView(path);

        // Push to browser history so back button works
        window.history.pushState({ view: path }, '', `#${path}`);

        if (path === 'dashboard' && mainContentRef.current) {
            // Scroll to top when navigating to dashboard view
            mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [view, composerHasUnsavedContent]);

    // Handle save and navigate from popup
    const handleSaveAndNavigate = useCallback(async () => {
        if (composerSaveDraftRef.current) {
            await composerSaveDraftRef.current();
        }
        setShowComposerSavePopup(false);
        setComposerHasUnsavedContent(false);
        if (pendingNavPath) {
            setView(pendingNavPath);
            window.history.pushState({ view: pendingNavPath }, '', `#${pendingNavPath}`);
            setPendingNavPath(null);
        }
    }, [pendingNavPath]);

    // Handle discard and navigate from popup
    const handleDiscardAndNavigate = useCallback(() => {
        setShowComposerSavePopup(false);
        setComposerHasUnsavedContent(false);
        if (pendingNavPath) {
            setView(pendingNavPath);
            window.history.pushState({ view: pendingNavPath }, '', `#${pendingNavPath}`);
            setPendingNavPath(null);
        }
    }, [pendingNavPath]);


    // 1. Load Theme and Onboarding Preferences from Firestore
    useEffect(() => {
        if (db && userId) {
            const themeRef = doc(db, `users/${userId}/preferences/theme`);
            const onboardingRef = doc(db, `users/${userId}/preferences/onboarding`);

            // Theme Listener
            const unsubscribeTheme = onSnapshot(themeRef, (docSnap) => {
                if (docSnap.exists() && typeof docSnap.data().isDarkMode === 'boolean') {
                    setIsDarkMode(docSnap.data().isDarkMode);
                } else {
                    // Default to system preference if no data in Firestore
                    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    setIsDarkMode(prefersDark);
                }
            }, (error) => {
                console.error("Error listening to theme preference:", error);
            });

            // Onboarding Listener
            const unsubscribeOnboarding = onSnapshot(onboardingRef, (docSnap) => {
                // If document exists and flag is set to true, skip interests
                if (docSnap.exists() && docSnap.data().interestsCompleted === true) {
                    setInterestsCompleted(true);
                } else {
                    // Otherwise, require interest selection
                    setInterestsCompleted(false);
                }
            }, (error) => {
                console.error("Error listening to onboarding preference:", error);
                // Fallback to requiring selection if Firestore fails
                setInterestsCompleted(false);
            });

            // User Type / Account Type Listener
            const accountTypeRef = doc(db, `users/${userId}/profile/accountType`);
            const unsubscribeAccountType = onSnapshot(accountTypeRef, (docSnap) => {
                if (docSnap.exists() && docSnap.data().userType) {
                    setUserTypeCompleted(true);
                    console.log('✅ User type loaded:', docSnap.data().userType);
                } else {
                    setUserTypeCompleted(false);
                }
            }, (error) => {
                console.error('Error listening to account type:', error);
                setUserTypeCompleted(false);
            });


            return () => {
                unsubscribeTheme();
                unsubscribeOnboarding();
                unsubscribeAccountType();
            };
        }
    }, [db, userId]);


    // 2. Load Scheduled Posts from Firestore
    useEffect(() => {
        if (db && userId) {
            const path = `users/${userId}/scheduled_posts`;
            const postsCollectionRef = collection(db, path);
            const q = query(postsCollectionRef, orderBy('scheduledTime', 'desc'));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const posts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    scheduledTime: doc.data().scheduledTime || { seconds: Date.now() / 1000 }
                }));
                setScheduledPosts(posts);
            }, (error) => {
                console.error("Error loading scheduled posts:", error);
            });

            return () => unsubscribe();
        }
    }, [db, userId]);

    // 3. Theme Toggle Function (updates state and Firestore)
    const toggleTheme = useCallback(() => {
        setIsDarkMode(prev => {
            const newMode = !prev;
            if (db && userId) {
                saveThemePreference(db, userId, newMode);
            }
            return newMode;
        });
    }, [db, userId]);

    // Apply dark class to the HTML element for Tailwind dark mode
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // Apply dark/light class to body/main container
    const containerClasses = `flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`;

    // Helper function to render content based on view state
    const renderContent = () => {
        // Priority 1: Loading state - show in main content area
        if (!isAuthReady) {
            return (
                <div className="flex flex-1 items-center justify-center">
                    <div className="text-xl font-semibold animate-pulse text-blue-600 dark:text-blue-400">
                        Initializing SocialConnectIQ...
                    </div>
                </div>
            );
        }

        // Priority 2: Interest Onboarding - SKIPPED (now managed in Settings)
        // Users go directly to dashboard after login

        // Priority 3: Full Screen Integration
        // Only show FullIntegrationView for WhatsApp (OTP flow)
        // Other platforms use direct popup OAuth from the Integrations page
        if (fullIntegration === 'whatsapp') {
            return <FullIntegrationView
                platformId={fullIntegration}
                onBack={handleIntegrationBack}
                onComplete={handleIntegrationComplete}
            />;
        }

        // Priority 4: Main Application Views
        switch (view) {
            case 'dashboard':
                return <DashboardContent
                    scheduledPosts={scheduledPosts}
                    integrationsRef={integrationsRef}
                    isTargetingIntegrations={isTargetingIntegrations}
                    openTrendingModal={openTrendingModal}
                    platformConnections={platformConnections}
                    handleNavClick={handleNavClick}
                    hasInterests={interestsCompleted === true}
                    db={db}
                    userId={userId}
                    onDeleteFromPlatform={handleDeleteFromPlatform}
                    deleting={deleting}
                    onNavigateToCalendar={handleNavigateToCalendar}
                    highlightedDate={highlightedDate}
                    onDeleteScheduledPost={handleDeleteScheduledPost}
                    onCancelAllScheduledPosts={handleCancelAllScheduledPosts}
                    trendingTopics={trendingTopics}
                    loadingTrending={loadingTrending}
                    trendingError={trendingError}
                    onRefreshTrending={() => loadTrendingTopics(true)}
                    userPlan={userPlan}
                />;
            case 'analytics':
                return <AnalyticsPage />;
            case 'integrations_page':
                return <IntegrationsPageContent
                    setFullIntegration={setFullIntegration}
                    platformConnections={platformConnections}
                    setPlatformConnections={setPlatformConnections}
                    addToast={addToast}
                />;
            case 'trending_panel':
                return <TrendingSidebarContent
                    openTrendingModal={openTrendingModal}
                    onManageInterests={() => handleNavClick('settings')}
                    trendingTopics={trendingTopics}
                    loadingTrending={loadingTrending}
                    trendingError={trendingError}
                    onRefreshTrending={() => loadTrendingTopics(true)}
                    hasInterests={interestsCompleted === true}
                />;
            case 'settings':
                return <SettingsContent db={db} userId={userId} user={user} />;
            case 'billing':
                return <Billing userPlan={userPlan} monthlyPostCount={monthlyPostCount} scheduledPostsCount={scheduledPostsCount} />;
            case 'composer':
                return <ComposerContent
                    db={db}
                    userId={userId}
                    platformConnections={platformConnections}
                    addToast={addToast}
                    addNotification={addNotification}
                    onUnsavedContentChange={setComposerHasUnsavedContent}
                    saveDraftRef={composerSaveDraftRef}
                    initialData={pendingDraft}
                    onClearInitialData={() => setPendingDraft(null)}
                    userPlan={userPlan}
                    monthlyPostCount={monthlyPostCount}
                    scheduledPostsCount={scheduledPostsCount}
                    updateUserUsage={updateUserUsage}
                />;
            default:
                // Defaulting to DashboardContent
                return <DashboardContent
                    scheduledPosts={scheduledPosts}
                    integrationsRef={integrationsRef}
                    isTargetingIntegrations={isTargetingIntegrations}
                    openTrendingModal={openTrendingModal}
                    platformConnections={platformConnections}
                    handleNavClick={handleNavClick}
                    hasInterests={interestsCompleted === true}
                    db={db}
                    userId={userId}
                    onDeleteFromPlatform={handleDeleteFromPlatform}
                    onDeleteSinglePlatform={handleDeleteSinglePlatform}
                    deleting={deleting}
                    onNavigateToCalendar={handleNavigateToCalendar}
                    highlightedDate={highlightedDate}
                    onDeleteScheduledPost={handleDeleteScheduledPost}
                    onCancelAllScheduledPosts={handleCancelAllScheduledPosts}
                />;
        }
    };

    return (
        <>
            {/* Toast Notifications */}
            <ToastNotification toasts={toasts} removeToast={removeToast} />

            {/* Show Landing Page for unauthenticated/anonymous users */}
            {(!user || user.isAnonymous) && isAuthReady && (
                <LandingPage
                    onGetStarted={() => setIsLoginModalOpen(true)}
                    onSignIn={async () => {
                        // Check if there's a saved provider for returning users
                        const lastProvider = getLastProvider();
                        if (lastProvider) {
                            try {
                                await autoSignInWithLastProvider();
                                // Success - user will be redirected by auth state change
                            } catch (error) {
                                console.error('Auto sign-in failed:', error);
                                // Fall back to showing modal
                                setIsLoginModalOpen(true);
                            }
                        } else {
                            // No saved provider - show modal for new users
                            setIsLoginModalOpen(true);
                        }
                    }}
                    isDarkMode={isDarkMode}
                    toggleTheme={toggleTheme}
                />
            )}

            {/* Show User Type Onboarding for authenticated users who haven't selected their type */}
            {user && !user.isAnonymous && userTypeCompleted === false && (
                <UserTypeOnboarding
                    db={db}
                    userId={userId}
                    isDarkMode={isDarkMode}
                    onComplete={(type) => {
                        console.log(`✅ User type selected: ${type}`);
                        setUserTypeCompleted(true);
                    }}
                />
            )}

            {/* Show main app content only for authenticated (non-anonymous) users who completed user type */}
            {user && !user.isAnonymous && userTypeCompleted !== false && (
                <div className={containerClasses}>
                    <Sidebar
                        isDarkMode={isDarkMode}
                        handleNavClick={handleNavClick}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        view={view}
                        user={user}
                        userPlan={userPlan}
                    />
                    <main ref={mainContentRef} className="flex-1 flex flex-col overflow-y-auto">
                        <TopBar
                            toggleTheme={toggleTheme}
                            isDarkMode={isDarkMode}
                            user={user}
                            openComposer={() => handleNavClick('composer')}
                            openLoginModal={() => setIsLoginModalOpen(true)}
                            handleLogout={handleLogout}
                            notifications={notifications}
                            onClearNotification={clearNotification}
                            isNotificationPanelOpen={isNotificationPanelOpen}
                            toggleNotificationPanel={toggleNotificationPanel}
                            isProfileDropdownOpen={isProfileDropdownOpen}
                            toggleProfileDropdown={toggleProfileDropdown}
                            onNavigateToProfile={() => handleNavClick('settings')}
                            userPlan={userPlan}
                        />
                        {renderContent()}
                    </main>
                </div>
            )}

            {/* Loading state while checking auth */}
            {!isAuthReady && (
                <div className={`flex items-center justify-center min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-blue-100'}`}>
                    <div className="text-center">
                        <div className="text-3xl font-bold mb-3">
                            <span className="text-blue-600">Social</span><span className={isDarkMode ? 'text-white' : 'text-gray-900'}>ConnectIQ</span>
                        </div>
                        <div className={`text-sm animate-pulse ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Initializing...
                        </div>
                    </div>
                </div>
            )}

            <ComposerModal
                isOpen={isComposerOpen}
                onClose={() => setIsComposerOpen(false)}
                db={db}
                userId={userId}
                addToast={addToast}
                addNotification={addNotification}
            />
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
            />
            <TrendingDetailModal
                isOpen={isTrendingModalOpen}
                onClose={closeTrendingModal}
                topic={modalTopic}
                onDraft={handleDraftTrendingPost}
                onUpdateImage={handleUpdateTopicImage}
            />

            {/* Save Draft Popup Modal - shown when navigating away from composer with unsaved content */}
            {showComposerSavePopup && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className={`rounded-xl shadow-2xl max-w-md w-full p-6 relative ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                        {/* Red X Close Button */}
                        <button
                            onClick={() => { setShowComposerSavePopup(false); setPendingRoute(null); }}
                            className="absolute top-2 right-2 p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer shadow-md z-50"
                            title="Stay here"
                        >
                            <X size={20} strokeWidth={3} />
                        </button>
                        <h3 className={`text-lg font-bold mb-2 pr-10 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Save Draft?</h3>
                        <p className={`mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>You have unsaved content. Would you like to save it as a draft before leaving?</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleDiscardAndNavigate}
                                className={`px-4 py-2 rounded-lg transition-colors ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSaveAndNavigate}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                                Save Draft
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* No Platform Connected Popup */}
            {
                showNoPlatformPopup && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className={`rounded-xl shadow-2xl max-w-md w-full p-6 relative ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            {/* Red X Close Button */}
                            <button
                                onClick={() => setShowNoPlatformPopup(false)}
                                className="absolute top-2 right-2 p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer shadow-md z-50"
                                title="Close"
                            >
                                <X size={20} strokeWidth={3} />
                            </button>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                                    <Zap size={24} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <h3 className={`text-lg font-bold pr-10 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Connect a Platform First</h3>
                            </div>
                            <p className={`mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                You need to connect at least <strong>1 platform</strong> (LinkedIn, Twitter, etc.) before you can compose posts with AI.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => {
                                        setShowNoPlatformPopup(false);
                                        setIsTrendingModalOpen(false);
                                        handleNavClick('integrations_page');
                                    }}
                                    className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2"
                                >
                                    Connect Now →
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Onboarding Modal */}
            <OnboardingModal
                isOpen={isOnboardingOpen}
                userId={userId}
                db={db}
                onComplete={() => setIsOnboardingOpen(false)}
            />

        </>
    );
};

export default App;
