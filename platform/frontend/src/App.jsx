import { useState, useEffect, useRef } from 'react'
import './index.css'

function App() {
  const [currentView, setCurrentView] = useState('pipelines')

  // Pipeline State
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [isBuilding, setIsBuilding] = useState(false)
  const [logs, setLogs] = useState([])
  const terminalRef = useRef(null)
  
  // Build Variables State
  const [buildVars, setBuildVars] = useState([{ key: '', value: '' }])
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  // Registry State
  const [images, setImages] = useState([])
  const [isLoadingImages, setIsLoadingImages] = useState(false)

  const fetchTemplates = () => {
    fetch('http://localhost:3001/api/templates')
      .then(res => res.json())
      .then(data => {
        setTemplates(data)
      })
      .catch(err => console.error('Failed to fetch templates:', err))
  }

  const fetchImages = () => {
    setIsLoadingImages(true)
    fetch('http://localhost:3001/api/images')
      .then(res => res.json())
      .then(data => {
        if (data.dockerImages) {
          const parsed = data.dockerImages.map(imgStr => {
            const match = imgStr.match(/^(.*?):(.*?) \((.*?)\)$/)
            if (match) {
              return { repository: match[1], tag: match[2], id: match[3] }
            }
            return { repository: imgStr, tag: '-', id: '-' }
          })
          setImages(parsed)
        }
      })
      .catch(err => console.error('Failed to fetch images:', err))
      .finally(() => setIsLoadingImages(false))
  }

  useEffect(() => {
    fetchTemplates()
    fetchImages()
  }, [])

  useEffect(() => {
    if (currentView === 'registry') {
      fetchImages()
    }
  }, [currentView])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [logs])

  const handleBuild = () => {
    if (!selectedTemplate || isBuilding) return

    setIsBuilding(true)
    setLogs([])

    // In a real app we'd pass buildVars to the backend here via POST.
    // For now, we simulate passing variables and use the existing GET endpoint.
    console.log("Passing variables to backend:", buildVars)
    const eventSource = new EventSource(`http://localhost:3001/api/build?template=${selectedTemplate.id}`)

    eventSource.onmessage = (event) => {
      setLogs(prev => [...prev, event.data])
      if (event.data.includes('Build process exited')) {
        eventSource.close()
        setIsBuilding(false)
        fetchImages()
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
          fetchTemplates()
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

  // Variables Functions
  const addVarRow = () => {
    setBuildVars([...buildVars, { key: '', value: '' }])
  }
  const removeVarRow = (index) => {
    setBuildVars(buildVars.filter((_, i) => i !== index))
  }
  const updateVar = (index, field, val) => {
    const newVars = [...buildVars]
    newVars[index][field] = val
    setBuildVars(newVars)
  }

  const renderSidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>Nexus</h1>
        <div style={{ color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '2px', marginTop: '4px' }}>
          DEVOPS CORE
        </div>
      </div>

      <nav className="sidebar-nav">
        <div 
          className={`nav-item ${currentView === 'pipelines' ? 'active' : ''}`}
          onClick={() => setCurrentView('pipelines')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          Build Pipelines
        </div>
        <div 
          className={`nav-item ${currentView === 'registry' ? 'active' : ''}`}
          onClick={() => setCurrentView('registry')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            <line x1="6" y1="6" x2="6.01" y2="6"></line>
            <line x1="6" y1="18" x2="6.01" y2="18"></line>
          </svg>
          Image Registry
        </div>
        <div 
          className={`nav-item ${currentView === 'integrations' ? 'active' : ''}`}
          onClick={() => setCurrentView('integrations')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          Integrations
        </div>
        <div 
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentView('settings')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Settings
        </div>
      </nav>
    </aside>
  )

  const renderPipelines = () => (
    <div className="page-transition">
      <header>
        <div>
          <h1 style={{ fontSize: '2.5rem' }}>Build Pipelines</h1>
          <div className="subtitle">Execute and monitor Packer templates</div>
        </div>
        <div className="status-indicator">
          <div className={`dot ${isBuilding ? 'pulse' : ''}`}></div>
          {isBuilding ? 'Build in Progress' : 'System Ready'}
        </div>
      </header>

      <div className="metric-cards">
        <div className="metric-card">
          <div className="metric-value">{templates.length}</div>
          <div className="metric-label">Available Targets</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{isBuilding ? '1' : '0'}</div>
          <div className="metric-label">Active Pipelines</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{images.length}</div>
          <div className="metric-label">Total Artifacts</div>
        </div>
      </div>

      <div className="dashboard">
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

          <div className="upload-section" style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Build Variables</h3>
            {buildVars.map((v, i) => (
              <div key={i} className="var-row">
                <input 
                  type="text" 
                  className="input-styled" 
                  placeholder="Key (e.g. AWS_REGION)" 
                  value={v.key} 
                  onChange={e => updateVar(i, 'key', e.target.value)} 
                  disabled={isBuilding}
                />
                <input 
                  type="text" 
                  className="input-styled" 
                  placeholder="Value" 
                  value={v.value} 
                  onChange={e => updateVar(i, 'value', e.target.value)}
                  disabled={isBuilding}
                />
                <button className="btn-icon" onClick={() => removeVarRow(i)} disabled={isBuilding}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            ))}
            <button className="btn-add" onClick={addVarRow} disabled={isBuilding}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Variable
            </button>
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
      </div>
    </div>
  )

  const renderRegistry = () => (
    <div className="page-transition">
      <header>
        <div>
          <h1 style={{ fontSize: '2.5rem' }}>Image Registry</h1>
          <div className="subtitle">Locally built Docker images</div>
        </div>
      </header>
      
      <div className="glass-panel" style={{ flexGrow: 1 }}>
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Docker Artifacts
          <button 
            onClick={fetchImages} 
            className="upload-btn-submit" 
            style={{ padding: '0.5rem 1rem', width: 'auto', fontSize: '0.9rem' }}
          >
            {isLoadingImages ? 'Refreshing...' : 'Refresh'}
          </button>
        </h2>
        
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Tag</th>
                <th>Image ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {images.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem' }}>
                    {isLoadingImages ? 'Loading registry...' : 'No Packer images found locally.'}
                  </td>
                </tr>
              ) : (
                images.map((img, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--primary-color)' }}>{img.repository}</td>
                    <td>{img.tag}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{img.id}</td>
                    <td><span className="template-type" style={{ background: 'var(--success-color)' }}>Available</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderSettings = () => (
    <div className="page-transition">
      <header>
        <div>
          <h1 style={{ fontSize: '2.5rem' }}>Settings</h1>
          <div className="subtitle">Cloud Credentials Management</div>
        </div>
      </header>

      <div className="glass-panel">
        <h2>AWS Credentials</h2>
        <div className="credentials-grid">
          <div className="form-group">
            <label>Access Key ID</label>
            <input type="text" className="input-styled" placeholder="AKIAIOSFODNN7EXAMPLE" />
          </div>
          <div className="form-group">
            <label>Secret Access Key</label>
            <input type="password" className="input-styled" placeholder="••••••••••••••••••••••••" />
          </div>
          <div className="form-group">
            <label>Default Region</label>
            <input type="text" className="input-styled" placeholder="us-east-1" />
          </div>
        </div>
        <button className="upload-btn-submit" style={{ marginTop: '1.5rem', width: '200px' }}>Save AWS Keys</button>
      </div>

      <div className="glass-panel" style={{ marginTop: '2.5rem' }}>
        <h2>Docker Hub Credentials</h2>
        <div className="credentials-grid">
          <div className="form-group">
            <label>Username</label>
            <input type="text" className="input-styled" placeholder="dockeruser" />
          </div>
          <div className="form-group">
            <label>Access Token / Password</label>
            <input type="password" className="input-styled" placeholder="••••••••••••••••" />
          </div>
        </div>
        <button className="upload-btn-submit" style={{ marginTop: '1.5rem', width: '200px' }}>Save Docker Auth</button>
      </div>
    </div>
  )

  const renderMockup = (title, icon) => (
    <div className="page-transition">
      <header>
        <div>
          <h1 style={{ fontSize: '2.5rem' }}>{title}</h1>
          <div className="subtitle">Platform Configuration</div>
        </div>
      </header>
      <div className="glass-panel" style={{ flexGrow: 1, justifyContent: 'center' }}>
        <div className="mockup-content">
          <div className="mockup-icon">{icon}</div>
          <h2 style={{ borderBottom: 'none', marginBottom: '1rem', fontSize: '1.8rem' }}>Under Construction</h2>
          <p style={{ maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
            The {title} module is currently being built out. Check back soon for advanced configuration options.
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="app-wrapper">
      {renderSidebar()}
      <main className="main-content">
        {currentView === 'pipelines' && renderPipelines()}
        {currentView === 'registry' && renderRegistry()}
        {currentView === 'integrations' && renderMockup('Integrations', '🔌')}
        {currentView === 'settings' && renderSettings()}
      </main>
    </div>
  )
}

export default App
