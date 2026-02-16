import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "TourWax",
  description: "Live music tour dates",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: '20px' }}>
          <h1>TourWax</h1>
          <hr />
          {children}
        </div>
      </body>
    </html>
  );
}
