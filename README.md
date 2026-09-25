# LuckySweetRain · Academic Homepage

全英文个人学术主页与博客。页面使用简短英文，包含 Research、Publications、About 和 Blog。

## 以后从哪里修改

| 想做什么 | 修改位置 |
| --- | --- |
| 修改名字、站点标题、页脚或 GitHub 链接 | `site.config.json` |
| 调整顶部导航 | `site.config.json` 的 `navigation` |
| 增加、重命名或排序博客板块 | `site.config.json` 的 `categories` |
| 修改介绍、研究、论文或教育经历 | `templates/home.html` 对应的 `<section>` |
| 写文章 | `.drafts/`，准备好后转入 `content/posts/` |
| 改颜色、字体或间距 | `styles.css`；主题变量集中在开头 `:root` |
| 修改所有页面的页头和页脚布局 | `tools/layout.mjs` |

修改后运行 `npm run build`，刷新浏览器。`index.html` 和 `blog/` 都是生成文件，不要直接编辑。现有文章地址与写作命令保持不变。

### 示例：新增 Reading 博客板块

在 `site.config.json` 的 `categories` 对象中增加一项，注意前一项结尾的逗号：

```json
"reading": {
  "title": "Reading",
  "description": "Books and ideas."
}
```

运行 `npm run build` 后，首页会出现 Reading 入口，博客页会出现 Reading 板块。无需修改生成器。创建文章时使用：

```sh
npm run post -- book-notes "Book notes" reading
```

配置中的排列顺序就是页面顺序。修改 `title` 只改显示名称；`reading` 这样的键还用于文章分类和链接，应尽量保持稳定。若要改键或删除板块，先更新已有文章及本地草稿的 `category`。

`defaultCategory` 指定省略分类参数时的默认板块，它必须存在于 `categories` 中。

### 示例：新增 Projects 首页板块

在 `templates/home.html` 内复制一个现有板块，或插入下面的 HTML：

```html
<section class="section-shell research-section" id="projects" aria-labelledby="projects-title">
  <div class="section-heading">
    <div>
      <p class="eyebrow">PROJECTS</p>
      <h2 id="projects-title">Projects</h2>
    </div>
  </div>
  <p>Add a short project description here.</p>
</section>
```

然后在 `site.config.json` 的 `navigation` 数组中增加：

```json
{ "label": "Projects", "href": "index.html#projects" }
```

运行 `npm run build` 后，所有页面都会出现新导航。每个板块的 `id` 必须唯一。导航路径从站点根目录写起，不加开头的 `/`，因此也能部署到子目录。

首页模板保留两个构建占位符：`{{name}}` 读取配置中的姓名，`{{blogTopics}}` 根据配置生成博客入口。其余正文可直接编辑 HTML。新增独立页面或更复杂的功能时，可复用 `tools/layout.mjs` 中的 `page()`，无需复制页头和页脚。

## 本地预览

首页和已经生成的博客都是静态 HTML。预览时在仓库根目录运行：

```sh
python -m http.server 4173 --bind 127.0.0.1
```

然后访问 http://127.0.0.1:4173 。

## 日常写博客

写作使用 Markdown。首次使用需要 Node.js 20 或更新版本，然后执行 `npm ci`。唯一的直接开发依赖是 `markdown-it`，用于生成 HTML；读者无需加载任何 Markdown 库。

### 1. 新建草稿

```sh
npm run post -- my-first-note "My first note" daily
```

这会创建 `.drafts/my-first-note.md`。最后一个参数选择板块：

| 参数 | 页面板块 | 内容 |
| --- | --- | --- |
| `research` | Research Notes | 论文笔记、研究想法和问题 |
| `engineering` | Engineering | 代码、工具和实验记录 |
| `daily` | Daily Notes | 日常记录和学习心得 |

省略板块参数时使用配置中的 `defaultCategory`，目前为 `daily`。文章文件名使用英文小写字母、数字和连字符；它会成为文章地址，请尽量保持稳定。

### 2. 写文章

用编辑器打开草稿。顶部是简单的逐行元信息，不是完整 YAML；值不需要加引号，不能换行。示例：

```markdown
---
title: My first note
date: 2026-09-25
category: daily
summary: A short note about what I learned.
draft: true
---

## What I learned

Write short paragraphs here.

- One idea
- One question
```

支持标题、段落、加粗、列表、引用、链接、图片、代码块和表格。为避免脚本注入，正文中的原始 HTML 会作为文字显示。暂不提供数学公式渲染、在线编辑器或评论系统。

图片可存放在仓库的 `assets/` 目录，文章中使用 `![Description](../../assets/example.png)`。请只放适合公开的图片。

### 3. 生成并检查

先替换模板摘要和正文，再执行：

```sh
npm run post:ready -- my-first-note
npm run build
```

`post:ready` 将草稿复制到 `content/posts/my-first-note.md` 并设为 `draft: false`，同时保留本地草稿备份。它不会覆盖已有文章，也不会向 GitHub 发布。

访问 http://127.0.0.1:4173/blog/ 查看博客，访问 http://127.0.0.1:4173/blog/my-first-note/ 查看文章。文章会按板块归类，并在每个板块内按日期从新到旧排列。

后续修改应编辑 `content/posts/` 中的正式文章，再运行 `npm run build`。不要直接修改 `blog/` 下的 HTML，下一次构建会覆盖这些生成文件。

### 草稿与隐私

- `.drafts/` 已被 Git 忽略，构建不会读取它。私密草稿请一直保留在这里。
- `content/posts/` 是公开文章源文件目录。即使将其中的文章改成 `draft: true` 后不再生成页面，源文件仍可能随 Git 提交公开。
- 构建会通过 `.blog-manifest.json` 清理失效的旧文章页面，不删除其他资源。删除已公开文章无法清除 Git 历史或外部缓存。
- 本地预览仅绑定 `127.0.0.1`。不将本地预览服务器公开到互联网。

## 内容维护

- `site.config.json`：站点信息、导航和博客板块。
- `templates/home.html`：首页内容源文件，按 `<section>` 分板块。
- `index.html`：生成的首页，不直接编辑。
- `styles.css`：响应式布局、颜色与字体。
- `script.js`：页面滚动时高亮当前导航；关闭 JavaScript 不影响内容阅读。
- `favicon.svg`：本站图标。
- `content/posts/`：公开文章的 Markdown 源文件。
- `.drafts/`：本地草稿，未纳入版本控制。
- `tools/blog.mjs`：草稿命令和静态页面生成器。
- `tools/layout.mjs`：共享页面模板、配置校验和首页生成。
- `blog/`：生成的博客首页与文章页，随站点一起发布。
- `.blog-manifest.json`：生成文件清单，随站点保存。

运行 `npm test` 可检查 Markdown 渲染、草稿隔离、排序、输入校验、草稿转正式文章和新增板块流程。配置或文章校验失败时，构建会报错并保留原有页面。

网站不加载第三方字体、统计脚本或追踪服务。公开信息仅包含学术身份、学校与专业、研究主题、论文和 GitHub 链接；未包含电话、邮箱、生日、照片、排名、原始简历或实习内部数据。

内容依据用户提供的简历整理；IJRNC 论文信息以 [Wiley 页面](https://onlinelibrary.wiley.com/doi/10.1002/rnc.70302) 核对。CVCI 条目来自简历，DOI 指向出版记录。继续研究中的课题不表述为已发表成果。

## 发布

这是适用于 GitHub Pages 的纯静态站点。更新文章后先运行 `npm run build`，将文章源文件、生成的 `blog/` 和 `.blog-manifest.json` 一起提交。无需在线构建服务。

用户确认发布后，可推送到 GitHub 并在仓库 Pages 设置中选择目标分支的根目录。当前制作不包含提交、推送或公开部署。
