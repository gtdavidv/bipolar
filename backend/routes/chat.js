const express = require('express');
const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage, AIMessage } = require('langchain/schema');
const chromaService = require('../services/chromaService');
const router = express.Router();

// Initialize LangChain ChatOpenAI model
const chatModel = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_KEY,
  modelName: 'gpt-5-nano',
  temperature: 1,
  maxCompletionTokens: 100
});

// System message for bipolar disorder assistance with RAG
const createSystemMessage = (relevantStudies = []) => {
  let systemContent = `You are a knowledgeable and empathetic assistant specializing in bipolar disorder. You provide accurate, up-to-date information based on current research and clinical guidelines.`;

  if (relevantStudies.length > 0) {
    systemContent += `\n\nRelevant research context:\n`;
    relevantStudies.forEach((study, index) => {
      systemContent += `\n${index + 1}. ${study.citation}\n${study.content}\n`;
    });
    systemContent += `\nUse this research context to inform your response. Always cite sources when referencing specific studies.`;
  }

  systemContent += `\n\nGuidelines for your responses:
- Be empathetic and understanding
- Provide evidence-based information
- Always recommend consulting healthcare professionals for medical decisions
- Acknowledge the complexity and variability of bipolar disorder experiences
- Keep responses concise but informative
- Avoid giving specific medical diagnoses or prescribing treatments
- When referencing research, include citations
- Be sensitive to mood episodes and crisis situations

If asked about topics unrelated to bipolar disorder, politely redirect the conversation back to bipolar disorder-related topics.

Do not assume the human has bipolar disorder or make diagnostic assessments.`;

  return new SystemMessage(systemContent);
};

// Function to estimate token count (rough approximation)
function estimateTokens(text) {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Function to trim conversation history to fit within token limit
function trimConversationHistory(messages, systemMessageContent, maxTokens = 30000) {
  let totalTokens = estimateTokens(systemMessageContent);
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

    // Initialize Chroma service
    await chromaService.initialize();

    // Query relevant studies for the user's message
    const lastUserMessage = userMessages[userMessages.length - 1];
    const relevantStudies = await chromaService.queryRelevantStudies(lastUserMessage, 3);

    // Create system message with relevant studies
    const systemMessage = createSystemMessage(relevantStudies);

    // Trim conversation history to fit within token limits
    const trimmedHistory = trimConversationHistory(conversationHistory, systemMessage.content);

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
      response: aiResponse.trim(),
      sources: relevantStudies.map(study => ({
        citation: study.citation,
        similarity: study.similarity
      }))
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