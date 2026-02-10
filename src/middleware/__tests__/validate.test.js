const { validateBody } = require('../validate');

describe('validateBody', () => {
  const schema = {
    name: { required: true, type: 'string', min: 1, max: 255 },
    slug: { type: 'string', max: 100 },
  };

  it('calls next() when body is valid', () => {
    const req = { body: { name: 'Acme', slug: 'acme' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 when required field is missing', () => {
    const req = { body: { slug: 'acme' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: expect.arrayContaining([expect.objectContaining({ field: 'name', message: 'name is required' })]),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when type is wrong', () => {
    const req = { body: { name: 123 } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('validates uuid type', () => {
    const uuidSchema = { id: { required: true, type: 'uuid' } };
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const req = { body: { id: validUuid } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validateBody(uuidSchema)(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 400 for invalid uuid', () => {
    const uuidSchema = { id: { required: true, type: 'uuid' } };
    const req = { body: { id: 'not-a-uuid' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validateBody(uuidSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: expect.arrayContaining([expect.objectContaining({ field: 'id', message: 'id must be a valid UUID' })]),
    });
  });
});
