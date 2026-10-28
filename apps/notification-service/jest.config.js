module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.spec.ts$',
  moduleNameMapper: {
    '^@prisma/client$': '<rootDir>/src/generated/client',
    '^@prisma/client/(.*)$': '<rootDir>/src/generated/client/$1',
    '^@workspace/common$': '<rootDir>/../../packages/common/src/index.ts',
    '^@workspace/auth$': '<rootDir>/../../packages/auth/src/index.ts',
    '^@workspace/events$': '<rootDir>/../../packages/events/src/index.ts',
    '^@workspace/(.*)$': '<rootDir>/../../packages/$1/src',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/test-setup.ts'],
  testTimeout: 30000,
};
