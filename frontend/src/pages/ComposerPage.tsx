import React, { useState } from 'react';
import {
  Button,
  TextField,
  Typography,
  CircularProgress,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { postToLinkedIn, postToFacebook, postToTwitter } from '../api/social';

// Platform status type
type PostStatus = 'idle' | 'posting' | 'success' | 'error';

interface PlatformStatus {
  status: PostStatus;
  message?: string;
  error?: string;
}

interface PlatformStatuses {
  linkedin: PlatformStatus;
  facebook: PlatformStatus;
  twitter: PlatformStatus;
}

const ComposerPage: React.FC = () => {
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [platforms, setPlatforms] = useState({
    linkedin: false,
    facebook: false,
    twitter: false,
  });
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatuses>({
    linkedin: { status: 'idle' },
    facebook: { status: 'idle' },
    twitter: { status: 'idle' },
  });

  const handlePlatformChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPlatforms({
      ...platforms,
      [event.target.name]: event.target.checked,
    });
  };

  // Update status for a specific platform
  const updatePlatformStatus = (
    platform: keyof PlatformStatuses,
    status: PostStatus,
    message?: string,
    error?: string
  ) => {
    setPlatformStatuses((prev) => ({
      ...prev,
      [platform]: { status, message, error },
    }));
  };

  // Post to a single platform
  const postToPlatform = async (platform: keyof typeof platforms): Promise<void> => {
    updatePlatformStatus(platform, 'posting');

    try {
      let result;
      if (platform === 'linkedin') {
        result = await postToLinkedIn({ content });
      } else if (platform === 'facebook') {
        result = await postToFacebook({ content });
      } else if (platform === 'twitter') {
        result = await postToTwitter({ content });
      }

      updatePlatformStatus(
        platform,
        'success',
        `Posted successfully at ${new Date().toLocaleTimeString()}`
      );
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to post';
      updatePlatformStatus(platform, 'error', undefined, errorMessage);
      console.error(`Error posting to ${platform}:`, err);
    }
  };

  // Main post handler - posts sequentially to selected platforms
  const handlePost = async () => {
    if (!content.trim()) {
      return;
    }

    const selectedPlatforms = Object.keys(platforms).filter(
      (p) => platforms[p as keyof typeof platforms]
    ) as Array<keyof typeof platforms>;

    if (selectedPlatforms.length === 0) {
      return;
    }

    setIsPosting(true);

    // Reset statuses for selected platforms
    selectedPlatforms.forEach((platform) => {
      updatePlatformStatus(platform, 'idle');
    });

    // Post sequentially to each selected platform
    for (const platform of selectedPlatforms) {
      await postToPlatform(platform);
    }

    setIsPosting(false);
  };

  // Retry a single failed platform
  const handleRetryPlatform = async (platform: keyof typeof platforms) => {
    await postToPlatform(platform);
  };

  // Retry all failed platforms
  const handleRetryAll = async () => {
    const failedPlatforms = (Object.keys(platformStatuses) as Array<keyof PlatformStatuses>).filter(
      (platform) => platformStatuses[platform].status === 'error' && platforms[platform]
    );

    if (failedPlatforms.length === 0) return;

    setIsPosting(true);

    for (const platform of failedPlatforms) {
      await postToPlatform(platform);
    }

    setIsPosting(false);
  };

  // Get status icon for a platform
  const getStatusIcon = (platform: keyof PlatformStatuses) => {
    const status = platformStatuses[platform];

    switch (status.status) {
      case 'posting':
        return (
          <Chip
            icon={<HourglassEmptyIcon />}
            label="Posting..."
            size="small"
            color="info"
            sx={{ ml: 1 }}
          />
        );
      case 'success':
        return (
          <Chip
            icon={<CheckCircleIcon />}
            label={status.message || 'Posted'}
            size="small"
            color="success"
            sx={{ ml: 1 }}
          />
        );
      case 'error':
        return (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', ml: 1 }}>
            <Chip
              icon={<ErrorIcon />}
              label="Failed"
              size="small"
              color="error"
            />
            <Tooltip title="Retry">
              <IconButton
                size="small"
                onClick={() => handleRetryPlatform(platform)}
                disabled={isPosting}
                sx={{ ml: 0.5 }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      default:
        return null;
    }
  };

  // Check if there are any failed posts
  const hasFailedPosts = Object.values(platformStatuses).some(
    (status) => status.status === 'error'
  );

  // Count successful and failed posts
  const successCount = Object.values(platformStatuses).filter(
    (status) => status.status === 'success'
  ).length;
  const failureCount = Object.values(platformStatuses).filter(
    (status) => status.status === 'error'
  ).length;

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Compose a Post
      </Typography>
      
      <TextField
        label="What's on your mind?"
        multiline
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        variant="outlined"
        fullWidth
        margin="normal"
        disabled={isPosting}
        error={!content.trim() && platforms.linkedin || platforms.facebook || platforms.twitter ? true : false}
        helperText={!content.trim() && (platforms.linkedin || platforms.facebook || platforms.twitter) ? 'Content cannot be empty' : ''}
      />

      <Typography variant="h6" sx={{ mt: 2 }}>
        Post to:
      </Typography>
      
      <FormGroup>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={platforms.linkedin}
                onChange={handlePlatformChange}
                name="linkedin"
                disabled={isPosting}
              />
            }
            label="LinkedIn"
          />
          {platforms.linkedin && getStatusIcon('linkedin')}
        </Box>
        
        {platforms.linkedin && platformStatuses.linkedin.status === 'error' && (
          <Alert severity="error" sx={{ ml: 4, mb: 1 }}>
            {platformStatuses.linkedin.error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={platforms.facebook}
                onChange={handlePlatformChange}
                name="facebook"
                disabled={isPosting}
              />
            }
            label="Facebook"
          />
          {platforms.facebook && getStatusIcon('facebook')}
        </Box>
        
        {platforms.facebook && platformStatuses.facebook.status === 'error' && (
          <Alert severity="error" sx={{ ml: 4, mb: 1 }}>
            {platformStatuses.facebook.error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={platforms.twitter}
                onChange={handlePlatformChange}
                name="twitter"
                disabled={isPosting}
              />
            }
            label="Twitter"
          />
          {platforms.twitter && getStatusIcon('twitter')}
        </Box>
        
        {platforms.twitter && platformStatuses.twitter.status === 'error' && (
          <Alert severity="error" sx={{ ml: 4, mb: 1 }}>
            {platformStatuses.twitter.error}
          </Alert>
        )}
      </FormGroup>

      {/* Summary status message */}
      {(successCount > 0 || failureCount > 0) && (
        <Box sx={{ mt: 2 }}>
          {successCount > 0 && (
            <Alert severity="success" sx={{ mb: 1 }}>
              Successfully posted to {successCount} platform{successCount > 1 ? 's' : ''}
            </Alert>
          )}
          {failureCount > 0 && (
            <Alert severity="error">
              Failed to post to {failureCount} platform{failureCount > 1 ? 's' : ''}. See details above.
            </Alert>
          )}
        </Box>
      )}

      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handlePost}
          disabled={
            isPosting ||
            !content.trim() ||
            !(platforms.linkedin || platforms.facebook || platforms.twitter)
          }
          startIcon={isPosting ? <CircularProgress size={20} /> : null}
        >
          {isPosting ? 'Posting...' : 'Post'}
        </Button>

        {hasFailedPosts && !isPosting && (
          <Button
            variant="outlined"
            color="error"
            onClick={handleRetryAll}
            startIcon={<RefreshIcon />}
          >
            Retry All Failed
          </Button>
        )}
      </Box>
    </div>
  );
};

export default ComposerPage;
