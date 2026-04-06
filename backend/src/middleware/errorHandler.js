const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred.';

  logger.error('Unhandled error', {
    code,
    message,
    statusCode,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  res.status(statusCode).json({
    error: {
      code,
      message: process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'An unexpected error occurred.'
        : message,
    },
  });
}

module.exports = errorHandler;
