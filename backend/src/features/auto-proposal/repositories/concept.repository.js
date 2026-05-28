const db = require("../../../config/data-source");

class ConceptRepository {
  /**
   * Create a new concept
   * Updated to match schema: tenant_id, metadata, name, minimum_cost, description
   */
  async create(tenantId, data) {
    console.log(`Creating concept for tenant ${tenantId} with data:`, data);

    const sql = `
      INSERT INTO concept 
      (tenant_id, name, minimum_cost, description, metadata) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *`;

    const values = [
      tenantId,
      data.name,
      data.minimum_cost || 0,
      data.description || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    ];

    const result = await db.query(sql, values);
    if (data.requirement_config_ids && data.requirement_config_ids.length > 0 && result && result.length > 0) {
      await this.addMultipleRequirementMappings(result[0].id, data.requirement_config_ids);
    }
    return result[0] || null;
  }

  /**
 * NEW: Add multiple requirement mappings in a single query
 */
  async addMultipleRequirementMappings(conceptId, configIds) {
    if (!configIds || configIds.length === 0) return [];

    // Generate values for: ($1, $2), ($1, $3), ($1, $4)...
    const values = [];
    const valuePlaceholders = configIds.map((id, index) => {
      values.push(conceptId, id);
      return `($${index * 2 + 1}, $${index * 2 + 2})`;
    }).join(', ');

    const sql = `
    INSERT INTO concept_requirement_config_mapping (concept_id, requirement_config_id)
    VALUES ${valuePlaceholders}
    ON CONFLICT (concept_id, requirement_config_id) DO NOTHING
    RETURNING *`;

    return await db.query(sql, values);
  }

  /**
   * NEW: Add a mapping between a concept and a requirement config
   */
  async addMappingToConcept(conceptId, requirementConfigId) {
    const sql = `
      INSERT INTO concept_requirement_config_mapping (concept_id, requirement_config_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING *`;
    const result = await db.query(sql, [conceptId, requirementConfigId]);
    return result[0];
  }

  /**
   * NEW: Remove a mapping between a concept and a requirement config
   */
  async removeMappingFromConcept(conceptId, requirementConfigId) {
    const sql = `
      DELETE FROM concept_requirement_config_mapping 
      WHERE concept_id = $1 AND requirement_config_id = $2
    `;
    await db.query(sql, [conceptId, requirementConfigId]);
  }

  /**
   * Fetch a concept and all its associated lead requirement configurations
   * Logic: Joins the concept to its requirements via the mapping table
   */
  async findByIdWithRequirements(tenantId, id) {
    const sql = `
      SELECT 
        c.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', lrc.id,
              'field_key', lrc.field_key,
              'label', lrc.label,
              'base_price', lrc.base_price
            ) ORDER BY lrc.id ASC
          ) FILTER (WHERE lrc.id IS NOT NULL), 
          '[]'
        ) as requirements
      FROM concept c
      LEFT JOIN concept_requirement_config_mapping crcm ON c.id = crcm.concept_id
      LEFT JOIN lead_requirement_config lrc ON crcm.requirement_config_id = lrc.id
      WHERE c.id = $1 AND c.tenant_id = $2 AND c.is_deleted = false and lrc.is_active=true
      GROUP BY c.id
    `;
    const result = await db.query(sql, [id, tenantId]);
    return result[0] || null;
  }

  /**
   * Add a requirement to a concept (Junction Table)
   */
  async addRequirementMapping(conceptId, requirementConfigId) {
    const sql = `
      INSERT INTO concept_requirement_config_mapping (concept_id, requirement_config_id)
      VALUES ($1, $2)
      ON CONFLICT (concept_id, requirement_config_id) DO NOTHING
      RETURNING *
    `;
    const result = await db.query(sql, [conceptId, requirementConfigId]);
    return result[0] || null;
  }

  /**
   * Remove a requirement from a concept (Junction Table)
   */
  async removeRequirementMapping(conceptId, requirementConfigId) {
    const sql = `
      DELETE FROM concept_requirement_config_mapping 
      WHERE concept_id = $1 AND requirement_config_id = $2
    `;
    await db.query(sql, [conceptId, requirementConfigId]);
    return true;
  }
  /**
   * Fetch all active concepts for a tenant, including their requirement configurations
   */
  async findAll(tenantId) {
    const sql = `
    SELECT 
      c.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', lrc.id,
            'field_key', lrc.field_key,
            'label', lrc.label,
            'is_required', lrc.is_required,
            'is_active', lrc.is_active,
            'base_price', lrc.base_price,
            'pricing_model_id', lrc.pricing_model_id
          )
        ) FILTER (WHERE lrc.id IS NOT NULL), 
        '[]'
      ) AS requirement_configs
    FROM concept c
    LEFT JOIN concept_requirement_config_mapping crcm ON c.id = crcm.concept_id
    LEFT JOIN lead_requirement_config lrc ON crcm.requirement_config_id = lrc.id
    WHERE c.tenant_id = $1 AND c.is_deleted = false and lrc.is_active=true
    GROUP BY c.id
    ORDER BY c.created_at DESC;
  `;

    const result = await db.query(sql, [tenantId]);

    // Return the rows directly. If result is from 'pg' library, use result.rows
    return result.rows || result || [];
  }

  /**
   * Fetch a single concept by ID
   */
  async findById(tenantId, id) {
    const sql = `
      SELECT * FROM concept 
      WHERE id = $1 AND tenant_id = $2 AND is_deleted = false
    `;
    const result = await db.query(sql, [id, tenantId]);
    return result[0] || null;
  }

  /**
   * Update an existing concept
   */
  async update(tenantId, id, data) {
    // 1. Start a transaction if your db driver supports it, 
    // or run them sequentially to ensure mapping updates.
    const sql = `
      UPDATE concept
      SET 
        name = COALESCE($1, name),
        minimum_cost = COALESCE($2, minimum_cost),
        description = COALESCE($3, description),
        metadata = COALESCE($4, metadata),
        updated_at = NOW()
      WHERE id = $5 AND tenant_id = $6 
      RETURNING *`;

    const values = [
      data.name,
      data.minimum_cost,
      data.description,
      data.metadata ? JSON.stringify(data.metadata) : null,
      id,
      tenantId
    ];

    const result = await db.query(sql, values);
    const updatedConcept = result[0] || null;

    // 2. Sync Mappings if requirement_config_ids are provided
    if (updatedConcept && data.requirement_config_ids) {
      // First, remove all existing mappings for this concept
      await db.query(
        `DELETE FROM concept_requirement_config_mapping WHERE concept_id = $1`,
        [id]
      );

      // Then, insert the new ones if the array isn't empty
      if (data.requirement_config_ids.length > 0) {
        // Using the batch insert logic we discussed earlier
        const mappingValues = [];
        const placeholders = data.requirement_config_ids.map((configId, index) => {
          mappingValues.push(id, configId);
          return `($${index * 2 + 1}, $${index * 2 + 2})`;
        }).join(', ');

        const mappingSql = `
          INSERT INTO concept_requirement_config_mapping (concept_id, requirement_config_id)
          VALUES ${placeholders}
          ON CONFLICT DO NOTHING`;

        await db.query(mappingSql, mappingValues);
      }
    }

    return updatedConcept;
  }

  async softDelete(id) {
    const sql = `UPDATE concept SET is_deleted = true, updated_at = NOW() WHERE id = $1 RETURNING id`;
    const result = await db.query(sql, [id]);
    return result[0] || null;
  }

  async hardDelete(id) {
    const sql = `DELETE FROM concept WHERE id = $1 RETURNING id`;
    const result = await db.query(sql, [id]);
    return result[0] || null;
  }

  /**
   * Fetch all concepts for a tenant, including their mapped requirement configurations.
   * Useful for initializing settings or building a concept-to-services lookup for AI extraction.
   */
  async findAllWithRequirements(tenantId) {
    const sql = `
      SELECT 
        c.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', lrc.id,
              'field_key', lrc.field_key,
              'label', lrc.label,
              'base_price', lrc.base_price
            ) order by lrc.id ASC
          ) FILTER (WHERE lrc.id IS NOT NULL), 
          '[]'
        ) as requirement_configs
      FROM concept c
      LEFT JOIN concept_requirement_config_mapping crcm ON c.id = crcm.concept_id
      LEFT JOIN lead_requirement_config lrc ON crcm.requirement_config_id = lrc.id
      WHERE c.tenant_id = $1 AND c.is_deleted = false  and lrc.is_active=true
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;

    try {
      const result = await db.query(sql, [tenantId]);
      // Ensures we return a clean array regardless of driver response format
      return Array.isArray(result) ? result : result.rows || [];
    } catch (error) {
      console.error("Error in findAllWithRequirements:", error);
      throw error;
    }
  }
}

module.exports = new ConceptRepository();