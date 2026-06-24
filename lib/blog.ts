import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked, Renderer } from 'marked';

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  category: string;
  featuredImage: string | null;
  publishedAt: string;
  updatedAt: string;
  content: string;
  // Optional SEO overrides. When set, these drive the <title> and meta
  // description instead of the (often longer) on-page title/excerpt, keeping
  // search-engine metadata within length limits without trimming visible copy.
  metaTitle?: string;
  metaDescription?: string;
}

type BlogPostMeta = Omit<BlogPost, 'content'>;

const BLOG_DIR = path.join(process.cwd(), 'content/blog');

// Custom renderer to ensure accessibility in blog content
const renderer = new Renderer();
// Add alt="" to images missing alt text so they're treated as decorative
const origImage = renderer.image.bind(renderer);
renderer.image = function ({ href, title, text }) {
  const alt = text || '';
  const titleAttr = title ? ` title="${title}"` : '';
  return `<img src="${href}" alt="${alt}"${titleAttr} loading="lazy" />`;
};
marked.use({ renderer });

// Convert standalone YouTube links (whole paragraph) into embedded players
function processYouTubeEmbeds(html: string): string {
  return html.replace(
    /<p><a[^>]+href="https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?(?:[^"]*&)?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})[^"]*"[^>]*>[^<]*<\/a><\/p>/gi,
    (_, videoId) =>
      `<div class="youtube-embed shadow-md"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
  );
}

function getMarkdownFiles(): string[] {
  return fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
}

export function getAllPosts(): BlogPostMeta[] {
  const files = getMarkdownFiles();

  const posts = files.map((filename) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf-8');
    const { data } = matter(raw);

    return {
      slug: data.slug as string,
      title: data.title as string,
      excerpt: data.excerpt as string,
      author: data.author as string,
      category: data.category as string,
      featuredImage: (data.featuredImage as string) || null,
      publishedAt: data.publishedAt as string,
      updatedAt: data.updatedAt as string,
      metaTitle: (data.metaTitle as string) || undefined,
      metaDescription: (data.metaDescription as string) || undefined,
    };
  });

  const now = new Date();

  return posts
    .filter((p) => new Date(p.publishedAt) <= now)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  const files = getMarkdownFiles();
  const filename = files.find((f) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, f), 'utf-8');
    const { data } = matter(raw);
    return data.slug === slug;
  });

  if (!filename) return null;

  const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf-8');
  const { data, content } = matter(raw);

  return {
    slug: data.slug as string,
    title: data.title as string,
    excerpt: data.excerpt as string,
    author: data.author as string,
    category: data.category as string,
    featuredImage: (data.featuredImage as string) || null,
    publishedAt: data.publishedAt as string,
    updatedAt: data.updatedAt as string,
    metaTitle: (data.metaTitle as string) || undefined,
    metaDescription: (data.metaDescription as string) || undefined,
    content: processYouTubeEmbeds(marked(content) as string),
  };
}

export function getAllSlugs(): string[] {
  const now = new Date();
  const files = getMarkdownFiles();

  return files
    .filter((filename) => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf-8');
      const { data } = matter(raw);
      return new Date(data.publishedAt as string) <= now;
    })
    .map((filename) => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf-8');
      const { data } = matter(raw);
      return data.slug as string;
    });
}
