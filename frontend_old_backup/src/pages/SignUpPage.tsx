import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import { Link, useNavigate } from 'react-router-dom';
import { signUpWithEmail, signInWithGoogle, signInWithFacebook } from '../api/auth';

const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('female');
  const [error, setError] = useState('');

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password should be at least 6 characters');
      return;
    }
    try {
      await signUpWithEmail(email, password, username, gender);
      navigate('/');
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
            Sign Up
          </Typography>
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
          <Box component="form" onSubmit={handleSignUp} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              autoComplete="username"
              name="username"
              required
              fullWidth
              id="username"
              label="Username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FormControl component="fieldset" sx={{ mt: 2 }}>
              <FormLabel component="legend">Gender</FormLabel>
              <RadioGroup
                row
                aria-label="gender"
                name="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <FormControlLabel value="female" control={<Radio />} label="Female" />
                <FormControlLabel value="male" control={<Radio />} label="Male" />
                <FormControlLabel value="other" control={<Radio />} label="Other" />
              </RadioGroup>
            </FormControl>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Sign Up
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
            <Link to="/signin" style={{ textDecoration: 'none' }}>
              <Typography variant="body2" color="primary" align="right">
                Already have an account? Sign in
              </Typography>
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default SignUpPage;
