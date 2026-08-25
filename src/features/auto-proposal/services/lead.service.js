const leadRepository = require("../repositories/lead.repository");

class LeadService {
  /**
   * Create a new lead with validation and business logic
   */
  async createLead(tenantId, leadData = {}, userId = null) {
    if (!tenantId) {
      const err = new Error("Tenant ID is required");
      err.statusCode = 400;
      throw err;
    }

    // 1. Basic Validation
    if (!leadData.email && !leadData.phone) {
      const err = new Error("Either Email or Phone is required to create a lead.");
      err.statusCode = 400;
      throw err;
    }

    // 2. Prepare Data (Applying defaults and formatting)
    const formattedData = {
      ...leadData,
      tenant_id: tenantId,
      created_by_user_id: userId,
      status: leadData.status || "active",
      stage: leadData.stage || "new",
      priority: parseInt(leadData.priority, 10) || 0,
      
      // Ensure JSON fields are objects/arrays if they come as strings from frontend
      tags: Array.isArray(leadData.tags) ? leadData.tags : [],
      custom_fields: leadData.custom_fields || {},
      raw_data: leadData.raw_data || {}
    };

    // 3. Call Repository
    const newLead = await leadRepository.create(formattedData);
    return newLead;
  }

  /**
   * Get all leads for a tenant with optional filtering
   */
  async getAllLeads(tenantId) {
    if (!tenantId) {
      const err = new Error("Tenant ID is required");
      err.statusCode = 400;
      throw err;
    }
    
    const leads = await leadRepository.findByTenant(tenantId);
    return leads;
  }

  /**
   * List leads for a tenant with pagination
   */
  async listLeads(tenantId, limit = 100, offset = 0) {
    if (!tenantId) {
      const err = new Error("Tenant ID is required");
      err.statusCode = 400;
      throw err;
    }
    const leads = await leadRepository.findByTenant(tenantId, limit, offset);
    return leads;
  }

  /**
   * Get a specific lead
   */
  async getLeadById(id, tenantId) {
    if (!id || !tenantId) {
      const err = new Error("Lead ID and Tenant ID are required");
      err.statusCode = 400;
      throw err;
    }

    const lead = await leadRepository.findById(id, tenantId);
    if (!lead) {
      const err = new Error("Lead not found");
      err.statusCode = 404;
      throw err;
    }
    return lead;
  }

  /**
   * Update lead with logic (e.g. updating 'updated_at' or checking status)
   */
  async updateLead(id, tenantId, updateData) {
    // Check if lead exists first
    const existingLead = await this.getLeadById(id, tenantId);
    
    // Merge existing data with updates
    const finalData = {
      ...existingLead,
      ...updateData,
      // Ensure JSON fields remain objects for the repository to stringify
      tags: Array.isArray(updateData.tags) ? updateData.tags : existingLead.tags,
      custom_fields: { ...existingLead.custom_fields, ...updateData.custom_fields }
    };

    return await leadRepository.update(id, tenantId, finalData);
  }

  /**
   * Soft delete a lead
   */
  async deleteLead(id, tenantId) {
    const deletedLead = await leadRepository.softDelete(id, tenantId);
    if (!deletedLead) {
      const err = new Error("Lead not found or already deleted");
      err.statusCode = 404;
      throw err;
    }
    return deletedLead;
  }

  /**
   * Logic to find a lead via a Requirement ID
   */
  async getLeadByRequirement(requirementId, tenantId) {
    const lead = await leadRepository.findByLeadRequirementId(requirementId, tenantId);
    if (!lead) {
      const err = new Error("No lead associated with this requirement");
      err.statusCode = 404;
      throw err;
    }
    return lead;
  }
}

module.exports = new LeadService();