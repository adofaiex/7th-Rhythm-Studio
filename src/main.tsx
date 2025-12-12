import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if (window.ipcRenderer) {
  window.ipcRenderer.on('main-process-message', (_event: any, message: unknown) => {
    console.log(message)
  })
}
