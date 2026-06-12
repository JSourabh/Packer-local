import { useState, useEffect, useRef } from 'react'
import { Terminal, Box, Plug, Settings, TrendingUp, TrendingDown, UploadCloud, X, Hexagon, Globe, Shield, Cpu } from 'lucide-react'
import './index.css'

function App() {
  const [showDashboard, setShowDashboard] = useState(false)
  const [currentView, setCurrentView] = useState('pipelines')
  const [pipelineTab, setPipelineTab] = useState('execution')

  // Dashboard States
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [isBuilding, setIsBuilding] = useState(false)
  const [logs, setLogs] = useState([])
  const terminalRef = useRef(null)
  
  const [buildVars, setBuildVars] = useState([{ key: '', value: '' }])
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [images, setImages] = useState([])
  const [isLoadingImages, setIsLoadingImages] = useState(false)

  // Custom AMI Form State
  const [amiForm, setAmiForm] = useState({
    platform: 'aws',
    imageName: '',
    baseAmi: 'ami-0c7217cdde317cfec',
    baseImage: 'ubuntu:22.04',
    instanceType: 't2.micro',
    region: 'us-east-1',
    toolName: '',
    requirement: ''
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateStatus, setGenerateStatus] = useState('')

  // Bento Spotlight effect
  const handleBentoHover = (e) => {
    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    card.style.setProperty('--x', `${x}px`)
    card.style.setProperty('--y', `${y}px`)
  }

  const fetchTemplates = () => {
    fetch('http://localhost:3001/api/templates')
      .then(res => res.json())
      .then(data => setTemplates(data))
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
            if (match) return { repository: match[1], tag: match[2], id: match[3] }
            return { repository: imgStr, tag: '-', id: '-' }
          })
          setImages(parsed)
        }
      })
      .catch(err => console.error('Failed to fetch images:', err))
      .finally(() => setIsLoadingImages(false))
  }

  useEffect(() => {
    if (showDashboard) {
      fetchTemplates()
      fetchImages()
    }
  }, [showDashboard])

  useEffect(() => {
    if (currentView === 'registry' && showDashboard) {
      fetchImages()
    }
  }, [currentView, showDashboard])

  useEffect(() => {
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
        if (data.error) setUploadStatus(`Error: ${data.error}`)
        else {
          setUploadStatus('Success!')
          setSelectedFile(null)
          fetchTemplates()
        }
      })
      .catch(err => {
        console.error('Upload failed:', err)
        setUploadStatus('Upload failed.')
      })
      .finally(() => setIsUploading(false))
  }

  const handleGenerate = () => {
    setIsGenerating(true)
    setGenerateStatus('Generating...')
    
    fetch('http://localhost:3001/api/templates/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(amiForm)
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) setGenerateStatus(`Error: ${data.error}`)
        else {
          setGenerateStatus('Success!')
          fetchTemplates() // Refresh the list
        }
      })
      .catch(err => {
        console.error('Generate failed:', err)
        setGenerateStatus(`Failed: ${err.message || 'Network Error'}`)
      })
      .finally(() => setIsGenerating(false))
  }

  const updateVar = (index, field, val) => {
    const newVars = [...buildVars]
    newVars[index][field] = val
    setBuildVars(newVars)
  }

  // --- RENDERING LANDING PAGE ---
  if (!showDashboard) {
    return (
      <div className="page-transition">
        <div className="ambient-bg"></div>
        <div className="ambient-glow"></div>

        <nav className="landing-nav">
          <div className="nav-brand">
            <Hexagon size={24} color="var(--primary-color)" />
            Nexus Engine
          </div>
          <div className="nav-links">
            <span className="nav-link">Features</span>
            <span className="nav-link">Solutions</span>
            <span className="nav-link">Pricing</span>
          </div>
          <div className="nav-actions">
            <button className="btn-secondary">Watch Demo</button>
            <button className="btn-primary" onClick={() => setShowDashboard(true)}>Get Started</button>
          </div>
        </nav>

        <section className="hero-section">
          <div className="hero-content">
            <div className="hero-badge animate-fade-delayed">
              <span className="pulse-dot"></span> [ NEW: AI Engine v2.0 ]
            </div>
            <h1 className="animate-reveal">Architecting the Future of Enterprise Data Pipelines</h1>
            <p className="animate-fade-delayed">
              Automate infrastructure deployment, monitor container lifecycles, and scale without configuration bottlenecks.
            </p>
            <div className="hero-buttons animate-fade-delayed" style={{ animationDelay: '0.4s' }}>
              <button className="btn-primary" onClick={() => setShowDashboard(true)}>Get Started Now</button>
              <button className="btn-secondary">Read Documentation</button>
            </div>
          </div>
        </section>

        <section className="bento-section animate-fade-delayed" style={{ animationDelay: '0.6s' }}>
          <div className="bento-grid">
            <div className="bento-card card-wide" onMouseMove={handleBentoHover}>
              <div className="bento-card-content">
                <h3>Live CI/CD Telemetry</h3>
                <p style={{ marginBottom: '1rem' }}>Stream build logs directly from immutable infrastructure.</p>
                <div className="terminal-container" style={{ height: '100%', minHeight: '150px' }}>
                  <div className="terminal-line" style={{color: '#a1a1aa'}}>Initializing build context...</div>
                  <div className="terminal-line" style={{color: '#a1a1aa'}}>Fetching ubuntu:22.04 layer 4f4d2f8e...</div>
                  <div className="terminal-line success">Successfully pulled image payload</div>
                  <div className="terminal-line" style={{color: 'var(--primary-color)'}}>Executing Ansible Provisioner [v1.1.2]</div>
                </div>
              </div>
            </div>

            <div className="bento-card card-narrow" onMouseMove={handleBentoHover}>
              <div className="bento-card-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Globe size={64} color="var(--primary-color)" strokeWidth={1.5} />
                <h3 style={{ marginTop: '1rem' }}>Global Latency</h3>
                <p style={{ textAlign: 'center' }}>99.9% uptime tracking</p>
              </div>
            </div>

            <div className="bento-card card-narrow" onMouseMove={handleBentoHover}>
              <div className="bento-card-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={64} color="var(--primary-color)" strokeWidth={1.5} />
                <h3 style={{ marginTop: '1rem' }}>Isolated Containers</h3>
                <p style={{ textAlign: 'center' }}>Secure web silos</p>
              </div>
            </div>

            <div className="bento-card card-wide" onMouseMove={handleBentoHover}>
              <div className="bento-card-content">
                <h3>Dynamic Configuration</h3>
                <p style={{ marginBottom: '1rem' }}>Inject real-time variables securely.</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="input-styled" style={{ flex: 1, pointerEvents: 'none' }}>AWS_REGION=us-east-1</div>
                  <div className="input-styled" style={{ flex: 1, pointerEvents: 'none' }}>ENV=production</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  // --- RENDERING DASHBOARD ---

  const renderSidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => setShowDashboard(false)}>
          <Cpu size={24} color="var(--primary-color)" />
          Nexus
        </h1>
        <div style={{ color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '2px', marginTop: '4px' }}>
          DEVOPS CORE
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className={`nav-item ${currentView === 'pipelines' ? 'active' : ''}`} onClick={() => setCurrentView('pipelines')}>
          <Terminal size={20} />
          Build Pipelines
        </div>
        <div className={`nav-item ${currentView === 'registry' ? 'active' : ''}`} onClick={() => setCurrentView('registry')}>
          <Box size={20} />
          Image Registry
        </div>
        <div className={`nav-item ${currentView === 'integrations' ? 'active' : ''}`} onClick={() => setCurrentView('integrations')}>
          <Plug size={20} />
          Integrations
        </div>
        <div className={`nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setCurrentView('settings')}>
          <Settings size={20} />
          Settings
        </div>
      </nav>
    </aside>
  )

  const renderPipelines = () => (
    <div className="page-transition">
      <div className="main-header">
        <div>
          <h1>Build Pipelines</h1>
          <div className="subtitle">Execute and monitor Packer templates</div>
        </div>
        <div className="status-indicator">
          <div className={`dot ${isBuilding ? 'pulse' : ''}`}></div>
          {isBuilding ? 'Build in Progress' : 'System Ready'}
        </div>
      </div>

      <div className="metric-cards">
        <div className="metric-card stagger-1">
          <div className="metric-header">
            <div>
              <div className="metric-value">98.5%</div>
              <div className="metric-label">Build Success Rate</div>
            </div>
            <div className="metric-trend trend-up">
              <TrendingUp size={16} />
              +2.1%
            </div>
          </div>
          <div className="sparkline-container">
            <svg viewBox="0 0 100 30" width="100%" height="100%" preserveAspectRatio="none">
              <path d="M0,25 L10,20 L20,22 L30,15 L40,18 L50,10 L60,12 L70,5 L80,8 L90,2 L100,0" fill="none" stroke="var(--success-color)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <path d="M0,25 L10,20 L20,22 L30,15 L40,18 L50,10 L60,12 L70,5 L80,8 L90,2 L100,0 L100,30 L0,30 Z" fill="rgba(16, 185, 129, 0.1)" stroke="none" />
            </svg>
          </div>
        </div>
        <div className="metric-card stagger-2">
          <div className="metric-header">
            <div>
              <div className="metric-value">2m 14s</div>
              <div className="metric-label">Avg. Build Duration</div>
            </div>
            <div className="metric-trend trend-down">
              <TrendingDown size={16} />
              -12s
            </div>
          </div>
          <div className="sparkline-container">
            <svg viewBox="0 0 100 30" width="100%" height="100%" preserveAspectRatio="none">
              <path d="M0,15 L10,18 L20,12 L30,20 L40,15 L50,22 L60,18 L70,25 L80,20 L90,28 L100,25" fill="none" stroke="var(--primary-color)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        </div>
        <div className="metric-card stagger-3">
          <div className="metric-header">
            <div>
              <div className="metric-value">{templates.length}</div>
              <div className="metric-label">Active Templates</div>
            </div>
          </div>
          <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Ready for execution across AWS and Docker targets.
          </div>
        </div>
      </div>

      <div className="sub-nav">
        <div className={`sub-nav-item ${pipelineTab === 'execution' ? 'active' : ''}`} onClick={() => setPipelineTab('execution')}>
          Pipeline Execution
        </div>
        <div className={`sub-nav-item ${pipelineTab === 'management' ? 'active' : ''}`} onClick={() => setPipelineTab('management')}>
          Template Library
        </div>
      </div>

      {pipelineTab === 'execution' && (
        <div className="dashboard stagger-2">
          <div className="glass-panel stagger-3">
            <h2>Select Build Target</h2>
            <select 
              className="input-styled" 
              value={selectedTemplate?.id || ""}
              onChange={(e) => {
                if (e.target.value === 'new_build') {
                  setPipelineTab('management');
                  setSelectedTemplate(null);
                } else {
                  const t = templates.find(t => t.id === e.target.value);
                  if(t) setSelectedTemplate(t);
                }
              }}
              disabled={isBuilding}
              style={{ width: '100%', cursor: 'pointer' }}
            >
              <option value="" disabled>Select a build target...</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.type})
                </option>
              ))}
              <option value="new_build">+ New Build</option>
            </select>

          <div className="upload-section" style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Build Variables</h3>
            {buildVars.map((v, i) => (
              <div key={i} className="var-row">
                <input type="text" className="input-styled" placeholder="Key" value={v.key} onChange={e => updateVar(i, 'key', e.target.value)} disabled={isBuilding} />
                <input type="text" className="input-styled" placeholder="Value" value={v.value} onChange={e => updateVar(i, 'value', e.target.value)} disabled={isBuilding} />
                <button className="btn-icon" onClick={() => setBuildVars(buildVars.filter((_, idx) => idx !== i))} disabled={isBuilding}>
                  <X size={20} />
                </button>
              </div>
            ))}
            <button className="btn-add" onClick={() => setBuildVars([...buildVars, { key: '', value: '' }])} disabled={isBuilding}>
              Add Variable
            </button>
          </div>

          <button className="build-btn" onClick={handleBuild} disabled={!selectedTemplate || isBuilding}>
            {isBuilding ? 'Building Pipeline...' : 'Start Build Pipeline'}
          </button>
        </div>

        <div className="glass-panel stagger-4" style={{ padding: '0' }}>
          <div className="terminal-header">
            <h2 style={{ borderBottom: 'none', padding: 0, margin: 0 }}>Live Build Logs</h2>
          </div>
          <div className="terminal-container" ref={terminalRef}>
            {logs.length === 0 ? (
              <div style={{ color: '#52525b', fontStyle: 'italic', display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
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
      )}

      {pipelineTab === 'management' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
          <div className="glass-panel stagger-2">
            <h2>Generate Custom Template</h2>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Target Platform</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', cursor: 'pointer', textTransform: 'none' }}>
                  <input type="radio" name="platform" value="aws" checked={amiForm.platform === 'aws'} onChange={() => setAmiForm({...amiForm, platform: 'aws'})} /> AWS AMI
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', cursor: 'pointer', textTransform: 'none' }}>
                  <input type="radio" name="platform" value="docker" checked={amiForm.platform === 'docker'} onChange={() => setAmiForm({...amiForm, platform: 'docker'})} /> Docker Image
                </label>
              </div>
            </div>

            <div className="credentials-grid" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Image Name</label>
                <input type="text" className="input-styled" placeholder="my-custom-app" value={amiForm.imageName} onChange={e => setAmiForm({...amiForm, imageName: e.target.value})} disabled={isGenerating} />
              </div>
              
              {amiForm.platform === 'aws' ? (
                <>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Base AMI</label>
                    <input type="text" className="input-styled" placeholder="ami-0c7217cdde317cfec" value={amiForm.baseAmi} onChange={e => setAmiForm({...amiForm, baseAmi: e.target.value})} disabled={isGenerating} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Instance Type</label>
                    <input type="text" className="input-styled" placeholder="t2.micro" value={amiForm.instanceType} onChange={e => setAmiForm({...amiForm, instanceType: e.target.value})} disabled={isGenerating} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Region</label>
                    <input type="text" className="input-styled" placeholder="us-east-1" value={amiForm.region} onChange={e => setAmiForm({...amiForm, region: e.target.value})} disabled={isGenerating} />
                  </div>
                </>
              ) : (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Base Docker Image</label>
                  <input type="text" className="input-styled" placeholder="ubuntu:22.04" value={amiForm.baseImage} onChange={e => setAmiForm({...amiForm, baseImage: e.target.value})} disabled={isGenerating} />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tool Name</label>
                <input type="text" className="input-styled" placeholder="nodejs" value={amiForm.toolName} onChange={e => setAmiForm({...amiForm, toolName: e.target.value})} disabled={isGenerating} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Requirement</label>
                <input type="text" className="input-styled" placeholder="npm" value={amiForm.requirement} onChange={e => setAmiForm({...amiForm, requirement: e.target.value})} disabled={isGenerating} />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button className="build-btn" style={{ marginTop: 0, flex: 1 }} onClick={handleGenerate} disabled={isGenerating || !amiForm.imageName}>
                {isGenerating ? 'Generating...' : 'Generate Template'}
              </button>
              {generateStatus && (
                <span style={{ color: generateStatus.includes('Failed') ? 'var(--danger-color)' : 'var(--success-color)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  {generateStatus}
                </span>
              )}
            </div>
          </div>

          <div className="glass-panel stagger-3">
            <h2>Upload Existing Template</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Upload an existing `.pkr.hcl` Packer file. It will be added to the registry and made available for immediate execution in your pipelines.
            </p>
            <div className="file-input-wrapper">
              <button className="btn-upload-ui" style={{ padding: '2rem' }}>
                <UploadCloud size={32} style={{ marginBottom: '0.5rem' }} />
                {selectedFile ? selectedFile.name : 'Click to Select .pkr.hcl File'}
              </button>
              <input type="file" accept=".pkr.hcl,.hcl" onChange={handleFileChange} disabled={isUploading} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1.5rem' }}>
              <button className="build-btn" style={{ marginTop: 0, flex: 1 }} onClick={handleUpload} disabled={isUploading || !selectedFile}>
                {isUploading ? 'Uploading...' : 'Upload File'}
              </button>
              {uploadStatus && (
                <span style={{ color: uploadStatus.includes('Success') ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  {uploadStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderRegistry = () => (
    <div className="page-transition">
      <div className="main-header">
        <div>
          <h1>Image Registry</h1>
          <div className="subtitle">Locally built Docker images</div>
        </div>
      </div>
      
      <div className="glass-panel stagger-1" style={{ flexGrow: 1 }}>
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Docker Artifacts
          <button onClick={fetchImages} className="btn-secondary" style={{ padding: '0.5rem 1rem', width: 'auto', fontSize: '0.9rem' }}>
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
      <div className="main-header">
        <div>
          <h1>Settings</h1>
          <div className="subtitle">Cloud Credentials Management</div>
        </div>
      </div>

      <div className="glass-panel stagger-1">
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
        <button className="build-btn" style={{ marginTop: '1.5rem', width: '200px' }}>Save AWS Keys</button>
      </div>

      <div className="glass-panel stagger-2" style={{ marginTop: '2.5rem' }}>
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
        <button className="build-btn" style={{ marginTop: '1.5rem', width: '200px' }}>Save Docker Auth</button>
      </div>
    </div>
  )

  const renderMockup = (title, icon) => (
    <div className="page-transition">
      <div className="main-header">
        <div>
          <h1>{title}</h1>
          <div className="subtitle">Platform Configuration</div>
        </div>
      </div>
      <div className="glass-panel stagger-1" style={{ flexGrow: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.5 }}>{icon}</div>
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
