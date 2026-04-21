import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateBlogIndexMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAllPosts } from '@/lib/blog';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return generateBlogIndexMetadata();
}

export default function BlogPage() {
  const posts = getAllPosts();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Blog', url: `${SITE_URL}/blog` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Music Blog</span>
          </h1>
          <p className="text-xl text-gray-600">
            Concert tips, tour news, and artist spotlights
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover overflow-hidden border border-gray-100"
              >
                {post.featuredImage ? (
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={post.featuredImage}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                ) : (
                  <div className="h-3 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600"></div>
                )}
                <div className="p-6">
                  <div className="mb-3">
                    <span className="inline-block px-3 py-1 text-xs font-semibold text-orange-600 bg-orange-50 rounded-full">
                      {post.category}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 group-hover:text-orange-500 transition-colors mb-2">
                    {post.title}
                  </h2>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{post.author}</span>
                    <span>
                      {new Date(post.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="mt-4 text-sm font-semibold text-orange-500 group-hover:text-orange-600 transition-colors">
                    Read More →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-12 bg-white rounded-xl shadow-md p-8 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Data Insights</h2>
          <p className="text-gray-600 mb-4">
            Explore data-driven rankings of the busiest touring artists and most popular concert cities.
          </p>
          <Link
            href="/insights"
            className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
          >
            View Live Music Insights →
          </Link>
        </div>
      </div>
    </>
  );
}
