/** @type {import('jest').Config} */
export default {
  transform: {},
  testMatch: ['<rootDir>/bld/test/*.test.js'],
  clearMocks: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  forceExit: true,
  prettierPath: null,
};
