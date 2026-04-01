import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  {
    to: '/',
    exact: true,
    label: 'Home',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/flashcards',
    label: 'Cards',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    to: '/progress',
    label: 'Stats',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  if (pathname === '/game' || pathname.startsWith('/semantic-web')) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 safe-area-inset-bottom"
      style={{
        background: 'var(--bg-surface)',
        borderTop: '2px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex max-w-lg mx-auto">
        {TABS.map(({ to, exact, label, icon }) => {
          const active = exact ? pathname === to : pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className="bottom-nav-tab"
              style={{
                color: active ? 'var(--primary)' : 'var(--text-muted)',
                textShadow: active ? '0 0 8px var(--primary-glow)' : 'none',
              }}
            >
              {icon(active)}
              <span>{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
