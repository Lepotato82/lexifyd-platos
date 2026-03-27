import React, { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

export default function MeaningChip({ id, text, hint, locked, used }) {
  const [showHint, setShowHint] = useState(false)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { text },
    disabled: locked || used,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 999 : undefined,
    touchAction: 'none',
  }

  if (locked) {
    return (
      <div className="rounded-xl border-2 border-green-500/40 bg-green-500/10 px-4 py-3 text-sm font-medium opacity-40 cursor-default">
        <span className="tamil text-green-300">{text}</span>
      </div>
    )
  }

  if (used) return null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`meaning-chip ${isDragging ? 'dragging' : ''} relative`}
    >
      <div className="flex items-center gap-2">
        <span className="tamil text-base font-semibold text-white">{text}</span>
        {hint && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setShowHint((v) => !v) }}
            className="text-white/30 hover:text-white/70 transition-colors text-xs leading-none ml-1 px-1 py-0.5 rounded border border-white/10"
            aria-label="Toggle hint"
          >
            {showHint ? '▲' : '?'}
          </button>
        )}
      </div>
      {showHint && hint && (
        <p className="mt-1 text-xs text-white/50">{hint}</p>
      )}
    </div>
  )
}
