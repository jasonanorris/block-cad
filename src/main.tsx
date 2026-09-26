import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ProjectRecovery from './ProjectRecovery'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProjectRecovery>{({ objects, notice, autosaveEnabled }) =>
      <App initialObjects={objects} recoveryNotice={notice} initialAutosaveEnabled={autosaveEnabled} />}</ProjectRecovery>
  </StrictMode>,
)
