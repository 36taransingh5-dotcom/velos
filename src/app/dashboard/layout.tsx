import Link from 'next/link';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';

const nav = [
  { href: '/dashboard', label: 'overview' },
  { href: '/dashboard/approvals', label: 'approvals' },
  { href: '/dashboard/policies', label: 'policies' },
  { href: '/dashboard/keys', label: 'api keys' },
  { href: '/dashboard/billing', label: 'billing' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[#e6e2da] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-mono text-lg font-bold lowercase tracking-tight">
              <span className="text-accent">+</span>velos
            </Link>
            <nav className="flex items-center gap-5">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="font-mono text-[13px] text-ink/70 transition-colors hover:text-accent"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <OrganizationSwitcher afterSelectOrganizationUrl="/dashboard" />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
    </div>
  );
}
