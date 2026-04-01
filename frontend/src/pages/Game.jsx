import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import useGameStore from '../store/gameStore'
import { useGameEngine } from '../hooks/useGameEngine'
import SentenceSlot from '../components/SentenceSlot'
import MeaningChip from '../components/MeaningChip'
import FeedbackBanner from '../components/FeedbackBanner'
import ProgressDots from '../components/ProgressDots'
import HeartsDisplay from '../components/HeartsDisplay'

// ── Circular countdown timer — retro arcade style ───────────────────────────
function CountdownTimer({ seconds, onTimeout }) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef(null)

  useEffect(() => {
    setRemaining(seconds)
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          onTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [seconds, onTimeout])

  const feedbackLocked = useGameStore((s) => s.feedbackLocked)
  useEffect(() => {
    if (feedbackLocked) clearInterval(intervalRef.current)
  }, [feedbackLocked])

  const pct = seconds > 0 ? remaining / seconds : 0
  const radius = 18
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - pct)
  const isUrgent = remaining <= 5

  return (
    <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
      <svg width={44} height={44} viewBox="0 0 44 44" className="absolute">
        <circle cx={22} cy={22} r={radius} fill="none" stroke="var(--border-retro)" strokeWidth={3} />
        <circle
          cx={22} cy={22} r={radius} fill="none"
          stroke={isUrgent ? 'var(--wrong)' : 'var(--neon-cyan)'}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1s linear',
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            filter: isUrgent ? 'drop-shadow(0 0 4px rgba(255,71,87,0.6))' : 'drop-shadow(0 0 4px rgba(0,240,255,0.4))',
          }}
        />
      </svg>
      <span
        className={`text-xs font-black tabular-nums ${isUrgent ? 'animate-pulse' : ''}`}
        style={{
          color: isUrgent ? 'var(--wrong)' : 'var(--neon-cyan)',
          textShadow: isUrgent ? '0 0 8px rgba(255,71,87,0.5)' : '0 0 8px rgba(0,240,255,0.3)',
        }}
      >
        {remaining}
      </span>
    </div>
  )
}

export default function Game() {
  const navigate = useNavigate()
  const { submitAnswer, navigateToResults } = useGameEngine()
  const {
    wordTa, wordRomanized, questions,
    currentQuestionIndex, slotStates, slotAnswers,
    scoreAnimations, score, streak, hearts, gems,
    feedback, feedbackLocked, results, rapidFire,
    timerEasy, timerHard,
    advanceQuestion, resetGame, spendGem, useGemHint, gamePhase,
  } = useGameStore()

  const [activeChip,      setActiveChip]      = useState(null)
  const [submitting,      setSubmitting]      = useState(false)
  const [eliminatedChips, setEliminatedChips] = useState([])

  const [hardBlankPhase,  setHardBlankPhase]  = useState(1)
  const [hardBlank1Answer, setHardBlank1Answer] = useState(null)
  const [hardBlank1State,  setHardBlank1State]  = useState('empty')
  const [hardBlank2Answer, setHardBlank2Answer] = useState(null)
  const [hardBlank2State,  setHardBlank2State]  = useState('empty')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 6 } })
  )

  if (gamePhase === 'idle' || !questions.length) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center flex-col gap-4"
        style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}
      >
        <p className="uppercase tracking-wider font-bold">No game in progress</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    )
  }

  useEffect(() => {
    setEliminatedChips([])
    setHardBlankPhase(1)
    setHardBlank1Answer(null)
    setHardBlank1State('empty')
    setHardBlank2Answer(null)
    setHardBlank2State('empty')
  }, [currentQuestionIndex])

  const currentQ       = questions[currentQuestionIndex]
  const totalQuestions = questions.length
  const answeredCount  = Object.values(slotStates).filter((s) => s === 'correct' || s === 'wrong').length
  const isHardQ        = (currentQ?.blank_count ?? 1) >= 2
  const isSemantic     = currentQ?.question_type === 'semantic'

  const currentOptions = isHardQ
    ? (hardBlankPhase === 1 ? (currentQ?.options_blank1 ?? []) : (currentQ?.options_blank2 ?? []))
    : (currentQ?.options ?? [])

  function isChipUsed(text) {
    if (!currentQ) return true
    if (isHardQ) {
      if (hardBlankPhase >= 2 && hardBlank1Answer === text) return true
      if ((slotStates[currentQ.index] === 'correct' || slotStates[currentQ.index] === 'wrong') &&
          hardBlank2Answer === text) return true
      return false
    }
    if (slotStates[currentQ.index] === 'correct' && slotAnswers[currentQ.index] === text) return true
    return false
  }

  async function handleAnswer(chipText, blankNum = 1) {
    if (!currentQ || feedbackLocked || submitting) return

    if (isHardQ) {
      if (hardBlankPhase === 1 && blankNum === 1) {
        const isB1Correct = isSemantic
          ? chipText === currentQ.sense_blank1
          : chipText === currentQ.correct_answer_blank1
        setHardBlank1Answer(chipText)
        setHardBlank1State(isB1Correct ? 'correct' : 'wrong')
        setHardBlankPhase(2)
      } else if (hardBlankPhase === 2 && blankNum === 2) {
        const isB2Correct = isSemantic
          ? chipText === currentQ.sense_blank2
          : chipText === currentQ.correct_answer_blank2
        setHardBlank2Answer(chipText)
        setHardBlank2State(isB2Correct ? 'correct' : 'wrong')
        setSubmitting(true)
        try {
          await submitAnswer(currentQ.index, '', hardBlank1Answer, chipText)
        } catch (err) { console.error(err) }
        finally { setSubmitting(false) }
      }
      return
    }

    if (slotStates[currentQ.index] === 'correct') return
    setSubmitting(true)
    try {
      await submitAnswer(currentQ.index, chipText)
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  function handleHint() {
    if (!currentQ || feedbackLocked || gems <= 0) return
    let phaseCorrect
    if (isHardQ) {
      if (isSemantic) {
        phaseCorrect = hardBlankPhase === 1 ? currentQ.sense_blank1 : currentQ.sense_blank2
      } else {
        phaseCorrect = hardBlankPhase === 1 ? currentQ.correct_answer_blank1 : currentQ.correct_answer_blank2
      }
    } else {
      phaseCorrect = currentQ.correct_answer
    }
    const wrongOptions = currentOptions.filter(
      (text) => text !== phaseCorrect && !eliminatedChips.includes(text)
    )
    if (!wrongOptions.length) return
    const pick = wrongOptions[Math.floor(Math.random() * wrongOptions.length)]
    setEliminatedChips((prev) => [...prev, pick])
    useGemHint()
  }

  const handleTimeout = useCallback(async () => {
    if (!currentQ || feedbackLocked || submitting) return
    setSubmitting(true)
    try {
      if (isHardQ) {
        await submitAnswer(currentQ.index, '', hardBlank1Answer || '', '')
      } else {
        await submitAnswer(currentQ.index, '__timeout__')
      }
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }, [currentQ?.index, feedbackLocked, submitting, isHardQ, hardBlank1Answer])

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveChip(null)
    if (!over) return
    const chipText      = active.data.current?.text
    const questionIndex = over.data.current?.questionIndex
    const blankNum      = over.data.current?.blankNum ?? 1
    if (chipText == null || questionIndex == null) return
    if (questionIndex !== currentQ?.index) return
    await handleAnswer(chipText, blankNum)
  }

  function handleContinue() {
    if (results) navigateToResults()
    else advanceQuestion()
  }

  const progressPct = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0
  const timerSecs = currentQ?.difficulty === 'easy' ? timerEasy : timerHard

  const cardState = slotStates[currentQ?.index]
  const cardBorderColor =
    cardState === 'correct' ? 'var(--correct)' :
    cardState === 'wrong'   ? 'var(--wrong)'   :
    'var(--border-bright)'
  const cardBg =
    cardState === 'correct' ? 'var(--correct-dim)' :
    cardState === 'wrong'   ? 'var(--wrong-dim)'   :
    'var(--bg-surface)'
  const cardShadow =
    cardState === 'correct' ? 'var(--shadow-correct)' :
    cardState === 'wrong'   ? 'var(--shadow-wrong)'   :
    'var(--shadow-card)'

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveChip(e.active.data.current?.text ?? null)}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-base)' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-20 px-4 py-3"
          style={{
            background: 'rgba(8,9,15,0.95)',
            borderBottom: '2px solid var(--border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button
              onClick={() => { resetGame(); navigate('/') }}
              className="shrink-0 transition-colors rounded-lg p-1"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Exit game"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* RPG-style HP bar */}
            <div className="flex-1 relative">
              <div
                className="h-3 rounded overflow-hidden"
                style={{
                  background: 'var(--bg-raised)',
                  border: '2px solid var(--border-bright)',
                }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, var(--correct), var(--neon-cyan))',
                    boxShadow: '0 0 8px rgba(57, 255, 20, 0.3)',
                  }}
                />
              </div>
            </div>

            {rapidFire && !feedbackLocked && currentQ && (
              <CountdownTimer
                key={`timer-${currentQuestionIndex}`}
                seconds={timerSecs}
                onTimeout={handleTimeout}
              />
            )}

            <div className="flex items-center gap-2 shrink-0">
              {gems > 0 && (
                <span
                  className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded"
                  style={{ background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-glow)' }}
                >
                  {gems}
                </span>
              )}
              <HeartsDisplay hearts={hearts} />
            </div>
          </div>
        </header>

        {/* Progress squares */}
        <div className="max-w-2xl mx-auto w-full px-4 pt-2">
          <ProgressDots total={totalQuestions} slotStates={slotStates} />
        </div>

        {/* ── Word + streak ──────────────────────────────────────────────── */}
        <div className="text-center pt-5 pb-2 px-4">
          <div className="flex items-center justify-center gap-3">
            <h1
              className="tamil font-bold animate-neonFlicker"
              style={{
                fontSize: '2.4rem',
                color: 'var(--text-primary)',
                textShadow: '0 0 20px var(--primary-glow)',
              }}
            >
              {wordTa}
            </h1>
            {streak >= 2 && (
              <div
                className="flex items-center gap-1 font-black text-sm"
                style={{
                  color: 'var(--accent)',
                  textShadow: '0 0 8px rgba(255,184,0,0.5)',
                }}
              >
                x{streak}
              </div>
            )}
          </div>
          <p
            className="text-xs mt-1 uppercase tracking-[0.3em] font-bold"
            style={{ color: 'var(--text-muted)' }}
          >
            {wordRomanized}
          </p>
        </div>

        {/* Score badge — coin style */}
        <div className="text-center pb-4">
          <span
            className="inline-flex items-center gap-1 text-sm font-black tabular-nums px-3 py-1 rounded"
            style={{
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              border: '2px solid rgba(255,184,0,0.3)',
              textShadow: '0 0 6px rgba(255,184,0,0.3)',
            }}
          >
            {score} PTS
          </span>
        </div>

        {/* ── Question card ──────────────────────────────────────────────── */}
        <main className="flex-1 px-4 max-w-2xl mx-auto w-full flex flex-col justify-center gap-4">
          {currentQ && (
            <div
              className={`rounded-xl p-5 transition-all duration-300 relative ${
                cardState === 'correct' ? 'animate-correctFlash' : cardState === 'wrong' ? 'animate-wrongShake' : ''
              }`}
              style={{
                background: cardBg,
                border: `2px solid ${cardBorderColor}`,
                boxShadow: cardShadow,
              }}
            >
              {/* Badges row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-black px-2.5 py-1 rounded uppercase tracking-wider"
                    style={{
                      background: currentQ.difficulty === 'hard'   ? 'rgba(255,71,87,0.15)' :
                                  currentQ.difficulty === 'medium' ? 'rgba(255,184,0,0.15)'  :
                                                                     'rgba(57,255,20,0.15)',
                      color:      currentQ.difficulty === 'hard'   ? 'var(--wrong)'   :
                                  currentQ.difficulty === 'medium' ? 'var(--accent)'  :
                                                                     'var(--correct)',
                      border:     `1px solid ${
                                  currentQ.difficulty === 'hard'   ? 'rgba(255,71,87,0.3)' :
                                  currentQ.difficulty === 'medium' ? 'rgba(255,184,0,0.3)'  :
                                                                     'rgba(57,255,20,0.3)'}`,
                    }}
                  >
                    {currentQ.difficulty}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded uppercase tracking-wide"
                    style={{
                      background: isSemantic ? 'rgba(139,92,246,0.15)' : 'rgba(0,240,255,0.12)',
                      color: isSemantic ? '#a78bfa' : 'var(--neon-cyan)',
                      border: `1px solid ${isSemantic ? 'rgba(139,92,246,0.3)' : 'rgba(0,240,255,0.25)'}`,
                    }}
                  >
                    {isSemantic ? 'Meaning' : 'Fill'}
                  </span>
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                  +{currentQ.difficulty === 'hard' ? 15 : currentQ.difficulty === 'medium' ? 12 : 10}
                  {currentQ.blank_count >= 2 && (
                    <span className="ml-1.5" style={{ color: 'var(--neon-cyan)' }}>
                      x2
                    </span>
                  )}
                </span>
              </div>

              <SentenceSlot
                id={`slot-${currentQ.index}`}
                questionIndex={currentQ.index}
                slotState={slotStates[currentQ.index] ?? 'empty'}
                filledWith={
                  !isHardQ && !isSemantic && (cardState === 'correct' || cardState === 'wrong')
                    ? slotAnswers[currentQ.index]
                    : null
                }
                sentence={currentQ.game_sentence}
                blankCount={currentQ.blank_count ?? 1}
                blankPhase={hardBlankPhase}
                blank1State={hardBlank1State}
                blank2State={hardBlank2State}
                blank1Answer={hardBlank1Answer}
                blank2Answer={hardBlank2Answer}
                questionType={currentQ.question_type}
                originalSentence={currentQ.original_sentence}
                highlightedWord={currentQ.highlighted_word}
              />

              {!isSemantic && (
                <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {currentQ.sense_ta && (
                    <span className="tamil" style={{ color: 'var(--text-secondary)' }}>
                      {currentQ.sense_ta}
                    </span>
                  )}
                  {currentQ.sense_ta && currentQ.sense ? ' · ' : ''}
                  <span style={{ color: 'var(--neon-cyan)', opacity: 0.7 }}>{currentQ.sense}</span>
                </p>
              )}

              {isSemantic && (
                <p
                  className="mt-3 text-sm font-bold uppercase tracking-wide"
                  style={{ color: '#a78bfa', letterSpacing: '0.08em' }}
                >
                  What does the underlined word mean?
                </p>
              )}

              {scoreAnimations[currentQ.index] && (
                <span
                  className="absolute top-3 right-4 text-sm font-black animate-scoreUp"
                  style={{
                    color: scoreAnimations[currentQ.index].startsWith('+') ? 'var(--correct)' : 'var(--wrong)',
                    textShadow: scoreAnimations[currentQ.index].startsWith('+')
                      ? '0 0 10px rgba(57,255,20,0.6)' : '0 0 10px rgba(255,71,87,0.6)',
                  }}
                >
                  {scoreAnimations[currentQ.index]}
                </span>
              )}
            </div>
          )}

          <p
            className="text-center text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {Math.min(currentQuestionIndex + 1, totalQuestions)} / {totalQuestions}
          </p>
        </main>

        {/* ── Chip pool — arcade button grid ─────────────────────────────── */}
        <footer
          className={`sticky bottom-0 px-4 py-4 transition-opacity duration-200 ${feedbackLocked ? 'opacity-40 pointer-events-none' : ''}`}
          style={{
            background: 'rgba(8,9,15,0.95)',
            borderTop: '2px solid var(--border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <p
                className="text-xs uppercase tracking-wider font-bold"
                style={{ color: 'var(--text-muted)' }}
              >
                {isSemantic
                  ? (isHardQ
                      ? (hardBlankPhase === 1 ? 'Word 1 meaning' : 'Word 2 meaning')
                      : 'Pick the meaning')
                  : (isHardQ
                      ? (hardBlankPhase === 1 ? 'Blank 1 of 2' : 'Blank 2 of 2')
                      : 'Drag or tap')}
              </p>
              {gems > 0 && !feedbackLocked && (
                <button
                  onClick={handleHint}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded transition-all active:scale-95"
                  style={{
                    background: 'var(--primary-dim)',
                    color: 'var(--primary)',
                    border: '1px solid var(--primary)',
                  }}
                >
                  Hint
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {currentOptions.map((text) => (
                <MeaningChip
                  key={text}
                  id={`chip-${text}`}
                  text={text}
                  used={isChipUsed(text)}
                  eliminated={eliminatedChips.includes(text)}
                  onTap={(t) => handleAnswer(t, isHardQ ? hardBlankPhase : 1)}
                  disableDrag={isSemantic}
                />
              ))}
            </div>
          </div>
        </footer>

        <FeedbackBanner
          feedback={feedback}
          onContinue={handleContinue}
          hearts={hearts}
          gems={gems}
          onSpendGem={spendGem}
        />
      </div>

      <DragOverlay>
        {activeChip && (
          <div
            className="rounded-xl px-4 py-3 font-bold shadow-2xl"
            style={{
              background: 'var(--bg-overlay)',
              border: '2px solid var(--neon-cyan)',
              boxShadow: 'var(--shadow-neon)',
              fontFamily: 'var(--font-tamil)',
              color: 'var(--text-primary)',
              transform: 'scale(1.05)',
            }}
          >
            {activeChip}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
