import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'CLINIXAI · Clinical Intelligence', description: 'Explainable multi-agent clinical decision support. Synthetic research demonstration.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
