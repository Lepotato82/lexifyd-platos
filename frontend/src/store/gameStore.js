import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useGameStore = create(
  persist(
    (set, get) => ({
      // ── Current game session ─────────────────────────────────────────────
      sessionId: null,
      wordTa: null,
      wordRomanized: null,
      questions: [],         // QuestionOut[]
      slotStates: {},        // { [questionIndex]: 'empty' | 'correct' | 'wrong' }
      slotAnswers: {},       // { [questionIndex]: string }
      scoreAnimations: {},   // { [questionIndex]: '+12' | '-2' }
      score: 0,
      streak: 0,
      correctCount: 0,
      gamePhase: 'idle',     // idle | loading | playing | results
      results: null,

      // ── Persistent progress ──────────────────────────────────────────────
      wordProgress: {},      // { [word_ta]: { plays, bestScore, stars } }
      recentWords: [],

      // ── Actions ──────────────────────────────────────────────────────────
      setPhase: (phase) => set({ gamePhase: phase }),

      initGame: (data) => {
        const slotStates = {}
        data.questions.forEach((q) => { slotStates[q.index] = 'empty' })
        set({
          sessionId: data.session_id,
          wordTa: data.word_ta,
          wordRomanized: data.word_romanized,
          questions: data.questions,
          slotStates,
          slotAnswers: {},
          scoreAnimations: {},
          score: 0,
          streak: 0,
          correctCount: 0,
          results: null,
          gamePhase: 'playing',
        })
      },

      recordAnswer: (questionIndex, response) => {
        const { slotStates, slotAnswers, scoreAnimations } = get()
        const delta = response.score_delta > 0 ? `+${response.score_delta}` : `${response.score_delta}`

        set({
          slotStates: { ...slotStates, [questionIndex]: response.is_correct ? 'correct' : 'wrong' },
          slotAnswers: { ...slotAnswers, [questionIndex]: response.submitted_answer },
          scoreAnimations: { ...scoreAnimations, [questionIndex]: delta },
          score: response.total_score,
          streak: response.streak,
          correctCount: response.is_correct ? get().correctCount + 1 : get().correctCount,
        })

        // Clear score animation after 1.2s
        setTimeout(() => {
          useGameStore.setState((s) => {
            const anims = { ...s.scoreAnimations }
            delete anims[questionIndex]
            return { scoreAnimations: anims }
          })
        }, 1200)

        // Clear wrong state after 0.6s so user can retry
        if (!response.is_correct) {
          setTimeout(() => {
            useGameStore.setState((s) => ({
              slotStates: { ...s.slotStates, [questionIndex]: 'empty' },
              slotAnswers: { ...s.slotAnswers, [questionIndex]: undefined },
            }))
          }, 600)
        }
      },

      setResults: (results) => {
        const { wordProgress, recentWords } = get()
        const wt = results.word_ta
        const prev = wordProgress[wt] || { plays: 0, bestScore: 0, stars: 0 }
        set({
          results,
          gamePhase: 'results',
          wordProgress: {
            ...wordProgress,
            [wt]: {
              plays: prev.plays + 1,
              bestScore: Math.max(prev.bestScore, results.score),
              stars: Math.max(prev.stars, results.stars),
            },
          },
          recentWords: [wt, ...recentWords.filter((w) => w !== wt)].slice(0, 5),
        })
      },

      resetGame: () =>
        set({
          sessionId: null,
          wordTa: null,
          wordRomanized: null,
          questions: [],
          slotStates: {},
          slotAnswers: {},
          scoreAnimations: {},
          score: 0,
          streak: 0,
          correctCount: 0,
          gamePhase: 'idle',
          results: null,
        }),
    }),
    {
      name: 'lexifyd-v2',
      partialize: (state) => ({
        wordProgress: state.wordProgress,
        recentWords: state.recentWords,
      }),
    }
  )
)

export default useGameStore
