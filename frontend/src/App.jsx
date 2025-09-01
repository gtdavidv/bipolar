import ChatInterface from './components/ChatInterface'
import './App.css'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Long COVID Chat</h1>
      </header>
      
      <main className="chat-main">
        <ChatInterface />
      </main>
    </div>
  )
}

export default App