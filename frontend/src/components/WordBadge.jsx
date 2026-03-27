import React from 'react'

const POS_COLORS = {
  Noun:      'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Verb:      'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Adjective: 'bg-green-500/20 text-green-300 border-green-500/30',
  Adverb:    'bg-purple-500/20 text-purple-300 border-purple-500/30',
}

export default function WordBadge({ wordTa, romanized, pos, size = 'md' }) {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className={`tamil font-bold ${sizeClasses[size]} text-white leading-tight`}>
        {wordTa}
      </span>
      {romanized && (
        <span className="text-sm text-white/50 tracking-widest uppercase font-medium">
          {romanized}
        </span>
      )}
      {pos && (
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${POS_COLORS[pos] || 'bg-brand-700/50 text-white/60 border-brand-600/30'}`}>
          {pos}
        </span>
      )}
    </div>
  )
}
