const { v4: uuidv4 } = require("uuid");
const dataSource = require("../../../config/data-source"); // adjust path


// Added eventType as the 4th argument
async function calculateFinalPrice(tenantId, locationName, leadRequirementId, eventType = null) {
  const db = dataSource;

  // 1️⃣ Fetch Dynamic Values (Same as before)
  const requirementValues = await db.query(
    `SELECT cv.value_number, cfg.field_key, cfg.label, cfg.order_index 
     FROM lead_requirement_values cv
     JOIN lead_requirement_config cfg ON cv.field_id = cfg.id
     WHERE cv.lead_requirement_id = $1
     ORDER BY cfg.order_index ASC`,
    [leadRequirementId]
  );

  if (!requirementValues.length) {
    throw new Error("No requirement values found for this lead");
  }

  const dynamicGuestData = requirementValues.map(row => ({
    key: row.field_key,
    count: Number(row.value_number) || 0,
    label: row.label,
    order_index: row.order_index
  }));

  const input = {};
  dynamicGuestData.forEach(item => { input[item.key] = item.count; });

  // 3️⃣ Fetch Concepts - Updated with optional eventType filter
  let conceptSql = `
    SELECT c.*, pm.type AS pricing_type
    FROM concept c
    LEFT JOIN pricing_models pm ON c.pricing_model_id = pm.id
    WHERE c.tenant_id = $1 AND c.is_deleted = false
  `;

  const queryParams = [tenantId];

  // If eventType is provided, filter the SQL query
  if (eventType) {
    conceptSql += ` AND c.name = $2`;
    queryParams.push(eventType);
  }

  const concepts = await db.query(conceptSql, queryParams);
  const results = [];
  const conceptList = Array.isArray(concepts) ? concepts : (concepts.rows || []);

  for (const concept of conceptList) {
    const breakdown = [];
    let totalCalculatedPrice = 0;

    // 4️⃣ Calculate price for EACH dynamic field
    for (const item of dynamicGuestData) {
      let itemBasePrice = 0;
      const rate = Number(concept.base_price) || 0;

      switch (concept.pricing_type) {
        case "per_person": itemBasePrice = rate * item.count; break;
        case "per_hour": itemBasePrice = item.key.includes('hour') ? rate * item.count : rate; break;
        case "per_day": itemBasePrice = item.key.includes('day') ? rate * item.count : rate; break;
        case "fixed": itemBasePrice = rate; break;
        default: itemBasePrice = rate * item.count;
      }

      let itemFinalPrice = itemBasePrice;
      const appliedRules = [];

      // 5️⃣ Fetch rules for this specific concept
      const rulesRes = await db.query(
        `SELECT * FROM pricing_rules WHERE concept_id = $1 AND tenant_id = $2 AND is_active = true AND is_deleted = false ORDER BY priority ASC`,
        [concept.id, tenantId]
      );

      const rulesList = Array.isArray(rulesRes) ? rulesRes : (rulesRes.rows || []);

      let totalDiscount = 0;
      let totalSurcharge = 0;

      for (const rule of rulesList) {
        const fieldValue = input[rule.condition_field];

        // Skip if field missing or if rule is intended for a different line item
        if (fieldValue === undefined || rule.condition_field !== item.key) continue;

        let matched = false;
        const val = Number(fieldValue);
        const cond = Number(rule.condition_value);

        switch (rule.condition_operator) {
          case ">": matched = val > cond; break;
          case "<": matched = val < cond; break;
          case "=": matched = val == cond; break;
          case ">=": matched = val >= cond; break;
          case "<=": matched = val <= cond; break;
        }

        if (matched) {
          let impact = (rule.action_mode === "percentage")
            ? (itemFinalPrice * Number(rule.action_value)) / 100
            : Number(rule.action_value);

          if (rule.action_type === "discount") {
            itemFinalPrice -= impact;
            totalDiscount += impact;
          } else if (rule.action_type === "surcharge") {
            itemFinalPrice += impact;
            totalSurcharge += impact;
          }
          appliedRules.push(rule.id);
        }
      }

      breakdown.push({
        key: item.key,
        label: item.label,
        count: item.count,
        base_unit_price: rate,
        price: itemFinalPrice,
        applied_rules: appliedRules,
        total_discount: totalDiscount,
        total_surcharge: totalSurcharge
      });

      totalCalculatedPrice += itemFinalPrice;
    }

    // 6️⃣ Minimum Cost Check
    let finalPrice = totalCalculatedPrice;
    let isMinimumCostApplied = false;

    if (concept.minimum_cost && finalPrice < Number(concept.minimum_cost)) {
      finalPrice = Number(concept.minimum_cost);
      isMinimumCostApplied = true;
    }

    const totals = breakdown.reduce(
      (acc, item) => {
        acc.totalDiscount += item.total_discount || 0;
        acc.totalSurcharge += item.total_surcharge || 0;
        return acc;
      },
      { totalDiscount: 0, totalSurcharge: 0 }
    );

    results.push({
      concept_id: concept.id,
      concept_name: concept.name,
      pricing_type: concept.pricing_type,
      breakdown: breakdown,
      total_base_price: totalCalculatedPrice,
      final_price: finalPrice,
      is_minimum_cost_applied: isMinimumCostApplied,
      total_concept_discount: totals.totalDiscount,
      total_concept_surcharge: totals.totalSurcharge
    });
  }

  return results;
}

// async function calculateFinalPrice(tenantId, locationName, leadRequirementId) {
//   const db = dataSource;

//   // 1️⃣ Fetch Dynamic Values + Config Metadata (Same as OLD)
//   const requirementValues = await db.query(
//     `
//     SELECT 
//       cv.value_number, 
//       cfg.field_key, 
//       cfg.label, 
//       cfg.order_index 
//     FROM lead_requirement_values cv
//     JOIN lead_requirement_config cfg ON cv.field_id = cfg.id
//     WHERE cv.lead_requirement_id = $1
//     ORDER BY cfg.order_index ASC
//     `,
//     [leadRequirementId]
//   );

//   if (!requirementValues.length) {
//     throw new Error("No requirement values found for this lead");
//   }

//   // 2️⃣ Store guest counts AND metadata for the breakdown
//   const dynamicGuestData = requirementValues.map(row => ({
//     key: row.field_key,
//     count: Number(row.value_number) || 0,
//     label: row.label,
//     order_index: row.order_index
//   }));

//   // Create a flat input object for rule checking (e.g., { people: 100 })
//   const input = {};
//   dynamicGuestData.forEach(item => { input[item.key] = item.count; });

//   // 3️⃣ Fetch Concepts joined with Pricing Models
//   const concepts = await db.query(
//     `
//     SELECT c.*, pm.type AS pricing_type
//     FROM concept c
//     LEFT JOIN pricing_models pm ON c.pricing_model_id = pm.id
//     WHERE c.tenant_id = $1 AND c.is_deleted = false
//     `,
//     [tenantId]
//   );

//   const results = [];
//   const conceptList = Array.isArray(concepts) ? concepts : (concepts.rows || []);

//   for (const concept of conceptList) {
//     const breakdown = [];
//     let totalCalculatedPrice = 0;

//     // 4️⃣ Calculate price for EACH dynamic field (The Breakdown)
//     for (const item of dynamicGuestData) {
//       let itemBasePrice = 0;
//       const rate = Number(concept.base_price) || 0;

//       // APPLY PRICING MODEL LOGIC
//       switch (concept.pricing_type) {
//         case "per_person":
//           itemBasePrice = rate * item.count;
//           break;
//         case "per_hour":
//           // If the key matches 'hours', use count, otherwise it's just base
//           itemBasePrice = item.key.includes('hour') ? rate * item.count : rate;
//           break;
//         case "per_day":
//           itemBasePrice = item.key.includes('day') ? rate * item.count : rate;
//           break;
//         case "fixed":
//           itemBasePrice = rate;
//           break;
//         default:
//           itemBasePrice = rate * item.count; // Default to per_person logic
//       }

//       // 5️⃣ Apply Pricing Rules to this specific item
//       let itemFinalPrice = itemBasePrice;
//       const appliedRules = [];

//       const rulesRes = await db.query(
//         `SELECT * FROM pricing_rules WHERE concept_id = $1 AND tenant_id = $2 AND is_active = true AND is_deleted = false ORDER BY priority ASC`,
//         [concept.id, tenantId]
//       );

//       const rulesList = Array.isArray(rulesRes) ? rulesRes : (rulesRes.rows || []);
//       console.log('Input for pricing rules:', input);
//       let totalDiscount = 0;
//       let totalSurcharge = 0;
//       for (const rule of rulesList) {
//         console.log(`Evaluating rule: ${rule.name} on item: ${item.label} with input value: ${input[rule.condition_field]} JSON : ${JSON.stringify(rule)}`);
//         const fieldValue = input[rule.condition_field];
//         console.log(`Field value for ${rule.condition_field}: ${fieldValue} | Rule condition value: ${rule.condition_value} | Operator: ${rule.condition_operator} | Key : ${item.key} | base price for item: ${itemBasePrice}`);
//         if (fieldValue === undefined) {
//           console.log(`Skipping rule ${rule.name} because condition field ${rule.condition_field} is not present in input`);
//           continue
//         }
//         // 2️⃣ SELECTIVE LOGIC: 
//         // If the rule's condition_field does NOT match the current item's key,
//         // skip it—UNLESS you want this specific rule to be a 'Global' rule.
//         if (rule.condition_field !== item.key) {
//           // Optional: Add a metadata check here if you want some rules to be global
//           // if (!rule.metadata?.isGlobal) continue; 

//           continue; // Skip because this rule belongs to a different line item
//         }
//         let matched = false;
//         const val = Number(fieldValue);
//         const cond = Number(rule.condition_value);

//         switch (rule.condition_operator) {
//           case ">": matched = val > cond; break;
//           case "<": matched = val < cond; break;
//           case "=": matched = val == cond; break;
//           case ">=": matched = val >= cond; break;
//           case "<=": matched = val <= cond; break;
//         }
//         console.log(`Rule ${rule.name} evaluated to ${matched} | rule value type: ${rule.action_mode} | rule action type: ${rule.action_type}| rule action value: ${rule.action_value} | current item final price before applying rule: ${itemFinalPrice}`);
//         if (matched) {
//           let impact = 0;
//           if (rule.action_mode === "percentage") {
//             impact = (itemFinalPrice * Number(rule.action_value)) / 100;
//           } else {
//             impact = Number(rule.action_value);
//           }

//           if (rule.action_type === "discount") {
//             itemFinalPrice -= impact;
//             totalDiscount += impact;
//           }
//           if (rule.action_type === "surcharge") {
//             itemFinalPrice += impact;
//             totalSurcharge += impact;
//           }
//           console.log(`Rule ${rule.id} applied with impact ${impact}, new item price: ${itemFinalPrice}`);
//           appliedRules.push(rule.id);
//           console.log(`Applied rules so far for item ${item.label}:`, appliedRules);
//         }
//       }

//       breakdown.push({
//         key: item.key,
//         label: item.label,
//         count: item.count,
//         base_unit_price: rate,
//         price: itemFinalPrice,
//         applied_rules: appliedRules,
//         total_discount: totalDiscount,
//         total_surcharge: totalSurcharge
//       });

//       totalCalculatedPrice += itemFinalPrice;
//     }

//     // 6️⃣ Apply Minimum Cost to the TOTAL
//     let finalPrice = totalCalculatedPrice;
//     let isMinimumCostApplied = false;

//     if (concept.minimum_cost && finalPrice < Number(concept.minimum_cost)) {
//       finalPrice = Number(concept.minimum_cost);
//       isMinimumCostApplied = true;
//     }
//     const totals = breakdown.reduce(
//       (acc, item) => {
//         acc.totalDiscount += item.total_discount || 0;
//         acc.totalSurcharge += item.total_surcharge || 0;
//         return acc;
//       },
//       { totalDiscount: 0, totalSurcharge: 0 }
//     );

//     console.log("Total Discount:", totals.totalDiscount);
//     console.log("Total Surcharge:", totals.totalSurcharge);
//     results.push({
//       concept_id: concept.id,
//       concept_name: concept.name,
//       pricing_type: concept.pricing_type,
//       breakdown: breakdown,
//       total_base_price: totalCalculatedPrice,
//       final_price: finalPrice,
//       is_minimum_cost_applied: isMinimumCostApplied,
//       total_concept_discount: totals.totalDiscount,
//       total_concept_surcharge: totals.totalSurcharge
//     });
//   }

//   return results;
// }

// async function calculateFinalPrice(tenantId, locationName, leadRequirementId) {
//   const queryRunner = dataSource;

//   // 1️⃣ Fetch Dynamic Values + Config Metadata (Label & Order Index)
//   const requirementValues = await queryRunner.query(
//     `
//     SELECT 
//       cv.value_number, 
//       cfg.field_key, 
//       cfg.label, 
//       cfg.order_index 
//     FROM lead_requirement_values cv
//     JOIN lead_requirement_config cfg ON cv.field_id = cfg.id
//     WHERE cv.lead_requirement_id = $1
//     ORDER BY cfg.order_index ASC
//     `,
//     [leadRequirementId]
//   );

//   if (!requirementValues.length) {
//     throw new Error("No requirement values found for this lead");
//   }

//   // 2️⃣ Store guest counts AND metadata
//   const dynamicGuestData = requirementValues.map(row => ({
//     key: row.field_key,
//     count: Number(row.value_number) || 0,
//     label: row.label,
//     order_index: row.order_index
//   }));

//   // 3️⃣ Calculate Max Guest Count
//   const maxGuestCount = Math.max(...dynamicGuestData.map(d => d.count));

//   // 4️⃣ Fetch All Concepts
//   const concepts = await queryRunner.query(
//     `SELECT * FROM concept WHERE tenant_id = $1 AND is_deleted = false`,
//     [tenantId]
//   );

//   const results = [];

//   for (const concept of concepts) {
//     let locationId = null;

//     if (locationName) {
//       const location = await queryRunner.query(
//         `SELECT id FROM location WHERE LOWER(name) = LOWER($1) AND is_deleted = false`,
//         [locationName]
//       );
//       if (location.length) locationId = location[0].id;
//     }

//     const matrixQuery = `
//       SELECT * FROM concept_pricing_matrix
//       WHERE tenant_id = $1 
//         AND concept_id = $2 
//         AND (location_id = $3 OR $3 IS NULL)
//         AND $4 BETWEEN min_pax AND max_pax
//         AND is_deleted = false
//       ORDER BY location_id NULLS LAST 
//       LIMIT 1`;

//     const pricing = await queryRunner.query(matrixQuery, [
//       tenantId,
//       concept.id,
//       locationId,
//       maxGuestCount
//     ]);

//     if (!pricing.length) continue;

//     const matrix = pricing[0];
//     const pp = Number(matrix.price_per_person);
//     const markup = Number(matrix.markup_percentage || 0);
//     const discount = Number(matrix.discount_percentage || 0);

//     // 7️⃣ Dynamic Array-based Breakdown Calculation
//     const breakdown = [];
//     let totalCalculatedPrice = 0;

//     for (const item of dynamicGuestData) {
//       const basePrice = pp * item.count;
//       const finalItemPrice = basePrice + (basePrice * markup / 100) - (basePrice * discount / 100);

//       breakdown.push({
//         key: item.key,
//         price: finalItemPrice,
//         label: item.label,
//         order_index: item.order_index
//       });

//       totalCalculatedPrice += finalItemPrice;
//     }

//     let finalPrice = totalCalculatedPrice;
//     let isMinimumCostApplied = false;

//     if (concept.minimum_cost && finalPrice < Number(concept.minimum_cost)) {
//       finalPrice = Number(concept.minimum_cost);
//       isMinimumCostApplied = true;
//     }

//     results.push({
//       concept_id: concept.id,
//       concept_name: concept.name,
//       concept_pricing_matrix_id: matrix.id,
//       breakdown: breakdown, // Now an array of objects
//       final_price: finalPrice,
//       is_minimum_cost_applied: isMinimumCostApplied,
//       markup: markup,
//       discount: discount
//     });
//   }

//   return results;
// }

// async function calculateFinalPriceWithStaticValues(tenantId,
//   locationName,
//   mainEventGuestCount,
//   cateringGuestCount,
//   functionHallGuestCount
// ) {
//   console.log("locationame : " + locationName)
//   const queryRunner = dataSource;

//   // 1️⃣ Fetch All Concepts for Tenant
//   const concepts = await queryRunner.query(
//     `
//     SELECT *
//     FROM concept
//     WHERE tenant_id = $1
//       AND is_deleted = false
//     `,
//     [tenantId]
//   );

//   if (!concepts.length) {
//     throw new Error("No concepts found for tenant");
//   }

//   const results = [];

//   // Calculate max guest count
//   const maxGuestCount = Math.max(
//     mainEventGuestCount,
//     cateringGuestCount,
//     functionHallGuestCount
//   );

//   console.log("concepts: " + concepts.length);
//   for (const concept of concepts) {
//     let pricing;

//     // 2️⃣ If location is NOT provided
//     if (!locationName) {
//       pricing = await queryRunner.query(
//         `
//         SELECT *
//         FROM concept_pricing_matrix
//         WHERE tenant_id = $1
//           AND concept_id = $2
//           AND $3 BETWEEN min_pax AND max_pax
//           AND is_deleted = false
//         ORDER BY max_pax DESC
//         LIMIT 1
//         `,
//         [tenantId, concept.id, maxGuestCount]
//       );
//     } else {
//       // 3️⃣ If location is provided
//       const location = await queryRunner.query(
//         `
//         SELECT *
//         FROM location
//         WHERE LOWER(name) = LOWER($1)
//           AND is_deleted = false
//         `,
//         [locationName]
//       );

//       if (!location.length) continue;

//       pricing = await queryRunner.query(
//         `
//         SELECT *
//         FROM concept_pricing_matrix
//         WHERE tenant_id = $1
//           AND concept_id = $2
//           AND location_id = $3
//           AND $4 BETWEEN min_pax AND max_pax
//           AND is_deleted = false
//         LIMIT 1
//         `,
//         [tenantId, concept.id, location[0].id, maxGuestCount]
//       );
//     }

//     console.log("pricing: " + pricing.length);
//     if (!pricing.length) continue;

//     const matrix = pricing[0];

//     // 4️⃣ Calculate Individual Prices
//     const pricePerPerson = Number(matrix.price_per_person);
//     const mainEventBasePrice = (pricePerPerson * mainEventGuestCount);
//     const mainEventPrice = mainEventBasePrice
//       + (mainEventBasePrice * Number(matrix.markup_percentage)) / 100
//       - (mainEventBasePrice * Number(matrix.discount_percentage)) / 100;
//     const cateringBasePrice = (pricePerPerson * cateringGuestCount);
//     const cateringPrice = cateringBasePrice
//       + (cateringBasePrice * Number(matrix.markup_percentage)) / 100
//       - (cateringBasePrice * Number(matrix.discount_percentage)) / 100;
//     const functionHallBasePrice = (pricePerPerson * functionHallGuestCount);
//     const functionHallPrice = functionHallBasePrice
//       + (functionHallBasePrice * Number(matrix.markup_percentage)) / 100
//       - (functionHallBasePrice * Number(matrix.discount_percentage)) / 100;

//     let finalPrice = mainEventPrice + cateringPrice + functionHallPrice;

//     // 5️⃣ Minimum Cost Check
//     let isMinimumCostApplied = false;

//     if (
//       concept.minimum_cost &&
//       finalPrice < Number(concept.minimum_cost)
//     ) {
//       finalPrice = Number(concept.minimum_cost);
//       isMinimumCostApplied = true;
//     }

//     // 6️⃣ Push Result
//     results.push({
//       concept_id: concept.id,
//       concept_name: concept.name,
//       concept_pricing_matrix_id: matrix.id,

//       breakdown: {
//         main_event_price: mainEventPrice,
//         catering_price: cateringPrice,
//         functionhall_price: functionHallPrice,
//       },

//       final_price: finalPrice,
//       is_minimum_cost_applied: isMinimumCostApplied,
//     });

//     console.log("result: " + results)
//   }
//   return results;
// }

//   console.log("Calculating price for:", { tenantId, conceptName, locationName, pax, leadRequirementId });
//   // 1️⃣ Fetch Concept
//   const concept = await queryRunner.query(
//     `
//     SELECT *
//     FROM concept
//     WHERE tenant_id = $1
//       AND is_deleted = false
//     `,
//     [tenantId]
//   );

//   if (!concept.length) {
//     throw new Error("Concept not found");
//   }

//   // 2️⃣ Fetch Location
//   const location = await queryRunner.query(
//     `
//     SELECT *
//     FROM location
//     WHERE LOWER(name) = LOWER($1)
//       AND is_deleted = false
//     `,
//     [locationName]
//   );

//   if (!location.length) {
//     throw new Error("Location not found");
//   }

//   const conceptId = concept[0].id;
//   const locationId = location[0].id;

//   // 3️⃣ Fetch Pricing Matrix for Pax Range
//   const pricing = await queryRunner.query(
//     `
//     SELECT *
//     FROM concept_pricing_matrix
//     WHERE tenant_id = $1
//       AND concept_id = $2
//       AND location_id = $3
//       AND $4 BETWEEN min_pax AND max_pax
//       AND is_deleted = false
//     LIMIT 1
//     `,
//     [tenantId, conceptId, locationId, pax]
//   );

//   if (!pricing.length) {
//     throw new Error("No pricing slab found for given pax");
//   }

//   const matrix = pricing[0];

//   // 4️⃣ Calculate Pricing
//   const basePrice = Number(matrix.price_per_person) * mainEventGuestCount + Number(matrix.price_per_person) * cateringGuestCount + Number(matrix.price_per_person) * functionHallGuestCount;

//   const markupPrice =
//      (basePrice * Number(matrix.markup_percentage)) / 100;

//   const discountAmount =
//     (markupPrice * Number(matrix.discount_percentage)) / 100;

//   const finalPrice = markupPrice - discountAmount;

//   // 5️⃣ Check Minimum Cost
//   let isMinimumCostApplied = false;
//   let finalPayable = finalPrice;

//   if (concept[0].minimum_cost && finalPrice < concept[0].minimum_cost) {
//     finalPayable = Number(concept[0].minimum_cost);
//     isMinimumCostApplied = true;
//   }


//   return {
//     isMinimumCostApplied:isMinimumCostApplied,
//     finalPayable: finalPayable
//   };


module.exports = { calculateFinalPrice };