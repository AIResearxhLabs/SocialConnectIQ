import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { initializeStorage } from './utils/storageUtils';

// Initialize storage cleanup before app renders
// This prevents crashes from corrupted session data
try {
  initializeStorage();
} catch (error) {
  console.error('Failed to initialize storage:', error);
  // Clear everything as last resort
  localStorage.clear();
  sessionStorage.clear();
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
