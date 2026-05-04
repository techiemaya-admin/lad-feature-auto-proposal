// controllers/quotationEmail.controller.js
const service = require('../services/quotation-email-template.service');

exports.create = async (req, res) => {
  try {
    const data = await service.createTemplate(req.params.tenantId, req.body);
    res.status(201).json(data);
  } catch (err) {
    console.error('Error in create:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const data = await service.getAllTemplates(req.params.tenantId);
    res.json(data);
  } catch (err) {
    console.error('Error in list:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const data = await service.getTemplate(req.params.id, req.params.tenantId);
    res.json(data);
  } catch (err) {
    console.error('Error in getById:', err);
    res.status(404).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const data = await service.updateTemplate(req.params.id, req.params.tenantId, req.body);
    res.json(data);
  } catch (err) {
    console.error('Error in update:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await service.deleteTemplate(req.params.id, req.params.tenant_id);
    res.status(204).send();
  } catch (err) {
    console.error('Error in remove:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.makeDefault = async (req, res) => {
  try {
    const result = await service.setDefault(req.params.tenantId, req.params.id);
    res.status(200).json({ message: "Default template updated", data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}