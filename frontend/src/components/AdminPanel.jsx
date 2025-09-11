import { useState, useEffect } from 'react'
import axios from 'axios'
import './AdminPanel.css'
//import { API_BASE } from '../App.jsx'

const AdminPanel = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [articles, setArticles] = useState([])
  const [currentArticle, setCurrentArticle] = useState({ title: '', content: '' })
  const [editingSlug, setEditingSlug] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

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
      const response = await axios.post(`/api/admin/login`, { password })
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
      const response = await axios.get(`/api/articles`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setArticles(response.data)
    } catch (error) {
      console.error('Error fetching articles:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const { title, content } = currentArticle
      
      if (!title.trim() || !content.trim()) {
        setMessage('Title and content are required')
        return
      }

      if (editingSlug) {
        // Update existing article
        await axios.put(`/api/admin/articles/${editingSlug}`, 
          { title, content },
          { headers: { Authorization: `Bearer ${authToken}` }}
        )
        setMessage('Article updated successfully!')
      } else {
        // Create new article
        await axios.post(`/api/admin/articles`, 
          { title, content },
          { headers: { Authorization: `Bearer ${authToken}` }}
        )
        setMessage('Article created successfully!')
      }

      setCurrentArticle({ title: '', content: '' })
      setEditingSlug(null)
      await fetchArticles(authToken)
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error saving article')
      console.error('Error saving article:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (article) => {
    setCurrentArticle({ title: article.title, content: article.content })
    setEditingSlug(article.slug)
    setMessage('')
  }

  const handleDelete = async (slug, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return
    }

    setLoading(true)
    try {
      await axios.delete(`/api/admin/articles/${slug}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      setMessage('Article deleted successfully!')
      await fetchArticles(authToken)
    } catch (error) {
      setMessage('Error deleting article')
      console.error('Error deleting article:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setAuthToken('')
    localStorage.removeItem('admin-token')
    setArticles([])
    setCurrentArticle({ title: '', content: '' })
    setEditingSlug(null)
    setMessage('')
  }

  const cancelEdit = () => {
    setCurrentArticle({ title: '', content: '' })
    setEditingSlug(null)
    setMessage('')
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-panel">
        <div className="admin-login">
          <h2>Admin Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          {message && <div className="message error">{message}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Article Management</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>

      {message && <div className={`message ${message.includes('Error') || message.includes('error') ? 'error' : 'success'}`}>{message}</div>}

      <div className="admin-content">
        <div className="article-form">
          <h2>{editingSlug ? 'Edit Article' : 'Create New Article'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="title">Title:</label>
              <input
                type="text"
                id="title"
                value={currentArticle.title}
                onChange={(e) => setCurrentArticle(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Article title"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="content">Content:</label>
              <textarea
                id="content"
                value={currentArticle.content}
                onChange={(e) => setCurrentArticle(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Article content"
                rows="15"
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading ? 'Saving...' : (editingSlug ? 'Update Article' : 'Create Article')}
              </button>
              {editingSlug && (
                <button type="button" onClick={cancelEdit} className="cancel-btn">
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="articles-list">
          <h2>Existing Articles ({articles.length})</h2>
          {articles.length === 0 ? (
            <p>No articles found.</p>
          ) : (
            <div className="articles">
              {articles.map((article) => (
                <div key={article.slug} className="article-item">
                  <h3>{article.title}</h3>
                  <p className="article-meta">
                    Slug: {article.slug}<br />
                    Created: {new Date(article.createdAt).toLocaleDateString()}<br />
                    Updated: {new Date(article.updatedAt).toLocaleDateString()}
                  </p>
                  <div className="article-actions">
                    <button onClick={() => handleEdit(article)} className="edit-btn">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(article.slug, article.title)} className="delete-btn">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminPanel