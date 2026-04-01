import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameEngine } from '../hooks/useGameEngine'
import useGameStore from '../store/gameStore'

const API = import.meta.env.VITE_API_URL || ''

function getMasteryColor(prog) {
  if (!prog) return 'var(--border-bright)'
  if (prog.stars === 3) return 'var(--correct)'
  if (prog.stars > 0)  return 'var(--accent)'
  return 'var(--border-bright)'
}

function getDailyWord(words) {
  if (!words.length) return null
  const day = Math.floor(Date.now() / 86400000)
  return words[day % words.length]
}

export default function Home() {
  const navigate  = useNavigate()
  const { startGame } = useGameEngine()
  const { wordProgress, recentWords, totalXP, streak, dailyChallengeDone, setDailyChallengeWord, rapidFire, setRapidFire } = useGameStore()

  const [words,    setWords]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [starting, setStarting] = useState(null)
  const [search,   setSearch]   = useState('')
  const [showAll,  setShowAll]  = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetch(`${API}/api/words`)
      .then((r) => r.json())
      .then((data) => {
        setWords(data)
        const daily = getDailyWord(data)
        if (daily) setDailyChallengeWord(daily.word_ta)
      })
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

  const dailyWordObj = getDailyWord(words)

  const filtered = words.filter(
    (w) =>
      w.word_ta.includes(search) ||
      w.word_romanized.toLowerCase().includes(search.toLowerCase())
  )

  const recentWordObjs = recentWords
    .map((wt) => words.find((w) => w.word_ta === wt))
    .filter(Boolean)

  const displayWords = search ? filtered : (showAll ? filtered : filtered.slice(0, 12))
  const hasMore = !search && !showAll && filtered.length > 12

  return (
    <div className="min-h-dvh flex flex-col pb-20" style={{ background: 'var(--bg-base)' }}>

      {/* Top bar — retro stats */}
      <div className="flex items-center justify-between px-5 pt-10 pb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="text-sm font-black tabular-nums"
            style={{ color: 'var(--accent)', textShadow: '0 0 8px rgba(255,184,0,0.3)' }}
          >
            x{streak}
          </span>
          <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>streak</span>
        </div>
        {totalXP > 0 && (
          <span className="xp-badge">{totalXP} XP</span>
        )}
      </div>

      {/* Hero — retro arcade title */}
      <header className="px-5 pt-4 pb-6 text-center">
        <h1
          className="tamil font-black animate-neonFlicker"
          style={{
            fontSize: '2.4rem',
            color: 'var(--text-primary)',
            textShadow: '0 0 30px var(--primary-glow), 0 0 60px rgba(124,106,247,0.1)',
          }}
        >
          லெக்ஸிஃபைட்
        </h1>
        <p
          className="mt-1 font-black uppercase"
          style={{
            color: 'var(--primary)',
            letterSpacing: '0.4em',
            fontSize: '0.7rem',
            textShadow: '0 0 10px var(--primary-glow)',
          }}
        >
          Lexifyd
        </p>
        <div
          className="mx-auto mt-3"
          style={{
            width: 50, height: 3,
            background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
            borderRadius: 9999,
          }}
        />
        <p className="mt-3 text-sm max-w-xs mx-auto font-medium" style={{ color: 'var(--text-secondary)' }}>
          Master Tamil polysemy through play
        </p>
      </header>

      <main className="flex-1 px-4 max-w-xl mx-auto w-full">

        {/* Rapid Fire toggle — retro switch */}
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3 mb-4"
          style={{
            background: rapidFire ? 'rgba(255,71,87,0.08)' : 'var(--bg-raised)',
            border: `2px solid ${rapidFire ? 'var(--wrong)' : 'var(--border-bright)'}`,
            boxShadow: rapidFire ? '0 0 15px rgba(255,71,87,0.15)' : 'none',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-black uppercase tracking-wider"
              style={{
                color: rapidFire ? 'var(--wrong)' : 'var(--text-secondary)',
                textShadow: rapidFire ? '0 0 8px rgba(255,71,87,0.4)' : 'none',
              }}
            >
              Rapid Fire
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Timed + speed bonus
            </span>
          </div>
          <button
            onClick={() => setRapidFire(!rapidFire)}
            className="relative w-11 h-6 rounded transition-colors duration-200"
            style={{
              background: rapidFire ? 'var(--wrong)' : 'var(--border-bright)',
              border: `2px solid ${rapidFire ? 'rgba(255,255,255,0.2)' : 'var(--border-retro)'}`,
              boxShadow: rapidFire ? 'var(--shadow-wrong)' : 'none',
            }}
            aria-label="Toggle rapid fire mode"
          >
            <span
              className="absolute top-0 left-0.5 w-4 h-4 rounded-sm transition-transform duration-200"
              style={{
                background: '#fff',
                transform: rapidFire ? 'translateX(18px)' : 'translateX(0)',
                marginTop: '1px',
              }}
            />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm font-bold"
            style={{ background: 'var(--wrong-dim)', border: '2px solid var(--wrong)', color: 'var(--wrong)' }}
          >
            {error}
          </div>
        )}

        {/* Daily Challenge — retro arcade card */}
        {!loading && dailyWordObj && !search && (
          <section className="mb-6">
            <p
              className="text-xs font-black uppercase mb-2 tracking-wider"
              style={{ color: 'var(--accent)', textShadow: '0 0 6px rgba(255,184,0,0.3)' }}
            >
              Daily Challenge
            </p>
            <div
              className="rounded-lg p-4 flex items-center justify-between gap-4"
              style={{
                background: 'var(--bg-raised)',
                border: `2px solid ${dailyChallengeDone === today ? 'var(--correct)' : 'var(--accent)'}`,
                boxShadow: dailyChallengeDone === today
                  ? 'var(--shadow-correct)'
                  : '0 0 20px rgba(255,184,0,0.15)',
              }}
            >
              <div>
                <p
                  className="tamil font-black"
                  style={{
                    fontSize: '2.8rem',
                    lineHeight: 1.1,
                    color: dailyChallengeDone === today ? 'var(--correct)' : 'var(--accent)',
                    textShadow: dailyChallengeDone === today
                      ? '0 0 12px rgba(57,255,20,0.4)'
                      : '0 0 12px rgba(255,184,0,0.4)',
                  }}
                >
                  {dailyWordObj.word_ta}
                </p>
                <p className="text-xs mt-1 font-bold" style={{ color: 'var(--text-secondary)' }}>
                  {dailyWordObj.word_romanized}
                </p>
                {dailyChallengeDone !== today && (
                  <p className="text-xs mt-1 font-black uppercase" style={{ color: 'var(--accent)' }}>
                    +20 Bonus XP
                  </p>
                )}
              </div>
              {dailyChallengeDone === today ? (
                <div className="shrink-0 flex flex-col items-center gap-1">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center font-black"
                    style={{ background: 'var(--correct)', color: '#0D0F1A' }}
                  >
                    !
                  </div>
                  <span className="text-xs font-black uppercase" style={{ color: 'var(--correct)' }}>Done</span>
                </div>
              ) : (
                <button
                  onClick={() => handlePlay(dailyWordObj.word_ta)}
                  disabled={!!starting}
                  className="btn-primary shrink-0"
                  style={{ background: 'var(--accent)', color: '#0D0F1A' }}
                >
                  {starting === dailyWordObj.word_ta ? '...' : 'PLAY'}
                </button>
              )}
            </div>
          </section>
        )}

        {/* Recently played */}
        {!search && recentWordObjs.length > 0 && (
          <section className="mb-6">
            <p className="text-xs font-black uppercase mb-3 tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Continue
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {recentWordObjs.map((w) => {
                const prog = wordProgress[w.word_ta]
                return (
                  <button
                    key={w.word_ta}
                    onClick={() => handlePlay(w.word_ta)}
                    disabled={!!starting}
                    className="shrink-0 flex flex-col items-start px-3 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60"
                    style={{
                      background: 'var(--bg-raised)',
                      border: '2px solid var(--border-bright)',
                    }}
                  >
                    <span className="tamil font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {w.word_ta}
                    </span>
                    <span className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                      {w.word_romanized}
                    </span>
                    <div className="flex gap-0.5 mt-1">
                      {[1, 2, 3].map((n) => (
                        <span
                          key={n}
                          className="text-xs"
                          style={{
                            color: prog && n <= prog.stars ? 'var(--accent)' : 'var(--border-bright)',
                            textShadow: prog && n <= prog.stars ? '0 0 4px rgba(255,184,0,0.4)' : 'none',
                          }}
                        >
                          {prog && n <= prog.stars ? '★' : '☆'}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Search + heading */}
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs font-black uppercase shrink-0 tracking-wider" style={{ color: 'var(--text-muted)' }}>
            All Words
          </p>
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowAll(false) }}
              className="input-field w-full pl-3 pr-8 py-1.5 text-sm"
              style={{ borderRadius: 'var(--radius-md)' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold transition-colors"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Clear search"
              >
                X
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="text-center py-16 text-sm font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
            Loading...
          </div>
        )}

        {/* Word grid — retro cards */}
        {!loading && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {displayWords.map((w) => {
                const prog      = wordProgress[w.word_ta]
                const isDaily   = !search && dailyWordObj && w.word_ta === dailyWordObj.word_ta
                const isStarting = starting === w.word_ta

                return (
                  <button
                    key={w.word_ta}
                    onClick={() => handlePlay(w.word_ta)}
                    disabled={!!starting}
                    className="card p-4 text-left transition-all active:scale-[0.97] disabled:opacity-60"
                    style={isDaily ? {
                      borderColor: 'var(--accent)',
                      background: 'var(--accent-dim)',
                      boxShadow: '0 0 15px rgba(255,184,0,0.15)',
                    } : {}}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="tamil font-bold"
                            style={{ fontSize: '1.3rem', color: 'var(--text-primary)', wordBreak: 'keep-all' }}
                          >
                            {w.word_ta}
                          </span>
                          {isDaily && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-black uppercase"
                              style={{
                                background: 'var(--accent-dim)',
                                color: 'var(--accent)',
                                fontSize: '0.6rem',
                                border: '1px solid rgba(255,184,0,0.3)',
                              }}
                            >
                              Today
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {w.word_romanized}
                        </p>
                      </div>
                      {/* Mastery indicator */}
                      <div
                        className="shrink-0 mt-1 rounded-sm"
                        style={{
                          width: 8, height: 8,
                          background: getMasteryColor(prog),
                          boxShadow: prog?.stars === 3 ? '0 0 6px rgba(57,255,20,0.5)' : 'none',
                        }}
                      />
                    </div>

                    <p className="text-xs mt-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>
                      {w.sense_count} {w.sense_count === 1 ? 'sense' : 'senses'}
                    </p>

                    {isStarting && (
                      <p className="text-xs mt-1 animate-pulse-soft font-bold uppercase" style={{ color: 'var(--primary)' }}>
                        Starting...
                      </p>
                    )}

                    <span
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/semantic-web/${encodeURIComponent(w.word_ta)}`)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation()
                          navigate(`/semantic-web/${encodeURIComponent(w.word_ta)}`)
                        }
                      }}
                      className="mt-2 text-xs cursor-pointer inline-block transition-colors font-bold"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--neon-cyan)'
                        e.currentTarget.style.textShadow = '0 0 8px rgba(0,240,255,0.4)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)'
                        e.currentTarget.style.textShadow = 'none'
                      }}
                    >
                      Semantic Web
                    </span>
                  </button>
                )
              })}
            </div>

            {filtered.length === 0 && (
              <p className="text-center py-12 text-sm font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                No words match "{search}"
              </p>
            )}

            {hasMore && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full mt-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all"
                style={{ color: 'var(--text-muted)', border: '2px solid var(--border-bright)' }}
              >
                Show {filtered.length - 12} more
              </button>
            )}
          </>
        )}
      </main>
    </div>
  )
}
