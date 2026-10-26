require('dotenv').config();
const app = require('./app');
const { getVerifyConfig } = require('./middleware/auth');
const dataSource = require('./config/data-source');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    getVerifyConfig(); // fail fast if JWT_SECRET is missing or weak
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
