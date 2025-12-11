import { auth } from './firebase';
import { buildBackendUrl, API_CONFIG } from '../config/api.config';

// Generate a unique correlation ID for request tracing
const generateCorrelationId = (): string => {
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
const createHeaders = async (correlationId?: string) => {
  const { userId, token } = await getUserAuth();
  const reqId = correlationId || generateCorrelationId();
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-User-ID': userId,
    'X-Correlation-ID': reqId,
  };
};

// LinkedIn Integration
interface PostToLinkedInParams {
  content: string;
}

export const postToLinkedIn = async (params: PostToLinkedInParams) => {
  const { userId } = await getUserAuth();
  const headers = await createHeaders();

  const url = buildBackendUrl('api/integrations/linkedin/post');
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: params.content,
      user_id: userId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to post to LinkedIn');
  }

  return response.json();
};

export const authenticateLinkedIn = async (): Promise<string> => {
  const correlationId = generateCorrelationId();
  
  console.log('\n' + '='.repeat(80));
  console.log(`🔵 [FRONTEND] Starting LinkedIn Authentication`);
  console.log(`🆔 [FRONTEND] Correlation ID: ${correlationId}`);
  console.log(`💡 [FRONTEND] Use this ID to trace this request across all services`);
  console.log('='.repeat(80));
  
  try {
    const headers = await createHeaders(correlationId);
    console.log('🔑 [FRONTEND] Headers created:', {
      ...headers,
      Authorization: headers.Authorization ? '[PRESENT]' : '[MISSING]',
      'X-Correlation-ID': correlationId
    });
    
    const url = buildBackendUrl('api/integrations/linkedin/auth');
    console.log(`📍 [FRONTEND] Fetching: ${url}`);
    console.log(`📍 [FRONTEND] Absolute URL: ${url}`);
    console.log(`📍 [FRONTEND] Method: POST`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
    });
    
    console.log(`📦 [FRONTEND] Response Status: ${response.status} ${response.statusText}`);
    console.log(`📦 [FRONTEND] Response OK: ${response.ok}`);
    
    if (!response.ok) {
      console.error('❌ [FRONTEND] Request failed!');
      let errorData;
      try {
        errorData = await response.json();
        console.error('❌ [FRONTEND] Error Data:', errorData);
      } catch (e) {
        const errorText = await response.text();
        console.error('❌ [FRONTEND] Error Text:', errorText);
        throw new Error(`Failed to authenticate with LinkedIn: ${response.status} ${response.statusText}`);
      }
      throw new Error(errorData.detail || 'Failed to authenticate with LinkedIn');
    }
    
    const data = await response.json();
    console.log('✅ [FRONTEND] Auth URL received:', data.auth_url?.substring(0, 100) + '...');
    console.log('✅ [FRONTEND] Opening LinkedIn OAuth window...\n');
    
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

// Facebook Integration
export const authenticateFacebook = async (): Promise<string> => {
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

interface PostToFacebookParams {
  content: string;
}

export const postToFacebook = async (params: PostToFacebookParams) => {
  const { userId } = await getUserAuth();
  const headers = await createHeaders();

  const url = buildBackendUrl('api/integrations/facebook/post');
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: params.content,
      user_id: userId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to post to Facebook');
  }

  return response.json();
};

// Twitter Integration
export const authenticateTwitter = async (): Promise<string> => {
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

interface PostToTwitterParams {
  content: string;
}

export const postToTwitter = async (params: PostToTwitterParams) => {
  const { userId } = await getUserAuth();
  const headers = await createHeaders();

  const url = buildBackendUrl('api/integrations/twitter/post');
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: params.content,
      user_id: userId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to post to Twitter');
  }

  return response.json();
};

// Generic status check for all platforms
export const getAllIntegrationsStatus = async () => {
  // Check if user is authenticated first
  const user = auth.currentUser;
  if (!user) {
    // Return disconnected status for all platforms if user is not authenticated
    return {
      linkedin: { connected: false },
      facebook: { connected: false },
      twitter: { connected: false },
    };
  }

  try {
    const [linkedin, facebook, twitter] = await Promise.allSettled([
      getLinkedInStatus(),
      getFacebookStatus(),
      getTwitterStatus(),
    ]);

    return {
      linkedin: linkedin.status === 'fulfilled' ? linkedin.value : { connected: false },
      facebook: facebook.status === 'fulfilled' ? facebook.value : { connected: false },
      twitter: twitter.status === 'fulfilled' ? twitter.value : { connected: false },
    };
  } catch (error) {
    console.error('Error fetching integration statuses:', error);
    return {
      linkedin: { connected: false },
      facebook: { connected: false },
      twitter: { connected: false },
    };
  }
};
