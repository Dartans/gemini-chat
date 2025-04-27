import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ClerkProvider } from '@clerk/clerk-react';

// Configure PDF.js worker for react-pdf
import { pdfjs } from 'react-pdf';
if (typeof window !== 'undefined' && 'pdfjsLib' in window) {
  // Use the global PDF.js worker that was set up in pdfJsSetup.js
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
}

// Get your Clerk publishable key from environment variables
// In Vite, environment variables are accessed via import.meta.env
// We handle both formats for compatibility during migration
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 
                    import.meta.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();