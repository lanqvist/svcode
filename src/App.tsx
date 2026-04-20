import { useState } from 'react'

function App() {
  const [prompt, setPrompt] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [prUrl, setPrUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    setPreviewUrl('')
    setPrUrl('')

    try {
      console.log('Sending prompt to /api/generate...')
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      console.log('Response status:', response.status)
      const text = await response.text()
      console.log('Response body:', text)

      const data = JSON.parse(text)

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed')
      }

      console.log('Success! PR URL:', data.prUrl)
      setPreviewUrl(data.previewUrl)
      setPrUrl(data.prUrl)
      setSuccess(`Project "${data.repo}" created successfully!`)
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '10px', fontSize: '2rem' }}>Vibe Coding Tool</h1>
      <p style={{ marginBottom: '30px', color: '#888' }}>Describe your React app in natural language</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        <div>
          <h2 style={{ marginBottom: '20px' }}>1. Describe Your App</h2>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Example: Create a todo list application with the following features:
- Header with app title
- Input field to add new tasks
- List of tasks with checkboxes
- Delete button for each task
- Filter buttons: All / Active / Completed

Use functional components and CSS styling."
            rows={12}
            style={{
              width: '100%',
              padding: '12px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '8px',
              color: '#fff',
              fontFamily: 'inherit',
              resize: 'vertical',
              lineHeight: '1.5'
            }}
          />

          {error && (
            <div style={{ color: '#ff6b6b', marginTop: '10px', padding: '10px', background: 'rgba(255,107,107,0.1)', borderRadius: '8px' }}>{error}</div>
          )}

          {success && (
            <div style={{ color: '#51cf66', marginTop: '10px', padding: '10px', background: 'rgba(81,207,102,0.1)', borderRadius: '8px' }}>{success}</div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              background: loading || !prompt.trim() ? '#444' : '#0066ff',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {loading ? 'Generating...' : 'Generate & Create PR'}
          </button>
        </div>

        <div>
          <h2 style={{ marginBottom: '20px' }}>2. Preview</h2>
          {previewUrl ? (
            <iframe
              src={previewUrl}
              style={{
                width: '100%',
                height: '500px',
                border: '1px solid #444',
                borderRadius: '8px'
              }}
            />
          ) : (
            <div style={{
              padding: '40px',
              background: '#2a2a2a',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#888'
            }}>
              Preview will appear here
            </div>
          )}

          {prUrl && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '10px' }}>3. Pull Request</h3>
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  background: '#28a745',
                  color: '#fff',
                  textDecoration: 'none',
                  borderRadius: '8px'
                }}
              >
                View PR on GitHub
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
