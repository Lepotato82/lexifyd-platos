import React, { useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

export default function MeaningChip({ id, text, hint, locked, used, eliminated, onTap, disableDrag = false }) {
  const [showHint, setShowHint] = useState(false)
  const wasDragging = useRef(false)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { text },
    disabled: locked || used || eliminated || disableDrag,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 999 : undefined,
    touchAction: 'none',
  }

  const handleDragStart = () => { wasDragging.current = true }

  const handleClick = () => {
    if (wasDragging.current) { wasDragging.current = false; return }
    if (onTap && !locked && !used) onTap(text)
  }

  if (locked) {
    return (
      <div
        className="rounded-2xl px-4 py-3 text-sm font-medium opacity-40 cursor-default"
        style={{
          border: '1.5px solid var(--correct)',
          background: 'var(--correct-dim)',
          color: 'var(--correct)',
          fontFamily: 'var(--font-tamil)',
        }}
      >
        {text}
      </div>
    )
  }

  if (used) return null

  // Hint-eliminated: shown but visually struck out and non-interactive
  if (eliminated) {
    return (
      <div
        className="rounded-2xl px-4 py-3 text-sm font-medium cursor-default select-none"
        style={{
          border: '1.5px solid var(--border)',
          background: 'var(--bg-raised)',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-tamil)',
          opacity: 0.35,
          textDecoration: 'line-through',
        }}
      >
        {text}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onPointerDown={() => { wasDragging.current = false }}
      onPointerMove={() => { wasDragging.current = true }}
      onClick={handleClick}
      className={`meaning-chip ${isDragging ? 'dragging' : ''} relative`}
    >
      <div className="flex items-center gap-2">
        <span className="tamil text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {text}
        </span>
        {hint && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setShowHint((v) => !v) }}
            className="transition-colors text-xs leading-none ml-1 px-1 py-0.5 rounded"
            style={{
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
            aria-label="Toggle hint"
          >
            {showHint ? '▲' : '?'}
          </button>
        )}
      </div>
      {showHint && hint && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{hint}</p>
      )}
    </div>
  )
}
