import { createRoot } from 'react-dom/client'
import { StageWorkspace } from './StageWorkspace.tsx'
import { STAGE_CSS } from './styles.ts'

const styleTag = document.createElement('style')
styleTag.textContent = STAGE_CSS
document.head.appendChild(styleTag)

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<StageWorkspace />)
}
