import React from 'react'
import useGameStore from '../store/gameStore'

export default function ScoreBar() {
  const { score, correctCount, totalQuestions } = useGameStore()
  const answered = Object.values(useGameStore((s) => s.slotStates)).filter(
    (v) => v === 'correct'
  ).length
  const progress = totalQuestions > 0 ? (answered / totalQuestions) * 100 : 0

  return (
    <div className="flex items-center gap-4 w-full">
      {/* Score pill */}
      <div className="flex items-center gap-1.5 bg-brand-800/80 border border-brand-700/40 rounded-xl px-4 py-2 min-w-[90px] justify-center">
        <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Score</span>
        <span className="text-lg font-bold text-indigo-300 tabular-nums">{score}</span>
      </div>

      {/* Progress bar */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex justify-between text-xs text-white/40">
          <span>{answered} of {totalQuestions} correct</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-brand-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
