import React, { useState, useEffect } from 'react';
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
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Card,
  CardContent,
  Stack,
  CardMedia,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Refresh as RefreshIcon,
  AutoAwesome as AutoAwesomeIcon,
  Edit as EditIcon,
  CheckCircleOutline as ApproveIcon,
  Replay as ReplayIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  Publish as PublishIcon,
} from '@mui/icons-material';
import { postToLinkedIn, postToFacebook, postToTwitter, refineContent, previewPost } from '../api/social';
import VoiceInputButton from '../components/VoiceInputButton';

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

// Platform preview interface
interface PlatformPreview {
  platform: string;
  platformName: string;
  textContent: string;
  hasImage: boolean;
  imagePreviewUrl?: string;
  warning?: string;
  canPost: boolean;
}

// Tone options
const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
  { value: 'informative', label: 'Informative' },
  { value: 'neutral', label: 'Neutral' },
];

const ComposerPage: React.FC = () => {
  // Original content state
  const [originalContent, setOriginalContent] = useState('');
  const [selectedTone, setSelectedTone] = useState('professional');
  
  // Image state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  
  // Refined content state
  const [refinedContent, setRefinedContent] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refinementError, setRefinementError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [refinementInstructions, setRefinementInstructions] = useState('');
  
  // Preview state
  const [previewData, setPreviewData] = useState<PlatformPreview[] | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  // Posting state
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

  // Reset preview when content, image, or platforms change
  useEffect(() => {
    if (previewData) {
      setPreviewData(null);
    }
  }, [originalContent, refinedContent, selectedImage, platforms]);

  const handlePlatformChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPlatforms({
      ...platforms,
      [event.target.name]: event.target.checked,
    });
  };

  // Handle voice transcript for original content
  const handleVoiceTranscript = (text: string) => {
    setOriginalContent((prev) => prev + text);
  };

  // Handle voice transcript for refinement instructions
  const handleInstructionVoiceTranscript = (text: string) => {
    setRefinementInstructions((prev) => prev + text);
  };

  // Handle image selection
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setImageError('Please select a valid image file (JPG, PNG, GIF, or WEBP)');
      return;
    }

    // Validate file size (5MB max for compatibility)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      setImageError('Image size must be less than 5MB');
      return;
    }

    // Clear any previous errors
    setImageError(null);

    // Set the selected image
    setSelectedImage(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle image removal
  const handleImageRemove = () => {
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setImageError(null);
  };

  // Convert image to Base64
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle content refinement
  const handleRefine = async () => {
    if (!originalContent.trim()) {
      setRefinementError('Please enter some content to refine');
      return;
    }

    setIsRefining(true);
    setRefinementError(null);
    setSuggestions([]);

    try {
      // Determine target platform for optimization
      const selectedPlatforms = Object.keys(platforms).filter(
        (p) => platforms[p as keyof typeof platforms]
      );
      const targetPlatform = selectedPlatforms.length === 1 ? selectedPlatforms[0] : undefined;

      const result = await refineContent({
        originalContent: originalContent.trim(),
        refinementInstructions: refinementInstructions.trim() || undefined,
        tone: selectedTone,
        platform: targetPlatform,
        generateAlternatives: false,
      });

      if (result.success && result.refined_content) {
        setRefinedContent(result.refined_content);
        setSuggestions(result.suggestions || []);
        setRefinementError(null);
      } else {
        setRefinementError(result.error || 'Failed to refine content');
      }
    } catch (error: any) {
      setRefinementError(error.message || 'An error occurred while refining content');
      console.error('Content refinement error:', error);
    } finally {
      setIsRefining(false);
    }
  };

  // Handle preview generation
  const handlePreview = async () => {
    // Validate that at least one platform is selected
    const selectedPlatformsList = Object.keys(platforms).filter(
      (p) => platforms[p as keyof typeof platforms]
    );

    if (selectedPlatformsList.length === 0) {
      setPreviewError('Please select at least one platform');
      return;
    }

    // Use refined content if available, otherwise use original
    const contentToPost = refinedContent.trim() || originalContent.trim();

    // Validate that at least content or image is provided
    if (!contentToPost && !selectedImage) {
      setPreviewError('Please provide text content or an image to post');
      return;
    }

    setIsGeneratingPreview(true);
    setPreviewError(null);

    try {
      let imageData: string | undefined;
      let imageMimeType: string | undefined;

      if (selectedImage) {
        imageData = await convertImageToBase64(selectedImage);
        imageMimeType = selectedImage.type;
      }

      const result = await previewPost({
        content: contentToPost,
        platforms: selectedPlatformsList,
        imageData,
        imageMimeType,
      });

      if (result.success && result.previews) {
        setPreviewData(result.previews);
        setPreviewError(null);
      } else {
        setPreviewError(result.error || 'Failed to generate preview');
      }
    } catch (error: any) {
      setPreviewError(error.message || 'An error occurred while generating preview');
      console.error('Preview generation error:', error);
    } finally {
      setIsGeneratingPreview(false);
    }
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
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📤 [COMPOSER] Starting post to ${platform}`);
    console.log(`📝 [COMPOSER] Content length: ${(refinedContent.trim() || originalContent.trim()).length}`);
    console.log(`🖼️  [COMPOSER] Has image: ${Boolean(selectedImage)}`);
    console.log('='.repeat(80));

    updatePlatformStatus(platform, 'posting');

    // Use refined content if available, otherwise use original
    const contentToPost = refinedContent.trim() || originalContent.trim();

    try {
      let imageData: string | undefined;
      let imageMimeType: string | undefined;

      if (selectedImage) {
        console.log(`🖼️  [COMPOSER] Converting image to base64 for ${platform}...`);
        imageData = await convertImageToBase64(selectedImage);
        imageMimeType = selectedImage.type;
        console.log(`✅ [COMPOSER] Image converted: ${imageMimeType}, ${imageData.length} bytes`);
      }

      let result;
      console.log(`📡 [COMPOSER] Calling API for ${platform}...`);
      
      if (platform === 'linkedin') {
        result = await postToLinkedIn({ 
          content: contentToPost,
          imageData,
          imageMimeType,
        });
      } else if (platform === 'facebook') {
        result = await postToFacebook({ 
          content: contentToPost,
          imageData,
          imageMimeType,
        });
      } else if (platform === 'twitter') {
        console.log(`🐦 [COMPOSER] Posting to Twitter...`);
        result = await postToTwitter({ 
          content: contentToPost,
          imageData,
          imageMimeType,
        });
        console.log(`✅ [COMPOSER] Twitter API call completed:`, result);
      }

      console.log(`✅ [COMPOSER] Successfully posted to ${platform}`);
      console.log('='.repeat(80) + '\n');

      updatePlatformStatus(
        platform,
        'success',
        `Posted successfully at ${new Date().toLocaleTimeString()}`
      );
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to post';
      console.error(`❌ [COMPOSER] Error posting to ${platform}:`, err);
      console.error(`❌ [COMPOSER] Error message: ${errorMessage}`);
      console.error(`❌ [COMPOSER] Error stack:`, err.stack);
      console.log('='.repeat(80) + '\n');
      
      updatePlatformStatus(platform, 'error', undefined, errorMessage);
    }
  };

  // Main post handler
  const handlePost = async () => {
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

  // Determine which content to post
  const contentToPost = refinedContent.trim() || originalContent.trim();
  const hasContent = Boolean(contentToPost) || Boolean(selectedImage);
  const hasSelectedPlatforms = platforms.linkedin || platforms.facebook || platforms.twitter;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Compose a Post
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Content Sections Row - Always show both text areas */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          {/* Original Content Section */}
          <Box sx={{ flex: 1 }}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">What's on your mind?</Typography>
              <VoiceInputButton
                onTranscript={handleVoiceTranscript}
                mode="append"
                size="medium"
                disabled={isRefining || isPosting}
                showInterim={true}
              />
            </Box>

            <TextField
              label="Your thought, idea, or opinion (optional)"
              multiline
              rows={6}
              value={originalContent}
              onChange={(e) => setOriginalContent(e.target.value)}
              variant="outlined"
              fullWidth
              disabled={isRefining || isPosting}
              placeholder="Type or speak your content here..."
              helperText={`${originalContent.length} characters`}
            />

            <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Tone</InputLabel>
                <Select
                  value={selectedTone}
                  label="Tone"
                  onChange={(e) => setSelectedTone(e.target.value)}
                  disabled={isRefining || isPosting}
                >
                  {TONE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="contained"
                color="secondary"
                onClick={handleRefine}
                disabled={!originalContent.trim() || isRefining || isPosting}
                startIcon={isRefining ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
              >
                {isRefining ? 'Refining...' : 'Enhance/Refine'}
              </Button>
            </Box>

            {refinementError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {refinementError}
              </Alert>
            )}
          </Paper>
          </Box>

          {/* Refined Content Section - Always visible */}
          <Box sx={{ flex: 1 }}>
            <Paper elevation={2} sx={{ p: 3, backgroundColor: '#f5f5f5' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" color="primary">
                  ✨ Refined Content
                </Typography>
                <Tooltip title="Edit refined content">
                  <IconButton size="small">
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              </Box>

              <TextField
                multiline
                rows={6}
                value={refinedContent}
                onChange={(e) => setRefinedContent(e.target.value)}
                variant="outlined"
                fullWidth
                disabled={isPosting}
                helperText={`${refinedContent.length} characters`}
              />

              {suggestions.length > 0 && (
                <Card sx={{ mt: 2, backgroundColor: '#fff3e0' }}>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      💡 Suggestions:
                    </Typography>
                    <Stack spacing={1}>
                      {suggestions.map((suggestion, index) => (
                        <Typography key={index} variant="body2">
                          {suggestion}
                        </Typography>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Refinement Instructions */}
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle2">
                    Want to refine further?
                  </Typography>
                  <VoiceInputButton
                    onTranscript={handleInstructionVoiceTranscript}
                    mode="append"
                    size="small"
                    disabled={isRefining || isPosting}
                  />
                </Box>
                <TextField
                  size="small"
                  placeholder="E.g., 'Make it shorter' or 'Add more enthusiasm'"
                  value={refinementInstructions}
                  onChange={(e) => setRefinementInstructions(e.target.value)}
                  fullWidth
                  disabled={isRefining || isPosting}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleRefine}
                  disabled={!originalContent.trim() || isRefining || isPosting}
                  startIcon={<ReplayIcon />}
                  sx={{ mt: 1 }}
                >
                  Refine Again
                </Button>
              </Box>
            </Paper>
          </Box>
        </Box>

        {/* Image Upload Section */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            📎 Attach Image (Optional)
          </Typography>

          {!selectedImage ? (
            <Box>
              <input
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                style={{ display: 'none' }}
                id="image-upload"
                type="file"
                onChange={handleImageSelect}
                disabled={isPosting}
              />
              <label htmlFor="image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<ImageIcon />}
                  disabled={isPosting}
                >
                  Upload Image
                </Button>
              </label>
              <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                Supported formats: JPG, PNG, GIF, WEBP (Max 5MB)
              </Typography>
            </Box>
          ) : (
            <Box>
              <Card sx={{ maxWidth: 300, position: 'relative' }}>
                <IconButton
                  onClick={handleImageRemove}
                  disabled={isPosting}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 1)',
                    },
                  }}
                >
                  <CloseIcon />
                </IconButton>
                {imagePreviewUrl && (
                  <CardMedia
                    component="img"
                    image={imagePreviewUrl}
                    alt="Selected image"
                    sx={{ maxHeight: 300, objectFit: 'contain' }}
                  />
                )}
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    {selectedImage.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}

          {imageError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {imageError}
            </Alert>
          )}
        </Paper>

        {/* Platform Selection */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
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
        </Paper>

        {/* Preview Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="secondary"
            onClick={handlePreview}
            disabled={isGeneratingPreview || isPosting}
            startIcon={isGeneratingPreview ? <CircularProgress size={20} /> : <VisibilityIcon />}
            size="large"
          >
            {isGeneratingPreview ? 'Generating Preview...' : 'Preview Post'}
          </Button>
        </Box>

        {previewError && (
          <Alert severity="error">
            {previewError}
          </Alert>
        )}

        {/* Preview Section */}
        {previewData && previewData.length > 0 && (
          <Paper elevation={3} sx={{ p: 3, backgroundColor: '#e3f2fd' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              📋 Posting Preview
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Here's what will be posted to each selected platform:
            </Typography>

            <Stack spacing={2}>
              {previewData.map((preview) => (
                <Card key={preview.platform} elevation={2}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {preview.platformName}
                      </Typography>
                      {preview.canPost ? (
                        <Chip
                          label="Ready"
                          color="success"
                          size="small"
                          sx={{ ml: 2 }}
                        />
                      ) : (
                        <Chip
                          label="Not Available"
                          color="error"
                          size="small"
                          sx={{ ml: 2 }}
                        />
                      )}
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary">
                        Text Content:
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                        {preview.textContent}
                      </Typography>
                    </Box>

                    {preview.hasImage && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" fontWeight="bold" color="text.secondary">
                          Image:
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleIcon color="success" fontSize="small" />
                          <Typography variant="body2">
                            Image will be included
                          </Typography>
                        </Box>
                        {preview.imagePreviewUrl && (
                          <Box sx={{ mt: 1 }}>
                            <img
                              src={preview.imagePreviewUrl}
                              alt="Preview"
                              style={{
                                maxWidth: '150px',
                                maxHeight: '150px',
                                objectFit: 'contain',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                              }}
                            />
                          </Box>
                        )}
                      </Box>
                    )}

                    {preview.warning && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        {preview.warning}
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Paper>
        )}

        {/* Publish Button and Status */}
        <Paper elevation={2} sx={{ p: 3 }}>
          {/* Summary status message */}
          {(successCount > 0 || failureCount > 0) && (
            <Box sx={{ mb: 2 }}>
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

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handlePost}
              disabled={!previewData || isPosting || !hasSelectedPlatforms}
              startIcon={isPosting ? <CircularProgress size={20} /> : <PublishIcon />}
              size="large"
            >
              {isPosting ? 'Publishing...' : 'Publish to Selected Platforms'}
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

          {!previewData && (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
              Click "Preview Post" to enable publishing
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default ComposerPage;
