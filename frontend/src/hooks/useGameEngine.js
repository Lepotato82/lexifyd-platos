import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore'

const API = import.meta.env.VITE_API_URL || ''

export function useGameEngine() {
  const navigate = useNavigate()
  const store = useGameStore()

  async function startGame(wordTa) {
    store.setPhase('loading')
    try {
      const { rapidFire } = useGameStore.getState()
      const res = await fetch(`${API}/api/game/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_ta: wordTa, rapid_fire: rapidFire }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Failed to start game')
      }
      const data = await res.json()
      store.initGame(data)
      navigate('/game')
    } catch (err) {
      store.setPhase('idle')
      throw err
    }
  }

  async function submitAnswer(questionIndex, answer, answerBlank1 = '', answerBlank2 = '') {
    const { sessionId, hearts, questionStartTime } = useGameStore.getState()
    const answerTimeMs = questionStartTime ? Date.now() - questionStartTime : 0
    const res = await fetch(`${API}/api/game/session/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_index: questionIndex,
        answer,
        answer_blank1: answerBlank1,
        answer_blank2: answerBlank2,
        answer_time_ms: answerTimeMs,
      }),
    })
    if (!res.ok) throw new Error('Failed to submit answer')
    const data = await res.json()

    // For hard questions the "primary" submitted answer is blank2 (last one tapped)
    data.submitted_answer = answerBlank2 || answer
    store.recordAnswer(questionIndex, data)

    // Compute hearts after this answer
    const heartsAfter = data.is_correct ? hearts : Math.max(0, hearts - 1)

    // Fetch results when all questions answered OR hearts are depleted
    if (data.completed || heartsAfter === 0) {
      const resultsRes = await fetch(`${API}/api/game/session/${sessionId}/results`)
      const results = await resultsRes.json()
      // Tag game-over-by-hearts so Results page can show different messaging
      store.setResults({ ...results, heartGameOver: heartsAfter === 0 && !data.completed })
    }

    return data
  }

  function navigateToResults() {
    navigate('/results')
  }

  async function fetchGraph(wordTa) {
    const res = await fetch(`${API}/api/words/${encodeURIComponent(wordTa)}/graph`)
    if (!res.ok) throw new Error('Could not load semantic graph — is the backend running?')
    return res.json()
  }

  return { startGame, submitAnswer, navigateToResults, fetchGraph }
}
