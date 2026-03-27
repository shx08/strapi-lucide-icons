const fs = require('fs');
const os = require('os');
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

const packLucideReact = (version) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lucide-react-'));

  run('npm', ['pack', `lucide-react@${version}`, '--pack-destination', tmpDir]);

  const tarballName = fs.readdirSync(tmpDir).find((entry) => entry.endsWith('.tgz'));
  if (!tarballName) {
    throw new Error(`Unable to find lucide-react tarball in ${tmpDir}`);
  }

  run('tar', ['-xzf', path.join(tmpDir, tarballName), '-C', tmpDir]);

  const extractedDir = path.join(tmpDir, 'package');
  if (!fs.existsSync(extractedDir)) {
    throw new Error(`Unable to find extracted lucide-react package in ${tmpDir}`);
  }

  return { tmpDir, extractedDir };
};

const main = () => {
  const latestVersion = resolveLatestLucideVersion();
  console.log(`Latest lucide-react version: ${latestVersion}`);

  const { tmpDir, extractedDir } = packLucideReact(latestVersion);

  try {
    // 1) Update package.json and package-lock.json to latest without touching node_modules.
    run('npm', ['install', `lucide-react@${latestVersion}`, '--save-exact', '--package-lock-only']);

    // 2) Regenerate categories data from the exact published lucide-react release.
    run('npm', ['run', 'update:lucide-categories'], {
      env: {
        ...process.env,
        LUCIDE_REACT_DIR: extractedDir,
        LUCIDE_REACT_VERSION: latestVersion,
      },
    });

    // 3) Sync plugin version with lucide-react version.
    run('npm', [
      'version',
      latestVersion,
      '--no-git-tag-version',
      '--allow-same-version',
    ]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`Done. package.json version and lucide-react are now ${latestVersion}.`);
};

main();
