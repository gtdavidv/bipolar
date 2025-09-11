import { useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import '../styles/AdminAuth.css'

const AdminAuth = ({ children, title = "Admin Access Required", showNavigation = true }) => {
  const { isAuthenticated, authToken, loading, login, logout } = useAuth()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setMessage('Password is required');
      return
    }

    const result = await login(password);
    
    if (result.success) {
      setPassword('');
      setMessage('');
    } else {
      setMessage(result.message);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-auth-container">
        <div className="admin-login">
          <h2>{title}</h2>
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
          
          {showNavigation && (
            <div className="back-to-site">
              <Link to="/" className="back-link">← Back to Chat</Link>
              <Link to="/articles" className="back-link">Browse Articles</Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  return children({ logout })
}

export default AdminAuth