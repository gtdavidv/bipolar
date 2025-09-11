import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import ChatInterface from './components/ChatInterface'
import AddArticle from './components/AddArticle'
import AdminManage from './components/AdminManage'
import ArticlesList from './components/ArticlesList'
import ArticleView from './components/ArticleView'
import './App.css'

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/admin/add-article" element={<AddArticle />} />
          <Route path="/admin/manage" element={<AdminManage />} />
          <Route path="/articles" element={<ArticlesList />} />
          <Route path="/articles/:slug" element={<ArticleView />} />
        </Routes>
      </div>
    </Router>
  )
}

function ChatPage() {
  return (
    <>
      <header className="App-header">
        <h1>Bipolar Disorder Chat</h1>
        <nav className="main-nav">
          <Link to="/articles" className="nav-link">
            📚 Browse Articles
          </Link>
          <Link to="/admin/add-article" className="nav-link admin-link">
            ✏️ Add Article
          </Link>
          <Link to="/admin/manage" className="nav-link admin-link">
            ⚙️ Manage Articles
          </Link>
        </nav>
      </header>
      
      <main className="chat-main">
        <ChatInterface />
      </main>
    </>
  )
}

export default App