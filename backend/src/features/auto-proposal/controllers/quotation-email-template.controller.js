// controllers/quotationEmail.controller.js
const service = require('../services/quotation-email-template.service');
const leadService = require('../services/lead.service');
const tenantService = require('../services/tenant.service');
const tenantProfileService = require('../services/tenant-profile.service');

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

exports.listViaAuth = async (req, res) => {
  try {
    const tenantId = req.tenantId; // From auth middleware
    console.log(req.params)
    const contactId = req.params.contact_id;
    console.log("Fetching email templates for tenant via auth : " + tenantId + " contactId : " + contactId)
    const data = await service.getAllTemplates(tenantId);

    const [leadData, tenantDetails, tenantProfileDetails] = await Promise.all([
      leadService.getLeadById(contactId, tenantId), // Replace with your actual Lead service/repo
      tenantService.getTenantById(tenantId),
      tenantProfileService.getProfile(tenantId),
    ]);

    // 3. Setup the Placeholder values
    const placeholders = {
      lead_name: `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim(),
      lead_email: leadData.email || '',
      company_name: tenantDetails.name || '',
      company_email: tenantProfileDetails.official_email || '',
      company_phone: tenantDetails.phone || '',
      company_website: tenantDetails.website || '',
      company_logo: tenantProfileDetails.company_logo_url || '',
      company_tagline: tenantProfileDetails.tagline || '',
      instagram_url: tenantProfileDetails.instagram_url || '',
      linkedin_url: tenantProfileDetails.linkedin_url || '',
      whatsapp_url: tenantProfileDetails.whatsapp_url || '',
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
    console.log("Templates fetched: ", templatesMap);
    res.status(200).json({ data: templatesMap });
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