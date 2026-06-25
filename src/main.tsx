import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress cross-origin "Script error." that are injected by browser extensions, 
// ad-blockers, or parent frame scripts to prevent false error reporting.
if (typeof window !== "undefined") {
  window.addEventListener('error', (event) => {
    if (event.message === "Script error." || !event.message) {
      event.preventDefault();
      console.log("Suppressed cross-origin or external script error in preview frame.");
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason);
    if (msg === "Script error." || msg.includes("Script error")) {
      event.preventDefault();
      console.log("Suppressed cross-origin or external unhandled promise rejection in preview frame.");
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

