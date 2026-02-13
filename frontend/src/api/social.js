import { auth } from '../firebase';
import { buildBackendUrl, buildGatewayUrl, buildAgentUrl, API_CONFIG } from '../config/api.config';

// Generate a unique correlation ID for request tracing
const generateCorrelationId = () => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

// Helper to get current user ID and token
const getUserAuth = async () => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }
    const token = await user.getIdToken();
    return { userId: user.uid, token };
};

// Helper to create headers with authentication and correlation ID
const createHeaders = async (correlationId) => {
    const { userId, token } = await getUserAuth();
    const reqId = correlationId || generateCorrelationId();

    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-User-ID': userId,
        'X-Correlation-ID': reqId,
    };
};

// ============================================================
// LINKEDIN INTEGRATION
// ============================================================

export const authenticateLinkedIn = async () => {
    const correlationId = generateCorrelationId();

    console.log('\n' + '='.repeat(80));
    console.log(`🔵 [FRONTEND] Starting LinkedIn Authentication`);
    console.log(`🆔 [FRONTEND] Correlation ID: ${correlationId}`);
    console.log('='.repeat(80));

    try {
        const headers = await createHeaders(correlationId);
        const url = buildBackendUrl('api/integrations/linkedin/auth');
        console.log(`📍 [FRONTEND] Fetching: ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers,
        });

        console.log(`📦 [FRONTEND] Response Status: ${response.status}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to authenticate with LinkedIn');
        }

        const data = await response.json();
        console.log('✅ [FRONTEND] Auth URL received');
        return data.auth_url;
    } catch (error) {
        console.error('❌ [FRONTEND] Exception in authenticateLinkedIn:', error);
        throw error;
    }
};

export const getLinkedInStatus = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/linkedin/status');

    const response = await fetch(url, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error('Failed to get LinkedIn status');
    }

    return response.json();
};

export const postToLinkedIn = async (content, imageData, imageMimeType) => {
    const { userId } = await getUserAuth();
    const headers = await createHeaders();

    // Use different endpoint based on whether image is included
    const hasImage = imageData && imageData.length > 0;
    const endpoint = hasImage
        ? 'api/integrations/linkedin/post-with-image'
        : 'api/integrations/linkedin/post';
    const url = buildBackendUrl(endpoint);

    console.log(`📤 [FRONTEND] Posting to LinkedIn ${hasImage ? 'WITH IMAGE' : 'text only'}`);

    const body = hasImage
        ? {
            content,
            user_id: userId,
            image_data: imageData,
            image_mime_type: imageMimeType,
        }
        : {
            content,
            user_id: userId,
        };

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to post to LinkedIn');
    }

    return response.json();
};

export const disconnectLinkedIn = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/linkedin/disconnect');

    const response = await fetch(url, {
        method: 'DELETE',
        headers,
    });

    if (!response.ok) {
        throw new Error('Failed to disconnect LinkedIn');
    }

    return response.json();
};

/**
 * Delete a post from LinkedIn using the post URN
 * @param {string} platformPostId - The LinkedIn post URN (e.g., "urn:li:share:123456")
 * @returns {Promise<{success: boolean, message: string, post_id: string}>}
 */
export const deleteFromLinkedIn = async (platformPostId) => {
    const correlationId = generateCorrelationId();
    const headers = await createHeaders(correlationId);

    // Use POST endpoint with body to avoid URL path issues with URN colons
    const url = buildBackendUrl('api/integrations/linkedin/delete');

    console.log('\n' + '='.repeat(80));
    console.log(`🗑️ [FRONTEND] Deleting LinkedIn Post`);
    console.log(`🆔 [FRONTEND] Correlation ID: ${correlationId}`);
    console.log(`📝 [FRONTEND] Post ID: ${platformPostId}`);
    console.log('='.repeat(80));

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ post_id: platformPostId }),
    });

    console.log(`📦 [FRONTEND] Response Status: ${response.status}`);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete post from LinkedIn');
    }

    const result = await response.json();
    console.log('✅ [FRONTEND] Delete response:', result);
    return result;
};

// ============================================================
// FACEBOOK INTEGRATION
// ============================================================

export const authenticateFacebook = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/facebook/auth');

    const response = await fetch(url, {
        method: 'POST',
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to authenticate with Facebook');
    }

    const data = await response.json();
    return data.auth_url;
};

export const getFacebookStatus = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/facebook/status');

    const response = await fetch(url, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error('Failed to get Facebook status');
    }

    return response.json();
};

export const postToFacebook = async (content, imageData, imageMimeType) => {
    const { userId } = await getUserAuth();
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/facebook/post');

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            content,
            user_id: userId,
            image_data: imageData,
            image_mime_type: imageMimeType,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to post to Facebook');
    }

    return response.json();
};

export const disconnectFacebook = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/facebook/disconnect');

    const response = await fetch(url, {
        method: 'DELETE',
        headers,
    });

    if (!response.ok) {
        throw new Error('Failed to disconnect Facebook');
    }

    return response.json();
};

// ============================================================
// TWITTER INTEGRATION
// ============================================================

export const authenticateTwitter = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/twitter/auth');

    const response = await fetch(url, {
        method: 'POST',
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to authenticate with Twitter');
    }

    const data = await response.json();
    return data.auth_url;
};

export const getTwitterStatus = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/twitter/status');

    const response = await fetch(url, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error('Failed to get Twitter status');
    }

    return response.json();
};

export const postToTwitter = async (content, imageData, imageMimeType) => {
    const correlationId = generateCorrelationId();
    const { userId } = await getUserAuth();
    const headers = await createHeaders(correlationId);
    const url = buildBackendUrl('api/integrations/twitter/post');

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            content,
            user_id: userId,
            image_data: imageData,
            image_mime_type: imageMimeType,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to post to Twitter');
    }

    return response.json();
};

export const disconnectTwitter = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/twitter/disconnect');

    const response = await fetch(url, {
        method: 'DELETE',
        headers,
    });

    if (!response.ok) {
        throw new Error('Failed to disconnect Twitter');
    }

    return response.json();
};

// ============================================================
// INSTAGRAM INTEGRATION
// ============================================================

export const authenticateInstagram = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/instagram/auth');

    const response = await fetch(url, {
        method: 'POST',
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to authenticate with Instagram');
    }

    const data = await response.json();
    return data.auth_url;
};

export const getInstagramStatus = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/instagram/status');

    const response = await fetch(url, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error('Failed to get Instagram status');
    }

    return response.json();
};

export const postToInstagram = async (content, imageData, imageMimeType) => {
    const { userId } = await getUserAuth();
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/instagram/post');

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            content,
            user_id: userId,
            image_data: imageData,
            image_mime_type: imageMimeType,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to post to Instagram');
    }

    return response.json();
};

export const disconnectInstagram = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/instagram/disconnect');

    const response = await fetch(url, {
        method: 'DELETE',
        headers,
    });

    if (!response.ok) {
        throw new Error('Failed to disconnect Instagram');
    }

    return response.json();
};

// ============================================================
// WHATSAPP INTEGRATION
// ============================================================

export const authenticateWhatsApp = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/whatsapp/auth');

    const response = await fetch(url, {
        method: 'POST',
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to authenticate with WhatsApp');
    }

    const data = await response.json();
    return data.auth_url;
};

export const sendWhatsAppOTP = async (mobileNumber) => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/whatsapp/send-otp');

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ mobile_number: mobileNumber }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send WhatsApp OTP');
    }

    return response.json();
};

export const verifyWhatsAppOTP = async (mobileNumber, otp) => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/whatsapp/verify-otp');

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ mobile_number: mobileNumber, otp }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to verify WhatsApp OTP');
    }

    return response.json();
};

export const getWhatsAppStatus = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/whatsapp/status');

    const response = await fetch(url, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error('Failed to get WhatsApp status');
    }

    return response.json();
};

export const disconnectWhatsApp = async () => {
    const headers = await createHeaders();
    const url = buildBackendUrl('api/integrations/whatsapp/disconnect');

    const response = await fetch(url, {
        method: 'DELETE',
        headers,
    });

    if (!response.ok) {
        throw new Error('Failed to disconnect WhatsApp');
    }

    return response.json();
};

// ============================================================
// GENERIC FUNCTIONS
// ============================================================

/**
 * Get status for all platforms at once
 */
export const getAllIntegrationsStatus = async () => {
    const user = auth.currentUser;
    if (!user) {
        return {
            linkedin: { connected: false },
            facebook: { connected: false },
            twitter: { connected: false },
            instagram: { connected: false },
            whatsapp: { connected: false },
        };
    }

    try {
        const [linkedin, facebook, twitter, instagram, whatsapp] = await Promise.allSettled([
            getLinkedInStatus(),
            getFacebookStatus(),
            getTwitterStatus(),
            getInstagramStatus(),
            getWhatsAppStatus(),
        ]);

        return {
            linkedin: linkedin.status === 'fulfilled' ? linkedin.value : { connected: false },
            facebook: facebook.status === 'fulfilled' ? facebook.value : { connected: false },
            twitter: twitter.status === 'fulfilled' ? twitter.value : { connected: false },
            instagram: instagram.status === 'fulfilled' ? instagram.value : { connected: false },
            whatsapp: whatsapp.status === 'fulfilled' ? whatsapp.value : { connected: false },
        };
    } catch (error) {
        console.error('Error fetching integration statuses:', error);
        return {
            linkedin: { connected: false },
            facebook: { connected: false },
            twitter: { connected: false },
            instagram: { connected: false },
            whatsapp: { connected: false },
        };
    }
};

/**
 * Refine content using AI
 */
export const refineContent = async (originalContent, refinementInstructions, tone, platform, generateAlternatives = false) => {
    const correlationId = generateCorrelationId();
    const headers = await createHeaders(correlationId);
    const url = buildGatewayUrl('api/integrations/content/refine');

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            original_content: originalContent,
            refinement_instructions: refinementInstructions,
            tone,
            platform,
            generate_alternatives: generateAlternatives,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to refine content');
    }

    return response.json();
};

/**
 * Preview post on multiple platforms
 */
export const previewPost = async (content, platforms, imageData, imageMimeType) => {
    const correlationId = generateCorrelationId();
    const headers = await createHeaders(correlationId);
    const url = buildGatewayUrl('api/integrations/preview');

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            content,
            platforms,
            image_data: imageData,
            image_mime_type: imageMimeType,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate preview');
    }

    return response.json();
};

/**
 * Chat with AI to write, refine, post, or schedule content
 * @param {string} message - User's chat message
 * @param {string} currentContent - Current post content for context
 * @param {Array} conversationHistory - Previous messages in the conversation
 * @param {Array} selectedPlatforms - Platforms currently selected in UI
 * @param {Array} connectedPlatforms - Platforms user has connected
 * @returns {Promise<{success: boolean, reply: string, suggested_content?: string, action?: string, action_result?: object}>}
 */
export const chatWithAI = async (message, currentContent, conversationHistory = [], selectedPlatforms = [], connectedPlatforms = [], imageData = null, imageMimeType = null) => {
    const correlationId = generateCorrelationId();
    const { userId } = await getUserAuth();
    const headers = await createHeaders(correlationId);

    // Use agent-service directly for AI chat
    const AGENT_SERVICE_URL = API_CONFIG.AGENT_SERVICE_URL || 'http://localhost:8006';
    const url = `${AGENT_SERVICE_URL}/agent/chat`;

    console.log(`💬 [FRONTEND] Sending chat to AI: "${message.substring(0, 50)}..."`);
    if (imageData) console.log(`🖼️ [FRONTEND] Including image in AI request (${imageMimeType})`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                user_id: userId,
                message,
                current_content: currentContent || '',
                conversation_history: conversationHistory.map(m => ({
                    role: m.role,
                    content: m.content
                })),
                selected_platforms: selectedPlatforms,
                connected_platforms: connectedPlatforms,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                image_data: imageData,
                image_mime_type: imageMimeType
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ [FRONTEND] AI Chat error:', errorData);
            return {
                success: false,
                reply: errorData.detail || 'Failed to get AI response'
            };
        }

        const data = await response.json();
        console.log('✅ [FRONTEND] AI Chat response received', data.action ? `(action: ${data.action})` : '');
        return {
            success: true,
            reply: data.reply || data.message || 'AI response received',
            suggested_content: data.suggested_content,
            suggested_platforms: data.suggested_platforms || null,
            action: data.action,
            action_result: data.action_result
        };
    } catch (error) {
        console.error('❌ [FRONTEND] AI Chat exception:', error);
        return {
            success: false,
            reply: `Connection error: ${error.message}`
        };
    }
};


/**
 * Refine content for a specific platform with a specific tone
 * @param {string} content - Content to refine
 * @param {string} platform - Target platform (linkedin, twitter, etc.)
 * @param {string} tone - Desired tone (professional, casual, etc.)
 * @returns {Promise<{success: boolean, refined_content?: string, error?: string}>}
 */
export const refineTone = async (content, platform, tone) => {
    const correlationId = generateCorrelationId();
    const { userId } = await getUserAuth();
    const headers = await createHeaders(correlationId);

    const AGENT_SERVICE_URL = API_CONFIG.AGENT_SERVICE_URL || 'http://localhost:8006';
    const url = `${AGENT_SERVICE_URL}/agent/refine-tone`;

    console.log(`🎨 [FRONTEND] Refining tone: platform=${platform}, tone=${tone}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                user_id: userId,
                content,
                platform,
                tone,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return { success: false, error: errorData.detail || 'Failed to refine tone' };
        }

        const data = await response.json();
        console.log(`✅ [FRONTEND] Tone refinement complete for ${platform}`);
        return data;
    } catch (error) {
        console.error('❌ [FRONTEND] Refine tone exception:', error);
        return { success: false, error: error.message };
    }
};


// ============================================================
// TRENDING TOPICS
// ============================================================

/**
 * Fetch personalized trending topics based on user's interests
 * @param {boolean} forceRefresh - Bypass cache and generate fresh content
 * @param {number} count - Number of topics to fetch (default 10)
 * @returns {Promise<{success: boolean, topics: Array, cached: boolean, error?: string}>}
 */
export const fetchTrendingTopics = async (forceRefresh = false, count = 10) => {
    const correlationId = generateCorrelationId();

    console.log('\n' + '='.repeat(80));
    console.log(`🔥 [FRONTEND] Fetching Trending Topics`);
    console.log(`🆔 [FRONTEND] Correlation ID: ${correlationId}`);
    console.log(`📋 [FRONTEND] Force Refresh: ${forceRefresh}, Count: ${count}`);
    console.log('='.repeat(80));

    try {
        const { userId } = await getUserAuth();
        const headers = await createHeaders(correlationId);

        const params = new URLSearchParams({
            force_refresh: forceRefresh.toString(),
            count: count.toString()
        });

        const url = buildAgentUrl(`trending/${userId}?${params}`);
        console.log(`📍 [FRONTEND] Fetching: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ [FRONTEND] Trending Topics error:', data);
            return {
                success: false,
                topics: [],
                cached: false,
                error: data.error || data.detail || 'Failed to fetch trending topics'
            };
        }

        console.log(`✅ [FRONTEND] Trending Topics fetched: ${data.topics?.length || 0} topics (cached: ${data.cached})`);
        return {
            success: true,
            topics: data.topics || [],
            cached: data.cached || false,
            error: null
        };
    } catch (error) {
        console.error('❌ [FRONTEND] Trending Topics exception:', error);
        return {
            success: false,
            topics: [],
            cached: false,
            error: `Connection error: ${error.message}`
        };
    }
};

/**
 * Clear the trending topics cache
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export const clearTrendingCache = async () => {
    const correlationId = generateCorrelationId();

    try {
        const headers = await createHeaders(correlationId);
        const url = buildAgentUrl('trending/clear-cache');

        const response = await fetch(url, {
            method: 'POST',
            headers
        });

        const data = await response.json();
        console.log('🧹 [FRONTEND] Trending cache cleared:', data);
        return data;
    } catch (error) {
        console.error('❌ [FRONTEND] Clear cache error:', error);
        return { success: false, error: error.message };
    }
};
