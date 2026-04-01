import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore'
import { useGameEngine } from '../hooks/useGameEngine'
import ConfettiOverlay from '../components/ConfettiOverlay'

// ── SVG Mascot — cute owl with expressions ─────────────────────────────────
function Mascot({ mood = 'happy' }) {
  // mood: 'celebrate' | 'happy' | 'ok' | 'sad'
  const bodyColor = '#7C6AF7'
  const bellyColor = '#A99BFF'
  const eyeColor = '#fff'

  const animClass =
    mood === 'celebrate' || mood === 'happy' ? 'animate-mascotBounce' : 'animate-mascotSad'

  return (
    <div className={`flex justify-center ${animClass}`}>
      <svg width={100} height={110} viewBox="0 0 100 110" fill="none">
        {/* Body */}
        <ellipse cx={50} cy={65} rx={35} ry={38} fill={bodyColor} />
        {/* Belly */}
        <ellipse cx={50} cy={72} rx={22} ry={24} fill={bellyColor} opacity={0.4} />

        {/* Left ear tuft */}
        <path d="M25 32 L20 10 L35 28Z" fill={bodyColor} />
        <path d="M23 30 L20 14 L32 27Z" fill={bellyColor} opacity={0.3} />
        {/* Right ear tuft */}
        <path d="M75 32 L80 10 L65 28Z" fill={bodyColor} />
        <path d="M77 30 L80 14 L68 27Z" fill={bellyColor} opacity={0.3} />

        {/* Eye backgrounds */}
        <circle cx={37} cy={55} r={12} fill={eyeColor} />
        <circle cx={63} cy={55} r={12} fill={eyeColor} />

        {/* Pupils — change based on mood */}
        {mood === 'celebrate' ? (
          <>
            {/* Star eyes */}
            <text x={32} y={60} fontSize={14} fill="var(--accent)" fontWeight="bold">*</text>
            <text x={58} y={60} fontSize={14} fill="var(--accent)" fontWeight="bold">*</text>
          </>
        ) : mood === 'sad' ? (
          <>
            {/* Sad eyes — looking down */}
            <circle cx={37} cy={59} r={5} fill="#333" />
            <circle cx={63} cy={59} r={5} fill="#333" />
            <circle cx={38} cy={57} r={1.5} fill="#fff" />
            <circle cx={64} cy={57} r={1.5} fill="#fff" />
          </>
        ) : (
          <>
            {/* Normal eyes */}
            <circle cx={37} cy={55} r={5.5} fill="#333" />
            <circle cx={63} cy={55} r={5.5} fill="#333" />
            <circle cx={39} cy={53} r={2} fill="#fff" />
            <circle cx={65} cy={53} r={2} fill="#fff" />
          </>
        )}

        {/* Beak */}
        <path d="M46 63 L50 70 L54 63Z" fill="var(--accent)" />

        {/* Blush */}
        {(mood === 'celebrate' || mood === 'happy') && (
          <>
            <circle cx={27} cy={64} r={5} fill="#FF6B81" opacity={0.25} />
            <circle cx={73} cy={64} r={5} fill="#FF6B81" opacity={0.25} />
          </>
        )}

        {/* Mouth — mood based */}
        {mood === 'celebrate' ? (
          <path d="M42 74 Q50 82 58 74" stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" />
        ) : mood === 'happy' ? (
          <path d="M44 74 Q50 79 56 74" stroke="#333" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        ) : mood === 'ok' ? (
          <line x1={44} y1={75} x2={56} y2={75} stroke="#333" strokeWidth={1.5} strokeLinecap="round" />
        ) : (
          <path d="M43 78 Q50 73 57 78" stroke="#333" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        )}

        {/* Feet */}
        <ellipse cx={40} cy={100} rx={8} ry={4} fill="var(--accent)" />
        <ellipse cx={60} cy={100} rx={8} ry={4} fill="var(--accent)" />

        {/* Wings (small) */}
        <ellipse cx={18} cy={68} rx={6} ry={14} fill={bodyColor} transform="rotate(-10 18 68)" />
        <ellipse cx={82} cy={68} rx={6} ry={14} fill={bodyColor} transform="rotate(10 82 68)" />

        {/* Crown for perfect score */}
        {mood === 'celebrate' && (
          <g transform="translate(35, -2)">
            <polygon points="0,18 4,6 8,14 12,2 16,14 20,6 24,14 28,6 30,18" fill="var(--accent)" />
            <rect x={0} y={18} width={30} height={4} rx={1} fill="var(--accent)" />
          </g>
        )}

        {/* Glow behind for celebrate */}
        {mood === 'celebrate' && (
          <ellipse cx={50} cy={65} rx={40} ry={42} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.2}>
            <animate attributeName="rx" values="40;44;40" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="ry" values="42;46;42" dur="1.5s" repeatCount="indefinite" />
          </ellipse>
        )}
      </svg>
    </div>
  )
}

function RetroStars({ stars }) {
  return (
    <div className="flex justify-center gap-5 my-4">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`text-4xl ${n <= stars ? 'animate-starBounce' : ''}`}
          style={{
            animationDelay: `${(n - 1) * 200}ms`,
            color: n <= stars ? 'var(--accent)' : 'var(--border-bright)',
            textShadow: n <= stars ? '0 0 15px rgba(255,184,0,0.6)' : 'none',
            filter: n <= stars ? 'drop-shadow(0 0 6px rgba(255,184,0,0.4))' : 'none',
          }}
        >
          {n <= stars ? '★' : '☆'}
        </div>
      ))}
    </div>
  )
}

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!target) return
    const steps     = 24
    const increment = target / steps
    let current     = 0
    const interval  = setInterval(() => {
      current = Math.min(current + increment, target)
      setValue(Math.round(current))
      if (current >= target) clearInterval(interval)
    }, duration / steps)
    return () => clearInterval(interval)
  }, [target, duration])
  return value
}

export default function Results() {
  const navigate = useNavigate()
  const { startGame } = useGameEngine()
  const { results, wordProgress, totalXP, gems, resetGame } = useGameStore()

  if (!results) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center flex-col gap-4"
        style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}
      >
        <p className="uppercase tracking-wider font-bold">No results yet</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    )
  }

  const { word_ta, word_romanized, score, correct_count, total_questions, stars, answers, heartGameOver, dailyBonus } = results
  const prog        = wordProgress[word_ta]
  const pct         = total_questions > 0 ? Math.round((correct_count / total_questions) * 100) : 0
  const displayScore = useCountUp(score)

  const mascotMood =
    heartGameOver ? 'sad' :
    stars === 3   ? 'celebrate' :
    stars === 2   ? 'happy' :
    stars === 1   ? 'ok' :
    'sad'

  const message = heartGameOver
    ? 'Game Over!'
    : stars === 3 ? 'Perfect Run!'
    : stars === 2 ? 'Great Job!'
    : stars === 1 ? 'Keep Going!'
    : 'Try Again!'

  const messageColor = heartGameOver ? 'var(--wrong)' : stars >= 2 ? 'var(--correct)' : 'var(--text-secondary)'

  async function handlePlayAgain() {
    try { await startGame(word_ta) } catch { /* ignore */ }
  }

  return (
    <div className="min-h-dvh flex flex-col pb-8" style={{ background: 'var(--bg-base)' }}>
      {stars === 3 && !heartGameOver && <ConfettiOverlay />}

      <main className="flex-1 px-4 py-6 max-w-xl mx-auto w-full">

        {/* Mascot */}
        <Mascot mood={mascotMood} />

        {/* Word title */}
        <div className="text-center mt-2 mb-1">
          <h1
            className="tamil font-bold"
            style={{
              fontSize: '2.4rem',
              color: 'var(--text-primary)',
              textShadow: '0 0 20px var(--primary-glow)',
            }}
          >
            {word_ta}
          </h1>
          <p
            className="text-xs uppercase tracking-[0.3em] font-bold mt-1"
            style={{ color: 'var(--text-muted)' }}
          >
            {word_romanized}
          </p>
        </div>

        {/* Stars or game over */}
        {heartGameOver ? (
          <div className="text-center my-4">
            <p
              className="text-lg font-black uppercase tracking-wider"
              style={{ color: 'var(--wrong)', textShadow: '0 0 15px rgba(255,71,87,0.4)' }}
            >
              Game Over
            </p>
          </div>
        ) : (
          <RetroStars stars={stars} />
        )}

        {/* Score card */}
        <div
          className="rounded-xl p-6 text-center mb-5"
          style={{
            background: 'var(--bg-surface)',
            border: '2px solid var(--border-bright)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p
            className="font-black tabular-nums animate-countUp"
            style={{
              fontSize: '3.5rem',
              lineHeight: 1,
              color: 'var(--accent)',
              textShadow: '0 0 20px rgba(255,184,0,0.4)',
            }}
          >
            {displayScore}
          </p>
          <p
            className="text-xs mt-1 font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Points
          </p>
          <p
            className="font-black text-lg mt-2 uppercase tracking-wider"
            style={{ color: messageColor, textShadow: `0 0 12px ${messageColor}33` }}
          >
            {message}
          </p>

          <div className="flex justify-center gap-8 mt-5 pt-4" style={{ borderTop: '2px solid var(--border)' }}>
            <div className="text-center">
              <p className="font-black text-lg tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {correct_count}/{total_questions}
              </p>
              <p className="text-xs mt-0.5 font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Correct</p>
            </div>
            <div className="text-center">
              <p className="font-black text-lg tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {pct}%
              </p>
              <p className="text-xs mt-0.5 font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Accuracy</p>
            </div>
            {prog && (
              <div className="text-center">
                <p className="font-black text-lg tabular-nums" style={{ color: 'var(--accent)' }}>
                  {prog.bestScore}
                </p>
                <p className="text-xs mt-0.5 font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Best</p>
              </div>
            )}
          </div>
        </div>

        {/* XP + Gems */}
        <div className="flex justify-center gap-3 mb-5 flex-wrap">
          <span className="xp-badge animate-popIn">
            +{Math.max(0, score)} XP{dailyBonus > 0 ? ` (+${dailyBonus} daily!)` : ''}
          </span>
          <span
            className="xp-badge animate-popIn"
            style={{ animationDelay: '100ms', opacity: 0.75 }}
          >
            {totalXP} total
          </span>
          {gems > 0 && (
            <span
              className="animate-popIn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                borderRadius: 'var(--radius-pill)',
                border: '2px solid rgba(124,106,247,0.4)',
                background: 'var(--primary-dim)',
                padding: '0.25rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--primary)',
                animationDelay: '200ms',
              }}
            >
              {gems} gem{gems !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Answer breakdown */}
        <p
          className="text-xs font-black uppercase mb-3 tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Breakdown
        </p>
        <div className="space-y-2 mb-6">
          {answers.map((a) => (
            <div
              key={a.question_index}
              className="rounded-lg p-4"
              style={{
                background: a.is_correct ? 'var(--correct-dim)' : 'var(--wrong-dim)',
                border: `2px solid ${a.is_correct ? 'var(--correct)' : 'var(--wrong)'}`,
                boxShadow: a.is_correct ? 'var(--shadow-correct)' : 'var(--shadow-wrong)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded font-black text-sm"
                  style={{
                    background: a.is_correct ? 'var(--correct)' : 'var(--wrong)',
                    color: '#0D0F1A',
                  }}
                >
                  {a.is_correct ? '!' : 'X'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="tamil text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {a.blank_count >= 2
                      ? (() => {
                          const parts = a.game_sentence.split('______')
                          const b1 = a.correct_answer_blank1 || a.correct_answer
                          const b2 = a.correct_answer_blank2 || a.correct_answer
                          return parts.reduce((acc, part, i) => {
                            if (i === 0) return `${part}[${b1}]`
                            if (i === 1) return `${acc}${part}[${b2}]`
                            return `${acc}${part}`
                          }, '')
                        })()
                      : a.game_sentence.replace('______', `[${a.correct_answer}]`)}
                  </p>
                  <p className="text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                    <span>{a.sense_ta} · {a.sense}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-bold uppercase"
                      style={{
                        background: a.difficulty === 'hard'   ? 'rgba(255,71,87,0.15)' :
                                    a.difficulty === 'medium' ? 'rgba(255,184,0,0.15)'  :
                                                                'rgba(57,255,20,0.15)',
                        color:      a.difficulty === 'hard'   ? 'var(--wrong)'   :
                                    a.difficulty === 'medium' ? 'var(--accent)'  :
                                                                'var(--correct)',
                      }}
                    >
                      {a.difficulty}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-bold uppercase"
                      style={{
                        background: a.question_type === 'semantic' ? 'rgba(139,92,246,0.15)' : 'rgba(0,240,255,0.12)',
                        color: a.question_type === 'semantic' ? '#a78bfa' : 'var(--neon-cyan)',
                      }}
                    >
                      {a.question_type === 'semantic' ? 'Meaning' : 'Fill'}
                    </span>
                  </p>
                  {!a.is_correct && (
                    a.blank_count >= 2 ? (
                      <div className="text-xs mt-1.5 space-y-0.5">
                        {a.submitted_answer_blank1 !== undefined && a.correct_answer_blank1 && (
                          <p>
                            <span style={{ color: 'var(--text-muted)' }}>B1: </span>
                            <span className="tamil" style={{ color: a.submitted_answer_blank1 === a.correct_answer_blank1 ? 'var(--correct)' : 'var(--wrong)' }}>
                              {a.submitted_answer_blank1 || '—'}
                            </span>
                            {a.submitted_answer_blank1 !== a.correct_answer_blank1 && (
                              <>
                                <span style={{ color: 'var(--text-muted)' }}> → </span>
                                <span className="tamil font-semibold" style={{ color: 'var(--correct)' }}>
                                  {a.correct_answer_blank1}
                                </span>
                              </>
                            )}
                          </p>
                        )}
                        {a.submitted_answer_blank2 !== undefined && a.correct_answer_blank2 && (
                          <p>
                            <span style={{ color: 'var(--text-muted)' }}>B2: </span>
                            <span className="tamil" style={{ color: a.submitted_answer_blank2 === a.correct_answer_blank2 ? 'var(--correct)' : 'var(--wrong)' }}>
                              {a.submitted_answer_blank2 || '—'}
                            </span>
                            {a.submitted_answer_blank2 !== a.correct_answer_blank2 && (
                              <>
                                <span style={{ color: 'var(--text-muted)' }}> → </span>
                                <span className="tamil font-semibold" style={{ color: 'var(--correct)' }}>
                                  {a.correct_answer_blank2}
                                </span>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs mt-1.5">
                        <span className="tamil" style={{ color: 'var(--wrong)' }}>
                          {a.submitted_answer || '—'}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}> → </span>
                        <span className="tamil font-semibold" style={{ color: 'var(--correct)' }}>
                          {a.correct_answer}
                        </span>
                      </p>
                    )
                  )}
                </div>
                <span
                  className="text-sm font-black shrink-0"
                  style={{
                    color: a.score_delta >= 0 ? 'var(--correct)' : 'var(--wrong)',
                    textShadow: a.score_delta >= 0 ? '0 0 6px rgba(57,255,20,0.4)' : '0 0 6px rgba(255,71,87,0.4)',
                  }}
                >
                  {a.score_delta > 0 ? `+${a.score_delta}` : a.score_delta}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <button className="btn-primary w-full text-base" onClick={handlePlayAgain}>
            Play Again
          </button>
          <button
            className="btn-outline w-full text-base"
            onClick={() => navigate(`/semantic-web/${encodeURIComponent(word_ta)}`)}
          >
            Explore Meaning Web
          </button>
          <button
            className="btn-ghost w-full text-sm"
            onClick={() => { resetGame(); navigate('/') }}
          >
            Try a New Word
          </button>
        </div>
      </main>
    </div>
  )
}
