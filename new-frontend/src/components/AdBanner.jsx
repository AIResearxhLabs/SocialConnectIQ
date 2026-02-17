
import React from 'react';

const AdBanner = () => {
    return (
        <div className="w-full p-4 my-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ad</span>
            <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Upgrade to Pro for Ad-Free Experience!
            </div>
            <button className="mt-2 px-4 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                Learn More
            </button>
        </div>
    );
};

export default AdBanner;
