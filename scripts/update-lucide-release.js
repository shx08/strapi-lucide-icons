const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

const run = (cmd, args, options = {}) => {
  execFileSync(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  });
};

const runCapture = (cmd, args) => {
  return execFileSync(cmd, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
};

const resolveLatestLucideVersion = () => {
  const raw = runCapture('npm', ['view', 'lucide-react', 'version', '--json']);

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string' && parsed.length > 0) {
      return parsed;
    }
  } catch {
    if (raw.length > 0) {
      return raw;
    }
  }

  throw new Error(`Unable to resolve latest lucide-react version from: ${raw}`);
};

const main = () => {
  const latestVersion = resolveLatestLucideVersion();
  console.log(`Latest lucide-react version: ${latestVersion}`);

  // 1) Update lucide-react to latest.
  run('npm', ['install', `lucide-react@${latestVersion}`, '--save-exact']);

  // 2) Regenerate categories data.
  run('npm', ['run', 'update:lucide-categories']);

  // 3) Sync plugin version with lucide-react version.
  run('npm', [
    'version',
    latestVersion,
    '--no-git-tag-version',
    '--allow-same-version',
  ]);

  console.log(`Done. package.json version and lucide-react are now ${latestVersion}.`);
};

main();
