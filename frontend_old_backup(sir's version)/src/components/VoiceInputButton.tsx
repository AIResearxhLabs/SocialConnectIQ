/**
 * VoiceInputButton Component
 * A button that enables voice input with visual feedback
 */
import React, { useEffect } from 'react';
import {
  IconButton,
  Tooltip,
  Box,
  Typography,
} from '@mui/material';
import {
  Mic as MicIcon,
  MicOff as MicOffIcon,
  FiberManualRecord as RecordingIcon,
} from '@mui/icons-material';
import { useVoiceInput } from '../hooks/useVoiceInput';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  mode?: 'append' | 'replace';
  language?: string;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  showInterim?: boolean;
}

const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  mode = 'append',
  language = 'en-US',
  size = 'medium',
  disabled = false,
  showInterim = false,
}) => {
  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    browserSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({ language });

  // Send transcript to parent when it updates
  useEffect(() => {
    if (transcript) {
      onTranscript(transcript);
    }
  }, [transcript]); // Remove onTranscript, mode, resetTranscript from dependencies

  const handleClick = () => {
    if (disabled) return;

    if (isListening) {
      stopListening();
    } else {
      // Reset transcript before starting new recording in replace mode
      if (mode === 'replace') {
        resetTranscript();
      }
      startListening();
    }
  };

  if (!browserSupported) {
    return (
      <Tooltip title={error || 'Voice input not supported in this browser'}>
        <span>
          <IconButton disabled size={size}>
            <MicOffIcon />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  const getTooltipText = () => {
    if (error) return error;
    if (isListening) return 'Stop recording';
    return 'Start voice input';
  };

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <Tooltip title={getTooltipText()}>
        <span>
          <IconButton
            onClick={handleClick}
            disabled={disabled}
            size={size}
            color={isListening ? 'error' : 'primary'}
            sx={{
              animation: isListening ? 'pulse 1.5s ease-in-out infinite' : 'none',
              '@keyframes pulse': {
                '0%': {
                  boxShadow: '0 0 0 0 rgba(255, 0, 0, 0.7)',
                },
                '70%': {
                  boxShadow: '0 0 0 10px rgba(255, 0, 0, 0)',
                },
                '100%': {
                  boxShadow: '0 0 0 0 rgba(255, 0, 0, 0)',
                },
              },
            }}
          >
            {isListening ? <RecordingIcon /> : <MicIcon />}
          </IconButton>
        </span>
      </Tooltip>
      
      {/* Show interim transcript if enabled and listening */}
      {showInterim && isListening && interimTranscript && (
        <Box
          sx={{
            position: 'absolute',
            bottom: -30,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 1,
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            zIndex: 1000,
          }}
        >
          <Typography variant="caption" sx={{ color: 'white' }}>
            {interimTranscript}...
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default VoiceInputButton;
