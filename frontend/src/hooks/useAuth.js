import { useState, useEffect } from 'react'
import axios from 'axios'

const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authToken, setAuthToken] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('admin-token')
    if (token) {
      setAuthToken(token)
      setIsAuthenticated(true)
    }
  }, [])

  const login = async (password) => {
    setLoading(true)
    
    try {
      const response = await axios.post('/api/admin/login', { password })
      const token = response.data.token;
      
      setAuthToken(token)
      setIsAuthenticated(true)
      localStorage.setItem('admin-token', token)
      
      return { success: true, message: 'Login successful!' }
      
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
      }
      
      console.error('Login error:', error)
      
      let errorMessage = 'Login failed - please try again'
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid password'
      } else if (error.response?.status === 500) {
        errorMessage = 'Server configuration error - admin password not set'
      }
      
      return { success: false, message: errorMessage }
    
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setIsAuthenticated(false);
    setAuthToken('');
    localStorage.removeItem('admin-token');
  }

  return {
    isAuthenticated,
    authToken,
    loading,
    login,
    logout
  }
}

export default useAuth