import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameEngine } from '../hooks/useGameEngine'
import GraphCanvas from '../components/GraphCanvas'

const POS_LEGEND = [
  { pos: 'Noun',      color: '#3b82f6' },
  { pos: 'Verb',      color: '#f97316' },
  { pos: 'Adjective', color: '#22c55e' },
  { pos: 'Adverb',    color: '#a855f7' },
]

export default function SemanticWeb() {
  const { wordTa } = useParams()
  const navigate   = useNavigate()
  const { fetchGraph } = useGameEngine()

  const [graphData, setGraphData] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ width: 800, height: 600 })

  useEffect(() => {
    if (!wordTa) { navigate('/'); return }
    fetchGraph(wordTa)
      .then((data) => { setGraphData(data); setLoading(false) })
      .catch((err)  => { setError(err.message); setLoading(false) })
  }, [wordTa])

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({
          width:  containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const senseCount = graphData?.nodes?.filter((n) => n.node_type === 'sense').length ?? 0
  const morphCount = graphData?.nodes?.filter((n) => n.node_type === 'morph').length ?? 0

  return (
    <div className="min-h-dvh flex flex-col bg-brand-950">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-brand-800/60 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="text-white/40 hover:text-white transition-colors"
          aria-label="Go back"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {graphData && (
          <>
            <div className="flex items-center gap-2">
              <span className="tamil text-xl font-bold text-white">{graphData.root.word_ta}</span>
              <span className="text-xs text-white/30 uppercase tracking-widest">{graphData.root.romanized}</span>
            </div>
            <div className="flex items-center gap-3 ml-2">
              <span className="text-xs bg-brand-800/60 border border-brand-700/40 px-2 py-0.5 rounded-full text-white/50">
                {senseCount} sense{senseCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs bg-brand-800/60 border border-brand-700/40 px-2 py-0.5 rounded-full text-white/50">
                {morphCount} forms
              </span>
            </div>
          </>
        )}

        <span className="ml-auto text-xs text-white/25 hidden sm:block">
          Drag to explore · Click a sense node for an example
        </span>
      </header>

      {/* Graph canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="text-3xl text-indigo-400 animate-spin select-none">⟳</div>
              <p className="text-white/50 text-sm">Building semantic graph…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3 px-4">
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={() => navigate(-1)} className="btn-ghost text-sm py-2">
                Go Back
              </button>
            </div>
          </div>
        )}

        {!loading && !error && graphData && (
          <GraphCanvas graphData={graphData} width={dims.width} height={dims.height} />
        )}

        {/* Legend */}
        {!loading && graphData && (
          <div className="absolute bottom-4 left-4 card p-3 space-y-1.5 text-xs">
            <p className="text-white/30 uppercase tracking-wider mb-2">Legend</p>
            {POS_LEGEND.map(({ pos, color }) => (
              <div key={pos} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: color, background: color + '30' }} />
                <span className="text-white/60">{pos}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1.5 border-t border-brand-700/30">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500/30 border-2 border-indigo-500" />
              <span className="text-white/60">Root word</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full border border-white/20 bg-white/5" />
              <span className="text-white/40">Morphological form</span>
            </div>
            <div className="flex items-center gap-2 pt-1.5 border-t border-brand-700/30">
              <div className="w-3 h-0.5 bg-indigo-600/80" />
              <span className="text-white/40">Sense relation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-px border-t border-dashed border-white/20" />
              <span className="text-white/40">Morphological link</span>
            </div>
          </div>
        )}

        {/* Algorithm badge */}
        {!loading && graphData && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-xs text-white/30 bg-brand-900/60 px-3 py-1.5 rounded-full border border-brand-700/30">
            <span>⚙</span>
            <span>
              {graphData.algorithm === 'sentence-transformer'
                ? 'MiniLM cosine × 0.7 + POS × 0.3'
                : 'Jaccard × 0.6 + POS × 0.4'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
