module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/index.js', '!src/config/data-source.js'],
  coverageDirectory: 'coverage',
  verbose: true,
};
