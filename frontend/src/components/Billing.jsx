
import React from 'react';
import { Check, X, Zap, Star, Briefcase } from 'lucide-react';

const Billing = ({ userPlan, monthlyPostCount, scheduledPostsCount }) => {
    const handleUpgrade = (planId) => {
        if (planId === 'enterprise') {
            window.location.href = 'mailto:sales@socialconnectiq.com?subject=Enterprise Plan Inquiry';
            return;
        }
        alert(`Upgrade to ${planId} functionality would connect to a payment gateway here.`);
    };

    const handleAddPaymentMethod = () => {
        alert("This would open a secure payment gateway integration.");
    };

    const plans = [
        {
            id: 'basic',
            name: 'Basic',
            price: '₹0',
            period: '/ month',
            description: 'Essential tools for individuals starting out.',
            features: [
                { name: 'Unlimited Social Accounts', included: true },
                { name: '2 Scheduled Posts', included: true },
                { name: '14 Monthly Posts', included: true },
                { name: 'Basic Analytics', included: true },
                { name: 'AI Content (100 words)', included: true },
                { name: 'Ad-Supported', included: true },
                { name: 'Limited AI Tones', included: true },
                { name: 'Platform based AI drafting', included: false },
                { name: 'Priority Support', included: false },
            ],
            missing: [
                'Unlimited Posts',
                'Advanced Analytics'
            ],
            icon: Zap,
            color: 'text-gray-500',
            buttonVariant: 'secondary',
        },
        {
            id: 'pro',
            name: 'Pro',
            price: '₹999',
            period: '/ month',
            description: 'Perfect for creators and small businesses.',
            features: [
                { name: 'Unlimited Social Accounts', included: true },
                { name: '15 Scheduled Posts', included: true },
                { name: '35 Monthly Posts', included: true },
                { name: 'Advanced Analytics', included: true },
                { name: 'AI Content (1000 words)', included: true },
                { name: 'All AI Tones', included: true },
                { name: 'Platform based AI drafting', included: true },
                { name: 'Ad-Free Experience', included: true },
                { name: 'Priority Support', included: true },
            ],
            missing: [],
            icon: Star,
            color: 'text-blue-600',
            buttonVariant: 'primary',
            badge: 'Most Popular'
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            price: '₹4,999',
            period: '/ month',
            description: 'Advanced features for large teams and agencies.',
            features: [
                { name: 'Unlimited Everything', included: true },
                { name: 'Unlimited Social Accounts', included: true },
                { name: 'Custom Integrations', included: true },
                { name: 'White-label Reports', included: true },
                { name: 'Advanced AI Features', included: true },
                { name: 'All AI Tones', included: true },
                { name: 'Platform based AI drafting', included: true },
                { name: 'Dedicated Account Manager', included: true },
            ],
            missing: [],
            icon: Briefcase,
            color: 'text-purple-600',
            buttonVariant: 'secondary',
        }
    ];

    // Mock Billing History
    const billingHistory = [
        // Example data - empty for new users
    ];

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">
                    Billing & Subscription
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Manage your plan, billing details, and invoices.
                </p>
            </div>

            {/* Usage Stats for Basic Plan */}
            {userPlan === 'basic' && (
                <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        Current Usage (Basic Plan)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Posts</span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{monthlyPostCount} / 14</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden">
                                <div className={`h-3 rounded-full transition-all duration-500 ${monthlyPostCount >= 14 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${Math.min((monthlyPostCount / 14) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Scheduled Posts</span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{scheduledPostsCount} / 2</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden">
                                <div className={`h-3 rounded-full transition-all duration-500 ${scheduledPostsCount >= 2 ? 'bg-red-500' : 'bg-purple-600'}`} style={{ width: `${Math.min((scheduledPostsCount / 2) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                    const isCurrent = userPlan === plan.id;
                    return (
                        <div
                            key={plan.id}
                            className={`relative rounded-2xl flex flex-col p-6 transition-all duration-200 ${isCurrent
                                ? 'bg-white dark:bg-gray-800 border-2 border-blue-600 shadow-xl scale-105 z-10'
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md opacity-90 hover:opacity-100'
                                }`}
                        >
                            {plan.badge && (
                                <div className="absolute top-0 right-0 left-0 flex justify-center -mt-3">
                                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-sm">
                                        {plan.badge}
                                    </span>
                                </div>
                            )}

                            <div className="mb-5">
                                <div className={`p-3 rounded-xl inline-block mb-4 ${isCurrent ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700/50'}`}>
                                    <plan.icon size={32} className={plan.color} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 h-10">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                                <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">{plan.price}</span>
                                <span className="text-gray-500 dark:text-gray-400 font-medium">{plan.period}</span>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start text-sm">
                                        {feature.included ? (
                                            <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                                        ) : (
                                            <X className="w-5 h-5 text-gray-300 dark:text-gray-600 mr-2 flex-shrink-0" />
                                        )}
                                        <span className={feature.included ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
                                            {feature.name}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleUpgrade(plan.id)}
                                disabled={isCurrent}
                                className={`w-full py-3 rounded-xl font-bold transition-colors ${isCurrent
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 cursor-default'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {isCurrent ? 'Current Plan' : plan.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Payment & History */}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6">Payment & History</h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Payment Method Section */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm flex flex-col justify-center items-center text-center h-full min-h-[200px]">
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-full mb-4">
                            {/* CreditCard Icon Placeholder */}
                            <div className="w-8 h-8 bg-gray-400 rounded-md"></div>
                        </div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">No Payment Method</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
                            Add a payment method to upgrade your plan and unlock premium features.
                        </p>
                        <button
                            onClick={handleAddPaymentMethod}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center"
                        >
                            Add Payment Method
                        </button>
                    </div>

                    {/* Billing History Section */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Billing History</h4>
                        </div>
                        <div className="flex-1 flex flex-col justify-center items-center text-center py-8">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No billing history available yet.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Billing;
