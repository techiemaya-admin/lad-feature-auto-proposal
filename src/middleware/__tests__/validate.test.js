const { validateBody } = require('../validate');

describe('Validate Middleware (validateBody)', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('calls next() when body satisfies schema requirements', () => {
    const schema = {
      name: { required: true, type: 'string', min: 2, max: 50 },
      guest_count: { required: true, type: 'number', min: 1, max: 500 },
      tenant_id: { required: true, type: 'uuid' },
      metadata: { required: false, type: 'object' },
    };

    req.body = {
      name: 'Corporate Gala',
      guest_count: 100,
      tenant_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      metadata: { theme: 'midnight' },
    };

    const middleware = validateBody(schema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns 400 with details when required fields are missing, undefined, or empty string', () => {
    const schema = {
      title: { required: true, type: 'string' },
      count: { required: true, type: 'number' },
      empty_field: { required: true, type: 'string' },
    };

    req.body = {
      title: undefined,
      count: null,
      empty_field: '',
    };

    const middleware = validateBody(schema);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: [
        { field: 'title', message: 'title is required' },
        { field: 'count', message: 'count is required' },
        { field: 'empty_field', message: 'empty_field is required' },
      ],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('validates types: string, number, uuid, object', () => {
    const schema = {
      strField: { type: 'string' },
      numField: { type: 'number' },
      uuidField: { type: 'uuid' },
      objField: { type: 'object' },
    };

    req.body = {
      strField: 12345, // invalid
      numField: 'not-a-number', // invalid
      uuidField: 'invalid-uuid-string', // invalid
      objField: ['array-is-not-plain-object'], // invalid
    };

    const middleware = validateBody(schema);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: [
        { field: 'strField', message: 'strField must be a string' },
        { field: 'numField', message: 'numField must be a number' },
        { field: 'uuidField', message: 'uuidField must be a valid UUID' },
        { field: 'objField', message: 'objField must be an object' },
      ],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('enforces min and max constraints for strings and numbers', () => {
    const schema = {
      shortStr: { type: 'string', min: 5 },
      longStr: { type: 'string', max: 10 },
      tooSmallNum: { type: 'number', min: 10 },
      tooLargeNum: { type: 'number', max: 100 },
    };

    req.body = {
      shortStr: 'abc', // < 5
      longStr: 'this is way too long string', // > 10
      tooSmallNum: 5, // < 10
      tooLargeNum: 200, // > 100
    };

    const middleware = validateBody(schema);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: [
        { field: 'shortStr', message: 'shortStr must be at least 5 characters' },
        { field: 'longStr', message: 'longStr must be at most 10 characters' },
        { field: 'tooSmallNum', message: 'tooSmallNum must be at least 10' },
        { field: 'tooLargeNum', message: 'tooLargeNum must be at most 100' },
      ],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('handles optional fields by skipping validation when value is undefined or null', () => {
    const schema = {
      optionalNotes: { required: false, type: 'string', min: 5 },
      optionalDiscount: { required: false, type: 'number', min: 0 },
    };

    req.body = {}; // No keys provided

    const middleware = validateBody(schema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('handles default empty body gracefully when req.body is undefined', () => {
    const schema = {
      title: { required: true },
    };

    req.body = undefined;

    const middleware = validateBody(schema);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: [{ field: 'title', message: 'title is required' }],
    });
  });
});
