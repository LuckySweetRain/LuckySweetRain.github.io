import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build, newPost, parsePost, readyPost, renderPost } from './blog.mjs';
import { rootDirectory, loadConfig } from './layout.mjs';

const source = (title = 'A note', date = '2026-09-25', category = 'research', draft = false) => `---\ntitle: ${title}\ndate: ${date}\ncategory: ${category}\nsummary: A short note.\ndraft: ${draft}\n---\n\n## A heading\n\nA **bold** idea.\n\n- First\n- Second\n\n\`\`\`python\nprint('<hello>')\n\`\`\`\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n`;
function workspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'academic-blog-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'content', 'posts'), { recursive: true });
  fs.copyFileSync(path.join(rootDirectory, 'site.config.json'), path.join(root, 'site.config.json'));
  fs.mkdirSync(path.join(root, 'templates'));
  fs.copyFileSync(path.join(rootDirectory, 'templates', 'home.html'), path.join(root, 'templates', 'home.html'));
  return root;
}
function write(root, slug, text) { fs.writeFileSync(path.join(root, 'content', 'posts', `${slug}.md`), text); }

test('renders Markdown and escapes titles and raw HTML', () => {
  const post = parsePost(source('<script>alert(1)</script>') + '\n<script>alert(2)</script>', 'a-note');
  const html = renderPost(post);
  for (const expected of ['<h2>A heading</h2>', '<strong>bold</strong>', '<ul>', 'language-python', '<table>', '&lt;script&gt;']) assert.ok(html.includes(expected));
  assert.ok(!html.includes('<script>'));
});

test('groups and sorts posts; drafts stay out of generated files', t => {
  const root = workspace(t);
  write(root, 'older', source('Older note', '2026-09-20'));
  write(root, 'newer', source('Newer note'));
  write(root, 'code', source('Code note', '2026-09-25', 'engineering'));
  write(root, 'private', source('Private note', '2026-09-25', 'daily', true));
  newPost(root, 'local-draft', 'Local private title', 'daily');
  assert.equal(build(root), 3);
  const index = fs.readFileSync(path.join(root, 'blog', 'index.html'), 'utf8');
  assert.ok(index.indexOf('Newer note') < index.indexOf('Older note'));
  assert.ok(index.includes('id="engineering"'));
  assert.ok(!index.includes('Private note') && !index.includes('Local private title'));
  assert.ok(!fs.existsSync(path.join(root, 'blog', 'private')));
});

test('rejects invalid posts before modifying the current output', t => {
  const root = workspace(t);
  build(root);
  const indexPath = path.join(root, 'blog', 'index.html');
  const original = fs.readFileSync(indexPath, 'utf8');
  for (const bad of [source('Bad', '2026-02-30'), source('Bad', '2026-09-25', 'unknown')]) {
    write(root, 'bad', bad);
    assert.throws(() => build(root));
    assert.equal(fs.readFileSync(indexPath, 'utf8'), original);
  }
  assert.throws(() => parsePost(source(), '../escape'));
});

test('making a post a draft removes only its generated page', t => {
  const root = workspace(t);
  write(root, 'a-note', source()); build(root);
  const asset = path.join(root, 'blog', 'a-note', 'keep.txt');
  fs.writeFileSync(asset, 'Keep this asset');
  write(root, 'a-note', source('A note', '2026-09-25', 'research', true)); build(root);
  assert.ok(!fs.existsSync(path.join(root, 'blog', 'a-note', 'index.html')));
  assert.equal(fs.readFileSync(asset, 'utf8'), 'Keep this asset');
});

test('draft-to-ready flow rejects placeholders and never overwrites a post', t => {
  const root = workspace(t);
  const draft = newPost(root, 'a-note', 'My title', 'daily');
  assert.throws(() => readyPost(root, 'a-note'), /template/);
  fs.writeFileSync(draft, source('My title', '2026-09-25', 'daily', true));
  const ready = readyPost(root, 'a-note');
  assert.equal(parsePost(fs.readFileSync(ready, 'utf8'), 'a-note').draft, false);
  assert.throws(() => readyPost(root, 'a-note'));
  assert.throws(() => newPost(root, 'a-note', 'Other title', 'daily'));
  assert.ok(fs.existsSync(draft));
  assert.equal(build(root), 1);
});

test('a configured category works in the homepage, blog, posts, and draft commands', t => {
  const root = workspace(t);
  const config = loadConfig(root);
  config.categories.reading = { title: 'Reading & ideas', description: 'Books and notes.' };
  config.defaultCategory = 'reading';
  config.navigation.push({ label: 'Reading', href: 'blog/#reading' });
  config.brand = 'My site';
  fs.writeFileSync(path.join(root, 'site.config.json'), JSON.stringify(config));
  const draft = newPost(root, 'book-note', 'A book');
  assert.ok(fs.readFileSync(draft, 'utf8').includes('category: reading'));
  fs.writeFileSync(draft, source('A book', '2026-09-25', 'reading', true));
  readyPost(root, 'book-note');
  assert.equal(build(root), 1);
  for (const file of ['index.html', 'blog/index.html', 'blog/book-note/index.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(html.includes('Reading &amp; ideas'), file);
    assert.ok(html.includes('My site'), file);
    assert.ok(html.includes('blog/#reading'), file);
  }
});

test('invalid configuration does not overwrite existing output', t => {
  const root = workspace(t);
  build(root);
  const indexPath = path.join(root, 'index.html');
  const previous = fs.readFileSync(indexPath, 'utf8');
  const config = loadConfig(root);
  config.navigation.push({ label: 'Bad link', href: 'javascript:alert(1)' });
  fs.writeFileSync(path.join(root, 'site.config.json'), JSON.stringify(config));
  assert.throws(() => build(root), /local paths/);
  assert.equal(fs.readFileSync(indexPath, 'utf8'), previous);
});
