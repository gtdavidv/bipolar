const express = require('express');
const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage, AIMessage } = require('langchain/schema');
const router = express.Router();

// Initialize LangChain ChatOpenAI model
const chatModel = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_KEY,
  modelName: 'gpt-5-nano',
  temperature: 1,
  maxCompletionTokens: 100
});

// System message for Long COVID assistance
const systemMessage = new SystemMessage(`You are a knowledgeable and empathetic assistant specializing in Long COVID (Post-COVID-19 condition). You provide accurate, up-to-date information about:

- Long COVID symptoms and their management
- Treatment approaches and therapies
- Current research and clinical trials
- Lifestyle modifications and coping strategies
- When to seek medical care

Guidelines for your responses:
- Be empathetic and understanding
- Provide evidence-based information
- Always recommend consulting healthcare professionals for medical decisions
- Acknowledge the complexity and variability of Long COVID
- Keep responses concise but informative
- Avoid giving specific medical diagnoses or prescribing treatments

If asked about topics unrelated to Long COVID, politely redirect the conversation back to Long COVID-related topics.

Do not assume the human has COVID.`);

// Function to estimate token count (rough approximation)
function estimateTokens(text) {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Function to trim conversation history to fit within token limit
function trimConversationHistory(messages, maxTokens = 30000) {
  let totalTokens = estimateTokens(systemMessage.content);
  const trimmedMessages = [];
  
  // Process messages from most recent to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const messageTokens = estimateTokens(message.text);
    
    if (totalTokens + messageTokens <= maxTokens) {
      totalTokens += messageTokens;
      trimmedMessages.unshift(message); // Add to beginning to maintain order
    } else {
      break; // Stop adding messages if we exceed token limit
    }
  }
  
  return trimmedMessages;
}

// Chat endpoint using LangChain with conversation context
router.post('/', async (req, res) => {
  try {
    const { message, messages, conversationHistory = [] } = req.body;

    // Handle both single message and multiple messages
    let userMessages = [];
    if (message) {
      // Legacy single message support
      userMessages = [message];
    } else if (messages && Array.isArray(messages)) {
      // New multiple messages support
      userMessages = messages.filter(msg => typeof msg === 'string' && msg.trim());
    }

    if (userMessages.length === 0) {
      return res.status(400).json({ error: 'At least one message is required' });
    }

    if (!process.env.OPENAI_KEY) {
      console.error('OpenAI API key not configured');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Trim conversation history to fit within token limits
    const trimmedHistory = trimConversationHistory(conversationHistory);

    // Build messages array for ChatOpenAI
    const chatMessages = [systemMessage];

    // Add conversation history
    for (const historyMessage of trimmedHistory) {
      if (historyMessage.sender === 'user') {
        chatMessages.push(new HumanMessage(historyMessage.text));
      } else if (historyMessage.sender === 'bot') {
        chatMessages.push(new AIMessage(historyMessage.text));
      }
    }

    // Add all pending user messages
    for (const userMessage of userMessages) {
      chatMessages.push(new HumanMessage(userMessage));
    }

    // Get response from ChatOpenAI
    const response = await chatModel.call(chatMessages);

    const aiResponse = response.content;

    if (!aiResponse) {
      throw new Error('No response received from ChatOpenAI');
    }

    res.json({
      response: aiResponse.trim()
    });
    
  } catch (error) {
    console.error('Chat endpoint error:', error);
    
    // Handle specific OpenAI/LangChain errors
    if (error.message && error.message.includes('401')) {
      return res.status(500).json({ error: 'Invalid API key configuration' });
    } else if (error.message && error.message.includes('429')) {
      return res.status(503).json({ error: 'API rate limit exceeded. Please try again later.' });
    } else if (error.message && error.message.includes('503')) {
      return res.status(503).json({ error: 'OpenAI service is currently unavailable. Please try again later' });
    }
    
    // Generic error response
    res.status(500).json({ error: 'Unable to process your request at this time. Please try again.' });
  }
});

module.exports = router;