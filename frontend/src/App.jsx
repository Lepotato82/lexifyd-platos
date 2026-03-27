import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Game from './pages/Game'
import Results from './pages/Results'
import SemanticWeb from './pages/SemanticWeb'

export default function App() {
  return (
    <div className="min-h-dvh bg-brand-900">
      {/* Subtle background gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(96,96,232,0.15) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10">
        <Routes>
          <Route path="/"                     element={<Home />} />
          <Route path="/game"                 element={<Game />} />
          <Route path="/results"              element={<Results />} />
          <Route path="/semantic-web/:wordId" element={<SemanticWeb />} />
          <Route path="*"                     element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}
