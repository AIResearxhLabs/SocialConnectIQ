/**
 * API Configuration Module
 * Centralizes API endpoint construction with proper base URLs
 */

// Get base URL from environment or use default
const getApiBaseUrl = () => {
  // In development, use the configured backend service URL
  // In production, this would be the deployed backend URL
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
};

const getGatewayUrl = () => {
  return import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8000';
};

const getAgentServiceUrl = () => {
  return import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8006';
};

// API Configuration
export const API_CONFIG = {
  // Backend Service Base URL (for integrations)
  BACKEND_BASE_URL: getApiBaseUrl(),

  // API Gateway Base URL (for other services)
  GATEWAY_BASE_URL: getGatewayUrl(),

  // Agent Service URL (for AI features like trending, chat)
  AGENT_SERVICE_URL: getAgentServiceUrl(),

  // Debug mode
  DEBUG: import.meta.env.VITE_DEBUG === 'true',
};

/**
 * Build absolute URL for backend service endpoints
 * @param {string} path - API path (e.g., '/api/integrations/linkedin/auth')
 * @returns {string} Absolute URL
 */
export const buildBackendUrl = (path) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const url = `${API_CONFIG.BACKEND_BASE_URL}/${cleanPath}`;

  if (API_CONFIG.DEBUG) {
    console.log(`[API Config] Building Backend URL: ${url}`);
  }

  return url;
};

/**
 * Build absolute URL for API Gateway endpoints
 * @param {string} path - API path
 * @returns {string} Absolute URL
 */
export const buildGatewayUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const url = `${API_CONFIG.GATEWAY_BASE_URL}/${cleanPath}`;

  if (API_CONFIG.DEBUG) {
    console.log(`[API Config] Building Gateway URL: ${url}`);
  }

  return url;
};

/**
 * Build absolute URL for Agent Service endpoints (AI features)
 * @param {string} path - API path (e.g., 'trending/user123')
 * @returns {string} Absolute URL
 */
export const buildAgentUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const url = `${API_CONFIG.AGENT_SERVICE_URL}/${cleanPath}`;

  if (API_CONFIG.DEBUG) {
    console.log(`[API Config] Building Agent URL: ${url}`);
  }

  return url;
};

/**
 * Log API configuration on module load
 */
if (API_CONFIG.DEBUG) {
  console.log('='.repeat(80));
  console.log('🔧 API Configuration Loaded:');
  console.log(`   Backend Service: ${API_CONFIG.BACKEND_BASE_URL}`);
  console.log(`   API Gateway:     ${API_CONFIG.GATEWAY_BASE_URL}`);
  console.log(`   Debug Mode:      ${API_CONFIG.DEBUG}`);
  console.log('='.repeat(80));
}
