import { useState, useEffect, useRef } from 'react'
import './index.css'

function App() {
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [isBuilding, setIsBuilding] = useState(false)
  const [logs, setLogs] = useState([])
  const terminalRef = useRef(null)
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  const fetchTemplates = () => {
    fetch('http://localhost:3001/api/templates')
      .then(res => res.json())
      .then(data => {
        setTemplates(data)
      })
      .catch(err => console.error('Failed to fetch templates:', err))
  }

  useEffect(() => {
    fetchTemplates()
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

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setUploadStatus('')
    }
  }

  const handleUpload = () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadStatus('Uploading...')

    const formData = new FormData()
    formData.append('templateFile', selectedFile)

    fetch('http://localhost:3001/api/templates/upload', {
      method: 'POST',
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setUploadStatus(`Error: ${data.error}`)
        } else {
          setUploadStatus('Success!')
          setSelectedFile(null)
          fetchTemplates() // Refresh list
        }
      })
      .catch(err => {
        console.error('Upload failed:', err)
        setUploadStatus('Upload failed.')
      })
      .finally(() => {
        setIsUploading(false)
      })
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
              <li className="template-item">Loading templates... Make sure backend is running.</li>
            )}
          </ul>

          <div className="upload-section">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Add Template</h3>
            <div className="file-input-wrapper">
              <button className="btn-upload-ui">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                {selectedFile ? selectedFile.name : 'Select .pkr.hcl File'}
              </button>
              <input type="file" accept=".pkr.hcl,.hcl" onChange={handleFileChange} disabled={isBuilding || isUploading} />
            </div>
            
            {(selectedFile || uploadStatus) && (
              <div className="upload-actions">
                <button 
                  className="upload-btn-submit" 
                  onClick={handleUpload}
                  disabled={isUploading || !selectedFile}
                >
                  {isUploading ? 'Uploading...' : 'Upload Template'}
                </button>
                {uploadStatus && (
                  <span style={{ alignSelf: 'center', color: uploadStatus.includes('Success') ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '0.9rem' }}>
                    {uploadStatus}
                  </span>
                )}
              </div>
            )}
          </div>

          <button 
            className="build-btn" 
            onClick={handleBuild}
            disabled={!selectedTemplate || isBuilding}
          >
            {isBuilding ? 'Building Pipeline...' : 'Start Build Pipeline'}
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '0' }}>
          <div className="terminal-header">
            <h2>Live Build Logs</h2>
          </div>
          <div className="terminal-container" ref={terminalRef}>
            {logs.length === 0 ? (
              <div style={{ color: '#666', fontStyle: 'italic', display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
                Select a target and start the build to view logs...
              </div>
            ) : (
              logs.map((log, i) => {
                let className = 'terminal-line'
                if (log.toLowerCase().includes('error')) className += ' error'
                if (log.toLowerCase().includes('success') || log.toLowerCase().includes('exited with code 0')) className += ' success'
                return <div key={i} className={className}>{log.replace('data: ', '')}</div>
              })
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
