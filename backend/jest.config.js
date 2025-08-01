module.exports = {
	testEnvironment: 'node',
	verbose: true,
	collectCoverage: false,
	testTimeout: 10000,
	testMatch: [
		'**/tests/**/*.test.js'
	],
	setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};