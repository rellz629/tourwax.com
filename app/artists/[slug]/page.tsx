export const dynamic = 'force-static';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return [
    { slug: 'tyler-the-creator' },
    { slug: 'drake' },
    { slug: 'sza' },
  ];
}

export default async function ArtistPageStatic({ params }: Props) {
  const { slug } = await params;

  return (
    <html>
      <body>
        <h1>Artist: {slug}</h1>
        <p>This is a completely static page</p>
        <p>No database query, no nothing</p>
        <a href="/artists">Back</a>
      </body>
    </html>
  );
}
