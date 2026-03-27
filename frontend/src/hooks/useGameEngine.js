import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore'

const API = import.meta.env.VITE_API_URL || ''

export function useGameEngine() {
  const navigate = useNavigate()
  const store = useGameStore()

  async function startGame(wordTa) {
    store.setPhase('loading')
    try {
      const res = await fetch(`${API}/api/game/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_ta: wordTa }),
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

  async function submitAnswer(questionIndex, answer) {
    const { sessionId } = useGameStore.getState()
    const res = await fetch(`${API}/api/game/session/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_index: questionIndex, answer }),
    })
    if (!res.ok) throw new Error('Failed to submit answer')
    const data = await res.json()

    // Attach the submitted answer for store use
    data.submitted_answer = answer
    store.recordAnswer(questionIndex, data)

    if (data.completed) {
      const resultsRes = await fetch(`${API}/api/game/session/${sessionId}/results`)
      const results = await resultsRes.json()
      store.setResults(results)
      navigate('/results')
    }

    return data
  }

  return { startGame, submitAnswer }
}
