
import React from 'react';

const AdBanner = ({ userPlan, isSidebar = false, isCollapsed = false }) => {
    if (userPlan !== 'basic') return null;

    if (isSidebar) {
        if (isCollapsed) {
            return (
                <div className="mx-auto w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg cursor-pointer" title="Upgrade to Pro">
                    <span className="font-bold text-xs">UP</span>
                </div>
            );
        }
        return (
            <div className="w-full p-3 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg text-white text-center relative overflow-hidden group cursor-pointer transition-transform hover:scale-105">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 w-12 h-12 bg-white opacity-20 rounded-full blur-xl transform group-hover:scale-150 transition-transform"></div>
                <p className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">Upgrade to Pro</p>
                <div className="text-sm font-extrabold mb-2 leading-tight">
                    Remove Ads &<br />Unlock AI
                </div>
                <button className="px-3 py-1 bg-white text-indigo-600 text-xs font-bold rounded-full shadow-sm hover:bg-gray-50 transition-colors">
                    Upgrade Now
                </button>
            </div>
        );
    }

    // Dashboard Banner
    return (
        <div className="w-full p-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-xl shadow-lg mb-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
                {/* Decorative background blur */}
                <div className="absolute -left-10 -top-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center gap-4 z-10">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white shadow-md shrink-0">
                        <span className="text-xl">💎</span>
                    </div>
                    <div className="text-center sm:text-left">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Unlock Full Potential</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Get unlimited posts, AI writing assistant, and advanced analytics.
                        </p>
                    </div>
                </div>
                <button className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg shadow-md transition-all transform hover:-translate-y-0.5 z-10 whitespace-nowrap">
                    Upgrade to Pro
                </button>
            </div>
        </div>
    );
};

export default AdBanner;


