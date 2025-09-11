import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import './AdminManage.css'
import { API_BASE } from '../App.jsx'

const AdminManage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('admin-token')
    if (token) {
      setAuthToken(token)
      setIsAuthenticated(true)
      fetchArticles(token)
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await axios.post(`${API_BASE}/api/admin/login`, { password })
      const token = response.data.token
      
      setAuthToken(token)
      setIsAuthenticated(true)
      localStorage.setItem('admin-token', token)
      setPassword('')
      setMessage('Login successful!')
      
      await fetchArticles(token)
    } catch (error) {
      setMessage('Invalid password')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchArticles = async (token) => {
    try {
      const response = await axios.get('/api/articles')
      setArticles(response.data)
    } catch (error) {
      console.error('Error fetching articles:', error)
      setMessage('Failed to fetch articles')
    }
  }

  const handleDelete = async (slug, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?\n\nThis action cannot be undone.`)) {
      return
    }

    setDeleteLoading(slug)
    try {
      await axios.delete(`${API_BASE}/api/admin/articles/${slug}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      setMessage(`Article "${title}" deleted successfully!`)
      await fetchArticles(authToken)
    } catch (error) {
      setMessage('Error deleting article')
      console.error('Error deleting article:', error)
    } finally {
      setDeleteLoading(null)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setAuthToken('')
    localStorage.removeItem('admin-token')
    setArticles([])
    setMessage('')
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-manage-container">
        <div className="admin-login">
          <h2>Admin Access Required</h2>
          <p>Please enter the admin password to manage articles.</p>
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
            <Link to="/admin/add-article" className="back-link">Add Article</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-manage-container">
      <header className="admin-header">
        <div className="header-content">
          <h1>Manage Articles</h1>
          <div className="header-actions">
            <Link to="/admin/add-article" className="nav-btn primary">Add New Article</Link>
            <Link to="/articles" className="nav-btn">Browse Articles</Link>
            <Link to="/" className="nav-btn">Back to Chat</Link>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      {message && (
        <div className={`message ${message.includes('Error') || message.includes('error') || message.includes('Invalid') || message.includes('Failed') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <main className="admin-main">
        <div className="articles-summary">
          <h2>All Articles ({articles.length})</h2>
          <p>Manage your published articles below. You can delete articles or add new ones.</p>
        </div>

        {articles.length === 0 ? (
          <div className="no-articles">
            <h3>No Articles Found</h3>
            <p>You haven't created any articles yet.</p>
            <Link to="/admin/add-article" className="add-first-btn">
              Create Your First Article
            </Link>
          </div>
        ) : (
          <div className="articles-grid">
            {articles.map((article) => (
              <div key={article.slug} className="article-card">
                <div className="article-header">
                  <h3 className="article-title">{article.title}</h3>
                  <Link 
                    to={`/articles/${article.slug}`} 
                    className="view-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Live →
                  </Link>
                </div>
                
                <div className="article-meta">
                  <div className="meta-item">
                    <strong>Slug:</strong> {article.slug}
                  </div>
                  <div className="meta-item">
                    <strong>Created:</strong> {new Date(article.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  {article.updatedAt !== article.createdAt && (
                    <div className="meta-item">
                      <strong>Updated:</strong> {new Date(article.updatedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>

                <div className="article-actions">
                  <button 
                    onClick={() => handleDelete(article.slug, article.title)}
                    disabled={deleteLoading === article.slug}
                    className="delete-btn"
                  >
                    {deleteLoading === article.slug ? 'Deleting...' : 'Delete Article'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminManage