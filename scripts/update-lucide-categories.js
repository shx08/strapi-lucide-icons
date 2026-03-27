const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execFileSync, execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const outPath = path.join(repoRoot, 'admin', 'src', 'data', 'lucideCategories.ts');

const readPackageJson = (packageJsonPath) => {
  const source = fs.readFileSync(packageJsonPath, 'utf8');
  return JSON.parse(source);
};

const resolveLucideReactVersion = () => {
  if (typeof process.env.LUCIDE_REACT_VERSION === 'string' && process.env.LUCIDE_REACT_VERSION.length > 0) {
    return process.env.LUCIDE_REACT_VERSION;
  }

  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Unable to find package metadata at ${packageJsonPath}`);
  }

  const pkg = readPackageJson(packageJsonPath);
  const lucideReactVersion = pkg.dependencies?.['lucide-react'];
  if (typeof lucideReactVersion !== 'string' || lucideReactVersion.length === 0) {
    throw new Error(`Unable to resolve lucide-react dependency version from ${packageJsonPath}`);
  }

  return lucideReactVersion;
};

const buildCategoriesDataUrl = (version) =>
  `https://raw.githubusercontent.com/lucide-icons/lucide/${version}/docs/.vitepress/data/categoriesData.json`;

const buildLucideTarballUrl = (version) =>
  `https://codeload.github.com/lucide-icons/lucide/tar.gz/refs/tags/${version}`;

const resolveLucideReactRoot = (version) => {
  if (typeof process.env.LUCIDE_REACT_DIR === 'string' && process.env.LUCIDE_REACT_DIR.length > 0) {
    return { root: path.resolve(process.env.LUCIDE_REACT_DIR), cleanup: null };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lucide-react-'));
  execFileSync('npm', ['pack', `lucide-react@${version}`, '--pack-destination', tmpDir], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  const tarballName = fs.readdirSync(tmpDir).find((entry) => entry.endsWith('.tgz'));
  if (!tarballName) {
    throw new Error(`Unable to find lucide-react tarball in ${tmpDir}`);
  }

  execFileSync('tar', ['-xzf', path.join(tmpDir, tarballName), '-C', tmpDir], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  const root = path.join(tmpDir, 'package');
  if (!fs.existsSync(root)) {
    throw new Error(`Unable to find extracted lucide-react package in ${tmpDir}`);
  }

  return {
    root,
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
  };
};

const parseLucideReactAliases = (lucideReactRoot) => {
  const lucideReactDynamicPath = path.join(lucideReactRoot, 'dist', 'esm', 'dynamicIconImports.js');
  if (!fs.existsSync(lucideReactDynamicPath)) {
    return null;
  }

  const source = fs.readFileSync(lucideReactDynamicPath, 'utf8');
  const entryRegex = /["']([^"']+)["']\s*:\s*\(\)\s*=>\s*import\(["']([^"']+)["']\)/g;
  const pathToNames = new Map();
  let match;

  while ((match = entryRegex.exec(source))) {
    const name = match[1];
    const importPath = match[2];
    const names = pathToNames.get(importPath) || [];
    names.push(name);
    pathToNames.set(importPath, names);
  }

  const aliasMap = new Map();
  const allIconNames = [];

  for (const [importPath, names] of pathToNames.entries()) {
    const baseName = path.basename(importPath, '.js');
    names.sort();
    for (const name of names) {
      allIconNames.push(name);
    }

    const aliases = names.filter((name) => name !== baseName);
    if (aliases.length > 0) {
      aliasMap.set(baseName, aliases);
    }
  }

  allIconNames.sort();
  return { aliasMap, allIconNames };
};

const download = (url, dest) =>
  new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (currentUrl) => {
      https
        .get(currentUrl, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return get(res.headers.location);
          }

          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`Failed to download ${currentUrl}: ${res.statusCode}`));
          }

          res.pipe(file);
          file.on('finish', () => file.close(resolve));
        })
        .on('error', (err) => {
          fs.unlink(dest, () => reject(err));
        });
    };

    get(url);
  });

const run = async () => {
  const lucideReactVersion = resolveLucideReactVersion();
  const { root: lucideReactRoot, cleanup } = resolveLucideReactRoot(lucideReactVersion);
  const categoriesDataUrl = buildCategoriesDataUrl(lucideReactVersion);
  const lucideTarballUrl = buildLucideTarballUrl(lucideReactVersion);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lucide-'));
  const tarPath = path.join(tmpDir, 'lucide.tar.gz');
  const categoriesPath = path.join(tmpDir, 'categoriesData.json');

  try {
    await download(categoriesDataUrl, categoriesPath);
    await download(lucideTarballUrl, tarPath);

    execSync(`tar -xzf ${tarPath} -C ${tmpDir}`);

    const repoDir = fs.readdirSync(tmpDir).find((entry) => entry.startsWith('lucide-'));
    if (!repoDir) {
      throw new Error('Unable to find extracted lucide repo');
    }

    const lucideRoot = path.join(tmpDir, repoDir);
    const categoriesDir = path.join(lucideRoot, 'categories');
    const iconDir = path.join(lucideRoot, 'icons');

    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));

    const categoryMeta = new Map();
    for (const file of fs.readdirSync(categoriesDir)) {
      if (!file.endsWith('.json')) continue;
      const name = path.basename(file, '.json');
      const content = JSON.parse(fs.readFileSync(path.join(categoriesDir, file), 'utf8'));
      categoryMeta.set(name, { title: content.title || name, icon: content.icon || name });
    }

    const categoryIcons = new Map();
    for (const { name } of categoriesData) {
      categoryIcons.set(name, []);
    }

    const allIcons = [];
    for (const file of fs.readdirSync(iconDir)) {
      if (!file.endsWith('.json')) continue;
      const iconName = path.basename(file, '.json');
      allIcons.push(iconName);

      const meta = JSON.parse(fs.readFileSync(path.join(iconDir, file), 'utf8'));
      const cats = Array.isArray(meta.categories) ? meta.categories : [];

      for (const cat of cats) {
        if (!categoryIcons.has(cat)) {
          categoryIcons.set(cat, []);
        }
        categoryIcons.get(cat).push(iconName);
      }
    }

    const lucideReactAliases = parseLucideReactAliases(lucideReactRoot);
    allIcons.sort();
    for (const icons of categoryIcons.values()) {
      icons.sort();
    }

    const iconAliases = Object.fromEntries(
      Array.from(lucideReactAliases?.aliasMap.entries() || [])
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([iconName, aliases]) => [iconName, aliases])
    );

    const categories = [
      { name: 'all', title: 'All icons', icon: 'grid', icons: allIcons },
      ...categoriesData.map((cat) => ({
        name: cat.name,
        title: categoryMeta.get(cat.name)?.title || cat.title,
        icon: categoryMeta.get(cat.name)?.icon || cat.name,
        icons: categoryIcons.get(cat.name) || [],
      })),
    ];

    const out = `export type LucideCategory = { name: string; title: string; icon: string; icons: string[] };\n\nexport const LUCIDE_ICON_ALIASES: Record<string, string[]> = ${JSON.stringify(
      iconAliases,
      null,
      2
    )};\n\nexport const LUCIDE_CATEGORIES: LucideCategory[] = ${JSON.stringify(categories, null, 2)};\n`;

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, out, 'utf8');

    console.log(
      `Updated ${outPath} with ${categories.length} categories using lucide-react ${lucideReactVersion}.`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    cleanup?.();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
