const { DataSource } = require('typeorm');
const path = require('path');

const isTest = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

// Enable synchronize in development and test environments
// In production, use migrations instead
const synchronize = !isProd;
const logging = isDev || isTest;

module.exports = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'l9837801673L#',
  database: process.env.DB_NAME || 'lad_dev',
  synchronize,
  logging,
  entities: [
    path.join(__dirname, '..', 'features', 'tenant', 'entities', '*.js'),
    path.join(__dirname, '..', 'features', 'location', 'entities', '*.js'),
    path.join(__dirname, '..', 'features', 'concept', 'entities', '*.js'),
    path.join(__dirname, '..', 'features', 'lead', 'entities', '*.js'),
    path.join(__dirname, '..', 'features', 'pricing', 'entities', '*.js'),
    path.join(__dirname, '..', 'features', 'quotation', 'entities', '*.js'),
    path.join(__dirname, '..', 'features', 'quotation-template', 'entities', '*.js'),
  ],
  migrations: [path.join(__dirname, '..', 'migrations', '*.js')],
  subscribers: [],
});
