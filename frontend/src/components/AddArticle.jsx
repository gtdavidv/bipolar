import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import './AddArticle.css'

const AddArticle = () => {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [article, setArticle] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('admin-token')
    if (token) {
      setAuthToken(token)
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await axios.post('/api/admin/login', { password })
      const token = response.data.token
      
      setAuthToken(token)
      setIsAuthenticated(true)
      localStorage.setItem('admin-token', token)
      setPassword('')
      setMessage('Login successful!')
    } catch (error) {
      setMessage('Invalid password')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const { title, content } = article
      
      if (!title.trim() || !content.trim()) {
        setMessage('Title and content are required')
        return
      }

      await axios.post('/api/admin/articles', 
        { title, content },
        { headers: { Authorization: `Bearer ${authToken}` }}
      )
      
      setMessage('Article created successfully!')
      setArticle({ title: '', content: '' })
      
      // Redirect to articles page after successful creation
      setTimeout(() => {
        navigate('/articles')
      }, 2000)
      
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error creating article')
      console.error('Error creating article:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setAuthToken('')
    localStorage.removeItem('admin-token')
    setArticle({ title: '', content: '' })
    setMessage('')
  }

  if (!isAuthenticated) {
    return (
      <div className="add-article-container">
        <div className="admin-login">
          <h2>Admin Access Required</h2>
          <p>Please enter the admin password to add a new article.</p>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="password">Admin Password:</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="login-btn">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          {message && <div className="message error">{message}</div>}
          
          <div className="back-to-site">
            <Link to="/" className="back-link">← Back to Chat</Link>
            <Link to="/articles" className="back-link">Browse Articles</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="add-article-container">
      <header className="add-article-header">
        <div className="header-content">
          <h1>Add New Article</h1>
          <div className="header-actions">
            <Link to="/articles" className="nav-btn">Browse Articles</Link>
            <Link to="/" className="nav-btn">Back to Chat</Link>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      {message && (
        <div className={`message ${message.includes('Error') || message.includes('error') || message.includes('Invalid') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <main className="add-article-main">
        <form onSubmit={handleSubmit} className="article-form">
          <div className="form-group">
            <label htmlFor="title">Article Title</label>
            <input
              type="text"
              id="title"
              value={article.title}
              onChange={(e) => setArticle(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter a descriptive title for your article"
              required
              className="title-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">Article Content</label>
            <textarea
              id="content"
              value={article.content}
              onChange={(e) => setArticle(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Write your article content here. You can use line breaks to separate paragraphs."
              rows="20"
              required
              className="content-textarea"
            />
            <div className="content-help">
              <p><strong>Formatting tips:</strong></p>
              <ul>
                <li>Use single line breaks for line breaks within a paragraph</li>
                <li>Use double line breaks (press Enter twice) to create new paragraphs with spacing</li>
                <li>Keep paragraphs focused and readable</li>
                <li>Include accurate, evidence-based information</li>
                <li>Remember to cite sources when referencing studies</li>
              </ul>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Creating Article...' : 'Create Article'}
            </button>
            <button 
              type="button" 
              onClick={() => setArticle({ title: '', content: '' })} 
              className="clear-btn"
              disabled={loading}
            >
              Clear Form
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default AddArticle