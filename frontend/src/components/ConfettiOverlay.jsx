import React, { useMemo } from 'react'

const COLORS = ['#ffd700', '#58cc02', '#4c6ef5', '#ff6b6b', '#cc5de8', '#ff9600', '#74c0fc']

export default function ConfettiOverlay() {
  const pieces = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      left: `${Math.random() * 100}%`,
      size: 6 + Math.random() * 8,
      duration: 1.5 + Math.random() * 1.5,
      delay: Math.random() * 0.8,
      shape: Math.random() > 0.5 ? 'rounded-sm' : 'rounded-full',
    })), [])

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className={`absolute top-0 ${p.shape} animate-confettiFall`}
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            '--duration': `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
