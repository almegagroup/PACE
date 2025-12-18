/**
 * PACE ERP — Frontend Zero Authority
 * Rule: No backend SDK, no direct DB/auth calls from frontend
 * Gate-0 / ID-0.2A
 */


import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
