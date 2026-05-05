const { v4: uuidv4 } = require("uuid");
const dataSource = require("../../../config/data-source"); // adjust path
const conceptRepository = require("./concept.repository");
const aiService = require("../services/ai-response.service");
const leadRequirementValueRepository = require("./lead_requirement_values.repository");


async function calculateFinalPrice(tenantId, leadRequirementId, event_type) {
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
  leadData.forEach(row => { inputValues[row.field_id] = Number(row.value_number) || 0; });
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
    console.log(`5. Checking Concept [${concept.name}]. Required IDs:`, JSON.stringify(conceptFieldIds), " lead requirement field ids : " + JSON.stringify(leadFieldIds));

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
      const minCost = Number(concept.minimum_cost);
      const adjustmentAmount = minCost - finalPrice;
      currentTotalBasePrice = currentTotalBasePrice + adjustmentAmount
      console.log(`14. MINIMUM COST TRIGGERED. Adding adjustment of ${adjustmentAmount}`);

      // Add a row to the breakdown to justify the price jump
      breakdown.push({
        key: 'min_cost_adjustment',
        label: `Minimum Package Commitment Adjustment (${concept.name})`,
        count: 1,
        base_unit_price: adjustmentAmount,
        price: adjustmentAmount,
        total_discount: 0,
        total_surcharge: adjustmentAmount,
        applied_rules: []
      });

      finalPrice = minCost;
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


  console.log("Price calculate before matching event_type/concept name of lead requiremnt :" + JSON.stringify(results))
  if (results.length > 1) {
    const selectedConcept = results.find(item =>
      item.concept_name.toLowerCase() === event_type.toLowerCase()
    );
    return selectedConcept;
  }
  return results[0];
}

async function generateFinalPrice(tenantId, leadRequirementId, emailContent, event_type) {
  // First Attempt
  let results = await calculateFinalPrice(tenantId, leadRequirementId, event_type);
  console.log("Price before re-evaluation email : " + JSON.stringify(results))
  // // Check if the total is zero
  if (!results || results.final_price === 0) {
    console.log("⚠️ Total is 0. Re-evaluating email for basic/pre-requisite services..." + emailContent);

    // Call AI again with the "Discovery Prompt"
    const suggestedRequirements = await aiService.callConsultantAI(tenantId, emailContent);
    console.log("AI-suggested requirements based on email content:", JSON.stringify(suggestedRequirements));
    // Update the database with these new requirements
    await leadRequirementValueRepository.saveRequirementValues(tenantId, leadRequirementId, suggestedRequirements);

    // Recalculate with the new services
    const newResults = await calculateFinalPrice(tenantId, leadRequirementId, event_type);
    console.log("New price calculated after re-evaluation of email : " + JSON.stringify(newResults))
    if (newResults && results) {
      const combinedRawBreakdown = [
        ...(results.breakdown || []),
        ...(newResults.breakdown || [])
      ];

      // 2. Use a Map to keep distinct keys with your custom logic
      const distinctMap = new Map();

      combinedRawBreakdown.forEach(item => {
        const existing = distinctMap.get(item.key);

        if (!existing) {
          // If key doesn't exist, add it
          distinctMap.set(item.key, item);
        } else {
          // If key exists, only overwrite if current item has a price and existing doesn't
          // (This satisfies your "keep key which has price > 0" rule)
          if (item.price > 0 && (existing.price === 0 || existing.price === null)) {
            distinctMap.set(item.key, item);
          }
        }
      });

      // 3. Convert Map back to Array
      const finalBreakdown = Array.from(distinctMap.values());

      // 4. Create the final merged object
      const mergedResult = {
        ...newResults, // Start with obj2 metadata
        breakdown: finalBreakdown,
        // Recalculate totals based on the new combined list
        total_base_price: finalBreakdown.reduce((sum, item) => sum + (item.price || 0), 0),
        final_price: finalBreakdown.reduce((sum, item) => sum + (item.price || 0), 0)
      };
      return mergedResult;
    }
    return newResults;
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


module.exports = { calculateFinalPrice, generateFinalPrice };