/**
 * API Configuration Module
 * Centralizes API endpoint construction with proper base URLs
 */

// Get base URL from environment or use default
const getApiBaseUrl = (): string => {
  // In development, use the configured backend service URL
  // In production, this would be the deployed backend URL
  return process.env.REACT_APP_API_BASE_URL || 'http://localhost:8001';
};

const getGatewayUrl = (): string => {
  return process.env.REACT_APP_GATEWAY_URL || 'http://localhost:8000';
};

// API Configuration
export const API_CONFIG = {
  // Backend Service Base URL (for integrations)
  BACKEND_BASE_URL: getApiBaseUrl(),
  
  // API Gateway Base URL (for other services)
  GATEWAY_BASE_URL: getGatewayUrl(),
  
  // Debug mode
  DEBUG: process.env.REACT_APP_DEBUG === 'true',
};

/**
 * Build absolute URL for backend service endpoints
 * @param path - API path (e.g., '/api/integrations/linkedin/auth')
 * @returns Absolute URL
 */
export const buildBackendUrl = (path: string): string => {
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
 * @param path - API path
 * @returns Absolute URL
 */
export const buildGatewayUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const url = `${API_CONFIG.GATEWAY_BASE_URL}/${cleanPath}`;
  
  if (API_CONFIG.DEBUG) {
    console.log(`[API Config] Building Gateway URL: ${url}`);
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
