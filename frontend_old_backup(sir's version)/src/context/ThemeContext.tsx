import React, { createContext, useState, useMemo, useContext } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';

const lightPalette = {
  primary: {
    main: '#1976d2',
  },
  secondary: {
    main: '#dc004e',
  },
  background: {
    default: '#f4f6f8',
    paper: '#ffffff',
  },
  text: {
    primary: '#000000',
    secondary: '#5f6368',
  }
};

const darkPalette = {
  primary: {
    main: '#64b5f6',
  },
  secondary: {
    main: '#f06292',
  },
  background: {
    default: '#121212',
    paper: '#1e1e1e',
  },
  text: {
    primary: '#ffffff',
    secondary: '#a9a9a9',
  }
};

const ThemeContext = createContext({
  toggleTheme: () => {},
  mode: 'light',
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === 'light' ? lightPalette : darkPalette),
        },
        typography: {
          fontFamily: [
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
            '"Apple Color Emoji"',
            '"Segoe UI Emoji"',
            '"Segoe UI Symbol"',
          ].join(','),
        },
      }),
    [mode]
  );

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ toggleTheme, mode }}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
