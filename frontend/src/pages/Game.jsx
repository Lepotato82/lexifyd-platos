import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import useGameStore from '../store/gameStore'
import { useGameEngine } from '../hooks/useGameEngine'
import SentenceSlot from '../components/SentenceSlot'
import MeaningChip from '../components/MeaningChip'

export default function Game() {
  const navigate = useNavigate()
  const { submitAnswer } = useGameEngine()
  const {
    wordTa, wordRomanized, questions, slotStates, slotAnswers,
    scoreAnimations, score, streak, correctCount, gamePhase, resetGame,
  } = useGameStore()

  const [activeChip, setActiveChip] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 6 } })
  )

  // Redirect if no game in progress
  if (gamePhase === 'idle' || !questions.length) {
    return (
      <div className="min-h-dvh flex items-center justify-center flex-col gap-4 text-white/50">
        <p>No game in progress.</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    )
  }

  // All unique options across every question — correct answers + all distractors
  const chipPool = [...new Set(questions.flatMap((q) => q.options))]

  // A chip is "used" only when every slot that needs it as the correct answer is filled
  function isChipUsed(text) {
    const needingSlots = questions.filter((q) => q.correct_answer === text)
    if (needingSlots.length === 0) return false   // pure distractor — always stays visible
    return needingSlots.every((q) => slotStates[q.index] === 'correct')
  }

  const totalQuestions = questions.length
  const allCorrect = questions.every((q) => slotStates[q.index] === 'correct')

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveChip(null)
    if (!over) return

    const chipText = active.data.current?.text
    const questionIndex = over.data.current?.questionIndex

    if (chipText == null || questionIndex == null) return
    if (slotStates[questionIndex] === 'correct') return

    try {
      await submitAnswer(questionIndex, chipText)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveChip(e.active.data.current?.text ?? null)}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-dvh flex flex-col">
        {/* HUD */}
        <header className="sticky top-0 z-20 bg-brand-900/90 backdrop-blur border-b border-brand-700/30 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <button
              onClick={() => { resetGame(); navigate('/') }}
              className="text-white/40 hover:text-white transition-colors text-sm"
            >
              ← Exit
            </button>

            <div className="flex items-center gap-4">
              {/* Streak */}
              {streak > 0 && (
                <div className="flex items-center gap-1 text-orange-400 font-bold text-sm animate-pulse">
                  🔥 {streak}
                </div>
              )}
              {/* Score */}
              <div className="text-white font-bold tabular-nums">
                {score} pts
              </div>
              {/* Progress */}
              <div className="text-white/40 text-sm">
                {correctCount}/{totalQuestions}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="max-w-2xl mx-auto mt-2">
            <div className="h-1 bg-brand-700/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${(correctCount / totalQuestions) * 100}%` }}
              />
            </div>
          </div>
        </header>

        {/* Word title */}
        <div className="text-center pt-6 pb-2 px-4">
          <h1 className="tamil text-4xl font-bold text-white">{wordTa}</h1>
          <p className="text-white/40 text-sm mt-1 uppercase tracking-widest">{wordRomanized}</p>
          <p className="text-white/30 text-xs mt-2">Match each sentence blank with the correct form</p>
        </div>

        {/* Sentence slots */}
        <main className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full space-y-3">
          {questions.map((q) => (
            <div
              key={q.index}
              className={`card p-4 transition-all duration-300 relative ${
                slotStates[q.index] === 'correct' ? 'border-green-500/40 bg-green-500/5' :
                slotStates[q.index] === 'wrong'   ? 'border-red-500/40 bg-red-500/5' : ''
              }`}
            >
              <SentenceSlot
                id={`slot-${q.index}`}
                questionIndex={q.index}
                slotState={slotStates[q.index] ?? 'empty'}
                filledWith={slotStates[q.index] === 'correct' ? slotAnswers[q.index] : null}
                sentence={q.game_sentence}
              />

              {/* Sense hint */}
              <p className="mt-2 text-xs text-white/30">
                <span className="tamil">{q.sense_ta}</span>
                {q.sense_ta && q.sense ? ' · ' : ''}
                {q.sense}
              </p>

              {/* Score animation */}
              {scoreAnimations[q.index] && (
                <span
                  className={`absolute top-2 right-3 text-sm font-bold animate-popIn ${
                    scoreAnimations[q.index].startsWith('+') ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {scoreAnimations[q.index]}
                </span>
              )}
            </div>
          ))}
        </main>

        {/* Chip pool */}
        <footer className="sticky bottom-0 bg-brand-900/95 backdrop-blur border-t border-brand-700/30 px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-widest text-white/30 mb-3">
              {allCorrect ? '🎉 All correct!' : 'Drag a form into the blank'}
            </p>
            <div className="flex flex-wrap gap-2">
              {chipPool.map((text) => (
                <MeaningChip
                  key={text}
                  id={`chip-${text}`}
                  text={text}
                  used={isChipUsed(text)}
                />
              ))}
            </div>
          </div>
        </footer>
      </div>

      <DragOverlay>
        {activeChip && (
          <div className="meaning-chip dragging">
            <span className="tamil text-base font-semibold text-white">{activeChip}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
