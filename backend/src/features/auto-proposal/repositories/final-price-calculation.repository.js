const { v4: uuidv4 } = require("uuid");
const dataSource = require("../../../config/data-source"); // adjust path


async function calculateFinalPrice(tenantId, locationName, leadRequirementId) {
  const queryRunner = dataSource;

  // 1️⃣ Fetch Dynamic Values + Config Metadata (Label & Order Index)
  const requirementValues = await queryRunner.query(
    `
    SELECT 
      cv.value_number, 
      cfg.field_key, 
      cfg.label, 
      cfg.order_index 
    FROM lead_requirement_values cv
    JOIN lead_requirement_config cfg ON cv.field_id = cfg.id
    WHERE cv.lead_requirement_id = $1
    ORDER BY cfg.order_index ASC
    `,
    [leadRequirementId]
  );

  if (!requirementValues.length) {
    throw new Error("No requirement values found for this lead");
  }

  // 2️⃣ Store guest counts AND metadata
  const dynamicGuestData = requirementValues.map(row => ({
    key: row.field_key,
    count: Number(row.value_number) || 0,
    label: row.label,
    order_index: row.order_index
  }));

  // 3️⃣ Calculate Max Guest Count
  const maxGuestCount = Math.max(...dynamicGuestData.map(d => d.count));

  // 4️⃣ Fetch All Concepts
  const concepts = await queryRunner.query(
    `SELECT * FROM concept WHERE tenant_id = $1 AND is_deleted = false`,
    [tenantId]
  );

  const results = [];

  for (const concept of concepts) {
    let locationId = null;

    if (locationName) {
      const location = await queryRunner.query(
        `SELECT id FROM location WHERE LOWER(name) = LOWER($1) AND is_deleted = false`,
        [locationName]
      );
      if (location.length) locationId = location[0].id;
    }

    const matrixQuery = `
      SELECT * FROM concept_pricing_matrix
      WHERE tenant_id = $1 
        AND concept_id = $2 
        AND (location_id = $3 OR $3 IS NULL)
        AND $4 BETWEEN min_pax AND max_pax
        AND is_deleted = false
      ORDER BY location_id NULLS LAST 
      LIMIT 1`;

    const pricing = await queryRunner.query(matrixQuery, [
      tenantId,
      concept.id,
      locationId,
      maxGuestCount
    ]);

    if (!pricing.length) continue;

    const matrix = pricing[0];
    const pp = Number(matrix.price_per_person);
    const markup = Number(matrix.markup_percentage || 0);
    const discount = Number(matrix.discount_percentage || 0);

    // 7️⃣ Dynamic Array-based Breakdown Calculation
    const breakdown = [];
    let totalCalculatedPrice = 0;

    for (const item of dynamicGuestData) {
      const basePrice = pp * item.count;
      const finalItemPrice = basePrice + (basePrice * markup / 100) - (basePrice * discount / 100);

      breakdown.push({
        key: item.key,
        price: finalItemPrice,
        label: item.label,
        order_index: item.order_index
      });

      totalCalculatedPrice += finalItemPrice;
    }

    let finalPrice = totalCalculatedPrice;
    let isMinimumCostApplied = false;

    if (concept.minimum_cost && finalPrice < Number(concept.minimum_cost)) {
      finalPrice = Number(concept.minimum_cost);
      isMinimumCostApplied = true;
    }

    results.push({
      concept_id: concept.id,
      concept_name: concept.name,
      concept_pricing_matrix_id: matrix.id,
      breakdown: breakdown, // Now an array of objects
      final_price: finalPrice,
      is_minimum_cost_applied: isMinimumCostApplied,
      markup: markup,
      discount: discount
    });
  }

  return results;
}

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