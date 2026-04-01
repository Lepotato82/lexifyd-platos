import React from 'react'
import { useDroppable } from '@dnd-kit/core'

function FilledWord({ text, slotState }) {
  return (
    <span
      className="font-semibold animate-popIn"
      style={{
        color: slotState === 'correct' ? 'var(--correct)' :
               slotState === 'wrong'   ? 'var(--wrong)'   :
               'var(--text-primary)',
        textDecoration: slotState === 'wrong' ? 'line-through' : 'none',
        opacity: slotState === 'wrong' ? 0.7 : 1,
      }}
    >
      {text}
    </span>
  )
}

function EmptyBlank({ waiting = false }) {
  return (
    <span style={{ color: waiting ? 'rgba(255,255,255,0.2)' : 'var(--text-muted)', fontSize: '0.875rem' }}>
      ______
    </span>
  )
}

export default function SentenceSlot({
  id, questionIndex, slotState, filledWith, sentence, blankCount = 1,
  // Hard-question (blankCount >= 2) props
  blankPhase = 1,
  blank1State = 'empty', blank2State = 'empty',
  blank1Answer = null, blank2Answer = null,
  // Semantic question props
  questionType = 'morphological',
  originalSentence = '',
  highlightedWord = '',
}) {
  // Always call both droppable hooks (React rules: no conditional hooks)
  const { setNodeRef: setRef1, isOver: isOver1 } = useDroppable({
    id: `${id}-1`,
    data: { questionIndex, blankNum: 1 },
    disabled: blankCount >= 2
      ? (blankPhase !== 1)
      : false,  // single-blank: always enabled (unless feedbackLocked — handled in Game.jsx)
  })
  const { setNodeRef: setRef2, isOver: isOver2 } = useDroppable({
    id: `${id}-2`,
    data: { questionIndex, blankNum: 2 },
    disabled: blankCount < 2 || blankPhase !== 2,
  })

  // ── Semantic question: full sentence with underlined word(s) ──────────────
  if (questionType === 'semantic') {
    const display = originalSentence || sentence.replace(/______/g, highlightedWord)

    // For hard semantic: two highlighted words (blank1 and blank2 answers from dataset)
    if (blankCount >= 2 && highlightedWord) {
      // Split on the highlighted word — underline each occurrence
      const segs = display.split(highlightedWord)
      return (
        <p className="tamil text-lg leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {segs.map((seg, i) => (
            <React.Fragment key={i}>
              {seg}
              {i < segs.length - 1 && (
                <span
                  className="font-bold"
                  style={{
                    textDecoration: 'underline',
                    textDecorationColor: i === 0
                      ? (blank1State === 'correct' ? 'var(--correct)' : blank1State === 'wrong' ? 'var(--wrong)' : 'var(--primary)')
                      : (blank2State === 'correct' ? 'var(--correct)' : blank2State === 'wrong' ? 'var(--wrong)' : 'var(--primary)'),
                    textUnderlineOffset: '4px',
                    textDecorationThickness: '2px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {highlightedWord}
                  <sup className="text-xs ml-0.5" style={{ color: 'var(--text-muted)' }}>{i + 1}</sup>
                </span>
              )}
            </React.Fragment>
          ))}
        </p>
      )
    }

    // Easy/medium semantic: single underlined word
    if (highlightedWord && display.includes(highlightedWord)) {
      const idx = display.indexOf(highlightedWord)
      const before = display.slice(0, idx)
      const after = display.slice(idx + highlightedWord.length)
      const underlineColor = slotState === 'correct' ? 'var(--correct)' : slotState === 'wrong' ? 'var(--wrong)' : 'var(--primary)'
      return (
        <p className="tamil text-lg leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {before}
          <span
            className="font-bold"
            style={{
              textDecoration: 'underline',
              textDecorationColor: underlineColor,
              textUnderlineOffset: '4px',
              textDecorationThickness: '2px',
              color: 'var(--text-primary)',
            }}
          >
            {highlightedWord}
          </span>
          {after}
        </p>
      )
    }

    // Fallback: just show the sentence
    return (
      <p className="tamil text-lg leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        {display}
      </p>
    )
  }

  const parts = sentence.split('______')

  // ── Hard question: two independent blanks ─────────────────────────────────
  if (blankCount >= 2 && parts.length >= 3) {
    const stateClass1 =
      blank1State === 'correct' ? 'sentence-slot correct' :
      blank1State === 'wrong'   ? 'sentence-slot wrong'   :
      isOver1                   ? 'sentence-slot over'    :
                                  'sentence-slot'

    // blank2 state after overall submission uses slotState; during phase 2 use blank2State
    const resolved2 =
      blank2State !== 'empty' ? blank2State :
      (slotState === 'correct' ? 'correct' : slotState === 'wrong' ? 'wrong' : 'empty')

    const stateClass2 =
      resolved2 === 'correct' ? 'sentence-slot correct' :
      resolved2 === 'wrong'   ? 'sentence-slot wrong'   :
      isOver2                  ? 'sentence-slot over'    :
                                 'sentence-slot'

    return (
      <p className="tamil text-lg leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        {parts[0]}
        {/* Blank 1 — active drop target in phase 1 */}
        <span
          ref={setRef1}
          className={`${stateClass1} mx-1`}
          key={`${questionIndex}-b1-${blank1State}`}
        >
          {blank1Answer
            ? <FilledWord text={blank1Answer} slotState={blank1State} />
            : <EmptyBlank />}
        </span>
        {parts[1]}
        {/* Blank 2 — active drop target in phase 2 */}
        <span
          ref={setRef2}
          className={`${stateClass2} mx-1`}
          key={`${questionIndex}-b2-${resolved2}`}
        >
          {blank2Answer
            ? <FilledWord text={blank2Answer} slotState={resolved2} />
            : <EmptyBlank waiting={blankPhase < 2} />}
        </span>
        {parts[2] ?? ''}
      </p>
    )
  }

  // ── Standard single-blank question ────────────────────────────────────────
  const stateClass =
    slotState === 'correct' ? 'sentence-slot correct' :
    slotState === 'wrong'   ? 'sentence-slot wrong'   :
    isOver1                 ? 'sentence-slot over'    :
                              'sentence-slot'

  return (
    <p className="tamil text-lg leading-relaxed" style={{ color: 'var(--text-primary)' }}>
      {parts[0] ?? ''}
      <span
        ref={setRef1}
        className={`${stateClass} mx-1`}
        key={`${questionIndex}-${slotState}`}
      >
        {filledWith ? <FilledWord text={filledWith} slotState={slotState} /> : <EmptyBlank />}
      </span>
      {parts[1] ?? ''}
    </p>
  )
}
