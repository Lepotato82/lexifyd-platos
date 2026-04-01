import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Game from './pages/Game'
import Results from './pages/Results'
import Flashcards from './pages/Flashcards'
import Progress from './pages/Progress'
import SemanticWeb from './pages/SemanticWeb'
import BottomNav from './components/BottomNav'
import StartupCurtain from './components/StartupCurtain'

export default function App() {
  const [showCurtain, setShowCurtain] = useState(() => {
    // Show once per browser session (not on every in-app navigation)
    if (sessionStorage.getItem('lexifyd-intro-seen')) return false
    sessionStorage.setItem('lexifyd-intro-seen', '1')
    return true
  })

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
          <Route path="/flashcards"           element={<Flashcards />} />
          <Route path="/progress"             element={<Progress />} />
          <Route path="/semantic-web/:wordTa"  element={<SemanticWeb />} />
          <Route path="*"                     element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
      {showCurtain && <StartupCurtain onDone={() => setShowCurtain(false)} />}
    </div>
  )
}
