const express = require('express');
const router = express.Router();
const service = require('../services/test.service');

router.get('/', (req, res) => service.generateAndUploadProposal(req, res));
router.get('/senemail', (req, res) => service.sendDefaultTemplateEmail(req, res));
module.exports = router;