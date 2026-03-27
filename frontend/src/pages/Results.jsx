import React from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore'
import { useGameEngine } from '../hooks/useGameEngine'

function StarDisplay({ stars }) {
  return (
    <div className="flex justify-center gap-2 my-4">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`text-5xl transition-all duration-500 ${
            n <= stars ? 'text-yellow-400 animate-popIn' : 'text-white/10'
          }`}
          style={{ animationDelay: `${(n - 1) * 150}ms` }}
        >
          ★
        </span>
      ))}
    </div>
  )
}

export default function Results() {
  const navigate = useNavigate()
  const { startGame } = useGameEngine()
  const { results, wordProgress, resetGame } = useGameStore()

  if (!results) {
    return (
      <div className="min-h-dvh flex items-center justify-center flex-col gap-4 text-white/50">
        <p>No results yet.</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    )
  }

  const { word_ta, word_romanized, score, correct_count, total_questions, stars, answers } = results
  const prog = wordProgress[word_ta]

  async function handlePlayAgain() {
    try {
      await startGame(word_ta)
    } catch (err) {
      console.error(err)
    }
  }

  const pct = total_questions > 0 ? Math.round((correct_count / total_questions) * 100) : 0

  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 px-4 py-10 max-w-2xl mx-auto w-full">

        {/* Word title */}
        <div className="text-center mb-6">
          <h1 className="tamil text-4xl font-bold text-white">{word_ta}</h1>
          <p className="text-white/40 text-sm uppercase tracking-widest mt-1">{word_romanized}</p>
        </div>

        {/* Stars */}
        <StarDisplay stars={stars} />

        {/* Score summary */}
        <div className="card p-5 text-center mb-6">
          <p className="text-5xl font-bold text-white mb-1">{score}</p>
          <p className="text-white/40 text-sm">points</p>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div>
              <p className="text-white font-semibold">{correct_count}/{total_questions}</p>
              <p className="text-white/40">correct</p>
            </div>
            <div>
              <p className="text-white font-semibold">{pct}%</p>
              <p className="text-white/40">accuracy</p>
            </div>
            {prog && (
              <div>
                <p className="text-white font-semibold">{prog.bestScore}</p>
                <p className="text-white/40">best score</p>
              </div>
            )}
          </div>
        </div>

        {/* Answer breakdown */}
        <h2 className="text-xs uppercase tracking-widest text-white/40 mb-3">Breakdown</h2>
        <div className="space-y-3 mb-8">
          {answers.map((a) => (
            <div
              key={a.question_index}
              className={`card p-4 border ${
                a.is_correct ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`text-lg mt-0.5 ${a.is_correct ? 'text-green-400' : 'text-red-400'}`}>
                  {a.is_correct ? '✓' : '✗'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="tamil text-sm text-white/70 leading-relaxed">
                    {a.game_sentence.replace('______', `[${a.correct_answer}]`)}
                  </p>
                  <p className="text-xs text-white/40 mt-1">{a.sense_ta} · {a.sense}</p>
                  {!a.is_correct && (
                    <p className="text-xs mt-1">
                      <span className="text-red-400">You answered: </span>
                      <span className="tamil text-white/60">{a.submitted_answer || '—'}</span>
                      <span className="text-white/30 mx-1">→</span>
                      <span className="text-green-400">Correct: </span>
                      <span className="tamil text-green-300">{a.correct_answer}</span>
                    </p>
                  )}
                </div>
                <span className={`text-sm font-bold shrink-0 ${a.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {a.score_delta > 0 ? `+${a.score_delta}` : a.score_delta}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className="btn-primary flex-1" onClick={handlePlayAgain}>
            Play Again
          </button>
          <button
            className="btn-ghost flex-1"
            onClick={() => { resetGame(); navigate('/') }}
          >
            New Word
          </button>
        </div>
      </main>
    </div>
  )
}
