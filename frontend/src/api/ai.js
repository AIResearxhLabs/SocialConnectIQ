import axios from 'axios';

const AGENT_SERVICE_URL = 'http://localhost:8006';

export const aiService = {
    /**
     * Refine content using AI based on tone and platform
     * @param {string} content - The original content to refine
     * @param {string} userId - The user's ID
     * @param {string} tone - The desired tone (e.g., 'Professional', 'Casual')
     * @param {string} platform - The target platform (optional)
     * @param {string} instructions - Specific instructions (optional)
     * @returns {Promise<Object>} - The refinement result
     */
    refineContent: async (content, userId, tone, platform = null, instructions = null) => {
        try {
            const response = await axios.post(`${AGENT_SERVICE_URL}/agent/content/refine`, {
                user_id: userId,
                original_content: content.trim(),
                tone: tone.toLowerCase(), // Backend expects lowercase
                platform: platform,
                refinement_instructions: instructions,
                generate_alternatives: false
            });

            return response.data;
        } catch (error) {
            console.error('AI Refinement Error:', error);
            throw error;
        }
    }
};
