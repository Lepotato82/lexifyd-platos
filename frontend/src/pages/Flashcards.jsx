import React, { useEffect, useState, useCallback } from 'react'
import useGameStore from '../store/gameStore'

const API = import.meta.env.VITE_API_URL || ''

function FlashCard({ card, onKnow, onLearning, progress }) {
  const [flipped, setFlipped] = useState(false)
  const [senseIndex, setSenseIndex] = useState(0)
  const sense = card.senses[senseIndex]

  function nextSense() {
    if (senseIndex < card.senses.length - 1) setSenseIndex((i) => i + 1)
  }

  function prevSense() {
    if (senseIndex > 0) setSenseIndex((i) => i - 1)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto">
      {/* Status badge */}
      {progress && (
        <span
          className="text-xs font-black uppercase tracking-wider px-3 py-1 border-2"
          style={{
            color: progress === 'known' ? 'var(--correct)' : 'var(--accent)',
            borderColor: progress === 'known' ? 'var(--correct)' : 'var(--accent)',
            background: progress === 'known' ? 'rgba(57,255,20,0.08)' : 'rgba(255,184,0,0.08)',
            textShadow: progress === 'known' ? '0 0 8px rgba(57,255,20,0.4)' : '0 0 8px rgba(255,184,0,0.4)',
          }}
        >
          {progress === 'known' ? '[ ✓ KNOWN ]' : '[ ~ LEARNING ]'}
        </span>
      )}

      {/* 3D card */}
      <div
        className="flashcard-scene w-full"
        style={{ height: 260 }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div className={`flashcard-inner ${flipped ? 'flipped' : ''}`}>
          {/* Front — Tamil word */}
          <div
            className="flashcard-face flex flex-col items-center justify-center gap-3 cursor-pointer select-none"
            style={{
              background: 'var(--bg-surface)',
              border: '2px solid var(--border-retro, var(--border))',
              boxShadow: 'var(--shadow-neon), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <p className="tamil text-5xl font-black" style={{ color: 'var(--text-primary)', textShadow: '0 0 20px var(--primary-glow)' }}>{card.word_ta}</p>
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{card.word_romanized}</p>
            <p className="text-xs mt-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>Tap to reveal</p>
          </div>

          {/* Back — sense + example */}
          <div
            className="flashcard-face back flex flex-col justify-between p-5 cursor-pointer select-none"
            style={{
              background: 'var(--bg-surface)',
              border: '2px solid var(--border-retro, var(--border))',
              boxShadow: 'var(--shadow-neon), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div>
              {/* Sense navigation */}
              {card.senses.length > 1 && (
                <div className="flex items-center justify-between mb-3">
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); prevSense() }}
                    disabled={senseIndex === 0}
                    className="text-lg leading-none px-1 font-black disabled:opacity-20 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >‹</button>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {senseIndex + 1} / {card.senses.length}
                  </span>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); nextSense() }}
                    disabled={senseIndex === card.senses.length - 1}
                    className="text-lg leading-none px-1 font-black disabled:opacity-20 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >›</button>
                </div>
              )}

              <div className="mb-2 flex items-start gap-2">
                <span
                  className="text-xs px-2 py-0.5 font-black uppercase tracking-wider border"
                  style={{
                    color: sense.pos === 'noun' ? '#3b82f6' : sense.pos === 'verb' ? '#f97316' : sense.pos === 'adj' ? '#22c55e' : 'var(--text-muted)',
                    borderColor: sense.pos === 'noun' ? '#3b82f6' : sense.pos === 'verb' ? '#f97316' : sense.pos === 'adj' ? '#22c55e' : 'var(--border)',
                    background: sense.pos === 'noun' ? 'rgba(59,130,246,0.1)' : sense.pos === 'verb' ? 'rgba(249,115,22,0.1)' : sense.pos === 'adj' ? 'rgba(34,197,94,0.1)' : 'var(--bg-raised)',
                  }}
                >
                  {sense.pos || 'word'}
                </span>
              </div>

              <p className="font-bold text-lg leading-snug" style={{ color: 'var(--text-primary)' }}>{sense.sense}</p>
              {sense.sense_ta && (
                <p className="tamil text-base mt-1" style={{ color: 'var(--text-secondary)' }}>{sense.sense_ta}</p>
              )}
            </div>

            {sense.example_sentence && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="tamil text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{sense.example_sentence}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 w-full">
        <button
          className="btn-danger flex-1 text-sm font-black uppercase tracking-wider"
          onClick={() => { setFlipped(false); setSenseIndex(0); onLearning() }}
        >
          Still Learning
        </button>
        <button
          className="btn-success flex-1 text-sm font-black uppercase tracking-wider"
          onClick={() => { setFlipped(false); setSenseIndex(0); onKnow() }}
        >
          Know it ✓
        </button>
      </div>
    </div>
  )
}

export default function Flashcards() {
  const { flashcardProgress, setFlashcardProgress } = useGameStore()
  const [cards, setCards] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // all | learning | known

  useEffect(() => {
    fetch(`${API}/api/words/flashcards`)
      .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(setCards)
      .catch(() => setError('Could not load flashcards. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = cards.filter((c) => {
    if (filter === 'known')    return flashcardProgress[c.word_ta] === 'known'
    if (filter === 'learning') return flashcardProgress[c.word_ta] === 'stillLearning' || !flashcardProgress[c.word_ta]
    return true
  })

  const safeIndex = Math.min(index, Math.max(0, filtered.length - 1))
  const current = filtered[safeIndex]

  const handleKnow = useCallback(() => {
    if (!current) return
    setFlashcardProgress(current.word_ta, 'known')
    setIndex((i) => Math.min(i + 1, filtered.length - 1))
  }, [current, filtered.length, setFlashcardProgress])

  const handleLearning = useCallback(() => {
    if (!current) return
    setFlashcardProgress(current.word_ta, 'stillLearning')
    setIndex((i) => Math.min(i + 1, filtered.length - 1))
  }, [current, filtered.length, setFlashcardProgress])

  const knownCount    = cards.filter((c) => flashcardProgress[c.word_ta] === 'known').length
  const learningCount = cards.filter((c) => flashcardProgress[c.word_ta] === 'stillLearning').length

  return (
    <div className="min-h-dvh flex flex-col pb-20" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="px-4 pt-8 pb-4 text-center">
        <h1
          className="text-2xl font-black uppercase tracking-wider"
          style={{ color: 'var(--text-primary)', textShadow: '0 0 20px var(--primary-glow)' }}
        >
          Flashcards
        </h1>
        <p className="text-sm mt-1 font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {knownCount} known · {learningCount} learning · {cards.length - knownCount - learningCount} new
        </p>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 mb-6 max-w-sm mx-auto w-full">
        {['all', 'learning', 'known'].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setIndex(0) }}
            className="flex-1 py-1.5 text-xs font-black uppercase tracking-wider transition-all border-2"
            style={{
              background: filter === f ? 'var(--primary)' : 'var(--bg-raised)',
              color: filter === f ? '#fff' : 'var(--text-muted)',
              borderColor: filter === f ? 'var(--primary)' : 'var(--border)',
              boxShadow: filter === f ? '0 0 12px var(--primary-glow)' : 'none',
              borderBottom: filter === f ? '3px solid rgba(0,0,0,0.3)' : '2px solid var(--border)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="mx-4 mb-4 px-4 py-3 text-sm font-bold border-2"
          style={{
            background: 'rgba(255,71,87,0.08)',
            borderColor: 'var(--wrong)',
            color: 'var(--wrong)',
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-16 font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Loading flashcards…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          <p className="text-4xl">🃏</p>
          <p className="text-sm text-center font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {filter === 'known' ? 'No known words yet.' :
             filter === 'learning' ? 'No words to learn.' :
             'No flashcards available.'}
          </p>
          {filter !== 'all' && (
            <button className="btn-ghost text-sm font-black uppercase tracking-wider" onClick={() => setFilter('all')}>Show all</button>
          )}
        </div>
      )}

      {!loading && current && (
        <div className="flex-1 flex flex-col px-4">
          {/* Progress */}
          <div className="max-w-sm mx-auto w-full mb-4">
            <div className="flex justify-between text-xs mb-1 font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              <span>{safeIndex + 1} / {filtered.length}</span>
              <span>{Math.round(((safeIndex) / filtered.length) * 100)}%</span>
            </div>
            <div
              className="h-2 overflow-hidden"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${(safeIndex / filtered.length) * 100}%`,
                  background: 'linear-gradient(90deg, var(--primary), var(--neon-cyan, #00F0FF))',
                  boxShadow: '0 0 8px var(--primary-glow)',
                }}
              />
            </div>
          </div>

          <FlashCard
            key={`${current.word_ta}-${safeIndex}`}
            card={current}
            progress={flashcardProgress[current.word_ta]}
            onKnow={handleKnow}
            onLearning={handleLearning}
          />

          {/* Navigation arrows */}
          <div className="flex justify-center gap-6 mt-6">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex === 0}
              className="btn-ghost text-sm font-black uppercase tracking-wider disabled:opacity-20 py-2 px-4"
            >
              ← Prev
            </button>
            <button
              onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}
              disabled={safeIndex >= filtered.length - 1}
              className="btn-ghost text-sm font-black uppercase tracking-wider disabled:opacity-20 py-2 px-4"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
