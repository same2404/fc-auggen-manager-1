import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isQuotaError, markQuotaExceeded } from './lib/offlineStorage';

// Trap unhandled Firestore Quota / Resource-Exhausted exceptions globally
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (isQuotaError(event.reason)) {
      event.preventDefault();
      markQuotaExceeded();
      console.warn('Unhandled Firestore Quota rejection trapped gracefully. Switched to offline storage.');
    }
  });

  window.addEventListener('error', (event) => {
    if (isQuotaError(event.error) || isQuotaError(event.message)) {
      event.preventDefault();
      markQuotaExceeded();
      console.warn('Unhandled Firestore Quota error trapped gracefully. Switched to offline storage.');
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

