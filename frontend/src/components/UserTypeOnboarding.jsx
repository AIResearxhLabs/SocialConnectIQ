import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
    Building2,
    User,
    ArrowRight,
    ArrowLeft,
    Briefcase,
    Target,
    Globe,
    Sparkles,
    CheckCircle2,
    X,
    ChevronDown,
} from 'lucide-react';

// Business categories list
const BUSINESS_CATEGORIES = [
    'Technology & SaaS',
    'E-commerce & Retail',
    'Healthcare & Wellness',
    'Finance & Banking',
    'Education & Training',
    'Marketing & Advertising',
    'Manufacturing & Industry',
    'Real Estate',
    'Food & Hospitality',
    'Entertainment & Media',
    'Professional Services',
    'Non-profit & NGO',
    'Other',
];

/**
 * UserTypeOnboarding - Full screen modal for selecting Personal vs Business account type.
 * Appears after authentication for first-time users who haven't set their account type yet.
 *
 * Props:
 *   - db: Firestore database instance
 *   - userId: Firebase user ID
 *   - onComplete: Callback after user completes onboarding
 *   - isDarkMode: current theme state
 */
const UserTypeOnboarding = ({ db, userId, onComplete, isDarkMode }) => {
    // Step: 'select' | 'business_form' | 'saving'
    const [step, setStep] = useState('select');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Business form state
    const [businessName, setBusinessName] = useState('');
    const [businessCategory, setBusinessCategory] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');

    // Handle personal account selection
    const handlePersonalSelect = async () => {
        setSaving(true);
        setError(null);
        try {
            const profileRef = doc(db, `users/${userId}/profile`, 'accountType');
            await setDoc(profileRef, {
                userType: 'personal',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }, { merge: true });
            console.log('✅ Personal account type saved');
            onComplete('personal');
        } catch (err) {
            console.error('❌ Error saving personal profile:', err);
            setError('Failed to save. Please try again.');
            setSaving(false);
        }
    };

    // Handle business form submission
    const handleBusinessSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!businessName.trim()) {
            setError('Business name is required.');
            return;
        }
        if (!businessCategory) {
            setError('Please select a business category.');
            return;
        }
        if (!targetAudience.trim()) {
            setError('Target audience description is required.');
            return;
        }

        setSaving(true);
        try {
            // Generate AI context prompt from business data
            const aiContextPrompt = `Business: ${businessName.trim()}. Industry: ${businessCategory}. Target audience: ${targetAudience.trim()}.${websiteUrl.trim() ? ` Website: ${websiteUrl.trim()}.` : ''} Create content that resonates with this audience and aligns with the brand voice.`;

            const profileRef = doc(db, `users/${userId}/profile`, 'accountType');
            await setDoc(profileRef, {
                userType: 'business',
                businessProfile: {
                    businessName: businessName.trim(),
                    category: businessCategory,
                    targetAudience: targetAudience.trim(),
                    websiteUrl: websiteUrl.trim() || null,
                    aiContextPrompt,
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }, { merge: true });
            console.log('✅ Business profile saved');
            onComplete('business');
        } catch (err) {
            console.error('❌ Error saving business profile:', err);
            setError('Failed to save. Please try again.');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            {/* Main Container */}
            <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 ${isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white'}`}>
                {/* Header */}
                <div className={`px-8 pt-8 pb-4 ${isDarkMode ? 'bg-gradient-to-r from-blue-900/50 to-purple-900/50' : 'bg-gradient-to-r from-blue-50 to-purple-50'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <Sparkles className="text-blue-500" size={28} />
                        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            How will you use SocialConnectIQ?
                        </h2>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {step === 'select'
                            ? 'Choose your account type to personalize your experience'
                            : 'Tell us about your business so our AI can create tailored content'}
                    </p>
                    {/* Step indicator for business */}
                    {step === 'business_form' && (
                        <div className="flex items-center gap-2 mt-3">
                            <div className="flex items-center gap-1">
                                <CheckCircle2 size={16} className="text-green-500" />
                                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Account Type</span>
                            </div>
                            <div className={`w-8 h-px ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                                    <span className="text-[10px] text-white font-bold">2</span>
                                </div>
                                <span className={`text-xs font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>Business Details</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error display */}
                {error && (
                    <div className="mx-8 mt-4 p-3 text-sm font-medium text-red-700 bg-red-100 dark:bg-red-900/50 dark:text-red-300 rounded-lg border border-red-300 dark:border-red-700 flex items-center gap-2">
                        <X size={16} />
                        {error}
                    </div>
                )}

                {/* Content Area */}
                <div className="p-8">
                    {/* Step 1: Type Selection */}
                    {step === 'select' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Personal Card */}
                            <button
                                onClick={handlePersonalSelect}
                                disabled={saving}
                                className={`group relative flex flex-col items-center p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-blue-500/30 ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                    } ${isDarkMode
                                        ? 'border-gray-700 hover:border-blue-500 bg-gray-800/50 hover:bg-gray-800'
                                        : 'border-gray-200 hover:border-blue-500 bg-white hover:bg-blue-50/50 shadow-sm hover:shadow-lg'
                                    }`}
                            >
                                {/* Icon */}
                                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-colors ${isDarkMode
                                        ? 'bg-blue-900/50 group-hover:bg-blue-800/70'
                                        : 'bg-blue-100 group-hover:bg-blue-200'
                                    }`}>
                                    <User size={36} className="text-blue-500" />
                                </div>
                                <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Personal
                                </h3>
                                <p className={`text-sm text-center leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Cross-platform posting for creators, influencers, and personal brands
                                </p>
                                {/* Features */}
                                <div className={`mt-4 w-full space-y-2 text-left text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                                        <span>Schedule across all platforms</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                                        <span>AI content suggestions</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                                        <span>Engagement analytics</span>
                                    </div>
                                </div>
                                {/* Arrow hint */}
                                <div className="mt-4 flex items-center gap-1 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-sm font-medium">Get Started</span>
                                    <ArrowRight size={16} />
                                </div>
                            </button>

                            {/* Business Card */}
                            <button
                                onClick={() => setStep('business_form')}
                                disabled={saving}
                                className={`group relative flex flex-col items-center p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-purple-500/30 ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                    } ${isDarkMode
                                        ? 'border-gray-700 hover:border-purple-500 bg-gray-800/50 hover:bg-gray-800'
                                        : 'border-gray-200 hover:border-purple-500 bg-white hover:bg-purple-50/50 shadow-sm hover:shadow-lg'
                                    }`}
                            >
                                {/* Recommended badge */}
                                <div className="absolute -top-3 right-4">
                                    <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full shadow-lg">
                                        Recommended
                                    </span>
                                </div>
                                {/* Icon */}
                                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-colors ${isDarkMode
                                        ? 'bg-purple-900/50 group-hover:bg-purple-800/70'
                                        : 'bg-purple-100 group-hover:bg-purple-200'
                                    }`}>
                                    <Building2 size={36} className="text-purple-500" />
                                </div>
                                <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Business
                                </h3>
                                <p className={`text-sm text-center leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    AI-powered content tailored for your brand, audience, and industry
                                </p>
                                {/* Features */}
                                <div className={`mt-4 w-full space-y-2 text-left text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                                        <span>Everything in Personal</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={14} className="text-purple-500 flex-shrink-0" />
                                        <span>AI trained on your business</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={14} className="text-purple-500 flex-shrink-0" />
                                        <span>Target audience optimization</span>
                                    </div>
                                </div>
                                {/* Arrow hint */}
                                <div className="mt-4 flex items-center gap-1 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-sm font-medium">Set Up Business</span>
                                    <ArrowRight size={16} />
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Step 2: Business Details Form */}
                    {step === 'business_form' && (
                        <form onSubmit={handleBusinessSubmit} className="space-y-5">
                            {/* Business Name */}
                            <div>
                                <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    <Briefcase size={16} className="text-purple-500" />
                                    Business Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="e.g., Acme Corp, The Coffee House"
                                    required
                                    className={`w-full px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-purple-500 focus:border-transparent ${isDarkMode
                                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                        }`}
                                />
                            </div>

                            {/* Business Category */}
                            <div>
                                <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    <Building2 size={16} className="text-purple-500" />
                                    Business Category <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={businessCategory}
                                        onChange={(e) => setBusinessCategory(e.target.value)}
                                        required
                                        className={`w-full px-4 py-3 rounded-xl border appearance-none transition-all focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10 ${isDarkMode
                                                ? 'bg-gray-800 border-gray-700 text-white'
                                                : 'bg-white border-gray-300 text-gray-900'
                                            } ${!businessCategory ? (isDarkMode ? 'text-gray-500' : 'text-gray-400') : ''}`}
                                    >
                                        <option value="" disabled>Select your industry</option>
                                        {BUSINESS_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                </div>
                            </div>

                            {/* Target Audience */}
                            <div>
                                <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    <Target size={16} className="text-purple-500" />
                                    Target Audience <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={targetAudience}
                                    onChange={(e) => setTargetAudience(e.target.value)}
                                    placeholder="Describe your ideal customers, e.g., 'Small business owners aged 25-45 who want to automate their social media presence'"
                                    required
                                    rows={3}
                                    className={`w-full px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${isDarkMode
                                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                        }`}
                                />
                                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                    This helps our AI create content that resonates with your audience
                                </p>
                            </div>

                            {/* Website URL (Optional) */}
                            <div>
                                <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    <Globe size={16} className="text-purple-500" />
                                    Website URL <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>(optional)</span>
                                </label>
                                <input
                                    type="url"
                                    value={websiteUrl}
                                    onChange={(e) => setWebsiteUrl(e.target.value)}
                                    placeholder="https://www.yourbusiness.com"
                                    className={`w-full px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-purple-500 focus:border-transparent ${isDarkMode
                                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                        }`}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setStep('select'); setError(null); }}
                                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${isDarkMode
                                            ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <ArrowLeft size={18} />
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all ${saving
                                            ? 'bg-purple-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50'
                                        }`}
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Setting up your business...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={18} />
                                            Launch with AI-Powered Content
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer note */}
                <div className={`px-8 pb-6 text-center ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    <p className="text-xs">
                        You can change your account type anytime from Settings
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UserTypeOnboarding;
