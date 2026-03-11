'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const tabs = [
  { href: '/', label: 'Accueil', icon: '⌂' },
  { href: '/veille', label: 'Veille', icon: '◎' },
  { href: '/inbox', label: 'Inbox', icon: '✉' },
  { href: '/contexte', label: 'Contexte', icon: '⚙' },
]

export function AppNav() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-50 h-dvh w-56 flex-col bg-glass/80 backdrop-blur-2xl border-r border-white/30">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900 font-heading">Leni</h1>
          <p className="text-xs text-gray-500 mt-0.5">Agent Social Media</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-gray-500 hover:bg-white/40 hover:text-gray-900'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                {tab.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3">
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-accent/90 transition-colors">
            <span className="text-lg">+</span>
            Composer
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2">
        <div className="flex items-center justify-around bg-glass/80 px-2 pb-6 pt-2 backdrop-blur-2xl border-t border-white/30">
          {tabs.map((tab, i) => {
            const isActive = pathname === tab.href
            return (
              <span key={tab.href} className="contents">
                {i === 2 && (
                  <button className="flex h-14 w-14 -mt-8 items-center justify-center rounded-full bg-accent text-white text-2xl shadow-lg">
                    +
                  </button>
                )}
                <Link
                  href={tab.href}
                  className={`flex flex-col items-center gap-0.5 text-xs ${
                    isActive ? 'text-accent font-semibold' : 'text-gray-400'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
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
