import React from 'react'
import { useDroppable } from '@dnd-kit/core'

export default function SentenceSlot({ id, questionIndex, slotState, filledWith, sentence }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { questionIndex } })

  const stateClass =
    slotState === 'correct' ? 'sentence-slot correct' :
    slotState === 'wrong'   ? 'sentence-slot wrong'   :
    isOver                  ? 'sentence-slot over'    :
                              'sentence-slot'

  const parts = sentence.split('______')
  const before = parts[0] ?? ''
  const after  = parts[1] ?? ''

  return (
    <p className="tamil text-lg leading-relaxed text-white/90">
      {before}
      <span
        ref={setNodeRef}
        className={`${stateClass} mx-1`}
        key={`${questionIndex}-${slotState}`}
      >
        {slotState === 'correct' && filledWith ? (
          <span className="font-semibold text-green-300 animate-popIn">{filledWith}</span>
        ) : (
          <span className="text-white/30 text-sm">______</span>
        )}
      </span>
      {after}
    </p>
  )
}
