import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import AdminAuth from './AdminAuth'
import useAuth from '../hooks/useAuth'
import './AddArticle.css'

const AddArticle = () => {
  const navigate = useNavigate()
  const { authToken } = useAuth()
  const [article, setArticle] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')


  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const { title, content } = article
      
      if (!title.trim() || !content.trim()) {
        setMessage('Title and content are required')
        return
      }

      await axios.post(`/api/admin/articles`, 
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


  return (
    <AdminAuth title="Add New Article">
      {({ logout }) => (
    <div className="add-article-container">
      <header className="add-article-header">
        <div className="header-content">
          <h1>Add New Article</h1>
          <div className="header-actions">
            <Link to="/articles" className="nav-btn">Browse Articles</Link>
            <Link to="/" className="nav-btn">Back to Chat</Link>
            <button onClick={logout} className="logout-btn">Logout</button>
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
      )}
    </AdminAuth>
  )
}

export default AddArticle