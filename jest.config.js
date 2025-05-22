/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts", // Skip main entry point
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true,
  verbose: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  projects: [
    {
      displayName: "unit-tests",
      testMatch: ["<rootDir>/tests/unit.test.ts"],
    },
    {
      displayName: "database-tests",
      testMatch: [
        "<rootDir>/tests/**/*.test.ts",
        "!<rootDir>/tests/unit.test.ts",
      ],
      setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
    },
  ],
};
