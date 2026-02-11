/**
 * Request body validation middleware.
 * schema: { fieldName: { required?: boolean, type?: 'string'|'number'|'uuid'|'object', min?: number, max?: number } }
 * Invalid body returns 400 with { error: string, details?: array }.
 */
function validateBody(schema) {
  return (req, res, next) => {
    const body = req.body || {};
    const details = [];

    for (const [key, rules = {}] of Object.entries(schema)) {
      const value = body[key];
      const { required, type, min, max } = rules;

      if (required && (value === undefined || value === null || value === '')) {
        details.push({ field: key, message: `${key} is required` });
        continue;
      }
      if (value === undefined || value === null) continue;

      if (type === 'string' && typeof value !== 'string') {
        details.push({ field: key, message: `${key} must be a string` });
      } else if (type === 'number' && typeof value !== 'number') {
        details.push({ field: key, message: `${key} must be a number` });
      } else if (type === 'uuid' && !isUuid(value)) {
        details.push({ field: key, message: `${key} must be a valid UUID` });
      } else if (type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
        details.push({ field: key, message: `${key} must be an object` });
      }
      if (typeof value === 'string' && min != null && value.length < min) {
        details.push({ field: key, message: `${key} must be at least ${min} characters` });
      }
      if (typeof value === 'string' && max != null && value.length > max) {
        details.push({ field: key, message: `${key} must be at most ${max} characters` });
      }
      if (typeof value === 'number' && min != null && value < min) {
        details.push({ field: key, message: `${key} must be at least ${min}` });
      }
      if (typeof value === 'number' && max != null && value > max) {
        details.push({ field: key, message: `${key} must be at most ${max}` });
      }
    }

    if (details.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details,
      });
    }
    next();
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

module.exports = {
  validateBody,
};
