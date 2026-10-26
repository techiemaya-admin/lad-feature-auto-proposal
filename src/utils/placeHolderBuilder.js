class PlaceHolderBuilder {
  constructor(initialData = {}) {
    this.data = {
      lead_name: "",
      lead_email: "",
      lead_phone: "",
      lead_company: "",
      lead_address: "",

      company_name: "",
      company_email: "",
      company_phone: "",
      company_address: "",
      company_website: "",

      company_logo: "",
      company_tagline: "",

      instagram_url: "",
      linkedin_url: "",
      facebook_url: "",
      whatsapp_url: "",

      quotation_id: "",
      quotation_date: "",
      valid_till: "",

      total_base_price: 0,
      total_discount: 0,
      total_surcharge: 0,
      final_price: 0,
      currency: "INR",

      items: [],

      notes: "",
      terms_conditions: "",
      prepared_by: "",
      event_category: "",
      services_given: "",
      surcharge_percentage: "",
      discount_percentage: ""
    };

    this.setBulk(initialData);
  }

  // ================= SINGLE FIELD =================
  set(key, value) {
    if (key in this.data) {
      this.data[key] = value;
    }
    return this;
  }

  // ================= MULTIPLE FIELDS =================
  setBulk(payload = {}) {
    Object.keys(payload).forEach((key) => {
      if (key in this.data) {
        this.data[key] = payload[key];
      }
    });
    return this;
  }

  // ================= SET ITEMS (FULL ARRAY) =================
  setItems(items = []) {
    this.data.items = items.map(item => ({
      item_name: item.item_name || "",
      item_description: item.item_description || "",
      item_quantity: item.item_quantity || 0,
      item_price: item.item_price || 0,
      item_total: item.item_total || 0
    }));
    return this;
  }

  // ================= ADD SINGLE ITEM =================
  addItem(item = {}) {
    this.data.items.push({
      item_name: item.item_name || "",
      item_description: item.item_description || "",
      item_quantity: item.item_quantity || 0,
      item_price: item.item_price || 0,
      item_total: item.item_total || 0
    });
    return this;
  }

  // ================= GET FINAL JSON =================
  build() {
    return this.data;
  }
}

module.exports = PlaceHolderBuilder;