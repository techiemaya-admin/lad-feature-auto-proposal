const service = require('../services/quotation-email-template.service');
const leadService = require('../services/lead.service');
const tenantService = require('../services/tenant.service');
const tenantProfileRepository = require('../repositories/tenant-profile.repository');
const logger = require('../../../utils/logger');

exports.create = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.params.tenantId || req.params.tenant_id;
    const data = await service.createTemplate(tenantId, req.body);
    res.status(201).json(data);
  } catch (err) {
    logger.error('Error in create template:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.params.tenantId || req.params.tenant_id;
    const data = await service.getAllTemplates(tenantId);
    res.json(data);
  } catch (err) {
    logger.error('Error in list templates:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.listViaAuth = async (req, res) => {
  try {
    const tenantId = req.tenantId; // From auth middleware
    const contactId = req.params.contact_id;
    logger.debug("Fetching email templates for tenant via auth : " + tenantId + " contactId : " + contactId);
    const data = await service.getAllTemplates(tenantId);

    const [leadData, tenantDetails, tenantProfileDetails] = await Promise.all([
      contactId ? leadService.getLeadById(contactId, tenantId) : Promise.resolve({}),
      tenantService.getTenantById(tenantId),
      tenantProfileRepository.findByTenantId(tenantId),
    ]);

    // 3. Setup the Placeholder values
    const placeholders = {
      lead_name: `${(leadData && leadData.first_name) || ''} ${(leadData && leadData.last_name) || ''}`.trim(),
      lead_email: (leadData && leadData.email) || '',
      company_name: (tenantDetails && tenantDetails.name) || '',
      company_email: (tenantProfileDetails && tenantProfileDetails.official_email) || '',
      company_phone: (tenantDetails && tenantDetails.phone) || '',
      company_website: (tenantDetails && tenantDetails.website) || '',
      company_logo: (tenantProfileDetails && tenantProfileDetails.company_logo_url) || '',
      company_tagline: (tenantProfileDetails && tenantProfileDetails.tagline) || '',
      instagram_url: (tenantProfileDetails && tenantProfileDetails.instagram_url) || '',
      linkedin_url: (tenantProfileDetails && tenantProfileDetails.linkedin_url) || '',
      whatsapp_url: (tenantProfileDetails && tenantProfileDetails.whatsapp_url) || '',
      date: new Date().toLocaleDateString()
    };

    // 4. Helper function to replace [bracket_placeholders]
    const replacePlaceholders = (text) => {
      if (!text) return '';
      return text.replace(/\[(\w+)\]/g, (match, key) => {
        return placeholders[key] !== undefined ? placeholders[key] : match;
      });
    };

    // 5. Map and Replace in templates
    const templatesMap = data.map(t => {
      const bodyText = replacePlaceholders(t.body_text || '');
      const bodyHtml = replacePlaceholders(t.body_html || '');

      let finalHtml = '';

      if (bodyHtml && bodyHtml.trim().length > 0) {
        finalHtml = bodyHtml;
      } else {
        // IMPORTANT FIX: Replace newlines with <br /> tags
        // This makes React Quill recognize the line breaks
        const formattedText = bodyText.replace(/\n/g, '<br />');

        finalHtml = `<div style="font-family: sans-serif; line-height: 1.6; color: #374151;">${formattedText}</div>`;
      }

      return {
        id: t.id,
        name: t.name,
        subject: replacePlaceholders(t.subject || ''),
        body: bodyText,
        body_html: finalHtml, // Quill will now see the <br /> tags and show lines correctly
        is_active: !t.is_deleted,
        created_at: t.created_at.toISOString(),
      };
    });
    logger.debug("Templates fetched: ", templatesMap);
    res.status(200).json({ data: templatesMap });
  } catch (err) {
    logger.error('Error in listViaAuth templates:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.params.tenantId || req.params.tenant_id;
    const data = await service.getTemplate(req.params.id, tenantId);
    res.json(data);
  } catch (err) {
    logger.error('Error in getById template:', err);
    res.status(404).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.params.tenantId || req.params.tenant_id;
    const data = await service.updateTemplate(req.params.id, tenantId, req.body);
    res.json(data);
  } catch (err) {
    logger.error('Error in update template:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.params.tenantId || req.params.tenant_id;
    await service.deleteTemplate(req.params.id, tenantId);
    res.status(204).send();
  } catch (err) {
    logger.error('Error in remove template:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.makeDefault = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.params.tenantId || req.params.tenant_id;
    const result = await service.setDefault(tenantId, req.params.id);
    res.status(200).json({ message: "Default template updated", data: result });
  } catch (error) {
    logger.error('Error in makeDefault template:', error);
    res.status(500).json({ error: error.message });
  }
};