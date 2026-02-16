module.exports = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],

    // Build & verify BEFORE publishing so you never ship broken artifacts
    ['@semantic-release/exec', { prepareCmd: 'npm run build && npm run verify' }],

    ['@semantic-release/npm', { npmPublish: true }],
    ['@semantic-release/git', { assets: ['package.json', 'CHANGELOG.md'] }],
    '@semantic-release/github',
  ],
};
