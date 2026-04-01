import React from 'react'

export default function ProgressDots({ total, slotStates }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {Array.from({ length: total }, (_, i) => {
        const state = slotStates[i]
        const isCorrect = state === 'correct'
        const isWrong = state === 'wrong'
        const color = isCorrect ? 'var(--correct)' : isWrong ? 'var(--wrong)' : 'var(--border-bright)'
        const glow = isCorrect
          ? '0 0 6px rgba(57, 255, 20, 0.5)'
          : isWrong
            ? '0 0 6px rgba(255, 71, 87, 0.5)'
            : 'none'

        return (
          <div
            key={i}
            className="progress-dot"
            style={{
              background: color,
              boxShadow: glow,
              transform: isCorrect ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        )
      })}
    </div>
  )
}
