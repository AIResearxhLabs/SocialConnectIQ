import React, { useState } from 'react';
import { 
  Typography, 
  Box, 
  Button, 
  Card, 
  CardContent, 
  CardActions,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  Stack
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import { clearBrowserStorage, getStorageInfo } from '../utils/storageUtils';

const SettingsPage: React.FC = () => {
  const [storageInfo, setStorageInfo] = useState(getStorageInfo());
  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleClearStorage = () => {
    setShowConfirmDialog(true);
  };

  const confirmClearStorage = () => {
    try {
      clearBrowserStorage({
        clearLocalStorage: true,
        clearSessionStorage: true,
        preserveKeys: ['theme'], // Preserve theme preference
      });
      setStorageInfo(getStorageInfo());
      setShowSuccess(true);
      setShowConfirmDialog(false);
      
      // Reload after 2 seconds to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {/* Storage Management Section */}
      <Card sx={{ mt: 3, maxWidth: 600 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Browser Storage Management
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Clear browser storage if you experience login issues or app crashes.
            This will sign you out and remove cached data.
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mt: 2, mb: 2 }}>
            <Chip 
              icon={<InfoIcon />}
              label={`Local Storage: ${storageInfo.localStorageKeys} items (${formatBytes(storageInfo.localStorageSize)})`}
              variant="outlined"
            />
            <Chip 
              icon={<InfoIcon />}
              label={`Session Storage: ${storageInfo.sessionStorageKeys} items (${formatBytes(storageInfo.sessionStorageSize)})`}
              variant="outlined"
            />
          </Stack>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>When to clear storage:</strong>
              <ul style={{ marginTop: 8, marginBottom: 0 }}>
                <li>App won't load or shows white screen</li>
                <li>Login page doesn't appear</li>
                <li>Session errors or authentication failures</li>
                <li>Corrupted data warnings in console</li>
              </ul>
            </Typography>
          </Alert>
        </CardContent>

        <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleClearStorage}
          >
            Clear Browser Storage
          </Button>
        </CardActions>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
      >
        <DialogTitle>Clear Browser Storage?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will clear all cached data and sign you out. You'll need to log in again.
            Your theme preference will be preserved.
          </DialogContentText>
          <Alert severity="warning" sx={{ mt: 2 }}>
            The page will automatically reload after clearing storage.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmClearStorage} 
            color="error" 
            variant="contained"
            autoFocus
          >
            Clear Storage
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={2000}
        onClose={() => setShowSuccess(false)}
        message="Storage cleared successfully! Reloading..."
      />
    </Box>
  );
};

export default SettingsPage;
