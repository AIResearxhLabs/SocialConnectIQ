import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Typography,
  CircularProgress,
  Box,
  Card,
  CardContent,
  Alert,
  Chip,
  IconButton,
} from '@mui/material';
import {
  LinkedIn,
  Facebook,
  Twitter,
  CheckCircle,
  Cancel,
  Refresh,
} from '@mui/icons-material';
import {
  authenticateLinkedIn,
  authenticateFacebook,
  authenticateTwitter,
  getAllIntegrationsStatus,
  disconnectLinkedIn,
  disconnectTwitter,
} from '../api/social';

interface IntegrationStatus {
  connected: boolean;
  connected_at?: any;
  platform_user_id?: string;
}

interface PlatformConfig {
  name: string;
  key: 'linkedin' | 'facebook' | 'twitter';
  icon: React.ReactNode;
  color: string;
  authenticateFn: () => Promise<string>;
  disconnectFn?: () => Promise<any>;
}

const IntegrationPage: React.FC = () => {
  const [isAuthenticating, setIsAuthenticating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<{
    linkedin: IntegrationStatus;
    facebook: IntegrationStatus;
    twitter: IntegrationStatus;
  }>({
    linkedin: { connected: false },
    facebook: { connected: false },
    twitter: { connected: false },
  });

  const location = useLocation();
  const navigate = useNavigate();

  const platforms: PlatformConfig[] = [
    {
      name: 'LinkedIn',
      key: 'linkedin',
      icon: <LinkedIn sx={{ fontSize: 40 }} />,
      color: '#0077B5',
      authenticateFn: authenticateLinkedIn,
      disconnectFn: disconnectLinkedIn,
    },
    {
      name: 'Facebook',
      key: 'facebook',
      icon: <Facebook sx={{ fontSize: 40 }} />,
      color: '#1877F2',
      authenticateFn: authenticateFacebook,
    },
    {
      name: 'Twitter',
      key: 'twitter',
      icon: <Twitter sx={{ fontSize: 40 }} />,
      color: '#1DA1F2',
      authenticateFn: authenticateTwitter,
      disconnectFn: disconnectTwitter,
    },
  ];

  // Load integration statuses on mount
  useEffect(() => {
    loadIntegrationStatuses();
  }, []);

  // Handle OAuth callback messages from popup window
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // Security: Verify origin
      if (event.origin !== window.location.origin) {
        console.warn('⚠️  [INTEGRATION-PAGE] Message from untrusted origin:', event.origin);
        return;
      }

      console.log('📩 [INTEGRATION-PAGE] Received message from popup:', event.data);

      if (event.data.type === 'OAUTH_CALLBACK') {
        const { status, platform, message } = event.data;

        if (status === 'success') {
          console.log(`✅ [INTEGRATION-PAGE] OAuth success for ${platform}`);
          setSuccess(`Successfully connected to ${platform}!`);
          // Reload statuses after successful connection
          loadIntegrationStatuses();
        } else if (status === 'error') {
          console.error(`❌ [INTEGRATION-PAGE] OAuth error for ${platform}: ${message}`);
          setError(`Failed to connect to ${platform}. ${message ? `Error: ${message}` : 'Please try again.'}`);
        }

        setIsAuthenticating(null);
      }
    };

    window.addEventListener('message', handleOAuthMessage);

    return () => {
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, []);

  const loadIntegrationStatuses = async () => {
    setLoading(true);
    try {
      const statuses = await getAllIntegrationsStatus();
      setAuthStatus(statuses);
    } catch (err) {
      console.error('Error loading integration statuses:', err);
      setError('Failed to load integration statuses');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthentication = async (platform: PlatformConfig) => {
    console.log('\n' + '='.repeat(80));
    console.log(`🎯 [INTEGRATION-PAGE] User clicked "Connect ${platform.name}"`);
    console.log('='.repeat(80));
    
    setIsAuthenticating(platform.key);
    setError(null);
    setSuccess(null);

    try {
      console.log(`🔄 [INTEGRATION-PAGE] Calling authenticateFn for ${platform.name}...`);
      const authUrl = await platform.authenticateFn();
      
      console.log(`✅ [INTEGRATION-PAGE] Auth URL received from backend`);
      console.log(`📏 [INTEGRATION-PAGE] URL length: ${authUrl.length} characters`);
      console.log(`🔗 [INTEGRATION-PAGE] URL preview: ${authUrl.substring(0, 100)}...`);

      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      console.log(`🪟 [INTEGRATION-PAGE] Opening OAuth popup window:`);
      console.log(`   ├─ Width: ${width}px`);
      console.log(`   ├─ Height: ${height}px`);
      console.log(`   ├─ Position: (${left}, ${top})`);
      console.log(`   └─ URL: ${authUrl.substring(0, 80)}...`);

      const popup = window.open(
        authUrl,
        `${platform.name} Authentication`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        console.error('❌ [INTEGRATION-PAGE] Popup window blocked!');
        console.error('   └─ User needs to allow popups for this site');
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      console.log(`✅ [INTEGRATION-PAGE] Popup window opened successfully`);
      console.log(`👀 [INTEGRATION-PAGE] Monitoring popup for closure...`);

      // Monitor popup closure
      if (popup) {
        let checkCount = 0;
        const checkPopupClosed = setInterval(() => {
          checkCount++;
          
          if (popup.closed) {
            console.log(`🔔 [INTEGRATION-PAGE] Popup closed by user (after ${checkCount * 0.5} seconds)`);
            clearInterval(checkPopupClosed);
            setIsAuthenticating(null);
            
            console.log(`🔄 [INTEGRATION-PAGE] Reloading integration statuses in 1 second...`);
            // Reload statuses after popup closes
            setTimeout(() => {
              console.log(`📊 [INTEGRATION-PAGE] Loading updated integration statuses...`);
              loadIntegrationStatuses();
            }, 1000);
          }
          
          // Log every 10 seconds to show monitoring is active
          if (checkCount % 20 === 0) {
            console.log(`⏱️  [INTEGRATION-PAGE] Popup still open (${checkCount * 0.5}s elapsed)`);
          }
        }, 500);
      }
    } catch (err: any) {
      console.error('❌ [INTEGRATION-PAGE] Authentication failed:');
      console.error(`   ├─ Platform: ${platform.name}`);
      console.error(`   ├─ Error Type: ${err.constructor.name}`);
      console.error(`   └─ Message: ${err.message}`);
      console.error('='.repeat(80) + '\n');
      
      setError(err.message || `Failed to authenticate with ${platform.name}`);
      setIsAuthenticating(null);
    }
  };

  const handleDisconnect = async (platform: PlatformConfig) => {
    if (!platform.disconnectFn) {
      setError('Disconnect functionality not yet implemented for this platform');
      return;
    }

    try {
      await platform.disconnectFn();
      setSuccess(`Successfully disconnected from ${platform.name}`);
      await loadIntegrationStatuses();
    } catch (err: any) {
      setError(err.message || `Failed to disconnect from ${platform.name}`);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Social Media Integrations
        </Typography>
        <IconButton onClick={loadIntegrationStatuses} color="primary" title="Refresh statuses">
          <Refresh />
        </IconButton>
      </Box>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Connect your social media accounts to enable posting, scheduling, and analytics across platforms.
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        {platforms.map((platform) => {
          const status = authStatus[platform.key];
          const isConnected = status?.connected;
          const isAuthenticatingThis = isAuthenticating === platform.key;

          return (
            <Box key={platform.key}>
              <Card
                sx={{
                  height: '100%',
                  position: 'relative',
                  border: isConnected ? `2px solid ${platform.color}` : '1px solid #e0e0e0',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3,
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ color: platform.color, mr: 2 }}>{platform.icon}</Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" component="h2">
                        {platform.name}
                      </Typography>
                      {isConnected && (
                        <Chip
                          label="Connected"
                          color="success"
                          size="small"
                          icon={<CheckCircle />}
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </Box>
                  </Box>

                  {isConnected && status.connected_at && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Connected on: {formatDate(status.connected_at)}
                    </Typography>
                  )}

                  {!isConnected && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Not connected. Click below to authenticate your {platform.name} account.
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {!isConnected ? (
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => handleAuthentication(platform)}
                        disabled={isAuthenticatingThis}
                        sx={{
                          backgroundColor: platform.color,
                          '&:hover': {
                            backgroundColor: platform.color,
                            filter: 'brightness(0.9)',
                          },
                        }}
                        startIcon={isAuthenticatingThis ? <CircularProgress size={20} /> : null}
                      >
                        {isAuthenticatingThis ? 'Authenticating...' : `Connect ${platform.name}`}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outlined"
                          fullWidth
                          onClick={() => handleDisconnect(platform)}
                          color="error"
                          startIcon={<Cancel />}
                        >
                          Disconnect
                        </Button>
                      </>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ mt: 4, p: 3, backgroundColor: '#f5f5f5', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          How OAuth Integration Works
        </Typography>
        <Typography variant="body2" color="text.secondary">
          1. Click "Connect" on any platform above
          <br />
          2. A popup window will open for authentication
          <br />
          3. Log in to your social media account and authorize the app
          <br />
          4. Your access tokens will be securely stored in Firestore
          <br />
          5. You can now post to that platform directly from our dashboard
        </Typography>
      </Box>
    </Box>
  );
};

export default IntegrationPage;
