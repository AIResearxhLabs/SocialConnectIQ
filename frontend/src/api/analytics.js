
const ANALYTICS_SERVICE_URL = 'http://localhost:8004';

/**
 * Fetch comprehensive analytics overview
 * @returns {Promise<Object>} Analytics data including overview, trends, and platform stats
 */
export const fetchAnalyticsOverview = async () => {
    try {
        // Get user ID from localStorage for real data fetching
        const userId = localStorage.getItem('userId') || localStorage.getItem('user_id');
        console.log('[Analytics API] Fetching overview for User ID:', userId);

        const headers = {};
        if (userId) {
            headers['X-User-ID'] = userId;
        } else {
            console.warn('[Analytics API] No User ID found in localStorage');
        }

        const response = await fetch(`${ANALYTICS_SERVICE_URL}/analytics/overview`, {
            headers
        });

        console.log('[Analytics API] Response Status:', response.status);

        if (!response.ok) {
            throw new Error(`Analytics Service Error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Analytics API] Data received:', data);
        return data;
    } catch (error) {
        console.error("Failed to fetch analytics:", error);
        throw error;
    }
};
