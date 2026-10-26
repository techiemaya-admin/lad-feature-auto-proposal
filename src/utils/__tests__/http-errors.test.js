const { clientError, clientMessage } = require('../http-errors');

describe('http-errors', () => {
  it('exposes messages of deliberate 4xx errors', () => {
    expect(clientMessage(clientError('Template not found', 404))).toBe('Template not found');
    const exposed = new Error('Shown'); exposed.expose = true;
    expect(clientMessage(exposed)).toBe('Shown');
  });

  it('hides messages of unexpected and 5xx errors', () => {
    expect(clientMessage(new Error('password authentication failed for user "lad_dev"'))).toBe('Internal Server Error');
    const fivehundred = new Error('upstream'); fivehundred.statusCode = 503;
    expect(clientMessage(fivehundred)).toBe('Internal Server Error');
    expect(clientMessage(undefined)).toBe('Internal Server Error');
  });

  it('supports a custom fallback', () => {
    expect(clientMessage(new Error('x'), 'Something went wrong')).toBe('Something went wrong');
  });
});
