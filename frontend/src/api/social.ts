import { auth } from './firebase';
import { buildBackendUrl, buildGatewayUrl, API_CONFIG } from '../config/api.config';

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
  imageData?: string;
  imageMimeType?: string;
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
      image_data: params.imageData,
      image_mime_type: params.imageMimeType,
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
  imageData?: string;
  imageMimeType?: string;
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
      image_data: params.imageData,
      image_mime_type: params.imageMimeType,
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

interface PostToTwitterParams {
  content: string;
  imageData?: string;
  imageMimeType?: string;
}

export const postToTwitter = async (params: PostToTwitterParams) => {
  const correlationId = generateCorrelationId();
  
  console.log('\n' + '='.repeat(80));
  console.log(`🐦 [FRONTEND-API] Starting Twitter Post Request`);
  console.log(`🆔 [FRONTEND-API] Correlation ID: ${correlationId}`);
  console.log(`📝 [FRONTEND-API] Content length: ${params.content.length} chars`);
  console.log(`🖼️  [FRONTEND-API] Has image: ${Boolean(params.imageData)}`);
  console.log('='.repeat(80));

  try {
    const { userId } = await getUserAuth();
    console.log(`👤 [FRONTEND-API] User ID: ${userId}`);
    
    const headers = await createHeaders(correlationId);
    console.log('🔑 [FRONTEND-API] Headers created:', {
      ...headers,
      Authorization: headers.Authorization ? '[PRESENT]' : '[MISSING]',
      'X-Correlation-ID': correlationId
    });

    const url = buildBackendUrl('api/integrations/twitter/post');
    console.log(`📍 [FRONTEND-API] POST URL: ${url}`);
    
    const requestBody = {
      content: params.content,
      user_id: userId,
      image_data: params.imageData,
      image_mime_type: params.imageMimeType,
    };
    console.log(`📦 [FRONTEND-API] Request body:`, {
      ...requestBody,
      image_data: requestBody.image_data ? `[${requestBody.image_data.length} bytes]` : undefined
    });

    console.log(`⏳ [FRONTEND-API] Sending request...`);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.log(`📦 [FRONTEND-API] Response Status: ${response.status} ${response.statusText}`);
    console.log(`📦 [FRONTEND-API] Response OK: ${response.ok}`);

    if (!response.ok) {
      console.error('❌ [FRONTEND-API] Request failed!');
      let errorData;
      try {
        errorData = await response.json();
        console.error('❌ [FRONTEND-API] Error Data:', errorData);
      } catch (e) {
        const errorText = await response.text();
        console.error('❌ [FRONTEND-API] Error Text:', errorText);
        throw new Error(`Failed to post to Twitter: ${response.status} ${response.statusText}`);
      }
      throw new Error(errorData.detail || 'Failed to post to Twitter');
    }

    const result = await response.json();
    console.log('✅ [FRONTEND-API] Twitter post successful:', result);
    console.log('='.repeat(80) + '\n');
    
    return result;
  } catch (error) {
    console.error('❌ [FRONTEND-API] Exception in postToTwitter:', error);
    console.log('='.repeat(80) + '\n');
    throw error;
  }
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

// Content Refinement
interface RefineContentParams {
  originalContent: string;
  refinementInstructions?: string;
  tone?: string;
  platform?: string;
  generateAlternatives?: boolean;
}

interface RefineContentResponse {
  success: boolean;
  refined_content?: string;
  suggestions?: string[];
  alternatives?: string[];
  metadata?: {
    original_length: number;
    refined_length: number;
    processing_time: number;
    model: string;
    tone?: string;
    platform?: string;
  };
  error?: string;
}

export const refineContent = async (params: RefineContentParams): Promise<RefineContentResponse> => {
  const correlationId = generateCorrelationId();
  
  console.log('\n' + '='.repeat(80));
  console.log(`✨ [FRONTEND] Starting Content Refinement`);
  console.log(`🆔 [FRONTEND] Correlation ID: ${correlationId}`);
  console.log(`� [FRONTEND] Original length: ${params.originalContent.length} chars`);
  console.log(`🎭 [FRONTEND] Tone: ${params.tone || 'default'}`);
  console.log(`� [FRONTEND] Platform: ${params.platform || 'none'}`);
  console.log('='.repeat(80));
  
  try {
    const headers = await createHeaders(correlationId);
    
    const url = buildGatewayUrl('api/integrations/content/refine');
    console.log(`📍 [FRONTEND] Fetching: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        original_content: params.originalContent,
        refinement_instructions: params.refinementInstructions,
        tone: params.tone,
        platform: params.platform,
        generate_alternatives: params.generateAlternatives || false,
      }),
    });
    
    console.log(`📦 [FRONTEND] Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error('❌ [FRONTEND] Request failed!');
      let errorData;
      try {
        errorData = await response.json();
        console.error('❌ [FRONTEND] Error Data:', errorData);
      } catch (e) {
        const errorText = await response.text();
        console.error('❌ [FRONTEND] Error Text:', errorText);
        throw new Error(`Failed to refine content: ${response.status} ${response.statusText}`);
      }
      throw new Error(errorData.detail || errorData.error || 'Failed to refine content');
    }
    
    const data: RefineContentResponse = await response.json();
    
    if (data.success) {
      console.log('✅ [FRONTEND] Content refinement successful');
      console.log(`📏 [FRONTEND] Refined length: ${data.refined_content?.length || 0} chars`);
      console.log(`💡 [FRONTEND] Suggestions: ${data.suggestions?.length || 0}`);
      console.log(`🔄 [FRONTEND] Alternatives: ${data.alternatives?.length || 0}`);
    } else {
      console.error('❌ [FRONTEND] Content refinement failed:', data.error);
    }
    
    console.log('='.repeat(80) + '\n');
    
    return data;
  } catch (error) {
    console.error('❌ [FRONTEND] Exception in refineContent:', error);
    throw error;
  }
};

// Preview Post
interface PreviewPostParams {
  content: string;
  platforms: string[];
  imageData?: string;
  imageMimeType?: string;
}

interface PlatformPreview {
  platform: string;
  platformName: string;
  textContent: string;
  hasImage: boolean;
  imagePreviewUrl?: string;
  warning?: string;
  canPost: boolean;
}

interface PreviewPostResponse {
  success: boolean;
  previews?: PlatformPreview[];
  error?: string;
}

export const previewPost = async (params: PreviewPostParams): Promise<PreviewPostResponse> => {
  const correlationId = generateCorrelationId();
  
  console.log('\n' + '='.repeat(80));
  console.log(`🔍 [FRONTEND] Generating Post Preview`);
  console.log(`🆔 [FRONTEND] Correlation ID: ${correlationId}`);
  console.log(`📝 [FRONTEND] Content length: ${params.content.length} chars`);
  console.log(`📱 [FRONTEND] Platforms: ${params.platforms.join(', ')}`);
  console.log(`🖼️  [FRONTEND] Has image: ${Boolean(params.imageData)}`);
  console.log('='.repeat(80));
  
  try {
    const headers = await createHeaders(correlationId);
    
    const url = buildGatewayUrl('api/integrations/preview');
    console.log(`📍 [FRONTEND] Fetching: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: params.content,
        platforms: params.platforms,
        image_data: params.imageData,
        image_mime_type: params.imageMimeType,
      }),
    });
    
    console.log(`📦 [FRONTEND] Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error('❌ [FRONTEND] Request failed!');
      let errorData;
      try {
        errorData = await response.json();
        console.error('❌ [FRONTEND] Error Data:', errorData);
      } catch (e) {
        const errorText = await response.text();
        console.error('❌ [FRONTEND] Error Text:', errorText);
        throw new Error(`Failed to generate preview: ${response.status} ${response.statusText}`);
      }
      throw new Error(errorData.detail || errorData.error || 'Failed to generate preview');
    }
    
    const data: PreviewPostResponse = await response.json();
    
    if (data.success) {
      console.log('✅ [FRONTEND] Preview generated successfully');
      console.log(`📋 [FRONTEND] Previews: ${data.previews?.length || 0} platforms`);
    } else {
      console.error('❌ [FRONTEND] Preview generation failed:', data.error);
    }
    
    console.log('='.repeat(80) + '\n');
    
    return data;
  } catch (error) {
    console.error('❌ [FRONTEND] Exception in previewPost:', error);
    throw error;
  }
};
