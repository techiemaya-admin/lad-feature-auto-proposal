# CommonJS and Parameterized SQL for Data Access

We use Node.js CommonJS modules and raw parameterized SQL queries executed via TypeORM's `AppDataSource.query()` and `pg`. This avoids ORM mapping overhead, provides total control over SQL query plans, and prevents entity metadata desynchronization while maintaining compatibility across all LAD backend microservices.

