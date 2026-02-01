import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Paper,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmail, signInWithGoogle, signInWithFacebook } from '../api/auth';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await signInWithEmail(email, password);
      navigate('/dashboard');
    } catch (error) {
      setError((error as Error).message);
      console.error(error);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography component="h1" variant="h5">
            Sign In
          </Typography>
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
          <Box component="form" onSubmit={handleSignIn} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Sign In
            </Button>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<GoogleIcon />}
                  onClick={async () => {
                    try {
                      await signInWithGoogle();
                      navigate('/dashboard');
                    } catch (error) {
                      console.error(error);
                    }
                  }}
                >
                  Google
                </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FacebookIcon />}
                onClick={async () => {
                  try {
                    await signInWithFacebook();
                    navigate('/dashboard');
                  } catch (error) {
                    console.error(error);
                  }
                }}
              >
                Facebook
              </Button>
            </Box>
            <Link to="/signup" style={{ textDecoration: 'none' }}>
              <Typography variant="body2" color="primary" align="right">
                Don't have an account? Sign Up
              </Typography>
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default SignInPage;
