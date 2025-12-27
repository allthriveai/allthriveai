import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initGlobalErrorCapture } from './services/logger'
import { initSentry } from './utils/sentry'

// Initialize Sentry error tracking (production only)
initSentry()

// Initialize global error capture to send errors to admin log stream
initGlobalErrorCapture()

createRoot(document.getElementById('root')!).render(<App />)
