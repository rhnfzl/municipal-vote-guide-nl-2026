"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-white text-gray-900">
        <div className="text-center space-y-4 p-8">
          <h1 className="text-4xl font-black text-red-400">Something went wrong</h1>
          <p className="text-gray-500">An unexpected error occurred. Please try again.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="rounded-xl bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
            <a
              href="/en"
              className="rounded-xl border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50 transition-colors"
            >
              Go to Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
