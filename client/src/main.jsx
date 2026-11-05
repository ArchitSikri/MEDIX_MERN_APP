import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import 'remixicon/fonts/remixicon.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

createRoot(document.getElementById('root')).render(
  googleClientId
    ? <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
    : app
)
