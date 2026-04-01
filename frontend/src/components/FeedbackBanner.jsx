import React from 'react'

export default function FeedbackBanner({ feedback, onContinue, hearts, gems, onSpendGem }) {
  if (!feedback) return null

  const { isCorrect, correctAnswer, message, speedBonus } = feedback
  const isGameOver = !isCorrect && hearts === 0
  const canRestoreHeart = isGameOver && gems > 0

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 animate-slideUp"
      style={{
        background: isCorrect
          ? 'rgba(57, 255, 20, 0.08)'
          : isGameOver
            ? 'rgba(255, 71, 87, 0.15)'
            : 'rgba(255, 71, 87, 0.06)',
        borderTop: `3px solid ${isCorrect ? 'var(--correct)' : 'var(--wrong)'}`,
        backdropFilter: 'blur(16px)',
        boxShadow: isCorrect
          ? '0 -4px 30px rgba(57, 255, 20, 0.15)'
          : '0 -4px 30px rgba(255, 71, 87, 0.15)',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-4 pb-safe">

        {/* Game Over state */}
        {isGameOver ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl shrink-0">
                <svg width={32} height={30} viewBox="0 0 11 10">
                  <rect x={1} y={0} width={3} height={1} fill="#555" />
                  <rect x={7} y={0} width={3} height={1} fill="#555" />
                  <rect x={0} y={1} width={5} height={1} fill="#555" />
                  <rect x={6} y={1} width={5} height={1} fill="#555" />
                  <rect x={0} y={2} width={11} height={1} fill="#666" />
                  <rect x={0} y={3} width={5} height={1} fill="#555" />
                  <rect x={5} y={3} width={1} height={3} fill="var(--bg-base)" />
                  <rect x={6} y={3} width={5} height={1} fill="#555" />
                  <rect x={1} y={4} width={4} height={1} fill="#555" />
                  <rect x={6} y={4} width={4} height={1} fill="#555" />
                  <rect x={2} y={5} width={3} height={1} fill="#444" />
                  <rect x={6} y={5} width={3} height={1} fill="#444" />
                  <rect x={3} y={6} width={5} height={1} fill="#444" />
                  <rect x={4} y={7} width={3} height={1} fill="#333" />
                  <rect x={5} y={8} width={1} height={1} fill="#333" />
                </svg>
              </span>
              <div>
                <p
                  className="font-bold text-sm uppercase tracking-wider"
                  style={{ color: 'var(--wrong)', letterSpacing: '0.1em' }}
                >
                  Game Over!
                </p>
                {correctAnswer && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Answer:{' '}
                    <span className="tamil font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {correctAnswer}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {canRestoreHeart && (
                <button
                  onClick={onSpendGem}
                  className="btn-primary flex-1 text-sm"
                  style={{ background: 'var(--primary)' }}
                >
                  Use Gem &middot; Restore Heart
                  <span
                    className="text-xs rounded-full px-1.5 py-0.5 font-bold"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  >
                    {gems}
                  </span>
                </button>
              )}
              <button
                onClick={onContinue}
                className={canRestoreHeart ? 'btn-ghost text-sm' : 'btn-danger text-sm flex-1'}
              >
                {canRestoreHeart ? 'End' : 'See Results'}
              </button>
            </div>
          </div>
        ) : (
          /* Normal correct / wrong feedback */
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {/* Retro check/cross icon */}
              <div
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg font-black text-xl"
                style={{
                  background: isCorrect ? 'var(--correct)' : 'var(--wrong)',
                  color: '#0D0F1A',
                  boxShadow: isCorrect ? 'var(--shadow-correct)' : 'var(--shadow-wrong)',
                }}
              >
                {isCorrect ? '!' : 'X'}
              </div>
              <div className="min-w-0">
                <p
                  className="font-black text-base uppercase tracking-wider"
                  style={{
                    color: isCorrect ? 'var(--correct)' : 'var(--wrong)',
                    letterSpacing: '0.12em',
                    textShadow: isCorrect
                      ? '0 0 10px rgba(57,255,20,0.5)'
                      : '0 0 10px rgba(255,71,87,0.5)',
                  }}
                >
                  {isCorrect ? 'Correct!' : 'Wrong!'}
                </p>
                {!isCorrect && correctAnswer && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="tamil font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {correctAnswer}
                    </span>
                  </p>
                )}
                {isCorrect && message && (
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{message}</p>
                )}
              </div>
            </div>
            <button
              onClick={onContinue}
              className="shrink-0"
              style={{
                background: isCorrect ? 'var(--correct)' : 'var(--wrong)',
                color: '#0D0F1A',
                fontWeight: 700,
                fontSize: '0.875rem',
                padding: '0.625rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '2px solid rgba(255,255,255,0.15)',
                borderBottom: '3px solid rgba(0,0,0,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                transition: 'all 100ms',
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
