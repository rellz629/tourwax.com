import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

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
}

type BlogPostMeta = Omit<BlogPost, 'content'>;

const BLOG_DIR = path.join(process.cwd(), 'content/blog');

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
    };
  });

  return posts.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
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
    content: marked(content) as string,
  };
}

export function getAllSlugs(): string[] {
  const files = getMarkdownFiles();

  return files.map((filename) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf-8');
    const { data } = matter(raw);
    return data.slug as string;
  });
}
