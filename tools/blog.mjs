import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

import { escape, validSlug, rootDirectory, loadConfig, page, renderHome } from './layout.mjs';

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });

export function parsePost(source, slug, categories = loadConfig().categories) {
  if (!validSlug(slug)) throw new Error(`Invalid slug: ${slug}. Use lowercase letters, numbers, and hyphens.`);
  const match = source.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`${slug}: start the file with a metadata block between --- lines.`);
  const meta = {};
  for (const line of match[1].split('\n').filter(line => line.trim())) {
    const field = line.match(/^(title|date|category|summary|draft):\s*(.*)$/);
    if (!field || Object.hasOwn(meta, field[1])) throw new Error(`${slug}: invalid or repeated metadata field: ${line}`);
    meta[field[1]] = field[2].trim();
  }
  for (const key of ['title', 'date', 'category', 'summary', 'draft']) {
    if (!meta[key]) throw new Error(`${slug}: missing ${key}.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date) || Number.isNaN(Date.parse(meta.date)) || new Date(meta.date).toISOString().slice(0, 10) !== meta.date) {
    throw new Error(`${slug}: date must be a real date in YYYY-MM-DD format.`);
  }
  if (!Object.hasOwn(categories, meta.category)) throw new Error(`${slug}: category must be one of: ${Object.keys(categories).join(", ")}.`);
  if (!['true', 'false'].includes(meta.draft)) throw new Error(`${slug}: draft must be true or false.`);
  if (!match[2].trim()) throw new Error(`${slug}: the post is empty.`);
  return { ...meta, slug, draft: meta.draft === 'true', body: match[2].trim() };
}

export function renderPost(post, config = loadConfig()) {
  const { categories } = config;
  const category = categories[post.category];
  return page(post.title, post.summary, '../../', `
    <a class="text-link" href="../#${post.category}">← ${escape(category.title)}</a>
    <article class="post">
      <header class="post-header">
        <p class="post-meta"><time datetime="${post.date}">${post.date}</time> / ${escape(category.title)}</p>
        <h1>${escape(post.title)}</h1>
        <p class="post-summary">${escape(post.summary)}</p>
      </header>
      <div class="prose">${markdown.render(post.body)}</div>
    </article>
    <a class="text-link post-back" href="../">← All posts</a>`, config);
}

function renderIndex(posts, config) {
  const { categories } = config;
  return page('Blog', 'Research notes, code, and daily life.', '../', `
    <header class="blog-header"><p class="eyebrow">BLOG</p><h1>Notes</h1><p>Papers I read. Things I build. Notes from daily life.</p></header>
    <nav class="category-nav" aria-label="Blog sections">${Object.entries(categories).map(([key, category]) => `<a href="#${key}">${escape(category.title)} <span>${posts.filter(post => post.category === key).length}</span></a>`).join('')}</nav>
    ${Object.entries(categories).map(([key, category]) => {
      const entries = posts.filter(post => post.category === key);
      return `<section class="blog-section" id="${key}" aria-labelledby="${key}-title">
      <div class="section-heading"><div><h2 id="${key}-title">${escape(category.title)}</h2><p class="section-description">${escape(category.description)}</p></div><span class="section-aside">${entries.length} ${entries.length === 1 ? 'post' : 'posts'}</span></div>
      ${entries.length ? `<ul class="post-list">${entries.map(post => `<li><time datetime="${post.date}">${post.date}</time><div><h3><a href="${post.slug}/">${escape(post.title)}</a></h3><p>${escape(post.summary)}</p></div><a class="post-read" href="${post.slug}/" aria-label="Read ${escape(post.title)}">Read →</a></li>`).join('\n')}</ul>` : '<p class="empty-notes">No posts yet.</p>'}
    </section>`;
    }).join('\n')}`, config);
}

export function build(root = rootDirectory) {
  const config = loadConfig(root);
  const home = renderHome(root, config);
  const sourceDirectory = path.join(root, 'content', 'posts');
  const sources = fs.existsSync(sourceDirectory) ? fs.readdirSync(sourceDirectory).filter(file => file.endsWith('.md')) : [];
  // Parse every source before changing output. A bad post must not erase the current blog.
  const posts = sources.map(file => parsePost(fs.readFileSync(path.join(sourceDirectory, file), 'utf8'), file.slice(0, -3), config.categories))
    .filter(post => !post.draft)
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  const outputs = new Map([['index.html', home], ['blog/index.html', renderIndex(posts, config)], ...posts.map(post => [`blog/${post.slug}/index.html`, renderPost(post, config)])]);
  const manifestPath = path.join(root, '.blog-manifest.json');
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  if (!Array.isArray(previous) || previous.some(file => typeof file !== 'string' || !/^blog\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?index\.html$/.test(file))) {
    throw new Error('Invalid blog output manifest. No files were changed.');
  }
  for (const [file, html] of outputs) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html, 'utf8');
  }
  // Remove only previously generated pages, never user assets or unrelated files.
  for (const file of previous.filter(file => !outputs.has(file))) {
    const target = path.join(root, file);
    fs.rmSync(target, { force: true });
    const directory = path.dirname(target);
    if (fs.existsSync(directory) && fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
  }
  fs.writeFileSync(manifestPath, JSON.stringify([...outputs.keys()].filter(file => file.startsWith('blog/')), null, 2) + '\n');
  return posts.length;
}

export function newPost(root, slug, title, category) {
  const config = loadConfig(root);
  const { categories } = config;
  category ??= config.defaultCategory;
  if (!validSlug(slug)) throw new Error('Use a slug with lowercase letters, numbers, and hyphens.');
  if (!title?.trim() || /[\r\n]/.test(title)) throw new Error('Provide a title on one line.');
  if (!Object.hasOwn(categories, category)) throw new Error(`Choose ${Object.keys(categories).join(", ")}.`);
  const file = path.join(root, '.drafts', `${slug}.md`);
  if (fs.existsSync(file) || fs.existsSync(path.join(root, 'content', 'posts', `${slug}.md`))) throw new Error(`A post named ${slug} already exists.`);
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `---\ntitle: ${title.trim()}\ndate: ${date}\ncategory: ${category}\nsummary: Add a short summary.\ndraft: true\n---\n\n## Notes\n\nWrite your note here.\n`, { encoding: 'utf8', flag: 'wx' });
  return file;
}

export function readyPost(root, slug) {
  if (!validSlug(slug)) throw new Error('Invalid post slug.');
  const draftPath = path.join(root, '.drafts', `${slug}.md`);
  const target = path.join(root, 'content', 'posts', `${slug}.md`);
  const source = fs.readFileSync(draftPath, 'utf8');
  const post = parsePost(source, slug, loadConfig(root).categories);
  if (post.summary === 'Add a short summary.' || post.body.includes('Write your note here.')) throw new Error('Replace the template summary and body before marking this post ready.');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source.replace(/^draft:\s*true\s*$/m, 'draft: false'), { encoding: 'utf8', flag: 'wx' });
  // Keep the local draft as a backup. It remains excluded from the build and Git.
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , command, slug, title, category] = process.argv;
  try {
    if (command === 'build') console.log(`Built blog: ${build()} public posts.`);
    else if (command === 'new') console.log(`Draft created: ${newPost(rootDirectory, slug ?? '', title, category)}`);
    else if (command === 'ready') console.log(`Ready for the next local build: ${readyPost(rootDirectory, slug ?? '')}\nRun npm run build. This does not deploy the site.`);
    else throw new Error('Use build, new <slug> "<title>" [category], or ready <slug>.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
