// Root layout is a pass-through - the [locale]/layout.tsx handles
// the full HTML structure including <html>, <body>, i18n, and theme.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
