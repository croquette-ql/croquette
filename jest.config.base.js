module.exports = {
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(src/.*\\.test)\\.tsx?$',
  testPathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$', 'lib/.*'],
  collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx', '!**/testing/**'],
  moduleFileExtensions: ['js', 'tsx', 'ts', 'json'],
};
