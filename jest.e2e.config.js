module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/integration/**/*.e2e.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFilesAfterEnv: [
    "<rootDir>/src/__tests__/setup.ts",
    "<rootDir>/src/__tests__/setup.e2e.ts",
  ],
  verbose: true,
  testTimeout: 15000,
  maxWorkers: 1,
  // E2E signal-only run; coverage is collected in dedicated coverage jobs.
  collectCoverage: false,
}
