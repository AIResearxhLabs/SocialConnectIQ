import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '', // Use relative path to leverage Vite proxy
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 60000, // 60 seconds default timeout
});

// Add a request interceptor to inject x-user-id
api.interceptors.request.use(
    (config) => {
        // Allow explicit override
        if (config.headers['x-user-id']) {
            return config;
        }

        // In a real app, this would come from an auth context.
        // For now, we reuse the logic from App.jsx or generate a persistent one.
        // We'll try to get it from localStorage or generate a temp one.
        let userId = localStorage.getItem('social_connect_user_id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('social_connect_user_id', userId);
        }

        config.headers['x-user-id'] = userId;
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
