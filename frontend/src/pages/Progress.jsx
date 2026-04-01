import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore'
import { useGameEngine } from '../hooks/useGameEngine'

const API = import.meta.env.VITE_API_URL || ''

function Stars({ count }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className="text-sm"
          style={{
            color: n <= count ? 'var(--accent)' : 'var(--border-bright)',
            textShadow: n <= count ? '0 0 8px rgba(255,184,0,0.5)' : 'none',
            filter: n <= count ? 'drop-shadow(0 0 4px rgba(255,184,0,0.4))' : 'none',
          }}
        >
          ★
        </span>
      ))}
    </span>
  )
}

function StatBox({ value, label, color, icon }) {
  return (
    <div className="text-center">
      <p
        className="text-2xl font-black tabular-nums uppercase"
        style={{ color, textShadow: `0 0 12px ${color}44` }}
      >
        {icon} {value}
      </p>
      <p className="text-xs mt-0.5 font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

const TABS = ['All', 'Learning', 'Mastered']

export default function Progress() {
  const { wordProgress, totalXP, gems, flashcardProgress } = useGameStore()
  const { startGame } = useGameEngine()
  const navigate = useNavigate()

  const [words,    setWords]    = useState([])
  const [starting, setStarting] = useState(null)
  const [tab,      setTab]      = useState('All')

  useEffect(() => {
    fetch(`${API}/api/words`)
      .then((r) => r.json())
      .then(setWords)
      .catch(() => {})
  }, [])

  async function handlePlay(wordTa) {
    setStarting(wordTa)
    try {
      await startGame(wordTa)
    } catch {
      setStarting(null)
    }
  }

  const playedWords = words.filter((w) => wordProgress[w.word_ta])
  const unplayed    = words.filter((w) => !wordProgress[w.word_ta])

  const totalPlays = playedWords.reduce((s, w) => s + (wordProgress[w.word_ta]?.plays || 0), 0)
  const masteredCount = playedWords.filter((w) => wordProgress[w.word_ta]?.stars === 3).length

  const level   = Math.floor(totalXP / 100)
  const levelXP = totalXP % 100
  const levelPct = levelXP

  const filteredPlayed = playedWords.filter((w) => {
    const stars = wordProgress[w.word_ta]?.stars ?? 0
    if (tab === 'Mastered') return stars === 3
    if (tab === 'Learning') return stars < 3
    return true
  })

  const noWords = words.length > 0 && playedWords.length === 0

  return (
    <div className="min-h-dvh flex flex-col pb-20" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <header className="px-4 pt-10 pb-4">
        <h1
          className="text-2xl font-black uppercase tracking-wider"
          style={{ color: 'var(--text-primary)', textShadow: '0 0 20px var(--primary-glow)' }}
        >
          Progress
        </h1>
      </header>

      <main className="flex-1 px-4 max-w-xl mx-auto w-full space-y-5">

        {/* Empty state */}
        {noWords && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📚</p>
            <p className="font-black uppercase tracking-wider mb-1" style={{ color: 'var(--text-primary)' }}>Start your first game!</p>
            <p className="text-sm mb-5 font-bold" style={{ color: 'var(--text-muted)' }}>
              Play a word to track your progress here
            </p>
            <button className="btn-primary font-black uppercase tracking-wider" onClick={() => navigate('/')}>
              Choose a Word
            </button>
          </div>
        )}

        {/* Stats row */}
        {words.length > 0 && (
          <div
            className="p-5"
            style={{
              background: 'var(--bg-surface)',
              border: '2px solid var(--border-retro, var(--border))',
              boxShadow: 'var(--shadow-neon), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div className="flex justify-around">
              <StatBox value={totalXP} label="XP" color="var(--accent)" icon="⚡" />
              <div className="my-1 w-px" style={{ background: 'var(--border)' }} />
              <StatBox value={totalPlays} label="Played" color="var(--text-primary)" icon="🎮" />
              <div className="my-1 w-px" style={{ background: 'var(--border)' }} />
              <StatBox value={masteredCount} label="Mastered" color="var(--correct)" icon="⭐" />
            </div>

            {/* Level / XP bar */}
            <div className="mt-5 pt-4" style={{ borderTop: '2px solid var(--border)' }}>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-black uppercase tracking-wider" style={{ color: 'var(--primary)', textShadow: '0 0 8px var(--primary-glow)' }}>
                  Level {level}
                </span>
                <div className="flex items-center gap-3">
                  {gems > 0 && (
                    <span className="font-bold" style={{ color: 'var(--primary)' }}>
                      💎 {gems} gem{gems !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="font-bold" style={{ color: 'var(--text-muted)' }}>{levelXP} / 100 XP</span>
                </div>
              </div>
              <div
                className="h-3 overflow-hidden"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}
              >
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${levelPct}%`,
                    background: 'linear-gradient(90deg, var(--primary), var(--neon-cyan, #00F0FF))',
                    boxShadow: '0 0 8px var(--primary-glow)',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Mastery tabs */}
        {playedWords.length > 0 && (
          <>
            <div
              className="flex gap-1.5 p-1"
              style={{ background: 'var(--bg-raised)', border: '2px solid var(--border)' }}
            >
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 py-2 text-sm font-black uppercase tracking-wider transition-all"
                  style={{
                    background: tab === t ? 'var(--primary)' : 'transparent',
                    color: tab === t ? '#fff' : 'var(--text-muted)',
                    boxShadow: tab === t ? '0 0 12px var(--primary-glow)' : 'none',
                    borderBottom: tab === t ? '2px solid rgba(0,0,0,0.3)' : '2px solid transparent',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Word cards */}
            <div className="space-y-2">
              {filteredPlayed.map((w) => {
                const prog = wordProgress[w.word_ta]
                const fcp  = flashcardProgress[w.word_ta]

                return (
                  <button
                    key={w.word_ta}
                    onClick={() => handlePlay(w.word_ta)}
                    disabled={!!starting}
                    className="w-full p-4 text-left transition-all active:scale-[0.99] disabled:opacity-60"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '2px solid var(--border-retro, var(--border))',
                      boxShadow: 'var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="tamil font-black"
                            style={{ fontSize: '1.6rem', color: 'var(--text-primary)' }}
                          >
                            {w.word_ta}
                          </span>
                          {fcp && (
                            <span
                              className="text-xs px-2 py-0.5 font-black uppercase tracking-wider border"
                              style={{
                                background: fcp === 'known' ? 'rgba(57,255,20,0.08)' : 'rgba(255,184,0,0.08)',
                                color: fcp === 'known' ? 'var(--correct)' : 'var(--accent)',
                                borderColor: fcp === 'known' ? 'var(--correct)' : 'var(--accent)',
                              }}
                            >
                              {fcp === 'known' ? '✓ Known' : '~ Learning'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5 font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          {w.word_romanized}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Stars count={prog.stars} />
                        <span className="text-xs font-black" style={{ color: 'var(--accent)', textShadow: '0 0 6px rgba(255,184,0,0.3)' }}>
                          {prog.bestScore} pts
                        </span>
                        <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                          {prog.plays}× played
                        </span>
                      </div>
                    </div>

                    {/* Accuracy bar */}
                    <div className="mt-3 h-1.5 overflow-hidden" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (prog.stars / 3) * 100)}%`,
                          background: prog.stars === 3 ? 'var(--correct)' : prog.stars > 0 ? 'var(--accent)' : 'var(--border-bright)',
                          boxShadow: prog.stars === 3 ? '0 0 8px rgba(57,255,20,0.4)' : prog.stars > 0 ? '0 0 8px rgba(255,184,0,0.3)' : 'none',
                        }}
                      />
                    </div>

                    {starting === w.word_ta && (
                      <p className="text-xs mt-2 animate-pulse-soft font-bold uppercase tracking-wider" style={{ color: 'var(--primary)' }}>Starting…</p>
                    )}
                  </button>
                )
              })}

              {filteredPlayed.length === 0 && (
                <p className="text-center py-8 text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  No words in this category yet
                </p>
              )}
            </div>
          </>
        )}

        {/* Unplayed words */}
        {unplayed.length > 0 && (
          <section>
            <p className="text-xs font-black uppercase mb-3" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
              Not yet played
            </p>
            <div className="flex flex-wrap gap-2">
              {unplayed.map((w) => (
                <button
                  key={w.word_ta}
                  onClick={() => handlePlay(w.word_ta)}
                  disabled={!!starting}
                  className="flex items-center gap-1.5 px-3 py-2 transition-all disabled:opacity-60"
                  style={{
                    background: 'var(--bg-raised)',
                    border: '2px solid var(--border)',
                    borderBottom: '3px solid var(--border)',
                  }}
                >
                  <span className="tamil font-bold text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {w.word_ta}
                  </span>
                  <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{w.word_romanized}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {words.length === 0 && (
          <div className="text-center py-16 text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        )}
      </main>
    </div>
  )
}
