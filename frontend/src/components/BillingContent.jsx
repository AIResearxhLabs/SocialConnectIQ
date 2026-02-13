import React from 'react';
import { CreditCard, CheckCircle, Clock, Download, Shield, Check, X as XIcon, Zap, Star, Briefcase } from 'lucide-react';

const BillingContent = () => {
    const [currentPlanId, setCurrentPlanId] = React.useState('basic');

    const handleUpgrade = (planId) => {
        if (planId === 'enterprise') {
            window.location.href = 'mailto:sales@socialconnectiq.com?subject=Enterprise Plan Inquiry';
            return;
        }
        if (confirm(`Are you sure you want to switch to the ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan? This is a demo action.`)) {
            setCurrentPlanId(planId);
        }
    };

    const handleAddPaymentMethod = () => {
        alert("This would open a secure payment gateway integration in a production environment.");
    };

    const plans = [
        {
            id: 'basic',
            name: 'Basic',
            price: '₹0',
            period: '/ month',
            description: 'Essential tools for individuals starting out.',
            features: [
                { name: '3 Social Accounts', included: true },
                { name: '10 Scheduled Posts', included: true },
                { name: 'Basic Analytics', included: true },
                { name: 'AI Content Generation', included: false },
                { name: 'Platform based AI drafting', included: false },
                { name: 'Team Collaboration', included: false },
                { name: 'Priority Support', included: false },
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
                { name: 'Unlimited Scheduled Posts', included: true },
                { name: 'Advanced Analytics', included: true },
                { name: 'AI Content Generation', included: true },
                { name: 'Platform based AI drafting', included: true },
                { name: 'Team Collaboration', included: false },
                { name: 'Priority Support', included: true },
            ],
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
                { name: 'Custom Integrations', included: true },
                { name: 'White-label Reports', included: true },
                { name: 'AI Content Generation', included: true },
                { name: 'Platform based AI drafting', included: true },
                { name: 'Team Collaboration', included: true },
                { name: 'Dedicated Account Manager', included: true },
            ],
            icon: Briefcase,
            color: 'text-purple-600',
            buttonVariant: 'secondary',
        }
    ];

    // Empty for new user
    const billingHistory = [];

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">

            {/* Header */}
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">
                    Billing & Subscription
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Manage your plan, billing details, and invoices.
                </p>
            </div>

            {/* Pricing Plans Table */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                    const isCurrent = currentPlanId === plan.id;
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
                                    <plan.icon size={24} className={plan.color} />
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
                                            <CheckCircle size={18} className="text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <XIcon size={18} className="text-gray-300 dark:text-gray-600 mr-2 flex-shrink-0 mt-0.5" />
                                        )}
                                        <span className={feature.included ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
                                            {feature.name}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleUpgrade(plan.id)}
                                className={`w-full py-3 rounded-xl font-bold transition-colors ${isCurrent
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 cursor-default'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                disabled={isCurrent}
                            >
                                {isCurrent ? 'Current Plan' : plan.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6">Payment & History</h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Payment Method Section - New User State */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm flex flex-col justify-center items-center text-center h-full min-h-[200px]">
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-full mb-4">
                            <CreditCard size={32} className="text-gray-400 dark:text-gray-500" />
                        </div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">No Payment Method</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
                            Add a payment method to upgrade your plan and unlock premium features.
                        </p>
                        <button
                            onClick={handleAddPaymentMethod}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center"
                        >
                            <CreditCard size={18} className="mr-2" />
                            Add Payment Method
                        </button>
                    </div>

                    {/* Billing History Section - New User State */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Billing History</h4>
                        </div>

                        {billingHistory.length > 0 ? (
                            <div className="overflow-x-auto -mx-6 px-6">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700">
                                            <th className="py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                            <th className="py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                            <th className="py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                            <th className="py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Invoice</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {billingHistory.map((item) => (
                                            <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                                                <td className="py-3 text-sm text-gray-900 dark:text-gray-100">{item.date}</td>
                                                <td className="py-3 text-sm text-gray-900 dark:text-gray-100">{item.amount}</td>
                                                <td className="py-3">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <button className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                                        <Download size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col justify-center items-center text-center py-8">
                                <Clock size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No billing history available yet.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BillingContent;
