// src/features/conversations/conversation.routes.js
const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversation.controller');

// Matches your frontend: /api/whatsapp-conversations/conversations
router.get('/conversations', conversationController.getConversations);

// Matches your frontend: /api/whatsapp-conversations/conversations/:id/messages
router.get('/conversations/:conversationId/messages', conversationController.getMessages);

module.exports = router;