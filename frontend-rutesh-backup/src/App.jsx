import React, { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, setDoc, getDocs, updateDoc, serverTimestamp, getDoc, orderBy, limit, deleteDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from './firebase';
import api from "./api/axios";
import { Sun, Moon, LayoutDashboard, Send, BarChart2, Settings, Zap, Facebook, Instagram, Twitter, Linkedin, Cloud, MessageSquare, LogIn, X, Clock, Image, Upload, Menu, Phone, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight, ThumbsUp, MessageSquare as CommentIcon, Share2, TrendingUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles, User, LogOut, Lock, Calendar, Trash2, CreditCard } from 'lucide-react';
import { ThemeToggle } from './components/ThemeToggle';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import Billing from './components/Billing';
import AdBanner from './components/AdBanner';

// --- GLOBAL FIREBASE VARIABLE SETUP (MANDATORY) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- MOCK DATA AND CONSTANTS ---

const PLATFORMS = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600', hover: 'hover:bg-blue-700', description: 'Schedule posts and track page performance.' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-600', hover: 'hover:bg-pink-700', description: 'Publish Reels, Stories, and carousel posts.' },
    { id: 'twitter', name: 'X', icon: X, color: 'bg-black', hover: 'hover:bg-gray-800', description: 'Monitor engagement and publish posts.' },
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

const MOCK_TRENDING_CONTENT = [
    // --- REAL WORLD NEWS (Technology, Business, Finance, Entertainment) ---
    { id: '1', platformId: 'twitter', title: 'Trump Demands Tech Giants Pay for Power', metrics: { likes: '45K', comments: '12K', shares: '18K' }, imageUrl: 'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?auto=format&fit=crop&q=80&w=300', category: 'Technology', popularityScore: 99, summary: 'President Trump pressures Microsoft and other tech giants to bear the electricity costs for massive AI data centers.' },
    { id: '2', platformId: 'instagram', title: 'Apple & Google Partner on Siri AI', metrics: { likes: '89K', comments: '2.4K', shares: '15K' }, imageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=300', category: 'Technology', popularityScore: 97, summary: 'A massive deal formalizes the integration of Google\'s Gemini AI into iPhone\'s Siri, marking a new era of cooperation.' },
    { id: '3', platformId: 'linkedin', title: 'Fed Chair Jerome Powell Under Probe', metrics: { likes: '22K', comments: 950, shares: '5.2K' }, imageUrl: 'https://images.unsplash.com/photo-1611974765270-ca12586343bb?auto=format&fit=crop&q=80&w=300', category: 'Business', popularityScore: 95, summary: 'Federal prosecutors launch criminal probe into Fed Chair Powell, sparking debate over central bank independence.' },
    { id: '4', platformId: 'facebook', title: 'Golden Globes: Hamnet Wins Big', metrics: { likes: '120K', comments: '5.6K', shares: '24K' }, imageUrl: 'https://images.unsplash.com/photo-1543536448-d209d2d159d4?auto=format&fit=crop&q=80&w=300', category: 'Entertainment', popularityScore: 92, summary: 'Top honors go to "Hamnet" and "One Battle After Another" at the 83rd Golden Globe Awards.' },
    { id: '5', platformId: 'twitter', title: 'OpenAI Acquires Torch for $100M', metrics: { likes: '34K', comments: '1.2K', shares: '8.5K' }, imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=300', category: 'Technology', popularityScore: 88, summary: 'OpenAI expands into healthcare with a strategic $100M+ acquisition of health data company Torch.' },
    { id: '6', platformId: 'linkedin', title: 'S&P 500 Hits Record High', metrics: { likes: '15K', comments: 340, shares: '2.1K' }, imageUrl: 'https://images.unsplash.com/photo-1611974765272-d150244db74c?auto=format&fit=crop&q=80&w=300', category: 'Finance', popularityScore: 85, summary: 'Markets rally as S&P 500 reaches new record highs, driven by technology sector gains and Walmart.' },
    { id: '7', platformId: 'instagram', title: 'Bruno Mars Drops "I Just Might"', metrics: { likes: '2.5M', comments: '54K', shares: '120K' }, imageUrl: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?auto=format&fit=crop&q=80&w=300', category: 'Entertainment', popularityScore: 96, summary: 'Bruno Mars releases the first single from his anticipated album "The Romantic". Fans are going wild.' },
    { id: '8', platformId: 'twitter', title: 'Grok AI Blocked in SE Asia', metrics: { likes: '28K', comments: '3.1K', shares: '11K' }, imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=300', category: 'Technology', popularityScore: 82, summary: 'Malaysia and Indonesia block Elon Musk\'s Grok AI over deepfake and safety concerns.' },
    { id: '9', platformId: 'facebook', title: 'Walmart Doubles Drone Delivery', metrics: { likes: '56K', comments: '8.2K', shares: '14K' }, imageUrl: 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&q=80&w=300', category: 'Business', popularityScore: 78, summary: 'Walmart significantly expands its drone delivery service to 150 more stores, doubling its coverage.' },
    { id: '10', platformId: 'linkedin', title: 'Meta Planning 10% Workforce Cut', metrics: { likes: '18K', comments: '2.5K', shares: '6K' }, imageUrl: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&q=80&w=300', category: 'Business', popularityScore: 89, summary: 'Reports indicate Meta plans to reduce its workforce by 10% as it restructures for AI efficiency.' },
    { id: '11', platformId: 'instagram', title: 'Mary J. Blige Vegas Residency', metrics: { likes: '450K', comments: '12K', shares: '34K' }, imageUrl: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?auto=format&fit=crop&q=80&w=300', category: 'Entertainment', popularityScore: 84, summary: 'The Queen of Hip-Hop Soul announces her first-ever Las Vegas residency starting in May.' },
    { id: '12', platformId: 'twitter', title: 'Trump Proposes Credit Card Rate Cap', metrics: { likes: '67K', comments: '15K', shares: '22K' }, imageUrl: 'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?auto=format&fit=crop&q=80&w=300', category: 'Finance', popularityScore: 91, summary: 'Proposed 10% cap on credit card interest rates puts pressure on major banks and financial stocks.' },
    { id: '13', platformId: 'instagram', title: 'Mariah Carey Releases 16th Album', metrics: { likes: '1.2M', comments: '24K', shares: '55K' }, imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&q=80&w=300', category: 'Entertainment', popularityScore: 87, summary: 'Mariah Carey returns with "Here for It All", her 16th studio album, delighting fans worldwide.' },
    { id: '14', platformId: 'twitter', title: 'Security Risks in Quantum Computing', metrics: { likes: '12K', comments: 450, shares: '3.2K' }, imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=300', category: 'Technology', popularityScore: 75, summary: 'Researchers warn of "security-by-design" flaws in cloud-based quantum computers.' },
    { id: '15', platformId: 'linkedin', title: 'Meta Secures Nuclear Power for AI', metrics: { likes: '29K', comments: 890, shares: '4.5K' }, imageUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&q=80&w=300', category: 'Technology', popularityScore: 93, summary: 'Meta invests heavily in nuclear power to feed the massive energy demands of next-gen AI data centers.' },

    // --- EVERGREEN CATEGORIES (Travel, Cooking, Fitness, Gaming, Science) ---
    { id: '16', platformId: 'instagram', title: 'Hidden Gems of Kyoto', metrics: { likes: '45K', comments: '1.2K', shares: '8K' }, imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=300', category: 'Travel', popularityScore: 88, summary: 'Explore the bamboo forests and ancient shrines of Kyoto in this stunning visual guide.' },
    { id: '17', platformId: 'facebook', title: 'Best Street Food in Bangkok', metrics: { likes: '32K', comments: '900', shares: '4.5K' }, imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=300', category: 'Travel', popularityScore: 86, summary: 'A foodie\'s dream! We rank the top 10 street food stalls you must visit in Thailand.' },
    { id: '18', platformId: 'instagram', title: 'Swiss Alps Hiking Guide', metrics: { likes: '28K', comments: '750', shares: '3.2K' }, imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=300', category: 'Travel', popularityScore: 82, summary: 'Everything you need to know before tackling the majestic trails of the Swiss Alps this summer.' },
    { id: '19', platformId: 'twitter', title: 'SpaceX Starship Launch', metrics: { likes: '150K', comments: '12K', shares: '45K' }, imageUrl: 'https://images.unsplash.com/photo-1516849841054-0043990150c1?auto=format&fit=crop&q=80&w=300', category: 'Space Exploration', popularityScore: 98, summary: 'Watch the highlights from the latest Starship test flight. A major step forward for Mars colonization.' },
    { id: '20', platformId: 'youtube', title: 'James Webb Telescope New Images', metrics: { likes: '95K', comments: '4.2K', shares: '22K' }, imageUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&q=80&w=300', category: 'Space Exploration', popularityScore: 94, summary: 'NASA releases breathtaking new deep field images revealing galaxies from the early universe.' },
    { id: '21', platformId: 'instagram', title: '15-Minute HIIT Workout', metrics: { likes: '67K', comments: '1.5K', shares: '12K' }, imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=300', category: 'Fitness', popularityScore: 89, summary: 'No gym? No problem. This intense cardio session will burn calories and boost metabolism at home.' },
    { id: '22', platformId: 'facebook', title: 'Vegan Meal Prep Ideas', metrics: { likes: '42K', comments: '2.1K', shares: '9K' }, imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=300', category: 'Cooking', popularityScore: 85, summary: 'Save time and money with these delicious, high-protein vegan meal prep recipes for the week.' },
    { id: '23', platformId: 'instagram', title: 'Ultimate Chocolate Cake Recipe', metrics: { likes: '120K', comments: '6.5K', shares: '42K' }, imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=300', category: 'Cooking', popularityScore: 93, summary: 'The moistest, richest chocolate cake you will ever make. Thousands of 5-star reviews can\'t be wrong.' },
    { id: '24', platformId: 'twitter', title: 'Elden Ring DLC Review', metrics: { likes: '89K', comments: '8.4K', shares: '15K' }, imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=300', category: 'Gaming', popularityScore: 96, summary: 'Is "Shadow of the Erdtree" worth the wait? Our in-depth review of the massive expansion.' },
    { id: '25', platformId: 'twitch', title: 'Top 10 RPGs of All Time', metrics: { likes: '56K', comments: '12K', shares: '8K' }, imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=300', category: 'Gaming', popularityScore: 91, summary: 'We rank the greatest Role-Playing Games ever made. Did your favorite make the list?' },
    { id: '26', platformId: 'instagram', title: 'DIY Home Office Makeover', metrics: { likes: '34K', comments: '890', shares: '6.5K' }, imageUrl: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&q=80&w=300', category: 'Home Design', popularityScore: 84, summary: 'Transform your small workspace into a productive sanctuary with these budget-friendly tips.' },
    { id: '27', platformId: 'pinterest', title: 'Modern Living Room Trends 2026', metrics: { likes: '48K', comments: '1.4K', shares: '18K' }, imageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=300', category: 'Home Design', popularityScore: 87, summary: 'From biophilic design to modular furniture, see what\'s trending in interior design this year.' },
    { id: '28', platformId: 'linkedin', title: 'The Future of Renewable Energy', metrics: { likes: '22K', comments: '560', shares: '3.1K' }, imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=300', category: 'Environmental Science', popularityScore: 90, summary: 'How improved battery storage and solar efficiency are reshaping the global energy grid.' },
    { id: '29', platformId: 'twitter', title: 'New Electric Vehicle tax credits', metrics: { likes: '18K', comments: '1.1K', shares: '4.2K' }, imageUrl: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&q=80&w=300', category: 'Automotive', popularityScore: 86, summary: 'Government announces new incentives for EV buyers. Find out if you qualify for the full credit.' },
    { id: '30', platformId: 'youtube', title: 'Learn Python in 4 Hours', metrics: { likes: '210K', comments: '15K', shares: '65K' }, imageUrl: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&q=80&w=300', category: 'Education', popularityScore: 97, summary: 'The complete beginner\'s guide to Python programming. Build your first app today.' }
];

const INTEREST_FIELDS = [
    'Adventure', 'Animals', 'Art', 'Artificial Intelligence', 'Astrophysics',
    'Automotive', 'Business', 'Comedy', 'Cooking', 'Crafts',
    'Cryptocurrency', 'Culture', 'DIY/Home Improvement', 'Education', 'Environmental Science',
    'Fashion', 'Finance', 'Fitness', 'Food & Drink', 'Gaming',
    'Health', 'History', 'Home Design', 'Investing', 'Language Learning',
    'Literature', 'Movies', 'Music', 'News', 'Photography',
    'Podcasts', 'Science', 'Space Exploration', 'Sports', 'Startups',
    'Technology', 'Travel', 'Video Games', 'Volunteering', 'Wellness'
].sort();


/**
 * Custom hook for Firebase Initialization and Authentication
 */
const useFirebase = () => {
    const [userId, setUserId] = useState(null);
    const [userName, setUserName] = useState(null);
    const [userPhoto, setUserPhoto] = useState(null);
    const [isAnonymous, setIsAnonymous] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setUserName(user.displayName || 'User');
                setUserPhoto(user.photoURL);
                setIsAnonymous(user.isAnonymous);
            } else {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (e) {
                    console.error("Auth error:", e);
                    // Generate a Patterned Guest ID: GUEST-YYYYMMDD-XXXX
                    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
                    setUserId(`GUEST-${dateStr}-${randomSuffix}`);
                    setUserName('Guest');
                    setIsAnonymous(true);
                }
            }
        });

        return () => unsubscribe();
    }, []);

    return { db, auth, userId, userName, userPhoto, isAnonymous, isAuthReady: !!userId };
};


/**
 * Saves or updates the user's interest preference to Firestore.
 */
const saveInterestsPreference = async (db, userId, interests) => {
    if (!db || !userId) return false;
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/preferences/onboarding`);
    try {
        await setDoc(docRef, { interestsCompleted: true, selectedInterests: interests, updatedAt: serverTimestamp() }, { merge: true });
        console.log("Interests saved to Firestore.");
        return true;
    } catch (e) {
        console.error("Error saving interest preference:", e);
        return false;
    }
};


const seedTrendingPosts = async (db) => {
    console.log("Seeding trending posts...");
    const postsRef = collection(db, `artifacts/${appId}/global_trending_feed`);

    // Check if empty first to avoid duplicates (optional, but good practice)
    // For now, simpler to just overwrite or add.

    let addedCount = 0;
    for (const post of MOCK_TRENDING_CONTENT) {
        try {
            await setDoc(doc(postsRef, post.id.toString()), {
                ...post,
                timestamp: serverTimestamp()
            });
            addedCount++;
        } catch (e) {
            console.error("Error seeding post:", e);
        }
    }
    alert(`Seeded ${addedCount} posts to Global Trending Feed successfully!`);
};
/**
 * Saves the current theme preference to Firestore.
 */
const saveThemePreference = async (db, userId, isDarkMode) => {
    if (!db || !userId) return;
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/preferences/theme`);
    try {
        await setDoc(docRef, { isDarkMode, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
        console.error("Error saving theme preference:", e);
    }
};

// ThemeToggle component replaced by imported component from ./components/ThemeToggle

// --- Calendar Component ---

const CalendarView = ({ scheduledPosts = [] }) => {
    // Initialize state with current month and year
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [error, setError] = useState(null);

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

                    // Check for scheduled posts on this day
                    const hasScheduledPosts = scheduledPosts.some(post => {
                        if (!post.scheduledTime) return false;
                        const postDate = new Date(post.scheduledTime.seconds * 1000); // Assuming Firestore Timestamp
                        return postDate.getDate() === date && postDate.getMonth() === currentDate.getMonth() && postDate.getFullYear() === currentYear;
                    });

                    return (
                        <div
                            key={index}
                            className={`p-1 border border-gray-200 dark:border-gray-700 rounded-lg min-h-[80px] text-xs transition-colors duration-200 cursor-pointer relative ${isToday ? 'bg-blue-100 dark:bg-blue-900/70 border-blue-500 ring-2 ring-blue-500/50' : ''
                                } ${isWeekend && !isToday
                                    ? 'bg-gray-50/50 dark:bg-gray-700/50'
                                    : !isToday ? 'bg-white dark:bg-gray-800' : ''
                                } ${!date ? 'opacity-50 pointer-events-none' : ''
                                } hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400`}
                        >
                            <div className={`font-semibold ${isToday ? 'text-blue-700 dark:text-blue-200' : 'text-gray-900 dark:text-gray-100'}`}>
                                {date}
                            </div>
                            {/* Scheduled Post Indicator */}
                            {hasScheduledPosts && (
                                <div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- MODIFIED AnalyticsCard for dynamic WhatsApp labels ---
const AnalyticsCard = ({ platform, posts, reach, engagement, color }) => {
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
        </div>
    );
};
// --- END MODIFIED AnalyticsCard ---


const ScheduledPostItem = ({ post, onDelete }) => {
    const scheduledDate = new Date(post.scheduledTime.seconds * 1000);
    const dateStr = scheduledDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeStr = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="group relative flex flex-col p-4 mb-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5">
            {/* Header: Platform Icons & Time */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                    <div className="flex -space-x-1.5 overflow-hidden">
                        {post.platforms.map(pId => {
                            const platform = PLATFORMS.find(p => p.id === pId);
                            if (!platform) return null;
                            const Icon = platform.icon;
                            return (
                                <div key={pId} className={`relative z-10 inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800 ${platform.color} flex items-center justify-center`}>
                                    <Icon size={12} className="text-white" />
                                </div>
                            );
                        })}
                    </div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">
                        {dateStr} • {timeStr}
                    </span>
                </div>

                {/* Delete Button - Always visible on mobile, subtle on desktop until hover */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(post.id); }}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-full transition-all duration-200"
                    title="Cancel Schedule"
                    aria-label="Delete scheduled post"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Content Preview */}
            <div className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-relaxed line-clamp-2">
                {post.content}
            </div>

            {/* Visual Indicator for Image */}
            {post.imageUrl && (
                <div className="mt-2 flex items-center text-xs text-blue-600 dark:text-blue-400 font-medium">
                    <Image size={12} className="mr-1" /> Image Attached
                </div>
            )}
        </div>
    );
};

const ScheduledPostsPanel = ({ scheduledPosts, onDelete }) => (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 h-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3 text-blue-600 dark:text-blue-400">
                    <Clock size={20} />
                </div>
                Scheduled Queue
            </h2>
            <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold px-2.5 py-1 rounded-full">
                {scheduledPosts.length}
            </span>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {scheduledPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-60">
                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-3">
                        <Calendar size={32} className="text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No details queued.</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Posts you schedule will appear here.</p>
                </div>
            ) : (
                scheduledPosts.map((post) => <ScheduledPostItem key={post.id || Math.random()} post={post} onDelete={onDelete} />)
            )}
        </div>
    </div>
);

// --- Composer Modal (Simplified) ---

// --- Composer Page (Full View) ---
const ComposerContent = ({ db, userId, onCancel, isAnonymous, openLoginPrompt, userPlan = 'basic', monthlyPostCount = 0, scheduledPostsCount = 0, updateUserUsage }) => {
    const fileInputRef = useRef(null);
    const [content, setContent] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('Processing...'); // New state for granular feedback
    const [refining, setRefining] = useState(false);
    const [uploadedImage, setUploadedImage] = useState(null); // Stores the URL for preview
    const [imageFile, setImageFile] = useState(null); // Stores the actual File object
    const [imageError, setImageError] = useState(null);
    const [showGuestPopup, setShowGuestPopup] = useState(false);
    const [scheduledDate, setScheduledDate] = useState('');
    const [showSchedulePicker, setShowSchedulePicker] = useState(false);
    const [selectedTone, setSelectedTone] = useState('Professional');

    const TONES = ['Professional', 'Casual', 'Enthusiastic', 'Witty', 'Ecstatic'];


    const MAX_FILE_SIZE_MB = 5;
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];



    const handleFileChange = (event) => {
        setImageError(null);
        const file = event.target.files[0];

        if (!file) return;

        // 1. Validate file type
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            setImageError(`Unsupported file type: ${file.type}. Please use JPEG, PNG, or GIF.`);
            setUploadedImage(null);
            setImageFile(null); // Clear invalid file
            return;
        }

        // 2. Validate file size
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setImageError(`File size exceeds limit (${MAX_FILE_SIZE_MB}MB).`);
            setUploadedImage(null);
            setImageFile(null); // Clear invalid file
            return;
        }

        // 3. Display preview and store file
        setUploadedImage(URL.createObjectURL(file));
        setImageFile(file); // Store file for upload on submit
        console.log(`Image "${file.name}" selected for upload.`);
    };

    const togglePlatform = (id) => {
        setSelectedPlatforms(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleRefine = async () => {
        // Guest Restriction Check
        if (isAnonymous) {
            setShowGuestPopup(true);
            return;
        }

        if (!content.trim()) {
            alert("Please enter some text to refine.");
            return;
        }
        setRefining(true);
        try {
            const platformId = selectedPlatforms.length > 0 ? selectedPlatforms[0] : 'linkedin';
            const platformName = PLATFORMS.find(p => p.id === platformId)?.name || 'LinkedIn';

            const response = await api.post('/api/integrations/content/refine', {
                original_content: content,
                platform: platformName,
                refinement_instructions: "Review and improve this content for better engagement and clarity.",
                tone: selectedTone.toLowerCase()
            });

            if (response.data && response.data.refined_content) {
                let refinedText = response.data.refined_content;

                // Enforce Basic Plan Word Limit (100 words)
                if (userPlan === 'basic') {
                    const words = refinedText.split(/\s+/);
                    if (words.length > 100) {
                        refinedText = words.slice(0, 100).join(' ') + '... (Basic Plan Limit)';
                    }
                }
                setContent(refinedText);
            } else if (typeof response.data === 'string') {
                setContent(response.data);
            } else {
                console.warn("Unexpected refinement response:", response.data);
            }
        } catch (error) {
            console.error("Refinement failed:", error);
            alert("Failed to refine content with AI.");
        } finally {
            setRefining(false);
        }
    };

    const handlePost = async () => {
        // Guest Restriction Check
        if (isAnonymous) {
            setShowGuestPopup(true);
            return;
        }

        // --- PLAN RESTRICTIONS ---
        if (userPlan === 'basic') {
            // 1. Monthly Post Limit
            if (!scheduledDate && monthlyPostCount >= 14) {
                alert("You have reached your monthly post limit (14) for the Basic plan. Upgrade to Pro for unlimited posting.");
                return;
            }
            // 2. Scheduled Post Limit
            if (scheduledDate && scheduledPostsCount >= 2) {
                alert("Basic plan is limited to 2 scheduled posts. Upgrade to Pro for unlimited scheduling.");
                return;
            }
        }

        if (!content.trim() || selectedPlatforms.length === 0) {
            console.error("Missing content or platforms.");
            alert("Please add content and select at least one platform.");
            return;
        }

        if (!userId) {
            console.error("User ID is missing.");
            alert("User authentication error. Please try logging in again.");
            return;
        }

        // Prevent "Fake Guest" uploads which will fail Firebase Storage Rules
        if (userId.startsWith('GUEST-')) {
            alert("Please sign in to upload images. Guest access does not support file uploads.");
            if (openLoginPrompt) openLoginPrompt();
            return;
        }

        setLoading(true);
        let successCount = 0;
        let failCount = 0;
        let imageUrl = null;

        try {
            // Upload Image if selected
            if (imageFile) {
                setLoadingText("Uploading Image...");
                console.log("Uploading image to Firebase Storage...");
                try {
                    const storageRef = ref(storage, `uploads/${userId}/${Date.now()}_${imageFile.name}`);

                    // Create a timeout promise
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Image upload timed out after 45 seconds")), 45000)
                    );

                    // Race between upload and timeout
                    const snapshot = await Promise.race([
                        uploadBytes(storageRef, imageFile),
                        timeoutPromise
                    ]);

                    imageUrl = await getDownloadURL(snapshot.ref);
                    console.log("Image uploaded successfully:", imageUrl);
                } catch (uploadError) {
                    console.error("Image upload failed:", uploadError);
                    alert(`Failed to upload image. Error: ${uploadError.message || uploadError}`);
                    setLoading(false); // Ensure loading is cleared immediately on return
                    return;
                }
            }

            setLoadingText("Publishing Post...");

            // Check if it's a scheduled post
            if (scheduledDate) {
                try {
                    const scheduledTime = new Date(scheduledDate).toISOString();
                    console.log("Scheduling post for:", scheduledTime);

                    // Generate a unique ID for the post
                    const newPostRef = doc(collection(db, `artifacts/${appId}/users/${userId}/scheduled_posts`));
                    const newPostId = newPostRef.id;

                    await api.post('/api/scheduling/schedule', {
                        content: content,
                        platforms: selectedPlatforms,
                        scheduled_time: scheduledTime,
                        user_id: userId,
                        image_url: imageUrl,
                        post_id: newPostId
                    });

                    // Save to Firestore for UI visibility
                    await setDoc(newPostRef, {
                        id: newPostId,
                        content: content,
                        platforms: selectedPlatforms,
                        scheduledTime: Timestamp.fromDate(new Date(scheduledDate)),
                        imageUrl: imageUrl,
                        createdAt: serverTimestamp(),
                        status: 'scheduled'
                    });

                    alert(`Post scheduled successfully for ${new Date(scheduledDate).toLocaleString()}`);
                    successCount = selectedPlatforms.length; // Treat as success

                    // Cleanup on success
                    setContent('');
                    setSelectedPlatforms([]);
                    setUploadedImage(null);
                    setImageFile(null);
                    setScheduledDate('');
                    setShowSchedulePicker(false);
                    onCancel();

                } catch (scheduleError) {
                    console.error("Scheduling failed:", scheduleError);
                    const errorMsg = scheduleError.response?.data?.detail || scheduleError.message;
                    alert(`Failed to schedule post. Error: ${errorMsg}`);
                }
            } else {
                // Immediate Posting
                const postPromises = selectedPlatforms.map(async (platformId) => {
                    try {
                        // Using the specific integration endpoints
                        await api.post(`/api/integrations/${platformId}/post`, {
                            content: content,
                            user_id: userId, // Required by backend model
                            image_url: imageUrl // Pass the real image URL
                        });
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to post to ${platformId}:`, error);
                        // Provide more specific feedback if possible, but don't block other platforms
                        const errorMsg = error.response?.data?.detail || error.message;
                        // Use a toast or accumulates errors? For now, we will track fails.
                        console.error(`Error details for ${platformId}: ${errorMsg}`);
                        failCount++;
                        // We could alert per failure, but that might be spammy if multiple fail. 
                        // Let's summarize at the end.
                        return { platform: platformId, error: errorMsg };
                    }
                    return null; // Success
                });

                const results = await Promise.all(postPromises);

                // Filter out nulls to get errors
                const errors = results.filter(r => r !== null);

                if (successCount > 0) {
                    let msg = `Successfully posted to ${successCount} platform(s).`;
                    if (failCount > 0) {
                        msg += `\nFailed to post to ${failCount} platform(s). Check console for details.`;
                    }
                    alert(msg);

                    // Only clear if fully successful or partially successful? 
                    // Usually good to clear so they don't double post the successes.
                    setContent('');
                    setSelectedPlatforms([]);
                    setUploadedImage(null);
                    setImageFile(null);
                    setScheduledDate('');
                    setShowSchedulePicker(false);
                    onCancel();
                    updateUserUsage(); // INCREMENT USAGE
                } else if (failCount > 0) {
                    const firstError = errors[0]?.error || "Unknown error";
                    alert(`Failed to publish posts. Error: ${firstError}`);
                }
            }
        } catch (unexpectedError) {
            console.error("Unexpected error in handlePost:", unexpectedError);
            alert(`An unexpected error occurred: ${unexpectedError.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full p-4 md:p-6 flex flex-col">
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                        <Send className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                        New Post
                    </h1>
                    <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${content.length > 280 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                            {content.length} chars
                        </span>
                    </div>
                </div>

                {/* Main Content Area - Split Layout */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

                    {/* Left Panel: Content Editor */}
                    <div className="flex-1 relative flex flex-col min-h-[300px]">
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="What's on your mind? Type here..."
                            className="flex-1 w-full p-6 bg-transparent text-gray-900 dark:text-white text-lg resize-none focus:outline-none placeholder-gray-400 dark:placeholder-gray-600"
                        />

                        {/* Refine Button (Floating) */}
                        <div className="absolute bottom-4 right-4">
                            <button
                                onClick={handleRefine}
                                disabled={refining || !content.trim()}
                                className="flex items-center px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-xs font-semibold disabled:opacity-50"
                                title="Refine with AI"
                            >
                                {refining ? <Sparkles size={14} className="mr-1.5 animate-spin" /> : <Sparkles size={14} className="mr-1.5" />}
                                {refining ? 'Refining...' : 'AI Refine'}
                            </button>
                        </div>
                    </div>

                    {/* Right Panel: Tools & Settings */}
                    <div className="w-full lg:w-96 bg-gray-50 dark:bg-gray-900/50 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 p-5 overflow-y-auto shrink-0 space-y-6">

                        {/* 1. Media Upload */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Media</h3>

                            {/* Hidden File Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept={ALLOWED_MIME_TYPES.join(',')}
                                className="hidden"
                                id="image-upload-input"
                            />

                            {!uploadedImage ? (
                                <label
                                    htmlFor="image-upload-input"
                                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 transition-all group"
                                >
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm group-hover:scale-110 transition-transform mb-2">
                                        <Image size={20} className="text-gray-500 dark:text-gray-400 group-hover:text-blue-500" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-blue-600">Click to upload image</span>
                                </label>
                            ) : (
                                <div className="relative group">
                                    <img
                                        src={uploadedImage}
                                        alt="Preview"
                                        className="w-full h-40 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                                        <button
                                            onClick={() => {
                                                URL.revokeObjectURL(uploadedImage);
                                                setUploadedImage(null);
                                                setImageFile(null);
                                            }}
                                            className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-red-500 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                            {imageError && <p className="text-xs text-red-500">{imageError}</p>}
                        </div>

                        {/* 2. Platform Selection */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Publish To</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {PLATFORMS.filter(p => p.id !== 'onedrive').map(platform => {
                                    const Icon = platform.icon;
                                    const isSelected = selectedPlatforms.includes(platform.id);
                                    return (
                                        <button
                                            key={platform.id}
                                            onClick={() => togglePlatform(platform.id)}
                                            className={`flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border ${isSelected
                                                ? `${platform.color} text-white border-transparent shadow-md`
                                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                                }`}
                                        >
                                            <Icon size={16} className="mr-2" />
                                            {platform.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tone Selection */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tone</h3>
                            <div className="flex flex-wrap gap-2">
                                {TONES.map(tone => (
                                    <button
                                        key={tone}
                                        onClick={() => setSelectedTone(tone)}
                                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${selectedTone === tone ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-500'}`}
                                    >
                                        {tone}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Scheduling (Optional Inline) */}
                        {showSchedulePicker && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 animate-fade-in">
                                <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center">
                                    <Clock size={12} className="mr-1.5" /> Schedule Time
                                </h4>
                                <input
                                    type="datetime-local"
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    min={new Date().toISOString().slice(0, 16)}
                                    className="w-full text-xs p-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shrink-0 flex justify-between items-center">

                    {/* Left Actions */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                            className={`p-2.5 rounded-lg transition-colors ${scheduledDate ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            title="Schedule Post"
                        >
                            <Calendar size={20} />
                        </button>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={onCancel}
                            className="px-5 py-2.5 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePost}
                            disabled={loading || selectedPlatforms.length === 0}
                            className={`px-8 py-2.5 rounded-lg font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center ${loading || selectedPlatforms.length === 0
                                ? 'bg-gray-400 cursor-not-allowed opacity-70'
                                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-500/30'
                                }`}
                        >
                            {loading ? (
                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> {loadingText}</>
                            ) : (
                                <>{scheduledDate ? 'Schedule Post' : 'Post Now'} {scheduledDate ? <Calendar size={16} className="ml-2" /> : <Send size={16} className="ml-2" />}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Guest Popup */}
            {showGuestPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border border-gray-100 dark:border-gray-700">
                        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mb-6">
                            <Lock size={32} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">Login Required</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                            Sign in to unlock all publishing features.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => { setShowGuestPopup(false); openLoginPrompt(); }}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                            >
                                Log In
                            </button>
                            <button
                                onClick={() => setShowGuestPopup(false)}
                                className="w-full py-3 text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Login Modal (Admin Access) ---

const LoginModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const handleOAuth = async (providerName) => {
        try {
            console.log(`Initiating OAuth login for ${providerName}...`);
            let provider;
            if (providerName === 'Google') {
                provider = new GoogleAuthProvider();
            } else {
                alert(`${providerName} login is not yet implemented.`);
                return;
            }

            const result = await signInWithPopup(auth, provider);
            // The onAuthStateChanged listener in App.jsx will handle the successful login state
            console.log("User signed in:", result.user);
            alert("Logged in successfully!");
            onClose();
        } catch (error) {
            console.error("OAuth Error:", error);
            if (error.code === 'auth/configuration-not-found') {
                alert("Configuration Error: Google Sign-In is not enabled in your Firebase Console.\n\nPlease go to Firebase Console > Authentication > Sign-in method and enable Google.");
            } else if (error.code === 'auth/popup-closed-by-user') {
                console.log("Sign-in popup closed by user.");
            } else {
                alert(`Login failed: ${error.message}`);
            }
        }
    };

    const GoogleIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px" className="mr-3">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.343c-1.77,2.677-4.92,4.516-8.843,4.516c-6.6,0-11.983-5.383-11.983-11.983c0-6.6,5.383-11.983,11.983-11.983c3.342,0,6.48,1.442,8.665,3.771l6.096-6.096C38.006,5.138,32.748,3,24,3C12.44,3,3,12.44,3,24c0,11.56,9.44,21,21,21c9.47,0,16.529-6.521,17.158-17.917L43.611,20.083z" />
            <path fill="#FF3D00" d="M6.306,14.691L1.401,9.786C4.888,5.432,9.757,3,15,3c8.156,0,13.298,5.08,13.298,5.08L22.997,14.51C20.628,11.323,17.47,9.516,13.543,9.516C8.82,9.516,4.86,12.783,3.31,17.373L6.306,14.691z" />
            <path fill="#4CAF50" d="M24,45c6.883,0,12.593-3.267,16.634-7.857L33.729,32.14c-1.928,2.837-5.086,4.86-8.729,4.86c-4.723,0-8.683-3.267-10.233-7.857L6.306,33.309C10.65,39.816,17.44,45,24,45z" />
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.343c-1.181,1.866-2.915,3.197-4.843,3.743c-2.091,0.612-4.188,0.76-6.177,0.443L6.306,33.309L3.31,30.597c2.618-5.719,7.668-9.088,14.69-9.088c4.29,0,8.349,1.673,11.141,4.402L39.167,14.73C34.549,10.655,29.349,9.516,24,9.516c4.608,0,8.966,1.444,12.454,3.772l3.771-3.771c-3.149-2.73-7.391-4.402-12.225-4.402c-7.25,0-13.67,3.615-17.387,9.088L1.401,9.786C4.888,5.432,9.757,3,15,3c8.611,0,15.611,6.864,16.892,16.083H43.611z" />
        </svg>
    );

    const MicrosoftIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20px" height="20px" className="mr-3">
            <rect x="1" y="1" width="10" height="10" fill="#f25022" />
            <rect x="13" y="1" width="10" height="10" fill="#7fba00" />
            <rect x="1" y="13" width="10" height="10" fill="#00a4ef" />
            <rect x="13" y="13" width="10" height="10" fill="#ffb900" />
        </svg>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 dark:bg-opacity-80 p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-xl shadow-2xl p-6 transition-all duration-300 transform scale-100 relative">
                {/* Dismiss 'X' Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    aria-label="Close login modal"
                >
                    <X size={20} />
                </button>

                <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100 text-center">
                    Admin Login
                </h3>

                <div className="space-y-4">
                    <button
                        onClick={() => handleOAuth('Google')}
                        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        aria-label="Sign in with Google"
                    >
                        <GoogleIcon />
                        Sign in with Google
                    </button>
                    <button
                        onClick={() => handleOAuth('Microsoft')}
                        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        aria-label="Sign in with Microsoft"
                    >
                        <MicrosoftIcon />
                        Sign in with Microsoft
                    </button>
                </div>
                <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
                    Only authorized administrators should proceed.
                </p>
            </div>
        </div>
    );
};


// --- SideBar Component ---
const Sidebar = ({ handleNavClick, isSidebarOpen, toggleSidebar, view }) => {

    const sidebarWidth = isSidebarOpen ? 'w-64' : 'w-20';
    const paddingClass = isSidebarOpen ? 'p-4' : 'p-3';

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
            className={`hidden md:flex flex-col ${sidebarWidth} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-xl transition-all duration-300 ease-in-out h-full`}
        >
            {/* Header / Logo Section - FIXED BUG HERE */}
            <div className={`flex items-center mb-6 border-b border-gray-200 dark:border-gray-700 ${isSidebarOpen ? 'h-16 justify-between px-4' : 'h-auto py-4 justify-center flex-col space-y-3'}`}>
                {isSidebarOpen ? (
                    <>
                        {/* Expanded State: Title on left, Button on right (justify-between) */}
                        <h1 className="text-xl font-extrabold text-blue-600 dark:text-blue-400 truncate">
                            <span className="text-blue-600 dark:text-gray-100">SocialConnect</span>IQ
                        </h1>
                        <ToggleButton />
                    </>
                ) : (
                    <>
                        {/* Collapsed State: Icon (top) + Button (bottom) (flex-col stacked, justify-center overall) */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-400 text-white font-extrabold text-xl" aria-label="SocialConnectIQ">
                            IQ
                        </div>
                        {/* FIX: Explicitly render Button in collapsed state */}
                        <ToggleButton />
                    </>
                )}
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 space-y-2">
                {NavItems.map((item) => {
                    // FIX: Use the passed 'view' state to determine the current active link
                    const isCurrent = item.path === view;

                    return (
                        <button
                            key={item.name}
                            onClick={() => handleNavClick(item.path)}
                            className={`w-full flex items-center rounded-xl text-sm font-medium transition-colors group cursor-pointer ${paddingClass} ${isCurrent
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
            <div className={`mt-auto pt-4 border-t border-gray-200 dark:border-gray-800 ${isSidebarOpen ? 'text-left px-4' : 'text-center'}`}>
                {isSidebarOpen && (
                    <>
                        {/* Ad Banner for Basic Users */}
                        {view !== 'billing' && <div className="mb-4"><AdBanner /></div>}
                        <p className="text-xs text-gray-400 dark:text-gray-500 break-all">App ID: {appId}</p>
                    </>
                )}
                {!isSidebarOpen && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 rotate-90 w-4 mx-auto my-3">App ID</p>
                )}
            </div>
        </div>
    );
};

// --- TopBar Component ---
const TopBar = ({ userId, userName, userPhoto, isAnonymous, openComposer, openLoginModal, handleLogout, onProfileClick }) => (
    <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
        <div className="md:hidden text-2xl font-extrabold text-blue-600 dark:text-blue-400">SocialConnectIQ</div>

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
            <button
                onClick={() => openComposer('composer')}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors text-sm font-semibold"
            >
                <Send className="w-4 h-4 mr-2" /> New Post
            </button>


            {/* Admin Login Button / Profile Status */}
            {userId && !isAnonymous ? (
                <div className="flex items-center space-x-2">
                    <button
                        onClick={onProfileClick}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-700 transition-colors hover:bg-blue-200 dark:hover:bg-blue-900/60 cursor-pointer"
                        title="View Profile"
                    >
                        {userPhoto ? (
                            <img src={userPhoto} alt="Profile" className="w-5 h-5 rounded-full" />
                        ) : (
                            <User className="w-4 h-4" />
                        )}
                        <span className="text-sm font-semibold hidden sm:inline">{userName || 'User'}</span>
                    </button>
                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
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

            <ThemeToggle />
        </div>
    </header >
);


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


// --- Slideshow Component (Features & Demos) ---
const Slideshow = () => {
    const FEATURE_SLIDES = [
        {
            id: 1,
            title: "AI-Powered Content Refinement",
            description: "Elevate your social media game with our advanced AI that polishes your posts for maximum engagement.",
            icon: Sparkles,
            color: "bg-purple-600"
        },
        {
            id: 2,
            title: "Unified Analytics Dashboard",
            description: "Track performance across Facebook, Instagram, Twitter, and LinkedIn in one centralized view.",
            icon: BarChart2,
            color: "bg-blue-600"
        },
        {
            id: 3,
            title: "Smart Scheduling & Calendar",
            description: "Plan your content strategy months in advance with our intuitive drag-and-drop calendar.",
            icon: Clock, // using Clock as Calendar icon substitute if Calendar not imported
            color: "bg-green-600"
        }
    ];

    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % FEATURE_SLIDES.length);
        }, 5000); // Auto-rotate every 5 seconds
        return () => clearInterval(timer);
    }, []);

    const nextSlide = () => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % FEATURE_SLIDES.length);
    };

    const prevSlide = () => {
        setCurrentIndex((prevIndex) => (prevIndex === 0 ? FEATURE_SLIDES.length - 1 : prevIndex - 1));
    };

    const currentSlide = FEATURE_SLIDES[currentIndex];
    const Icon = currentSlide.icon;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden relative min-h-[300px] flex items-center justify-center">
            {/* Background Accent */}
            <div className={`absolute inset-0 opacity-10 ${currentSlide.color}`}></div>

            <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col items-center text-center relative z-10 transition-all duration-500 ease-in-out">
                <div className={`p-4 rounded-full ${currentSlide.color} text-white mb-6 shadow-xl`}>
                    <Icon size={48} />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-4 tracking-tight">
                    {currentSlide.title}
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                    {currentSlide.description}
                </p>
            </div>

            {/* Navigation Buttons */}
            <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-md transition-all"
                aria-label="Previous Slide"
            >
                <ChevronLeft size={24} />
            </button>
            <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-md transition-all"
                aria-label="Next Slide"
            >
                <ChevronRight size={24} />
            </button>

            {/* Dots Indicator */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2">
                {FEATURE_SLIDES.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={`w-3 h-3 rounded-full transition-colors duration-300 ${index === currentIndex
                            ? 'bg-blue-600 dark:bg-blue-400 scale-110'
                            : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                            }`}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};


// --- NEW DEDICATED TRENDING CONTENT VIEW ---
const TrendingSidebarContent = ({ openTrendingModal, userId, db }) => {
    const [allPosts, setAllPosts] = useState([]);
    const [trendingPosts, setTrendingPosts] = useState([]);
    const [userInterests, setUserInterests] = useState([]);
    const [hiddenPosts, setHiddenPosts] = useState([]); // Local state for dismissed items
    const [loading, setLoading] = useState(true);

    // 1. Fetch User Interests (Real-time)
    useEffect(() => {
        if (!db || !userId) {
            setLoading(false);
            return;
        }

        const userPrefRef = doc(db, `artifacts/${appId}/users/${userId}/preferences/onboarding`);
        const unsubscribePrefs = onSnapshot(userPrefRef, (docSnap) => {
            if (docSnap.exists()) {
                const interests = docSnap.data().selectedInterests || [];
                setUserInterests(interests);
            } else {
                setUserInterests([]);
            }
        });

        // Load hidden posts from local storage for persistence
        const savedHidden = localStorage.getItem(`hidden_posts_${userId}`);
        if (savedHidden) {
            try {
                setHiddenPosts(JSON.parse(savedHidden));
            } catch (e) { console.error("Error parsing hidden posts", e); }
        }

        return () => unsubscribePrefs();
    }, [db, userId]);

    // 2. Fetch ALL Global Trending Posts (Real-time)
    useEffect(() => {
        if (!db) return;

        setLoading(true);
        // Fetch top 50 global items to sort locally
        const postsRef = collection(db, `artifacts/${appId}/global_trending_feed`);
        // We order by timestamp initially to get fresh content, or popularity
        const q = query(postsRef, limit(50));

        const unsubscribePosts = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllPosts(posts);
            setLoading(false);
        });

        return () => unsubscribePosts();
    }, [db]);

    // 3. Ranking Algorithm & Filtering
    useEffect(() => {
        if (allPosts.length === 0) {
            setTrendingPosts([]);
            return;
        }

        const ranked = allPosts
            .filter(post => !hiddenPosts.includes(post.id))
            .map(post => {
                // --- RANKING ALGORITHM ---

                // 1. Popularity (0.3 weight) - Normalize 0-100 to 0-1
                const popularityScore = (post.popularityScore || 0) / 100;

                // 2. Interest Match (0.6 weight) - PRIMARY DRIVER
                const isInterestMatch = post.category && userInterests.includes(post.category);
                const interestScore = isInterestMatch ? 1.0 : 0.0;

                // 3. Recency (0.1 weight)
                let recencyScore = 0.5; // Default if no timestamp
                if (post.timestamp) {
                    const postDate = post.timestamp.toDate ? post.timestamp.toDate() : new Date(post.timestamp.seconds * 1000);
                    const hoursAgo = (new Date() - postDate) / (1000 * 60 * 60);
                    recencyScore = 1.0 / (Math.max(hoursAgo, 0) + 1); // Decay function
                }

                // Weighted Sum
                const finalScore = (popularityScore * 0.3) + (interestScore * 0.6) + (recencyScore * 0.1);

                return { ...post, finalScore, isInterestMatch };
            })
            .sort((a, b) => b.finalScore - a.finalScore) // Sort Descending
            .slice(0, 20); // Top 20

        setTrendingPosts(ranked);
    }, [allPosts, userInterests, hiddenPosts]);

    const handleDismiss = (e, postId) => {
        e.stopPropagation();
        const newHidden = [...hiddenPosts, postId];
        setHiddenPosts(newHidden);
        localStorage.setItem(`hidden_posts_${userId}`, JSON.stringify(newHidden));
    };

    return (
        <div className="p-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 min-h-[500px]">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-6 flex items-center justify-between">
                    <span className="flex items-center">
                        <TrendingUp className="inline mr-2 h-7 w-7 text-red-500" />
                        {userInterests.length > 0 ? "For You" : "Global Trending Feed"}
                    </span>
                    {userInterests.length > 0 && (
                        <span className="text-xs font-normal bg-purple-100 text-purple-800 px-3 py-1 rounded-full dark:bg-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 flex items-center">
                            <Sparkles size={12} className="mr-1" />
                            AI Personalized
                        </span>
                    )}
                </h1>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 space-y-4">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p>Curating your personal feed...</p>
                    </div>
                ) : trendingPosts.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-gray-600 dark:text-gray-300 mb-4">No trending posts found.</p>
                        <p className="text-sm text-gray-500">Try clearing your filters or checking back later!</p>
                    </div>
                ) : (
                    <>
                        {userInterests.length > 0 && (
                            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                                Prioritizing: <span className="font-semibold text-blue-600 dark:text-blue-400">{userInterests.slice(0, 5).join(', ')}{userInterests.length > 5 ? '...' : ''}</span>
                            </p>
                        )}

                        <ol className="space-y-4">
                            {trendingPosts.map((post, index) => {
                                const platform = PLATFORMS.find(p => p.id === post.platformId);
                                const Icon = platform ? platform.icon : Zap;

                                return (
                                    <li
                                        key={post.id}
                                        onClick={() => openTrendingModal(post.platformId)}
                                        className="relative group flex items-start p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 cursor-pointer hover:shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200"
                                        aria-label={`${post.title} ranking #${index + 1}`}
                                    >
                                        {/* Rank Number */}
                                        <span className={`text-2xl font-black mr-4 w-8 flex-shrink-0 text-right ${index < 3 ? 'text-yellow-500 drop-shadow-sm' : 'text-gray-400 dark:text-gray-600'}`}>
                                            {index + 1}.
                                        </span>

                                        {/* Thumbnail */}
                                        <div className="w-16 h-16 mr-4 overflow-hidden rounded-md flex-shrink-0 relative">
                                            {post.imageUrl ? (
                                                <img src={post.imageUrl} alt={`Thumbnail for ${post.title}`} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="bg-gray-200 dark:bg-gray-900 w-full h-full flex items-center justify-center text-xs text-gray-500">Image</div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 pr-8">
                                            <div className="flex items-center mb-1 flex-wrap gap-2">
                                                <Icon size={14} className={`${platform ? platform.color.replace('bg', 'text') : 'text-gray-500'}`} />
                                                <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate max-w-[200px]" title={post.title}>
                                                    {post.title}
                                                </h3>

                                                {/* For You Logic/Badge */}
                                                {post.isInterestMatch && (
                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-white bg-gradient-to-r from-blue-500 to-purple-500 px-1.5 py-0.5 rounded flex items-center shadow-sm">
                                                        For You
                                                    </span>
                                                )}

                                                {post.category && (
                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                                        {post.category}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                                {post.summary}
                                            </p>

                                            <div className="flex space-x-4 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="flex items-center" title="Popularity Score">
                                                    <TrendingUp size={12} className="mr-1 text-green-500" /> {post.popularityScore || 'N/A'}%
                                                </span>
                                                <span className="flex items-center">
                                                    <ThumbsUp size={12} className="mr-1 text-red-500" /> {post.metrics.likes}
                                                </span>
                                                <span className="flex items-center">
                                                    <CommentIcon size={12} className="mr-1 text-yellow-500" /> {post.metrics.comments}
                                                </span>
                                                <span className="flex items-center">
                                                    <Share2 size={12} className="mr-1 text-blue-500" /> {post.metrics.shares}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Dismiss Button (Visible on Hover) */}
                                        <button
                                            onClick={(e) => handleDismiss(e, post.id)}
                                            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Not Interested"
                                        >
                                            <X size={16} />
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </>
                )}

                <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>Criteria:</strong> Real-time ranking based on <span className="font-semibold text-purple-600">Your Interests (60%)</span>, <span className="font-semibold text-blue-600">Popularity (30%)</span>, and <span className="font-semibold text-green-600">Recency (10%)</span>.</p>
                </div>
            </div>
        </div>
    );
};



const LandingPage = ({ openLoginModal }) => (
    <div className="p-6 space-y-8">
        <div className="flex flex-col items-center justify-center text-center py-10 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 mb-8">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-full mb-6">
                <LayoutDashboard size={48} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-5xl font-extrabold mb-6">
                Welcome to
                <span className="text-black dark:text-white"> SocialConnect</span>
                <span className="text-blue-600 dark:text-blue-400">IQ</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl leading-relaxed mb-8 px-4">
                The ultimate AI-powered platform to manage your social media presence, analyze performance, and generate engaging content.
            </p>
            <button
                onClick={openLoginModal}
                className="px-8 py-4 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-105 text-lg font-bold flex items-center"
            >
                <LogIn className="mr-2" /> Get Started / Login
            </button>
        </div>

        {/* Section 1: Features Slideshow - Reused */}
        <div className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-gray-200">Explore Our Power Features</h2>
            <Slideshow />
        </div>

        {/* Section 2: Core Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 transition-transform hover:-translate-y-1">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg w-fit mb-4">
                    <Zap size={24} className="text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">Unified Dashboard</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Manage Facebook, Instagram, Twitter, and LinkedIn from a single intuitive interface. Stop switching tabs.
                </p>
            </div>
            <div className="p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 transition-transform hover:-translate-y-1">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg w-fit mb-4">
                    <Sparkles size={24} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">AI Content Refinement</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Use advanced AI to polish your posts, improve tone, and maximize audience engagement instantly.
                </p>
            </div>
            <div className="p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 transition-transform hover:-translate-y-1">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg w-fit mb-4">
                    <BarChart2 size={24} className="text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">Analytics & Insights</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Track real-time metrics and gain actionable insights to grow your social reach effectively.
                </p>
            </div>
        </div>

        {/* Section 3: "How It Works" Video Presentation */}
        <div className="mt-16 mb-8">
            <h2 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
                See SocialConnectIQ in Action
            </h2>
            <div className="max-w-4xl mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-200 dark:border-gray-700 relative group">
                {/* Video Element with Custom Thumbnail */}
                <video
                    controls
                    className="w-full h-auto aspect-video object-cover"
                    poster="https://placehold.co/1280x720/1e40af/ffffff?text=SocialConnectIQ+Walkthrough"
                    preload="none"
                >
                    {/* Placeholder content - User should replace src with actual demo video */}
                    <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                </video>

                {/* Overlay Text/Description */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Discover how to automate your social media workflow.
                </div>
            </div>
        </div>

        {/* Footer Section */}
        <footer className="mt-20 pt-10 border-t border-gray-200 dark:border-gray-700 text-center pb-8">
            <div className="flex justify-center space-x-6 mb-6">
                <button className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <Facebook size={20} />
                </button>
                <button className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors">
                    <Instagram size={20} />
                </button>
                <button className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                    <X size={20} />
                </button>
                <button className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-500 transition-colors">
                    <Linkedin size={20} />
                </button>
            </div>

            <p className="text-gray-900 dark:text-gray-100 font-semibold mb-2">
                © 2026 AIResearxhLabs Community. All rights reserved.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-3xl mx-auto mb-4 leading-relaxed">
                AIResearxhLabs is a community supported by BSRS Digital Solutions. All commercial licenses, cloud infrastructure, and operational costs are borne by BSRS as part of its R&D and CSR commitment.
            </p>
            <div className="flex justify-center space-x-6 text-sm font-medium text-blue-600 dark:text-blue-400">
                <button className="hover:underline">Privacy Policy</button>
                <span>&middot;</span>
                <button className="hover:underline">Terms of Service</button>
            </div>
        </footer>
    </div>
);


const DashboardContent = ({ scheduledPosts, integrationsRef, isTargetingIntegrations, platformConnections, onDeleteScheduledPost, userPlan }) => (
    <div className="p-6 space-y-8">
        {/* TITLE: Welcome to ConnectIQ */}
        <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-4xl font-extrabold mb-2">
                Welcome to
                <span className="text-black dark:text-white"> SocialConnect</span>
                <span className="text-blue-600 dark:text-blue-400">IQ</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
                Your central hub for social media management, analytics, and content generation.
            </p>
        </div>

        {/* Section 1: Features Slideshow (New) - Placed at Top */}
        <div className="mb-6">
            {userPlan === 'basic' && <AdBanner />}
        </div>
        <Slideshow />

        {/* Section 2: Quick Analytics Summary (Now includes WhatsApp) - Moved Down */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MOCK_ANALYTICS.map(data => (
                <AnalyticsCard key={data.platform} {...data} color={PLATFORMS.find(p => p.name === data.platform)?.color || 'bg-gray-500'} />
            ))}
        </div>

        {/* Section 3: Composer and Calendar/Scheduled Posts - Moved Down */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl min-h-[500px]">
                <CalendarView scheduledPosts={scheduledPosts} />
            </div>
            <ScheduledPostsPanel scheduledPosts={scheduledPosts} onDelete={onDeleteScheduledPost} />
        </div>

        {/* Section 4: Integrations Status Panel - Moved Down */}
        <IntegrationsStatusPanel
            ref={integrationsRef}
            platformConnections={platformConnections} // PASS state here
            isTargetingIntegrations={isTargetingIntegrations}
        />

        {/* REMOVED: TrendingContent Panel */}
    </div>
);

// --- Trending Authentication Modal ---
const TrendingAuthModal = ({ isOpen, onClose, platformId, onConnect }) => {
    if (!isOpen || !platformId) return null;

    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!platform) return null;

    const Icon = platform.icon;

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [saveCredentials, setSaveCredentials] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLoginAttempt = () => {
        setError(null);
        if (!username || !password) {
            setError("Please enter both your username/email and password.");
            return;
        }

        setLoading(true);

        // Mock Authentication Logic
        setTimeout(() => {
            setLoading(false);
            if (password === 'test1234') { // Mock Success
                console.log(`Successfully connected ${platform.name}. Credentials saved: ${saveCredentials}`);
                onConnect(platformId, true); // Trigger connection success with status=true
                onClose();
            } else {
                setError("Incorrect credentials. Please try again. (Hint: Use password 'test1234')");
            }
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 dark:bg-opacity-80 p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-xl shadow-2xl p-6 transition-all duration-300 transform scale-100 relative">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    aria-label="Close login modal"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                    <div className={`mx-auto w-12 h-12 flex items-center justify-center rounded-full ${platform.color} mb-3`}>
                        <Icon size={24} className="text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Connect to Access Trending Content
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Log in to your **{platform.name}** account to view this post and related analytics.
                    </p>
                </div>

                {/* Error Handling */}
                {error && (
                    <div className="mb-4 p-3 text-sm font-medium text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded-lg border border-red-300 flex items-center">
                        <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Login Form */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Username or Email</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="username@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Password"
                        />
                    </div>

                    {/* Security/UX Options */}
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                            <input
                                id="save-credentials"
                                type="checkbox"
                                checked={saveCredentials}
                                onChange={(e) => setSaveCredentials(e.target.checked)}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <label htmlFor="save-credentials" className="ml-2 text-gray-700 dark:text-gray-300">
                                Save credentials securely
                            </label>
                        </div>
                        <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-xs">Forgot Password?</button>
                    </div>
                </div>

                {/* Call to Action */}
                <button
                    onClick={handleLoginAttempt}
                    disabled={loading}
                    className={`w-full mt-6 py-3 rounded-lg text-lg font-semibold text-white transition-colors ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    {loading ? 'Logging In...' : 'Securely Connect Account'}
                </button>

                {/* User Feedback Mechanism */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
                    <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600">
                        Report Issue / Provide Feedback
                    </button>
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
    if (isEmailPassword || isUserIdPassword) {
        const primaryLabel = isEmailPassword ? 'Email Address' : 'User ID';
        const primaryType = isEmailPassword ? 'email' : 'text';

        return (
            <div className="w-full">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {isEmailPassword ? 'Sign in using your account email and password.' : 'Sign in using your user ID and password.'}
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{primaryLabel}</label>
                        <input
                            type={primaryType}
                            value={emailOrUser}
                            onChange={(e) => setEmailOrUser(e.target.value)}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder={`Enter ${primaryLabel}`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Enter Password"
                        />
                    </div>
                </div>
                <button
                    onClick={() => handleLogin(platformId, emailOrUser, password)}
                    disabled={loading || !emailOrUser || !password}
                    className={`w-full mt-6 py-3 rounded-lg text-lg font-semibold text-white transition-colors ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    {loading ? 'Authenticating...' : 'Secure Login'}
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

    // --- Common Auth Handler for standard logins ---
    const handleLogin = (id, loginId, password) => {
        if (id === 'whatsapp') return; // Handled separately by OTP flow

        setLoading(true);
        setError(null);
        setStep(2); // Move to Authorization/Loading Step

        // Mock Login/API call simulation
        setTimeout(() => {
            if (loginId && password && password.length > 5) { // Simple validation
                setStep(3);
                setTimeout(() => {
                    onComplete(platformId, true); // Complete integration
                }, 1000);
            } else {
                setLoading(false);
                setError("Login failed. Please check your credentials or ensure the account is active.");
                setStep(1);
            }
        }, 2000);
    };

    // --- WhatsApp Handlers ---
    const handleSendOTP = () => {
        // OTP Logic (simplified for this component)
        const phoneRegex = /^\+\d{8,15}$/;
        if (!phoneRegex.test(mobileNumber)) {
            setError('Invalid mobile number format. Please include country code, e.g., +1234567890.');
            return;
        }
        setError(null);
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            const mockOtp = String(Math.floor(100000 + Math.random() * 900000));
            setOtpSent(mockOtp);
            console.log(`Mock OTP for ${platform.name}: ${mockOtp}`); // Log mock OTP for testing
            setError(`Mock OTP Sent (use ${mockOtp}) to verify connection.`); // Use error message box to display mock OTP
        }, 1500);
    };

    const handleVerifyOTP = () => {
        setLoading(true);
        setError(null);
        setTimeout(() => {
            setLoading(false);
            if (otpInput === otpSent) {
                setStep(3);
                onComplete(platformId, true);
            } else {
                setError("Incorrect OTP. Please try again.");
            }
        }, 1500);
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

// --- OAuth Callback Component ---
const OAuthCallback = () => {
    const [status, setStatus] = useState('loading');
    const [platform, setPlatform] = useState('');
    const [message, setMessage] = useState('');
    const [debugInfo, setDebugInfo] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const statusParam = params.get('status');
        const platformParam = params.get('platform');
        const messageParam = params.get('message');

        setStatus(statusParam);
        setPlatform(platformParam);
        setMessage(messageParam);
        setDebugInfo(window.location.href);

        if (statusParam === 'success') {
            // Notify parent window
            const channel = new BroadcastChannel('social_connect_auth');
            channel.postMessage({ type: 'OAUTH_SUCCESS', platform: platformParam });

            if (window.opener) {
                try {
                    window.opener.postMessage({ type: 'OAUTH_SUCCESS', platform: platformParam }, '*');
                } catch (e) { }
            }

            // Auto close
            setTimeout(() => window.close(), 2500);
        } else if (statusParam === 'error') {
            if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_ERROR', platform: platformParam, message: messageParam }, '*');
            }
        }
    }, []);

    const handleManualClose = () => {
        const channel = new BroadcastChannel('social_connect_auth');
        channel.postMessage({ type: 'OAUTH_SUCCESS', platform: platform });
        if (window.opener) {
            try {
                window.opener.postMessage({ type: 'OAUTH_SUCCESS', platform: platform }, '*');
            } catch (e) { }
        }
        window.close();
    };

    if (status === 'success') {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-gray-800 p-4 text-center">
                <div className="text-5xl text-green-500 mb-4">✓</div>
                <h2 className="text-2xl font-bold mb-2">Connected Successfully!</h2>
                <p>You have successfully connected to {platform || 'the platform'}.</p>
                <p className="mb-4">This window should close automatically.</p>
                <button
                    onClick={handleManualClose}
                    className="px-6 py-2 bg-green-500 text-white rounded font-bold hover:bg-green-600 transition"
                >
                    Click here if window doesn't close
                </button>
                <p className="text-xs text-gray-500 mt-4">Debug: {platform} | {status}</p>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-gray-800 p-4 text-center">
                <div className="text-5xl text-red-500 mb-4">✕</div>
                <h2 className="text-2xl font-bold mb-2">Connection Failed</h2>
                <p className="mb-4">{message ? decodeURIComponent(message) : 'An unknown error occurred.'}</p>
                <button
                    onClick={() => window.close()}
                    className="px-6 py-2 bg-red-500 text-white rounded font-bold hover:bg-red-600 transition"
                >
                    Close Window
                </button>
            </div>
        );
    }

    // Fallback / Unknown
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-gray-800 p-4 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
            <h2 className="text-xl font-bold mb-4">Processing...</h2>
            <div className="bg-gray-200 p-4 rounded text-left text-xs overflow-auto max-w-md w-full mb-4">
                <pre>URL: {debugInfo}</pre>
            </div>
            <button
                onClick={handleManualClose}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
                Force Success & Close
            </button>
        </div>
    );
};

const IntegrationsPageContent = ({ setFullIntegration, platformConnections, setPlatformConnections, userId, isAnonymous }) => { // Pass isAnonymous
    // NOTE: connections state replaced by platformConnections prop to ensure synchronization

    const [message, setMessage] = useState(''); // Unified message state for this page

    // Effect to handle status messages from the full integration flow completion
    // Since the full integration flow now updates platformConnections directly, we monitor that.
    useEffect(() => {
        // Simple hack: Check if any connection status changed to true recently (requires external timestamp/flag in real app)
        const lastConnected = Object.keys(platformConnections).find(id => platformConnections[id] === true);
        if (lastConnected) {
            const platformName = PLATFORMS.find(p => p.id === lastConnected).name;
            setMessage({ type: 'success', text: `${platformName} successfully connected!` });
            // Optionally clear the message after a delay
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [platformConnections]);

    useEffect(() => {
        // Listen for OAuth success/error messages from popup
        const handleMessage = (event) => {
            console.log("Received message from popup:", event.data);
            if (event.data.type === 'OAUTH_SUCCESS') {
                const platform = PLATFORMS.find(p => p.id === event.data.platform);
                // Optimistically update
                setPlatformConnections(prev => ({ ...prev, [event.data.platform]: true }));
                setMessage({ type: 'success', text: `${platform?.name || 'Account'} successfully connected!` });

                // Close popup logic is handled by popup itself usually (window.close())
                // But we can clear message later
                setTimeout(() => setMessage(''), 5000);
            } else if (event.data.type === 'OAUTH_ERROR') {
                setMessage({ type: 'error', text: `Connection failed: ${event.data.message || 'Unknown error'}` });
            }
        };

        window.addEventListener('message', handleMessage);

        // BroadcastChannel for robust cross-window communication
        const channel = new BroadcastChannel('social_connect_auth');
        channel.onmessage = handleMessage;

        return () => {
            window.removeEventListener('message', handleMessage);
            channel.close();
        };
    }, [setPlatformConnections]);

    const handleLogin = async (id) => {
        const platform = PLATFORMS.find(p => p.id === id);

        // Guest Restriction
        if (isAnonymous) {
            setMessage({ type: 'info', text: "Please login to connect your social media accounts." });
            return;
        }

        if (!userId) {
            setMessage({ type: 'error', text: "Please wait... initializing user session." });
            return;
        }

        if (platformConnections[id]) {
            if (!window.confirm(`Are you sure you want to disconnect ${platform.name}?`)) return;
            try {
                // Determine if we need to call API or just clear state
                // Ideally call API. Assuming DELETE endpoint exists or implemented
                await api.delete(`/api/integrations/${id}/disconnect`, { headers: { 'x-user-id': userId } }).catch(e => console.warn(e));

                setPlatformConnections(prev => ({ ...prev, [id]: false }));
                setMessage({ type: 'success', text: `${platform.name} disconnected.` });
            } catch (error) {
                console.error("Disconnect error:", error);
                setMessage({ type: 'error', text: "Failed to disconnect." });
            }
        } else {
            // NEW: "Coming Soon" Check
            // Allow only 'linkedin' and 'twitter' for now
            if (id !== 'linkedin' && id !== 'twitter') {
                setMessage({ type: 'info', text: `${platform.name} integration is coming soon!` });
                return;
            }



            // Connect Logic
            try {
                setMessage({ type: 'info', text: 'Initiating connection...' });

                const response = await api.post(`/api/integrations/${id}/auth`, {}, { headers: { 'x-user-id': userId } });

                if (response.data.auth_url) {
                    const width = 600;
                    const height = 700;
                    const left = (window.screen.width / 2) - (width / 2);
                    const top = (window.screen.height / 2) - (height / 2);

                    // Open the real OAuth popup
                    window.open(
                        response.data.auth_url,
                        'SocialConnectAuth',
                        `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
                    );

                    setMessage({ type: 'info', text: 'Please complete login in the popup window.' });
                } else {
                    throw new Error("No authentication URL received from server.");
                }

            } catch (error) {
                console.error("Connection error:", error);
                const errorMsg = error.response?.data?.message || error.message || "Unknown error";
                setMessage({ type: 'error', text: `Connection failed: ${errorMsg}. Ensure backend is running.` });
            }
        }
    };


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

                {/* Message Display */}
                {message && (
                    <div className={`mb-4 p-3 flex items-center rounded-lg font-medium border ${message.type === 'success'
                        ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700'
                        : message.type === 'error'
                            ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700'
                            : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700'
                        }`}>
                        {message.type === 'success' ? <CheckCircle size={18} className="mr-2" /> : <AlertTriangle size={18} className="mr-2" />}
                        {message.text}
                    </div>
                )}


                {/* Integration Blocks Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {PLATFORMS.map(platform => {
                        const Icon = platform.icon;
                        // READ from platformConnections state
                        const isConnected = platformConnections[platform.id];

                        const buttonLabel = isConnected ? 'Disconnect' : 'Connect Account';

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

                                {/* Standard Connect/Disconnect Button */}
                                <button
                                    onClick={() => handleLogin(platform.id)}
                                    className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${isConnected
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                >
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




const SettingsContent = ({ db, userId, userName, userPhoto, isAnonymous, handleLogout, openLoginPrompt }) => {
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isLoadingPreferences, setIsLoadingPreferences] = useState(true); // New loading state
    const [statusMsg, setStatusMsg] = useState('');
    const [isEditing, setIsEditing] = useState(false); // Default to safe View Mode
    const [hasSavedOnce, setHasSavedOnce] = useState(false);

    // Guest details override
    const displayUserName = isAnonymous ? 'Guest_User' : (userName || 'User');
    const displayUserId = isAnonymous ? (userId?.startsWith('GUEST') ? userId : `GUEST-${userId}`) : `USR-${userId?.slice(0, 12).toUpperCase()}`;
    const displayRole = isAnonymous ? 'Guest' : 'Account Owner';
    const displayStatus = isAnonymous ? 'Inactive' : 'Active';
    const statusColor = isAnonymous ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    const roleColor = isAnonymous ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';


    // Load initial interests - ONLY if not anonymous
    // Load initial interests - ONLY if not anonymous
    useEffect(() => {
        if (!db || !userId || isAnonymous) {
            setIsLoadingPreferences(false);
            return;
        }
        const fetchInterests = async () => {
            setIsLoadingPreferences(true);
            try {
                const docRef = doc(db, `artifacts/${appId}/users/${userId}/preferences/onboarding`);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data().selectedInterests || [];
                    setSelectedInterests(data);
                    if (data.length > 0) {
                        setHasSavedOnce(true);
                        setIsEditing(false); // View mode if data exists
                    } else {
                        setIsEditing(true); // No specific interests -> Edit mode
                    }
                } else {
                    setIsEditing(true); // Logic for new user -> Edit mode
                }
            } catch (e) {
                console.error("Error fetching interests for settings:", e);
                setIsEditing(true); // Fallback to edit on error
            } finally {
                setIsLoadingPreferences(false);
            }
        };
        fetchInterests();
    }, [db, userId, isAnonymous]);


    const handleToggleInterest = (interest) => {
        if (!isEditing) return; // Prevent editing in view mode
        setSelectedInterests(prev =>
            prev.includes(interest)
                ? prev.filter(i => i !== interest)
                : [...prev, interest]
        );
        setStatusMsg('');
    };

    const handleSaveInterests = async () => {
        setLoading(true);
        setStatusMsg('');
        const success = await saveInterestsPreference(db, userId, selectedInterests);
        setLoading(false);
        if (success) {
            setStatusMsg('Saved!');
            setHasSavedOnce(true);
            // Delay switch to View Mode to let user see "Saved!" message
            setTimeout(() => {
                setIsEditing(false);
                setStatusMsg('');
            }, 1500);
        } else {
            setStatusMsg('Failed.');
        }
    };

    return (
        <div className="p-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 min-h-[500px]">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-6">Settings & Profile</h1>

                {/* --- Profile Summary Section (First) --- */}
                <div className="flex flex-col items-center mb-10 border-b border-gray-200 dark:border-gray-700 pb-8">
                    <div className="relative mb-4">
                        {userPhoto && !isAnonymous ? (
                            <img src={userPhoto} alt="Profile" className="w-24 h-24 rounded-full border-4 border-blue-500 shadow-lg object-cover" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-4 border-gray-300 dark:border-gray-600 shadow-lg">
                                <User size={48} className="text-gray-400 dark:text-gray-500" />
                            </div>
                        )}
                    </div>

                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{displayUserName}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">
                            ID: {displayUserId}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Account Status</h3>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
                                {displayStatus}
                            </span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Role</h3>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${roleColor}`}>
                                {displayRole}
                            </span>
                        </div>
                    </div>

                    {/* Logout/Login Button in Settings directly */}
                    {isAnonymous ? (
                        <button
                            onClick={openLoginPrompt}
                            className="mt-8 flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors font-semibold text-sm"
                        >
                            <LogIn className="w-4 h-4 mr-2" />
                            Log In
                        </button>
                    ) : (
                        <button
                            onClick={handleLogout}
                            className="mt-8 flex items-center px-6 py-2 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition-colors font-semibold text-sm"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Sign Out
                        </button>
                    )}
                </div>


                {/* --- Preferences Section (Logged In Only) --- */}
                {!isAnonymous ? (
                    <>
                        <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                            My Interests
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            Select topics to personalize your AI content recommendations and trending feed.
                        </p>


                        <div className="mb-6">
                            {isLoadingPreferences ? (
                                <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 py-4">
                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                    <span>Loading preferences...</span>
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                                    {INTEREST_FIELDS.map(field => {
                                        const isSelected = selectedInterests.includes(field);
                                        return (
                                            <button
                                                key={field}
                                                onClick={() => handleToggleInterest(field)}
                                                className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 border ${isSelected
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md' + (isEditing ? ' hover:bg-blue-700' : '')
                                                    : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600' + (isEditing ? ' hover:bg-gray-200 dark:hover:bg-gray-600' : '')
                                                    } ${!isEditing ? 'cursor-default opacity-90' : 'cursor-pointer'}`}
                                            >
                                                {field} {isSelected && '✓'}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center space-x-4 mb-8">
                            {isEditing ? (
                                <button
                                    onClick={handleSaveInterests}
                                    disabled={loading || statusMsg === 'Saved!'}
                                    className={`px-6 py-2 rounded-lg font-medium transition-all shadow-md flex items-center ${statusMsg === 'Saved!'
                                        ? 'bg-green-600 text-white'
                                        : statusMsg === 'Failed.'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? (
                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> Saving...</>
                                    ) : statusMsg === 'Saved!' ? (
                                        <><CheckCircle size={18} className="mr-2" /> Saved!</>
                                    ) : statusMsg === 'Failed.' ? (
                                        <><AlertTriangle size={18} className="mr-2" /> Failed</>
                                    ) : (
                                        'Save Interests'
                                    )}
                                </button>
                            ) : (
                                // Show "Edit Preferences" if not editing, OR if we just saved successfully (handled by useEffect logic but safe here)
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition shadow-md"
                                >
                                    Edit Preferences
                                </button>
                            )}
                            <button
                                onClick={() => seedTrendingPosts(db)}
                                className="px-4 py-2 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                            >
                                Seed Trending Data
                            </button>
                            {statusMsg && (
                                <span className={`text-sm font-medium ${statusMsg.includes('Success') ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>
                                    {statusMsg}
                                </span>
                            )}
                        </div>

                        <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">User Experience</h3>
                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-8">
                            <label htmlFor="scroll-speed" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Navigation Scroll Speed (Smoothness)
                            </label>
                            <select id="scroll-speed" disabled className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-48">
                                <option>Fast (Default)</option>
                                <option>Medium</option>
                                <option>Slow</option>
                            </select>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Currently mocked using browser's 'smooth' behavior. Custom durations would be implemented here.
                            </p>
                        </div>

                        <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Account Management</h3>
                        <p className="text-gray-600 dark:text-gray-300">Manage API keys and connected accounts here.</p>
                    </>
                ) : (
                    <div className="mt-8 text-center p-8 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                        <Lock className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Preferences Locked</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Log in to access account settings and personalization.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const ProfileContent = ({ userId, userName, userPhoto, isAnonymous, handleLogout }) => (
    <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 min-h-[500px] flex flex-col items-center">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-8 self-start border-b border-gray-200 dark:border-gray-700 pb-4 w-full">
                User Profile
            </h1>

            <div className="flex flex-col items-center space-y-4 mb-8">
                <div className="relative">
                    {userPhoto ? (
                        <img src={userPhoto} alt="Profile" className="w-32 h-32 rounded-full border-4 border-blue-500 shadow-lg object-cover" />
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center border-4 border-blue-500 shadow-lg">
                            <User size={64} className="text-blue-600 dark:text-blue-300" />
                        </div>
                    )}
                    {isAnonymous && (
                        <span className="absolute bottom-0 right-0 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-white dark:border-gray-800">
                            Guest
                        </span>
                    )}
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userName || 'User'}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">
                        ID: {userId?.startsWith('GUEST-') ? userId : `USR-${userId?.slice(0, 12).toUpperCase()}`}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mb-10">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Account Status</h3>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        Active
                    </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Role</h3>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        Account Owner
                    </span>
                </div>
            </div>

            <button
                onClick={handleLogout}
                className="flex items-center px-6 py-3 bg-red-600 text-white rounded-xl shadow-md hover:bg-red-700 transition-colors font-semibold"
            >
                <LogOut className="w-5 h-5 mr-2" />
                Sign Out
            </button>
        </div>
    </div>
);


const AnalyticsContent = ({ isAnonymous, openLoginPrompt }) => {
    if (isAnonymous) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-10 max-w-md text-center border border-gray-100 dark:border-gray-700 transform transition-all hover:scale-105 duration-300">
                    <div className="mx-auto w-20 h-20 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mb-6">
                        <Lock size={40} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
                        Analytics Locked
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed text-lg">
                        Please login and <span className="font-semibold text-blue-600 dark:text-blue-400">connect your social media platforms</span> to view your respective analytics.
                    </p>
                    <button
                        onClick={openLoginPrompt}
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-blue-500/40 flex items-center justify-center"
                    >
                        <LogIn className="mr-2" size={20} /> Login / Connect
                    </button>
                </div>
            </div>
        );
    }

    return (
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
};


// --- Main Application Component ---
const App = () => {
    const { db, userId, userName, userPhoto, isAnonymous, isAuthReady } = useFirebase();
    const [scheduledPosts, setScheduledPosts] = useState([]);
    // const [isComposerOpen, setIsComposerOpen] = useState(false); // Removed model state
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    // Logout Handler
    const handleLogout = async () => {
        try {
            await signOut(auth);
            // Optional: Reset view or show message
            alert("You have been logged out.");
        } catch (error) {
            console.error("Logout Error:", error);
            alert("Failed to log out.");
        }
    };

    // Determine initial view based on URL or defaults
    const getInitialView = () => {
        if (window.location.pathname === '/oauth-callback' || window.location.pathname === '/oauth-callback.html') {
            return 'oauth_callback';
        }
        return 'dashboard';
    };

    const [view, setView] = useState(getInitialView());
    const [isTargetingIntegrations, setIsTargetingIntegrations] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // --- NEW ONBOARDING STATE ---
    const [interestsCompleted, setInterestsCompleted] = useState(null); // null, true, or false

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
    const [modalPlatformId, setModalPlatformId] = useState(null);

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

    // Trending Content Handlers
    const openTrendingModal = useCallback((platformId) => {
        setModalPlatformId(platformId);
        setIsTrendingModalOpen(true);
    }, []);

    const closeTrendingModal = useCallback(() => {
        setIsTrendingModalOpen(false);
        setModalPlatformId(null);
    }, []);

    // Handler for Trending Auth Modal completion (updates centralized state)
    const handleTrendingConnect = useCallback((platformId, status) => {
        setPlatformConnections(prev => ({
            ...prev,
            [platformId]: status // status is true on successful connection
        }));
    }, []);


    // Scroll and Navigation handler
    const handleNavClick = useCallback((path) => {
        // 1. Handle special cases (Modals/Scroll)
        // if (path === 'composer') {  // Removed modal logic
        //     setIsComposerOpen(true);
        // } else {
        // 2. Handle all navigation clicks
        setView(path);

        if (path === 'dashboard' && mainContentRef.current) {
            // Scroll to top when navigating to dashboard view
            mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, []);

    // New: Handle Scheduled Post Deletion
    const handleDeleteScheduledPost = useCallback(async (postId) => {
        if (!window.confirm("Are you sure you want to delete this scheduled post?")) return;
        try {
            // 1. Delete from Backend (Cancel Job)
            await api.delete(`/api/scheduling/schedule/${postId}`);

            // 2. Delete from Firestore
            if (db && userId) {
                await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/scheduled_posts/${postId}`));
            }
        } catch (error) {
            console.error("Error deleting scheduled post:", error);
            alert("Failed to delete scheduled post. It may have already run or backend is unreachable.");
            // Even if backend fails, we might want to delete from UI or sync check later. 
            // For now, let's allow Firestore delete if backend is 404/500 to keep UI clean?
            // Safer to just try Firestore delete anyway if backend error isn't "Network Error"
            if (db && userId) {
                try { await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/scheduled_posts/${postId}`)); } catch (e) { }
            }
        }
    }, [db, userId]);


    // Load Theme Preference (Firestore)
    // Theme preferences handled by next-themes

    // 1. Load Onboarding Preferences from Firestore (moved from combined useEffect)
    useEffect(() => {
        if (db && userId) {
            const onboardingRef = doc(db, `artifacts/${appId}/users/${userId}/preferences/onboarding`);

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

            return () => unsubscribeOnboarding();
        }
    }, [db, userId]);


    // 2. Load Scheduled Posts from Firestore
    useEffect(() => {
        if (db && userId) { // Removed interestsCompleted dependency to ensure visibility
            const postsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/scheduled_posts`);
            // Sort by scheduledTime for display
            const q = query(postsCollectionRef, orderBy('scheduledTime', 'desc'));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const posts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Ensure timestamp is converted for rendering if it exists
                    scheduledTime: doc.data().scheduledTime || { seconds: Date.now() / 1000 }
                }));
                console.log("Fetched Scheduled Posts:", posts); // Add debug log
                setScheduledPosts(posts);
            }, (error) => {
                console.error("Error listening to scheduled posts:", error);
            });

            return () => unsubscribe();
        }
    }, [db, userId]); // Removed interestsCompleted dependency

    // 3. Fetch Integration Statuses
    useEffect(() => {
        const fetchStatuses = async () => {
            if (!userId) return;
            try {
                // We use Promise.allSettled to ensure one failure doesn't break all
                const promises = PLATFORMS.map(async (platform) => {
                    try {
                        const res = await api.get(`/api/integrations/${platform.id}/status`, { headers: { 'x-user-id': userId } });
                        // Assume endpoint returns { connected: boolean } or we infer from 200 OK
                        // If endpoint returns { status: 'connected' } or similar
                        return { id: platform.id, connected: res.data.connected || res.data.status === 'connected' };
                    } catch (e) {
                        // 404 or 401 means not connected or error
                        return { id: platform.id, connected: false };
                    }
                });

                const results = await Promise.all(promises);
                const newConnections = {};
                results.forEach(r => {
                    if (r) newConnections[r.id] = r.connected;
                });

                setPlatformConnections(prev => ({ ...prev, ...newConnections }));
            } catch (error) {
                console.error("Failed to fetch integration statuses:", error);
            }
        };

        fetchStatuses();
    }, [userId]);

    // 4. Load Billing/Usage Info
    const [userPlan, setUserPlan] = useState('basic');
    const [monthlyPostCount, setMonthlyPostCount] = useState(0);

    useEffect(() => {
        if (db && userId) {
            const billingDocRef = doc(db, `artifacts/${appId}/users/${userId}/billing/usage`);
            const unsubscribe = onSnapshot(billingDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setMonthlyPostCount(docSnap.data().currentMonthPosts || 0);
                    // setUserPlan(docSnap.data().plan || 'basic'); // If we were persisting plan
                } else {
                    setMonthlyPostCount(0);
                }
            });
            return () => unsubscribe();
        }
    }, [db, userId]);

    // Helper to increment usage
    const updateUserUsage = async () => {
        if (!db || !userId) return;
        const billingDocRef = doc(db, `artifacts/${appId}/users/${userId}/billing/usage`);
        try {
            // Atomic increment would be better, but for now simple set
            await setDoc(billingDocRef, {
                currentMonthPosts: monthlyPostCount + 1,
                lastUpdated: serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.error("Failed to update usage:", e);
        }
    };

    // Apply dark/light class to body/main container
    const containerClasses = `flex h-screen overflow-hidden transition-colors duration-300 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100`;

    // Helper function to render content based on view state
    // Helper function to render content based on view state
    const renderContent = () => {
        if (!isAuthReady) {
            return (
                <div className="flex flex-1 items-center justify-center">
                    <div className="text-xl font-semibold animate-pulse text-blue-600 dark:text-blue-400">
                        Initializing SocialConnectIQ...
                    </div>
                </div>
            );
        }

        // Priority 3: Full Screen Integration
        if (fullIntegration) {
            return <FullIntegrationView
                platformId={fullIntegration}
                onBack={handleIntegrationBack}
                onComplete={handleIntegrationComplete}
            />;
        }

        // Priority 4: Main Application Views
        switch (view) {
            case 'oauth_callback':
                return <OAuthCallback />;
            case 'dashboard':
                if (isAnonymous) {
                    return <LandingPage openLoginModal={() => setIsLoginModalOpen(true)} />;
                }
                return <DashboardContent
                    scheduledPosts={scheduledPosts}
                    integrationsRef={integrationsRef}
                    isTargetingIntegrations={isTargetingIntegrations}
                    openTrendingModal={openTrendingModal}
                    platformConnections={platformConnections}
                    onDeleteScheduledPost={handleDeleteScheduledPost}
                    userPlan={userPlan}
                />;
            case 'composer':
                return <ComposerContent
                    db={db}
                    userId={userId}
                    onCancel={() => setView('dashboard')}
                    isAnonymous={isAnonymous}
                    openLoginPrompt={() => setIsLoginModalOpen(true)}
                    userPlan={userPlan}
                    monthlyPostCount={monthlyPostCount}
                    scheduledPostsCount={scheduledPosts.length}
                    updateUserUsage={updateUserUsage}
                />;
            case 'billing':
                return <Billing
                    userPlan={userPlan}
                    monthlyPostCount={monthlyPostCount}
                    scheduledPostsCount={scheduledPosts.length}
                />;
            case 'analytics':
                return <AnalyticsDashboard />;
            case 'integrations_page':
                return <IntegrationsPageContent
                    setFullIntegration={setFullIntegration}
                    platformConnections={platformConnections} // Pass connection state
                    setPlatformConnections={setPlatformConnections} // Pass setter for disconnect
                    userId={userId}
                    isAnonymous={isAnonymous}
                />;
            case 'trending_panel':
                return <TrendingSidebarContent
                    openTrendingModal={openTrendingModal}
                    userId={userId}
                    db={db}
                />;
            case 'settings':
                return <SettingsContent
                    db={db}
                    userId={userId}
                    userName={userName}
                    userPhoto={userPhoto}
                    isAnonymous={isAnonymous}
                    handleLogout={handleLogout}
                    openLoginPrompt={() => setIsLoginModalOpen(true)}
                />;
            case 'profile':
                return <ProfileContent userId={userId} userName={userName} userPhoto={userPhoto} isAnonymous={isAnonymous} handleLogout={handleLogout} />;
            default:
                // Defaulting to DashboardContent
                return <DashboardContent
                    scheduledPosts={scheduledPosts}
                    integrationsRef={integrationsRef}
                    isTargetingIntegrations={isTargetingIntegrations}
                    openTrendingModal={openTrendingModal}
                    platformConnections={platformConnections}
                    onDeleteScheduledPost={handleDeleteScheduledPost}
                    userPlan={userPlan}
                />;
        }
    };

    return (
        <div className={containerClasses}>
            {/* Always Render Sidebar and TopBar if Auth is Ready */}
            {isAuthReady ? (
                <>
                    <Sidebar
                        handleNavClick={handleNavClick}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        view={view}
                    />
                    <main ref={mainContentRef} className="flex-1 flex flex-col overflow-y-auto">
                        <TopBar
                            userId={userId}
                            userName={userName}
                            userPhoto={userPhoto}
                            isAnonymous={isAnonymous}
                            handleLogout={handleLogout}
                            openComposer={() => handleNavClick('composer')}
                            openLoginModal={() => setIsLoginModalOpen(true)}
                            onProfileClick={() => handleNavClick('profile')}
                        />
                        {renderContent()}
                    </main>
                </>
            ) : (
                /* Loading State */
                renderContent()
            )}


            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
            />
            <TrendingAuthModal
                isOpen={isTrendingModalOpen}
                onClose={closeTrendingModal}
                platformId={modalPlatformId}
                onConnect={handleTrendingConnect}
            />
        </div>
    );
};

export default App;