import React, { useEffect, useState } from 'react'
import { useGameEngine } from '../hooks/useGameEngine'
import useGameStore from '../store/gameStore'

const API = import.meta.env.VITE_API_URL || ''

function Stars({ count }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= count ? 'text-yellow-400' : 'text-white/15'}>★</span>
      ))}
    </span>
  )
}

// Deterministic daily word based on date
function getDailyWord(words) {
  if (!words.length) return null
  const day = Math.floor(Date.now() / 86400000)
  return words[day % words.length].word_ta
}

export default function Home() {
  const { startGame } = useGameEngine()
  const { wordProgress, recentWords, gamePhase } = useGameStore()
  const [words, setWords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`${API}/api/words`)
      .then((r) => r.json())
      .then(setWords)
      .catch(() => setError('Could not load words. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  async function handlePlay(wordTa) {
    setStarting(wordTa)
    try {
      await startGame(wordTa)
    } catch (err) {
      setError(err.message)
      setStarting(null)
    }
  }

  const dailyWord = getDailyWord(words)
  const filtered = words.filter(
    (w) =>
      w.word_ta.includes(search) ||
      w.word_romanized.toLowerCase().includes(search.toLowerCase())
  )

  const recentWordObjs = recentWords
    .map((wt) => words.find((w) => w.word_ta === wt))
    .filter(Boolean)

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="px-6 pt-10 pb-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          <span className="tamil">லெக்ஸிஃபைட்</span>
        </h1>
        <p className="mt-1 text-white/50 text-sm tracking-widest uppercase">Lexifyd</p>
        <p className="mt-3 text-white/60 text-sm max-w-xs mx-auto">
          Drag the correct Tamil word-form into each sentence blank
        </p>
      </header>

      <main className="flex-1 px-4 pb-10 max-w-2xl mx-auto w-full">

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search words…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center text-white/40 py-16">Loading words…</div>
        )}

        {/* Recent words */}
        {!search && recentWordObjs.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
              Recently played
            </h2>
            <div className="flex gap-2 flex-wrap">
              {recentWordObjs.map((w) => {
                const prog = wordProgress[w.word_ta]
                return (
                  <button
                    key={w.word_ta}
                    onClick={() => handlePlay(w.word_ta)}
                    disabled={!!starting}
                    className="flex items-center gap-2 rounded-xl bg-brand-800/60 border border-brand-700/40 px-4 py-2 text-sm hover:border-indigo-500/50 transition-all"
                  >
                    <span className="tamil text-white font-semibold">{w.word_ta}</span>
                    {prog && <Stars count={prog.stars} />}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Word grid */}
        {!loading && (
          <section>
            {!search && (
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
                All words
              </h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((w) => {
                const prog = wordProgress[w.word_ta]
                const isDaily = w.word_ta === dailyWord && !search
                const isStarting = starting === w.word_ta

                return (
                  <button
                    key={w.word_ta}
                    onClick={() => handlePlay(w.word_ta)}
                    disabled={!!starting}
                    className={`card p-4 text-left transition-all hover:border-indigo-500/50 hover:bg-brand-700/40 active:scale-[0.98] disabled:opacity-60 ${isDaily ? 'border-indigo-500/40 bg-indigo-500/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="tamil text-2xl font-bold text-white">{w.word_ta}</span>
                          {isDaily && (
                            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                              Today
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white/40 mt-0.5">{w.word_romanized}</p>
                        <p className="text-xs text-white/30 mt-1">
                          {w.sense_count} {w.sense_count === 1 ? 'sense' : 'senses'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {prog ? (
                          <>
                            <Stars count={prog.stars} />
                            {prog.plays > 0 && (
                              <span className="text-xs text-white/30">{prog.plays}× played</span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-white/20">New</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {w.senses.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="text-xs bg-brand-700/50 text-white/50 px-2 py-0.5 rounded-full"
                        >
                          {s}
                        </span>
                      ))}
                      {w.senses.length > 4 && (
                        <span className="text-xs text-white/30">+{w.senses.length - 4} more</span>
                      )}
                    </div>

                    {isStarting && (
                      <p className="mt-2 text-xs text-indigo-300 animate-pulse">Starting…</p>
                    )}
                  </button>
                )
              })}
            </div>

            {filtered.length === 0 && !loading && (
              <p className="text-center text-white/30 py-12">No words match "{search}"</p>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
