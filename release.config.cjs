module.exports = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',

    // Build & verify BEFORE publishing so you never ship broken artifacts
    ['@semantic-release/exec', { prepareCmd: 'npm run build && npm run verify' }],

    // Publish only (no repo changes)
    ['@semantic-release/npm', { npmPublish: true }],
    '@semantic-release/github',
  ],
};
