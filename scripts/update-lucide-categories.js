const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');

const CATEGORIES_DATA_URL =
  'https://raw.githubusercontent.com/lucide-icons/lucide/main/docs/.vitepress/data/categoriesData.json';
const LUCIDE_TARBALL_URL =
  'https://codeload.github.com/lucide-icons/lucide/tar.gz/refs/heads/main';

const repoRoot = path.resolve(__dirname, '..');
const outPath = path.join(repoRoot, 'admin', 'src', 'data', 'lucideCategories.ts');
const lucideReactDynamicPath = path.join(
  repoRoot,
  'node_modules',
  'lucide-react',
  'dist',
  'esm',
  'dynamicIconImports.js'
);

const parseLucideReactAliases = () => {
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lucide-'));
  const tarPath = path.join(tmpDir, 'lucide.tar.gz');
  const categoriesPath = path.join(tmpDir, 'categoriesData.json');

  await download(CATEGORIES_DATA_URL, categoriesPath);
  await download(LUCIDE_TARBALL_URL, tarPath);

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

  const lucideReactAliases = parseLucideReactAliases();
  const allIconsWithAliases = lucideReactAliases?.allIconNames || allIcons;

  allIconsWithAliases.sort();
  for (const icons of categoryIcons.values()) {
    const withAliases = new Set(icons);
    if (lucideReactAliases?.aliasMap) {
      for (const iconName of icons) {
        const aliases = lucideReactAliases.aliasMap.get(iconName);
        if (aliases) {
          for (const alias of aliases) {
            withAliases.add(alias);
          }
        }
      }
    }
    icons.length = 0;
    icons.push(...withAliases);
    icons.sort();
  }

  const categories = [
    { name: 'all', title: 'All icons', icon: 'grid', icons: allIconsWithAliases },
    ...categoriesData.map((cat) => ({
      name: cat.name,
      title: categoryMeta.get(cat.name)?.title || cat.title,
      icon: categoryMeta.get(cat.name)?.icon || cat.name,
      icons: categoryIcons.get(cat.name) || [],
    })),
  ];

  const out = `export type LucideCategory = { name: string; title: string; icon: string; icons: string[] };\n\nexport const LUCIDE_CATEGORIES: LucideCategory[] = ${JSON.stringify(
    categories,
    null,
    2
  )};\n`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out, 'utf8');

  console.log(`Updated ${outPath} with ${categories.length} categories.`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
