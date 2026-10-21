import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/design-tokens.css'
import './index.css'
import './styles/conversation-inbox.css'
import './styles/components.css'
import './styles/motion.css'
import './styles/app-topbar.css'
import './styles/video-page.css'
import './styles/conversation-layout.css'
import './styles/shape-overrides.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
