import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Insights | AI Business Intelligence',
  description: 'Instant Business Intelligence Dashboards powered by Conversational AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main className="app-container">
          {children}
        </main>
      </body>
    </html>
  );
}
