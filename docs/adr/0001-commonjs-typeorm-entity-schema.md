# CommonJS and TypeORM EntitySchema for Data Access

We use Node.js CommonJS modules and TypeORM `EntitySchema` definitions instead of TypeScript decorator classes or Prisma/Knex. This avoids transpilation overhead, keeps runtime entities pure JavaScript, and maintains compatibility across all LAD backend microservices.
