import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { generateBlogPostMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateBlogPostingSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getPostBySlug, getAllSlugs } from '@/lib/blog';

export const revalidate = 1800;

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return generateBlogPostMetadata(post);
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Blog', url: `${SITE_URL}/blog` },
    { name: post.title, url: `${SITE_URL}/blog/${post.slug}` },
  ]);

  const blogPostingSchema = generateBlogPostingSchema(post);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
    { name: post.title, url: `/blog/${post.slug}` },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema, blogPostingSchema]} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <article className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600"></div>

          <header className="px-6 sm:px-10 pt-8 pb-6 border-b border-gray-100">
            <div className="mb-4">
              <span className="inline-block px-3 py-1 text-xs font-semibold text-orange-600 bg-orange-50 rounded-full">
                {post.category}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4">
              <span className="gradient-text">{post.title}</span>
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {post.author.split(' ').map(w => w[0]).join('')}
                </div>
                <span className="font-medium text-gray-700">{post.author}</span>
              </div>
              <span className="text-gray-300">|</span>
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
            </div>
          </header>

          <div className="px-6 sm:px-10 py-8">
            <div
              className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-gray-900"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>
        </article>

        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
          >
            ← Back to Blog
          </Link>
        </div>
      </div>
    </>
  );
}
