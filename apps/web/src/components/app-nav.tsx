'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Home, FileText, PenSquare, Settings, LogOut } from 'lucide-react'

const tabs = [
  { href: '/', label: 'Accueil', icon: Home, mobile: true },
  { href: '/posts', label: 'Posts', icon: FileText, mobile: true },
  { href: '/rediger', label: 'Rédiger', icon: PenSquare, mobile: false },
]

export function AppNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* ─── Mobile top bar ─── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-[hsl(228,30%,6%)]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <img src="/favicon.svg" alt="Leni" className="h-6 w-6" />
        <p className="font-display text-[13px] font-bold tracking-tight text-white/90">Leni</p>
      </header>

      {/* ─── Desktop sidebar ─── */}
      <aside className="hidden md:flex fixed left-0 top-0 z-50 h-dvh w-60 flex-col border-r border-white/[0.06] bg-[hsl(228,30%,6%)]/80 backdrop-blur-xl">
        {/* Logo + Mascot */}
        <div className="px-6 pt-8 pb-6">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0">
              <img src="/favicon.svg" alt="Leni" className="h-full w-full" />
            </div>
            <div>
              <p className="font-display text-[15px] font-bold tracking-tight text-white">Leni</p>
              <p className="text-[11px] font-medium text-white/40">Agent Social Media</p>
            </div>
          </div>
        </div>

        <div className="mx-5 h-px bg-white/[0.06]" />

        {/* Nav links */}
        <nav className="flex-1 px-4 pt-5 space-y-1">
          {tabs.map((tab) => {
            const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200',
                  isActive
                    ? 'text-white'
                    : 'text-white/40 hover:text-white/70'
                )}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-white/[0.07] shadow-sm" />
                )}
                <tab.icon className={cn(
                  'relative h-[18px] w-[18px] transition-colors duration-200',
                  isActive ? 'text-accent-blue' : 'text-white/30 group-hover:text-white/50'
                )} />
                <span className="relative">{tab.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Compose button */}
        <div className="px-4 pb-2">
          <Link href="/rediger" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-blue to-[#5b8aff] py-2.5 text-[13px] font-bold text-white shadow-lg shadow-accent-blue/25 transition-all duration-200 hover:shadow-accent-blue/40 hover:brightness-110 active:scale-[0.98]">
            <PenSquare className="h-4 w-4" />
            Rédiger
          </Link>
        </div>

        {/* Settings + Logout */}
        <div className="px-4 pb-2">
          <Link
            href="/settings"
            className={cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200',
              pathname === '/settings' ? 'text-white' : 'text-white/40 hover:text-white/70'
            )}
          >
            {pathname === '/settings' && (
              <div className="absolute inset-0 rounded-xl bg-white/[0.07] shadow-sm" />
            )}
            <Settings className={cn(
              'relative h-[18px] w-[18px] transition-colors duration-200',
              pathname === '/settings' ? 'text-accent-blue' : 'text-white/30 group-hover:text-white/50'
            )} />
            <span className="relative">Réglages</span>
          </Link>
        </div>
        <div className="px-4 pb-4">
          <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.06] py-2 text-[12px] font-medium text-white/30 transition-colors hover:text-white/60 hover:border-white/[0.1]">
            <LogOut className="h-3.5 w-3.5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ─── Mobile bottom nav ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[hsl(228,30%,6%)]/90 backdrop-blur-2xl">
        <div className="flex items-center justify-around px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tabs.filter((t) => t.mobile).map((tab, i) => {
            const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
            return (
              <span key={tab.href} className="contents">
                {i === 1 && (
                  <Link href="/rediger" className="flex h-11 w-11 items-center justify-center rounded-full -mt-5 bg-gradient-to-br from-accent-blue to-accent-teal text-white shadow-lg shadow-accent-blue/30 transition-transform active:scale-90">
                    <PenSquare className="h-5 w-5" />
                  </Link>
                )}
                <Link
                  href={tab.href}
                  className={cn(
                    'flex flex-col items-center gap-1 px-1.5 py-1.5 text-[9px] font-semibold transition-colors duration-200',
                    isActive ? 'text-accent-blue' : 'text-white/30'
                  )}
                >
                  <tab.icon className="h-5 w-5" />
                  {tab.label}
                </Link>
              </span>
            )
          })}
        </div>
      </nav>
    </>
  )
}
