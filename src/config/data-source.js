const { DataSource } = require('typeorm');
const path = require('path');

const isTest = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV === 'development';
const synchronize = isTest || isDev;
const entitiesDir = path.join(__dirname, '..', 'entities');

module.exports = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rush_away',
  synchronize,
  logging: process.env.NODE_ENV === 'development',
  entities: [
    path.join(entitiesDir, 'Tenant.js'),
    path.join(entitiesDir, 'Location.js'),
    path.join(entitiesDir, 'Concept.js'),
    path.join(entitiesDir, 'ConceptLocation.js'),
    path.join(entitiesDir, 'ConceptPricingMatrix.js'),
    path.join(entitiesDir, 'PricingRule.js'),
    path.join(entitiesDir, 'PriceCalculation.js'),
    path.join(entitiesDir, 'LeadRequirement.js'),
    path.join(entitiesDir, 'QuotationTemplateMetadata.js'),
    path.join(entitiesDir, 'Quotation.js'),
  ],
  migrations: [path.join(__dirname, '..', 'migrations', '*.js')],
  subscribers: [],
});
