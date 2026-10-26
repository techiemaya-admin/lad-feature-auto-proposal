const { DataSource } = require('typeorm');
const path = require('path');

const isTest = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

// Enable synchronize in development and test environments
// In production, use migrations instead
const synchronize = !isProd;
// const logging = isDev || isTest;
const logging = false; // Disable logging for all environments, can be set to true for development if needed


module.exports = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'lad_dev',
  password: process.env.DB_PASSWORD || 'lad_dev_pwd',
  database: process.env.DB_NAME || 'lad_dev',
  synchronize,
  logging,
  subscribers: [],
});
