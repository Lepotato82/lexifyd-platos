import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useGameStore = create(
  persist(
    (set, get) => ({
      // ── Current game session (ephemeral) ─────────────────────────────────
      sessionId: null,
      wordTa: null,
      wordRomanized: null,
      questions: [],
      currentQuestionIndex: 0,
      slotStates: {},        // { [questionIndex]: 'empty'|'correct'|'wrong' }
      slotAnswers: {},       // { [questionIndex]: string }
      scoreAnimations: {},
      score: 0,
      streak: 0,
      hearts: 3,
      feedback: null,        // null | { isCorrect, correctAnswer, scoreDelta, message }
      feedbackLocked: false,
      gamePhase: 'idle',     // idle | loading | playing | results
      results: null,
      // Rapid fire
      timerEasy: 45,
      timerHard: 60,
      questionStartTime: null,  // Date.now() when question was shown

      // ── Persistent progress ──────────────────────────────────────────────
      wordProgress: {},      // { [word_ta]: { plays, bestScore, stars } }
      recentWords: [],
      totalXP: 0,
      flashcardProgress: {}, // { [word_ta]: 'known' | 'stillLearning' | undefined }
      gems: 0,               // spendable gems (1 gem = restore 1 heart OR get a hint)
      nextGemAt: 100,        // XP milestone for the next gem award
      rapidFire: false,          // rapid fire mode toggle (persistent)
      dailyChallengeWord: null,  // word_ta of today's daily word (set by Home page)
      dailyChallengeDone: null,  // date string "YYYY-MM-DD" of last completed daily

      // ── Actions ──────────────────────────────────────────────────────────
      setPhase: (phase) => set({ gamePhase: phase }),
      setRapidFire: (on) => set({ rapidFire: on }),

      initGame: (data) => {
        const slotStates = {}
        data.questions.forEach((q) => { slotStates[q.index] = 'empty' })
        set({
          sessionId: data.session_id,
          wordTa: data.word_ta,
          wordRomanized: data.word_romanized,
          questions: data.questions,
          currentQuestionIndex: 0,
          slotStates,
          slotAnswers: {},
          scoreAnimations: {},
          score: 0,
          streak: 0,
          hearts: 3,
          feedback: null,
          feedbackLocked: false,
          results: null,
          gamePhase: 'playing',
          timerEasy: data.timer_easy ?? 45,
          timerHard: data.timer_hard ?? 60,
          questionStartTime: Date.now(),
        })
      },

      recordAnswer: (questionIndex, response) => {
        const { slotStates, slotAnswers, scoreAnimations } = get()
        const delta = response.score_delta > 0
          ? `+${response.score_delta}`
          : `${response.score_delta}`

        const newHearts = response.is_correct
          ? get().hearts
          : Math.max(0, get().hearts - 1)

        // For hard questions, show per-blank correct answers when wrong
        const isHard = response.correct_answer_blank1 !== undefined &&
                       response.correct_answer_blank1 !== ''
        let displayCorrect = response.correct_answer
        if (isHard && !response.is_correct) {
          const parts = []
          if (!response.blank1_correct) parts.push(`Blank 1: ${response.correct_answer_blank1}`)
          if (!response.blank2_correct) parts.push(`Blank 2: ${response.correct_answer_blank2}`)
          if (parts.length) displayCorrect = parts.join(' · ')
        }

        set({
          slotStates: { ...slotStates, [questionIndex]: response.is_correct ? 'correct' : 'wrong' },
          slotAnswers: { ...slotAnswers, [questionIndex]: response.submitted_answer },
          scoreAnimations: { ...scoreAnimations, [questionIndex]: delta },
          score: response.total_score,
          streak: response.streak,
          hearts: newHearts,
          feedback: {
            isCorrect: response.is_correct,
            correctAnswer: displayCorrect,
            scoreDelta: response.score_delta,
            speedBonus: response.speed_bonus || 0,
            message: response.is_correct
              ? `+${response.score_delta} pts${response.speed_bonus ? ` (⚡+${response.speed_bonus} speed!)` : ''}`
              : `Correct: ${displayCorrect}`,
          },
          feedbackLocked: true,
        })

        // Clear score animation after 1.5s
        setTimeout(() => {
          useGameStore.setState((s) => {
            const anims = { ...s.scoreAnimations }
            delete anims[questionIndex]
            return { scoreAnimations: anims }
          })
        }, 1500)
      },

      advanceQuestion: () => {
        const { currentQuestionIndex, questions } = get()
        const next = currentQuestionIndex + 1
        set({
          feedback: null,
          feedbackLocked: false,
          currentQuestionIndex: next < questions.length ? next : currentQuestionIndex,
          questionStartTime: Date.now(),
        })
      },

      setResults: (results) => {
        const { wordProgress, recentWords, totalXP, gems, nextGemAt, dailyChallengeWord, dailyChallengeDone } = get()
        const wt = results.word_ta
        const prev = wordProgress[wt] || { plays: 0, bestScore: 0, stars: 0 }

        // Award +20 bonus XP for completing the daily challenge word (once per day)
        const today = new Date().toISOString().split('T')[0]
        const isDailyBonus = wt === dailyChallengeWord && dailyChallengeDone !== today && !results.heartGameOver
        const bonusXP = isDailyBonus ? 20 : 0

        // Always award XP for every game — minimum 0 (don't penalise bad runs)
        const xpEarned = Math.max(0, results.score) + bonusXP
        const newXP = totalXP + xpEarned

        // Award 1 gem per 100 XP milestone crossed
        let newGems = gems
        let newNextGemAt = nextGemAt
        while (newXP >= newNextGemAt) {
          newGems++
          newNextGemAt += 100
        }

        set({
          results: { ...results, dailyBonus: isDailyBonus ? bonusXP : 0 },
          gamePhase: 'results',
          totalXP: newXP,
          gems: newGems,
          nextGemAt: newNextGemAt,
          dailyChallengeDone: isDailyBonus ? today : dailyChallengeDone,
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

      setDailyChallengeWord: (wordTa) => set({ dailyChallengeWord: wordTa }),

      // Spend 1 gem for a hint (only decrements gems — no other side effects)
      useGemHint: () => {
        const { gems } = get()
        if (gems <= 0) return false
        set({ gems: gems - 1 })
        return true
      },

      spendGem: () => {
        const { gems, hearts, currentQuestionIndex, questions } = get()
        if (gems <= 0 || hearts >= 3) return false
        // Advance past the question that killed the last heart
        const next = currentQuestionIndex + 1
        set({
          gems: gems - 1,
          hearts: Math.min(3, hearts + 1),
          // Undo the pre-loaded game-over state so the game resumes
          results: null,
          gamePhase: 'playing',
          // Dismiss the feedback banner
          feedback: null,
          feedbackLocked: false,
          // Move to next question
          currentQuestionIndex: next < questions.length ? next : currentQuestionIndex,
          questionStartTime: Date.now(),
        })
        return true
      },

      setFlashcardProgress: (wordTa, status) => {
        set((s) => ({
          flashcardProgress: { ...s.flashcardProgress, [wordTa]: status },
        }))
      },

      resetGame: () =>
        set({
          sessionId: null,
          wordTa: null,
          wordRomanized: null,
          questions: [],
          currentQuestionIndex: 0,
          slotStates: {},
          slotAnswers: {},
          scoreAnimations: {},
          score: 0,
          streak: 0,
          hearts: 3,
          feedback: null,
          feedbackLocked: false,
          gamePhase: 'idle',
          results: null,
          timerEasy: 45,
          timerHard: 60,
          questionStartTime: null,
        }),
    }),
    {
      name: 'lexifyd-v5',
      partialize: (state) => ({
        wordProgress: state.wordProgress,
        recentWords: state.recentWords,
        totalXP: state.totalXP,
        flashcardProgress: state.flashcardProgress,
        gems: state.gems,
        nextGemAt: state.nextGemAt,
        rapidFire: state.rapidFire,
        dailyChallengeWord: state.dailyChallengeWord,
        dailyChallengeDone: state.dailyChallengeDone,
      }),
    }
  )
)

export default useGameStore
