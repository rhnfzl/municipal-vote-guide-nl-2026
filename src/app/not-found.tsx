import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-white text-gray-900">
        <div className="text-center space-y-4 p-8">
          <h1 className="text-6xl font-black text-gray-300">404</h1>
          <h2 className="text-xl font-semibold">Page not found</h2>
          <p className="text-gray-500">The page you&apos;re looking for doesn&apos;t exist.</p>
          <Link
            href="/en"
            className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </body>
    </html>
  );
}
