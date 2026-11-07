import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted (no external Google Fonts CDN call at runtime) -- the serif
// accent heading font used across every page's title and the sidebar
// brand mark was referencing "Playfair Display" by name for a while
// without ever actually loading it, silently falling back to Georgia.
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/playfair-display/600.css'
import '@fontsource/playfair-display/600-italic.css'
import '@fontsource/playfair-display/700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
