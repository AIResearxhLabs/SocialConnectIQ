
import React from 'react';
import { Check, X } from 'lucide-react';

const Billing = ({ userPlan, monthlyPostCount, scheduledPostsCount }) => {
    const plans = [
        {
            name: 'Basic',
            price: '$0',
            features: [
                '2 Scheduled Posts',
                '14 Monthly Posts',
                'AI Content Generation (100 words)',
                'All Tones Available',
                'Ads Supported'
            ],
            missing: [
                'Unlimited Scheduled Posts',
                'Unlimited Monthly Posts',
                'Advanced Analytics',
                'Team Collaboration'
            ],
            current: userPlan === 'basic'
        },
        {
            name: 'Pro',
            price: '$29',
            features: [
                'Unlimited Scheduled Posts',
                'Unlimited Monthly Posts',
                'AI Content Generation (Unlimited)',
                'All Tones Available',
                'Ad-Free Experience',
                'Advanced Analytics'
            ],
            missing: [
                'Team Collaboration'
            ],
            current: userPlan === 'pro'
        }
    ];

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Billing & Plans</h1>

            {/* Usage Stats for Basic Plan */}
            {userPlan === 'basic' && (
                <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Current Usage (Basic Plan)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Posts</span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{monthlyPostCount} / 14</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min((monthlyPostCount / 14) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Scheduled Posts</span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{scheduledPostsCount} / 2</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${Math.min((scheduledPostsCount / 2) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                {plans.map((plan) => (
                    <div key={plan.name} className={`relative p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-2 ${plan.current ? 'border-blue-500 transform scale-105' : 'border-gray-100 dark:border-gray-700'}`}>
                        {plan.current && (
                            <span className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                                CURRENT PLAN
                            </span>
                        )}
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                        <div className="my-4">
                            <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">{plan.price}</span>
                            <span className="text-gray-500 dark:text-gray-400">/month</span>
                        </div>
                        <ul className="space-y-3 mb-8">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-center text-gray-700 dark:text-gray-300">
                                    <Check className="w-5 h-5 text-green-500 mr-2" />
                                    {feature}
                                </li>
                            ))}
                            {plan.missing.map((feature, i) => (
                                <li key={i} className="flex items-center text-gray-400 dark:text-gray-600">
                                    <X className="w-5 h-5 mr-2" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <button
                            disabled={plan.current}
                            className={`w-full py-3 rounded-xl font-bold transition-colors ${plan.current
                                ? 'bg-gray-100 text-gray-400 cursor-default dark:bg-gray-700 dark:text-gray-500'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                                }`}
                        >
                            {plan.current ? 'Active' : 'Upgrade'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Billing;
