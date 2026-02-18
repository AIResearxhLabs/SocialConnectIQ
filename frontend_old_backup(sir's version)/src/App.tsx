import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import HomePage from './pages/HomePage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import ComposerPage from './pages/ComposerPage';
import AnalyticsPage from './pages/AnalyticsPage';
import IntegrationPage from './pages/IntegrationPage';
import TrendingPage from './pages/TrendingPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="composer" element={<ComposerPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="integration" element={<IntegrationPage />} />
              <Route path="trending" element={<TrendingPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
