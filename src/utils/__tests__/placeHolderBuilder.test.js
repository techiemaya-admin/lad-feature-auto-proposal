const PlaceHolderBuilder = require('../placeHolderBuilder');

describe('PlaceHolderBuilder', () => {
  it('initializes with expected default schema values', () => {
    const builder = new PlaceHolderBuilder();
    const data = builder.build();

    expect(data.lead_name).toBe('');
    expect(data.lead_email).toBe('');
    expect(data.company_name).toBe('');
    expect(data.currency).toBe('INR');
    expect(data.total_base_price).toBe(0);
    expect(data.total_discount).toBe(0);
    expect(data.total_surcharge).toBe(0);
    expect(data.final_price).toBe(0);
    expect(data.items).toEqual([]);
    expect(data.notes).toBe('');
    expect(data.terms_conditions).toBe('');
  });

  it('populates initial data via constructor and ignores unrecognized keys', () => {
    const builder = new PlaceHolderBuilder({
      lead_name: 'Alice Smith',
      lead_email: 'alice@example.com',
      final_price: 15000,
      malicious_key: 'hacked',
      unknown_attribute: 123,
    });

    const data = builder.build();

    expect(data.lead_name).toBe('Alice Smith');
    expect(data.lead_email).toBe('alice@example.com');
    expect(data.final_price).toBe(15000);
    expect(data.malicious_key).toBeUndefined();
    expect(data.unknown_attribute).toBeUndefined();
  });

  it('sets single valid field with chaining and ignores unknown keys', () => {
    const builder = new PlaceHolderBuilder();

    builder
      .set('lead_name', 'Bob Jones')
      .set('total_base_price', 2500)
      .set('non_existent_key', 'should_be_ignored');

    const data = builder.build();
    expect(data.lead_name).toBe('Bob Jones');
    expect(data.total_base_price).toBe(2500);
    expect(data.non_existent_key).toBeUndefined();
  });

  it('sets bulk fields and filters out invalid keys', () => {
    const builder = new PlaceHolderBuilder();

    builder.setBulk({
      company_name: 'Apex Events',
      company_phone: '+1-800-555-0199',
      instagram_url: 'https://instagram.com/apex',
      bogus_field: 'discarded',
    });

    const data = builder.build();
    expect(data.company_name).toBe('Apex Events');
    expect(data.company_phone).toBe('+1-800-555-0199');
    expect(data.instagram_url).toBe('https://instagram.com/apex');
    expect(data.bogus_field).toBeUndefined();
  });

  it('normalizes item arrays via setItems with numerical and string defaults', () => {
    const builder = new PlaceHolderBuilder();

    builder.setItems([
      {
        item_name: 'Banquet Hall',
        item_description: 'Grand Ballroom setup',
        item_quantity: 1,
        item_price: 5000,
        item_total: 5000,
      },
      {
        // Missing optional properties to test defaults
        item_name: 'Sound System',
      },
    ]);

    const data = builder.build();
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toEqual({
      item_name: 'Banquet Hall',
      item_description: 'Grand Ballroom setup',
      item_quantity: 1,
      item_price: 5000,
      item_total: 5000,
    });
    expect(data.items[1]).toEqual({
      item_name: 'Sound System',
      item_description: '',
      item_quantity: 0,
      item_price: 0,
      item_total: 0,
    });
  });

  it('appends single item via addItem with default normalization', () => {
    const builder = new PlaceHolderBuilder();

    builder
      .addItem({
        item_name: 'Catering',
        item_price: 45,
        item_quantity: 100,
        item_total: 4500,
      })
      .addItem({}); // empty item object

    const data = builder.build();
    expect(data.items).toHaveLength(2);
    expect(data.items[0].item_name).toBe('Catering');
    expect(data.items[0].item_total).toBe(4500);
    expect(data.items[1]).toEqual({
      item_name: '',
      item_description: '',
      item_quantity: 0,
      item_price: 0,
      item_total: 0,
    });
  });
});
