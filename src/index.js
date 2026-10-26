require('dotenv').config();
const app = require('./app');
const { assertJwtConfig } = require('./middleware/auth.middleware');
const dataSource = require('./config/data-source');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    assertJwtConfig(); // fail fast if JWT_SECRET is missing or weak
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required');
    }
    await dataSource.initialize();
    app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
