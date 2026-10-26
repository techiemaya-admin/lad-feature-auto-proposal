const GENERIC_ERROR_MESSAGE = 'Internal Server Error';

/** Creates an error whose message is safe to show the client (4xx). */
function clientError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Message safe to put in an HTTP response. Only errors deliberately marked as client
 * errors (a 4xx statusCode, or expose === true) keep their own message; anything else
 * (database, Google API, storage, bugs) is replaced so internals are never leaked.
 */
function clientMessage(err, fallback = GENERIC_ERROR_MESSAGE) {
  if (err && (err.expose === true || (Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 500))) {
    return err.message;
  }
  return fallback;
}

module.exports = { clientError, clientMessage, GENERIC_ERROR_MESSAGE };
