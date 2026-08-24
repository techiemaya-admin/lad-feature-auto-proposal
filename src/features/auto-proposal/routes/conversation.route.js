// src/features/conversations/conversation.routes.js
const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversation.controller');
const socialIntegrationController = require('../controllers/social-integration.controller');
const authenticateJWT = require('../../../middleware/auth.middleware');
const multer = require('multer');

// Apply middleware to all routes in this file
router.use(authenticateJWT);
// Matches your frontend: /api/whatsapp-conversations/conversations
router.get('/contacts', conversationController.getConversations);

// Matches your frontend: /api/whatsapp-conversations/conversations/:id/messages
router.get('/messages', conversationController.getMessages);

router.post('/send-bulk', conversationController.sendBulkEmails);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
});

// POST /api/upload
// The 'file' string must match formData.append('file', ...) in React
router.post('/upload', upload.single('file'), conversationController.uploadAttachment);

router.get('/email-ai-followup/:contactId', authenticateJWT, conversationController.generateFollowUp);
router.get('/email-ai-crux/:contactId', authenticateJWT, conversationController.generateFollowUpCrux);
router.get('/status',socialIntegrationController.getGoogleEmailStatusWithOtherDetails);
module.exports = router;