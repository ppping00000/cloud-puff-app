export const metadata = {
  title: 'Cloud Puff ☁️',
  description: '和朋友一起放空 5 分鐘',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
