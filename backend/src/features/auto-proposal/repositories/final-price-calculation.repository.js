const { v4: uuidv4 } = require("uuid");
const dataSource = require("../../../config/data-source"); // adjust path
const conceptRepository = require("./concept.repository");


async function calculateFinalPrice(tenantId, leadRequirementId) {
  const db = dataSource;

  const leadData = await db.query(
    `SELECT cv.id AS value_record_id, cv.value_number, cfg.id AS field_id, cfg.field_key, cfg.label, cfg.base_price, pm.type AS pricing_model
    FROM lead_requirement_values cv
    JOIN lead_requirement_config cfg ON cv.field_id = cfg.id
    LEFT JOIN pricing_models pm ON cfg.pricing_model_id = pm.id
    WHERE cv.lead_requirement_id = $1 AND cfg.tenant_id = $2 AND cfg.is_active = true`,
    [leadRequirementId, tenantId]
  );
  console.log("1. Raw Lead Data Fetched:", JSON.stringify(leadData));

  const inputValues = {};
  leadData.forEach(row => { inputValues[row.field_key] = Number(row.value_number) || 0; });
  console.log("2. Transformed Input Values (Conditions):", JSON.stringify(inputValues));

  const rulesRes = await db.query(
    `SELECT * FROM pricing_rules WHERE tenant_id = $1 AND is_active = true AND is_deleted = false`,
    [tenantId]
  );
  const allRules = rulesRes;
  console.log("3. All Active Pricing Rules:", JSON.stringify(allRules));

  const concepts = await conceptRepository.findAllWithRequirements(tenantId);
  console.log("4. Available Concepts with Mappings:", JSON.stringify(concepts));

  const results = [];

  for (const concept of concepts) {
    const conceptFieldIds = concept.requirement_configs.map(rc => rc.id);
    const leadFieldIds = leadData.map(ld => ld.field_id);
    console.log(`5. Checking Concept [${concept.name}]. Required IDs:`, JSON.stringify(conceptFieldIds));

    const isMatch = conceptFieldIds.every(id => leadFieldIds.includes(id));
    console.log(`6. Does Lead Match Concept [${concept.name}]?`, isMatch);

    if (!isMatch) continue;

    const breakdown = [];
    let currentTotalBasePrice = 0;
    let conceptServicesSubtotal = 0;
    let addonServicesSubtotal = 0;
    let totalDiscount = 0;
    let totalSurcharge = 0;

    for (const item of leadData) {
      const count = Number(item.value_number) || 0;
      const base = Number(item.base_price) || 0;
      let itemBasePrice = (item.pricing_model === 'Fixed') ? base : (base * count);

      currentTotalBasePrice += itemBasePrice;

      let itemFinalPrice = itemBasePrice;
      let itemDiscount = 0;
      let itemSurcharge = 0;
      let appliedRules = [];

      // --- HANDLE SERVICES OUTSIDE THE CONCEPT (ADD-ONS) ---
      if (!conceptFieldIds.includes(item.field_id)) {
        console.log(`7a. Item [${item.label}] is an ADD-ON. Checking Service Rules.`);
        const serviceRules = allRules.filter(r => r.target_type === 'service' && r.requirement_config_id === item.field_id);

        const ruleResult = applyRuleMathWithDetails(itemBasePrice, serviceRules, inputValues, false);
        console.log(`7b. Rule Result for Add-on [${item.label}]:`, JSON.stringify(ruleResult));

        itemFinalPrice = ruleResult.finalAmount;
        itemDiscount = ruleResult.discount;
        itemSurcharge = ruleResult.surcharge;
        appliedRules = ruleResult.appliedRules;

        addonServicesSubtotal += itemFinalPrice;
      } else {
        // --- HANDLE SERVICES INSIDE THE CONCEPT ---
        console.log(`8. Item [${item.label}] is INSIDE Concept. Adding to Concept Bucket.`);
        conceptServicesSubtotal += itemBasePrice;
      }

      breakdown.push({
        key: item.field_key,
        label: item.label,
        count: count,
        base_unit_price: base,
        price: itemFinalPrice,
        total_discount: itemDiscount,
        total_surcharge: itemSurcharge,
        applied_rules: appliedRules
      });

      totalDiscount += itemDiscount;
      totalSurcharge += itemSurcharge;
    }

    console.log(`9. Concept Bucket Subtotal: ${conceptServicesSubtotal}`);
    console.log(`10. Add-on Bucket Subtotal: ${addonServicesSubtotal}`);

    // --- APPLY PACKAGE RULE (ONLY TO THE CONCEPT BUCKET) ---
    const packageRules = allRules.filter(r => r.target_type === 'package' && r.concept_id === concept.id);
    console.log(`11. Package Rules found for [${concept.name}]:`, JSON.stringify(packageRules));

    const packageResult = applyRuleMathWithDetails(conceptServicesSubtotal, packageRules, inputValues, true);
    console.log(`12. Package Rule Application Result:`, JSON.stringify(packageResult));

    const finalPackagePrice = packageResult.finalAmount;
    totalDiscount += packageResult.discount;
    totalSurcharge += packageResult.surcharge;

    let finalPrice = finalPackagePrice + addonServicesSubtotal;
    console.log(`13. Calculated Final Price (Package + Addons): ${finalPrice}`);

    if (concept.minimum_cost && finalPrice < Number(concept.minimum_cost)) {
      console.log(`14. MINIMUM COST TRIGGERED. Raising ${finalPrice} to ${concept.minimum_cost}`);
      finalPrice = Number(concept.minimum_cost);
    }

    const finalResponse = {
      concept_id: concept.id,
      concept_name: concept.name,
      pricing_type: concept.pricing_type || 'hybrid',
      breakdown: breakdown,
      total_base_price: currentTotalBasePrice,
      final_price: finalPrice,
      total_concept_discount: totalDiscount,
      total_concept_surcharge: totalSurcharge,
      applied_package_rules: packageResult.appliedRules
    };

    console.log(`15. Final Concept Object:`, JSON.stringify(finalResponse));
    results.push(finalResponse);
  }
  // --- FALLBACK LOGIC REMAINS SAME ---
  // ... (Your results.length === 0 logic)
  let totalBasePrice = 0;
  if (results.length === 0) {
    const breakdown = [];
    let grandTotal = 0;
    let totalDiscount = 0;
    let totalSurcharge = 0;

    for (const item of leadData) {
      const count = Number(item.value_number) || 0;
      const base = Number(item.base_price) || 0;
      const itemBasePrice = (item.pricing_model === 'Fixed') ? base : (base * count);
      totalBasePrice = totalBasePrice + itemBasePrice;
      console.log(`Calculating price for standalone service item: ${item.label} with base price ${itemBasePrice} with total base price : ${totalBasePrice}`);

      // In fallback mode, every service is treated as a standalone service
      const serviceRules = allRules.filter(r => r.target_type === 'service' && r.requirement_config_id === item.field_id);
      console.log(`Applying pricing rules for standalone service item: ${item.label}`, JSON.stringify(serviceRules));

      const ruleResult = applyRuleMathWithDetails(itemBasePrice, serviceRules, inputValues);
      console.log(`Result after applying rules for item ${item.label}: `, JSON.stringify(ruleResult));

      breakdown.push({
        key: item.field_key,
        label: item.label,
        count: count,
        base_unit_price: base,
        price: ruleResult.finalAmount,
        total_discount: ruleResult.discount,
        total_surcharge: ruleResult.surcharge,
        applied_rules: ruleResult.appliedRules
      });

      console.log(`Breakdown for item ${item.label}:`, JSON.stringify(breakdown[breakdown.length - 1]));

      grandTotal += ruleResult.finalAmount;
      totalDiscount += ruleResult.discount;
      totalSurcharge += ruleResult.surcharge;
    }

    results.push({
      concept_id: null,
      concept_name: "Custom Service Quote",
      pricing_type: "service_only",
      breakdown: breakdown,
      total_base_price: totalBasePrice,
      final_price: grandTotal,
      total_concept_discount: totalDiscount,
      total_concept_surcharge: totalSurcharge,
      applied_package_rules: []
    });
  }



  return results;
}


function applyRuleMathWithDetails(baseAmount, rules, inputValues, forceMatch = false) {
  let finalAmount = baseAmount;
  let discount = 0;
  let surcharge = 0;
  let appliedRules = [];

  for (const rule of rules) {
    let matched = forceMatch; // If forceMatch is true (Package), we skip condition checks

    if (!matched) {
      const val = inputValues[rule.condition_field] || 0;
      const cond = Number(rule.condition_value);

      switch (rule.condition_operator) {
        case ">": matched = val > cond; break;
        case "<": matched = val < cond; break;
        case ">=": matched = val >= cond; break;
        case "<=": matched = val <= cond; break;
        case "=": matched = val == cond; break;
      }
    }

    if (matched) {
      let impact = 0;
      const actionVal = Number(rule.action_value) || 0;

      if (rule.action_mode?.toLowerCase() === 'percentage') {
        impact = (finalAmount * actionVal / 100);
      } else {
        impact = actionVal;
      }

      if (rule.action_type?.toLowerCase() === 'discount') {
        finalAmount -= impact;
        discount += impact;
      } else {
        finalAmount += impact;
        surcharge += impact;
      }
      appliedRules.push(rule.id);
    }
  }
  return { finalAmount, discount, surcharge, appliedRules };
}

// async function calculateFinalPrice(tenantId, leadRequirementId) {
//   const db = dataSource;
//   let totalBasePrice = 0;
//   // 1. Fetch Lead Values & Config
//   const leadData = await db.query(
//     `SELECT 
//        cv.id AS value_record_id,
//        cv.value_number,
//        cfg.id AS field_id, 
//        cfg.field_key, 
//        cfg.label, 
//        cfg.base_price,
//        pm.type AS pricing_model
//     FROM lead_requirement_values cv
//     JOIN lead_requirement_config cfg ON cv.field_id = cfg.id
//     LEFT JOIN pricing_models pm ON cfg.pricing_model_id = pm.id
//     WHERE cv.lead_requirement_id = $1 
//       AND cfg.tenant_id = $2
//       AND cfg.is_active = true`,
//     [leadRequirementId, tenantId]
//   );

//   console.log("Fetched lead data for price calculation:", JSON.stringify(leadData));

//   const inputValues = {};
//   leadData.forEach(row => { inputValues[row.field_key] = Number(row.value_number) || 0; });

//   const rulesRes = await db.query(
//     `SELECT * FROM pricing_rules WHERE tenant_id = $1 AND is_active = true AND is_deleted = false`,
//     [tenantId]
//   );

//   const allRules = rulesRes;
//   console.log("Fetched pricing rules for price calculation:", JSON.stringify(rulesRes));

//   const concepts = await conceptRepository.findAllWithRequirements(tenantId);
//   const results = [];

//   console.log("Fetched concepts with requirements for price calculation:", JSON.stringify(concepts));

//   // --- 1️⃣ TRY TO MATCH CONCEPTS ---
//   for (const concept of concepts) {
//     const conceptFieldIds = concept.requirement_configs.map(rc => rc.id);
//     const leadFieldIds = leadData.map(ld => ld.field_id);

//     const isMatch = conceptFieldIds.every(id => leadFieldIds.includes(id));
//     if (!isMatch) continue;

//     const breakdown = [];
//     let conceptSubtotal = 0;
//     let totalDiscount = 0;
//     let totalSurcharge = 0;

//     for (const item of leadData) {
//       const count = Number(item.value_number) || 0;
//       const base = Number(item.base_price) || 0;
//       let itemBasePrice = (item.pricing_model === 'Fixed') ? base : (base * count);
//       totalBasePrice = totalBasePrice + itemBasePrice;
//       console.log(`Calculating price for item: ${item.label} with base price ${itemBasePrice} with total base price : ${totalBasePrice}`);
//       let itemFinalPrice = itemBasePrice;
//       let itemDiscount = 0;
//       let itemSurcharge = 0;
//       let appliedRules = [];

//       // If item is an addon (not in concept), apply service rules
//       if (!conceptFieldIds.includes(item.field_id)) {
//         const serviceRules = allRules.filter(r => r.target_type === 'service' && r.requirement_config_id === item.field_id);
//         const ruleResult = applyRuleMathWithDetails(itemBasePrice, serviceRules, inputValues);
//         itemFinalPrice = ruleResult.finalAmount;
//         itemDiscount = ruleResult.discount;
//         itemSurcharge = ruleResult.surcharge;
//         appliedRules = ruleResult.appliedRules;
//       }

//       breakdown.push({
//         key: item.field_key,
//         label: item.label,
//         count: count,
//         base_unit_price: base,
//         price: itemFinalPrice,
//         total_discount: itemDiscount,
//         total_surcharge: itemSurcharge,
//         applied_rules: appliedRules
//       });

//       if (conceptFieldIds.includes(item.field_id)) {
//         conceptSubtotal += itemBasePrice;
//       } else {
//         conceptSubtotal += itemFinalPrice;
//         totalDiscount += itemDiscount;
//         totalSurcharge += itemSurcharge;
//       }
//     }

//     const packageRules = allRules.filter(r => r.target_type === 'package' && r.concept_id === concept.id);
//     const packageResult = applyRuleMathWithDetails(conceptSubtotal, packageRules, inputValues);

//     let finalPrice = packageResult.finalAmount;
//     totalDiscount += packageResult.discount;
//     totalSurcharge += packageResult.surcharge;

//     if (concept.minimum_cost && finalPrice < Number(concept.minimum_cost)) {
//       finalPrice = Number(concept.minimum_cost);
//     }

//     results.push({
//       concept_id: concept.id,
//       concept_name: concept.name,
//       pricing_type: concept.pricing_type || 'hybrid',
//       breakdown: breakdown,
//       total_base_price: totalBasePrice,
//       final_price: finalPrice,
//       total_concept_discount: totalDiscount,
//       total_concept_surcharge: totalSurcharge,
//       applied_package_rules: packageResult.appliedRules
//     });
//   }

//   // --- 2️⃣ FALLBACK: IF NO CONCEPTS MATCHED (SERVICE-ONLY CALCULATION) ---
//   if (results.length === 0) {
//     const breakdown = [];
//     let grandTotal = 0;
//     let totalDiscount = 0;
//     let totalSurcharge = 0;

//     for (const item of leadData) {
//       const count = Number(item.value_number) || 0;
//       const base = Number(item.base_price) || 0;
//       const itemBasePrice = (item.pricing_model === 'Fixed') ? base : (base * count);
//       totalBasePrice = totalBasePrice + itemBasePrice;
//       console.log(`Calculating price for standalone service item: ${item.label} with base price ${itemBasePrice} with total base price : ${totalBasePrice}`);

//       // In fallback mode, every service is treated as a standalone service
//       const serviceRules = allRules.filter(r => r.target_type === 'service' && r.requirement_config_id === item.field_id);
//       console.log(`Applying pricing rules for standalone service item: ${item.label}`, JSON.stringify(serviceRules));

//       const ruleResult = applyRuleMathWithDetails(itemBasePrice, serviceRules, inputValues);
//       console.log(`Result after applying rules for item ${item.label}: `, JSON.stringify(ruleResult));

//       breakdown.push({
//         key: item.field_key,
//         label: item.label,
//         count: count,
//         base_unit_price: base,
//         price: ruleResult.finalAmount,
//         total_discount: ruleResult.discount,
//         total_surcharge: ruleResult.surcharge,
//         applied_rules: ruleResult.appliedRules
//       });

//       console.log(`Breakdown for item ${item.label}:`, JSON.stringify(breakdown[breakdown.length - 1]));

//       grandTotal += ruleResult.finalAmount;
//       totalDiscount += ruleResult.discount;
//       totalSurcharge += ruleResult.surcharge;
//     }

//     results.push({
//       concept_id: null,
//       concept_name: "Custom Service Quote",
//       pricing_type: "service_only",
//       breakdown: breakdown,
//       total_base_price: totalBasePrice,
//       final_price: grandTotal,
//       total_concept_discount: totalDiscount,
//       total_concept_surcharge: totalSurcharge,
//       applied_package_rules: []
//     });
//   }

//   return results;
// }

/**
 * Enhanced Helper to return math details
 */
// function applyRuleMathWithDetails(baseAmount, rules, inputValues) {
//   let finalAmount = baseAmount;
//   let discount = 0;
//   let surcharge = 0;
//   let appliedRules = [];

//   for (const rule of rules) {
//     console.log(`Evaluating rule: ${JSON.stringify(rule)} with input values: ${JSON.stringify(inputValues)}`);

//     const val = inputValues[rule.condition_field] || 0;
//     const cond = Number(rule.condition_value);
//     let matched = false;

//     switch (rule.condition_operator) {
//       case ">": matched = val > cond; break;
//       case "<": matched = val < cond; break;
//       case ">=": matched = val >= cond; break;
//       case "<=": matched = val <= cond; break;
//       case "=": matched = val == cond; break;
//     }

//     if (matched) {
//       let impact = 0;

//       if (rule.action_mode?.toLowerCase() === 'percentage') {
//         console.log(`Rule ${rule.name} is a percentage-based rule. Calculating impact as percentage of current final amount: ${finalAmount}`);
//         impact = (finalAmount * Number(rule.action_value) / 100);
//       } else {
//         console.log(`Rule ${rule.name} is a fixed amount rule. Using action value directly as impact: ${rule.action_value}`);
//         impact = Number(rule.action_value);
//       }

//       if (rule.action_type?.toLowerCase() === 'discount') {
//         finalAmount -= impact;
//         discount += impact;
//       } else {
//         finalAmount += impact;
//         surcharge += impact;
//       }
//       appliedRules.push(rule.id);
//     }
//   }
//   console.log(`Final amount after applying rules: ${finalAmount}, total discount: ${discount}, total surcharge: ${surcharge}, applied rules: ${appliedRules} with total base amount: ${baseAmount}`);
//   return { finalAmount, discount, surcharge, appliedRules };
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