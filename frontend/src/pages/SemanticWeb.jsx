import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameEngine } from '../hooks/useGameEngine'
import GraphCanvas from '../components/GraphCanvas'

const POS_LEGEND = [
  { pos: 'Noun',      color: '#3b82f6', label: 'Noun' },
  { pos: 'Verb',      color: '#f97316', label: 'Verb' },
  { pos: 'Adjective', color: '#22c55e', label: 'Adjective' },
  { pos: 'Adverb',    color: '#a855f7', label: 'Adverb' },
]

export default function SemanticWeb() {
  const { wordId } = useParams()
  const navigate = useNavigate()
  const { fetchGraph } = useGameEngine()
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ width: 800, height: 600 })

  useEffect(() => {
    if (!wordId) { navigate('/'); return }
    fetchGraph(wordId)
      .then((data) => { setGraphData(data); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [wordId])

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div className="min-h-dvh flex flex-col bg-brand-950">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-3 border-b border-brand-800/60">
        <button
          onClick={() => navigate(-1)}
          className="text-white/40 hover:text-white transition-colors text-lg"
        >
          ←
        </button>
        {graphData && (
          <div className="flex items-center gap-3">
            <span className="tamil text-xl font-bold text-white">
              {graphData.root.word_ta}
            </span>
            <span className="text-xs text-white/30 uppercase tracking-widest">
              {graphData.root.romanized}
            </span>
          </div>
        )}
        <span className="ml-auto text-xs text-white/30">
          Click a node to see an example
        </span>
      </header>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="text-4xl animate-spin">⟳</div>
              <p className="text-white/50 text-sm">Building semantic graph…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <p className="text-red-400">{error}</p>
              <button onClick={() => navigate(-1)} className="btn-ghost">Go Back</button>
            </div>
          </div>
        )}

        {!loading && !error && graphData && (
          <GraphCanvas graphData={graphData} width={dims.width} height={dims.height} />
        )}

        {/* Legend */}
        {!loading && graphData && (
          <div className="absolute bottom-4 left-4 card p-3 space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider">Legend</p>
            {POS_LEGEND.map(({ pos, color, label }) => (
              <div key={pos} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full border-2"
                  style={{ borderColor: color, background: color + '30' }}
                />
                <span className="text-xs text-white/70">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-brand-700/30">
              <div className="w-3 h-3 rounded-full bg-indigo-500/30 border-2 border-indigo-500" />
              <span className="text-xs text-white/70">Root Word</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
