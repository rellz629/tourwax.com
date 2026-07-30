import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateBlogPostMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateBlogPostingSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getPostBySlug, getAllSlugs, getAllPosts } from '@/lib/blog';
import FollowOnX from '@/components/FollowOnX';

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

  // Get related posts: same category first, then recent, excluding current
  const allPosts = getAllPosts();
  const relatedPosts = [
    ...allPosts.filter((p) => p.slug !== post.slug && p.category === post.category),
    ...allPosts.filter((p) => p.slug !== post.slug && p.category !== post.category),
  ].slice(0, 3);

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
          {post.featuredImage ? (
            <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden">
              <Image
                src={post.featuredImage}
                alt={post.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 896px"
                priority
              />
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent" />
            </div>
          ) : (
            <div className="h-2 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600"></div>
          )}

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

        <FollowOnX />

        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
          >
            ← Back to Blog
          </Link>
        </div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">More from the Blog</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="bg-white rounded-xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-shadow"
                >
                  <span className="inline-block px-2 py-0.5 text-xs font-semibold text-orange-600 bg-orange-50 rounded-full mb-2">
                    {related.category}
                  </span>
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-2">{related.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2">{related.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Explore More */}
        <section className="mt-12 bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Explore TourWax</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/concerts/tonight" className="text-sm font-medium text-orange-500 hover:text-orange-600">Concerts Tonight</Link>
            <Link href="/concerts/this-weekend" className="text-sm font-medium text-orange-500 hover:text-orange-600">This Weekend</Link>
            <Link href="/festivals" className="text-sm font-medium text-orange-500 hover:text-orange-600">Festivals</Link>
            <Link href="/insights" className="text-sm font-medium text-orange-500 hover:text-orange-600">Insights</Link>
            <Link href="/artists" className="text-sm font-medium text-orange-500 hover:text-orange-600">Browse Artists</Link>
            <Link href="/concerts" className="text-sm font-medium text-orange-500 hover:text-orange-600">Concerts by City</Link>
            <Link href="/tours" className="text-sm font-medium text-orange-500 hover:text-orange-600">Tours by Genre</Link>
            <Link href="/venues" className="text-sm font-medium text-orange-500 hover:text-orange-600">Venues</Link>
          </div>
        </section>
      </div>
    </>
  );
}
