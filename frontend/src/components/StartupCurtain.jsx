import React, { useEffect, useState } from 'react'

// Phases
// CLOSED  → panels cover screen, radial glow behind them
// TITLE   → title fades in at center seam
// OPEN    → panels slide apart (top up, bottom down)
// DONE    → unmount

const CLOSED = 'closed'
const TITLE  = 'title'
const OPEN   = 'open'
const DONE   = 'done'

// Scanline overlay for each panel
function ScanlinePanel({ style }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)',
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}

export default function StartupCurtain({ onDone }) {
  const [phase, setPhase] = useState(CLOSED)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(TITLE), 150)
    const t2 = setTimeout(() => setPhase(OPEN),  1350)
    const t3 = setTimeout(() => { setPhase(DONE); onDone?.() }, 2200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  function skip() {
    setPhase(DONE)
    onDone?.()
  }

  if (phase === DONE) return null

  const opening = phase === OPEN
  const showTitle = phase === TITLE || phase === OPEN

  // Easing: accelerates at start (curtains "pop" open)
  const curtainEasing = 'cubic-bezier(0.55, 0, 0.85, 0.35)'

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden cursor-pointer select-none"
      onClick={skip}
      aria-hidden="true"
    >
      {/* ── Top curtain ────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: 0, right: 0, top: 0,
          height: '50%',
          background: 'linear-gradient(180deg, #060710 0%, #0E1020 100%)',
          transform: opening ? 'translateY(-100%)' : 'translateY(0)',
          transition: `transform 0.75s ${curtainEasing}`,
          // decorative inner edge
          borderBottom: '2px solid rgba(124,106,247,0.5)',
          boxShadow: '0 2px 24px rgba(124,106,247,0.2), 0 0 0 1px rgba(124,106,247,0.08)',
          zIndex: 2,
        }}
      >
        <ScanlinePanel />
        {/* Corner ornament top-left */}
        <CornerOrn style={{ top: 12, left: 12 }} />
        {/* Corner ornament top-right */}
        <CornerOrn style={{ top: 12, right: 12, transform: 'scaleX(-1)' }} />
        {/* Radial vignette toward center */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 80% 120% at 50% 100%, rgba(124,106,247,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── Bottom curtain ─────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          height: '50%',
          background: 'linear-gradient(0deg, #060710 0%, #0E1020 100%)',
          transform: opening ? 'translateY(100%)' : 'translateY(0)',
          transition: `transform 0.75s ${curtainEasing}`,
          borderTop: '2px solid rgba(124,106,247,0.5)',
          boxShadow: '0 -2px 24px rgba(124,106,247,0.2), 0 0 0 1px rgba(124,106,247,0.08)',
          zIndex: 2,
        }}
      >
        <ScanlinePanel />
        {/* Corner ornament bottom-left */}
        <CornerOrn style={{ bottom: 12, left: 12, transform: 'scaleY(-1)' }} />
        {/* Corner ornament bottom-right */}
        <CornerOrn style={{ bottom: 12, right: 12, transform: 'scale(-1,-1)' }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 80% 120% at 50% 0%, rgba(124,106,247,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── Center seam glow line ──────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: 0, right: 0,
          top: 'calc(50% - 1px)',
          height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(124,106,247,0.8) 20%, rgba(0,240,255,0.9) 50%, rgba(124,106,247,0.8) 80%, transparent)',
          boxShadow: '0 0 16px rgba(124,106,247,0.6), 0 0 32px rgba(0,240,255,0.3)',
          opacity: opening ? 0 : 1,
          transition: 'opacity 0.25s ease-out',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />

      {/* ── Title (sits at the center, z above panels) ─────────── */}
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 8,
          zIndex: 4,
          pointerEvents: 'none',
          opacity: showTitle ? 1 : 0,
          transition: showTitle
            ? (opening ? 'opacity 0.2s ease-out' : 'opacity 0.5s ease-in')
            : 'none',
        }}
      >
        {/* Main Tamil title */}
        <h1
          className="tamil font-black"
          style={{
            fontSize: 'clamp(2.2rem, 10vw, 3.5rem)',
            color: '#fff',
            textShadow:
              '0 0 20px rgba(124,106,247,0.9), 0 0 50px rgba(124,106,247,0.4), 0 0 80px rgba(0,240,255,0.15)',
            letterSpacing: '0.04em',
            lineHeight: 1.1,
          }}
        >
          லெக்ஸிஃபைட்
        </h1>

        {/* Subtitle */}
        <p
          className="font-black uppercase"
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.45em',
            color: '#7C6AF7',
            textShadow: '0 0 12px rgba(124,106,247,0.7)',
          }}
        >
          LEXIFYD
        </p>

        {/* Decorative divider */}
        <div
          style={{
            width: 120, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(124,106,247,0.6), transparent)',
            margin: '6px 0',
          }}
        />

        {/* Tap to skip */}
        {phase === TITLE && (
          <p
            className="animate-pulse-soft font-bold uppercase"
            style={{
              fontSize: '0.6rem',
              letterSpacing: '0.3em',
              color: 'rgba(255,255,255,0.25)',
              marginTop: 8,
            }}
          >
            tap to skip
          </p>
        )}
      </div>
    </div>
  )
}

// Small L-shaped corner ornament (SVG)
function CornerOrn({ style }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      fill="none"
      style={{ position: 'absolute', ...style }}
    >
      <path d="M1 17 L1 1 L17 1" stroke="rgba(124,106,247,0.55)" strokeWidth={1.5} strokeLinecap="square" />
    </svg>
  )
}
