import { useState, useEffect, useRef } from 'react'
import './index.css'

function App() {
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [isBuilding, setIsBuilding] = useState(false)
  const [logs, setLogs] = useState([])
  const terminalRef = useRef(null)

  useEffect(() => {
    // Fetch available templates
    fetch('http://localhost:3001/api/templates')
      .then(res => res.json())
      .then(data => {
        setTemplates(data)
      })
      .catch(err => console.error('Failed to fetch templates:', err))
  }, [])

  useEffect(() => {
    // Auto-scroll terminal
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [logs])

  const handleBuild = () => {
    if (!selectedTemplate || isBuilding) return

    setIsBuilding(true)
    setLogs([])

    const eventSource = new EventSource(`http://localhost:3001/api/build?template=${selectedTemplate.id}`)

    eventSource.onmessage = (event) => {
      setLogs(prev => [...prev, event.data])
      if (event.data.includes('Build process exited')) {
        eventSource.close()
        setIsBuilding(false)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err)
      setLogs(prev => [...prev, 'Connection error or build failed to start.'])
      eventSource.close()
      setIsBuilding(false)
    }
  }

  return (
    <div className="app-container">
      <header>
        <div>
          <h1>Packer Nexus</h1>
          <div className="subtitle">Visual Image Management Platform</div>
        </div>
        <div className="status-indicator">
          <div className={`dot ${isBuilding ? 'pulse' : ''}`}></div>
          {isBuilding ? 'Build in Progress' : 'System Ready'}
        </div>
      </header>

      <main className="dashboard">
        <div className="glass-panel">
          <h2>Build Target</h2>
          <ul className="template-list">
            {templates.map(template => (
              <li 
                key={template.id}
                className={`template-item ${selectedTemplate?.id === template.id ? 'active' : ''}`}
                onClick={() => !isBuilding && setSelectedTemplate(template)}
              >
                <div className="template-info">
                  <h3>{template.name}</h3>
                </div>
                <span className={`template-type ${template.type === 'AWS' ? 'aws' : ''}`}>
                  {template.type}
                </span>
              </li>
            ))}
            {templates.length === 0 && (
              <li className="template-item">Loading templates...</li>
            )}
          </ul>

          <button 
            className="build-btn" 
            onClick={handleBuild}
            disabled={!selectedTemplate || isBuilding}
          >
            {isBuilding ? 'Building...' : 'Start Build Pipeline'}
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
          <div className="terminal-header" style={{ padding: '1.5rem 1.5rem 0.5rem' }}>
            <h2>Live Build Logs</h2>
          </div>
          <div className="terminal-container" ref={terminalRef}>
            {logs.length === 0 ? (
              <div style={{ color: '#666', fontStyle: 'italic' }}>
                Select a target and start the build to view logs...
              </div>
            ) : (
              logs.map((log, i) => {
                let className = 'terminal-line'
                if (log.includes('ERROR') || log.includes('error')) className += ' error'
                if (log.includes('success') || log.includes('exited with code 0')) className += ' success'
                return <div key={i} className={className}>{log}</div>
              })
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
