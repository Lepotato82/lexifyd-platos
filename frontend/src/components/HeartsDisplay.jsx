import React, { useEffect, useRef, useState } from 'react'

function PixelHeart({ alive, animating }) {
  return (
    <svg
      width={22} height={20} viewBox="0 0 11 10"
      className={`transition-all duration-150 ${animating ? 'animate-heartLost' : ''}`}
      style={{
        filter: alive
          ? 'drop-shadow(0 0 4px rgba(255, 71, 87, 0.6))'
          : 'none',
        opacity: alive ? 1 : 0.2,
      }}
    >
      {/* Pixel heart shape on an 11x10 grid */}
      <rect x={1} y={0} width={3} height={1} fill={alive ? '#FF4757' : '#3D4170'} />
      <rect x={7} y={0} width={3} height={1} fill={alive ? '#FF4757' : '#3D4170'} />
      <rect x={0} y={1} width={5} height={1} fill={alive ? '#FF4757' : '#3D4170'} />
      <rect x={6} y={1} width={5} height={1} fill={alive ? '#FF4757' : '#3D4170'} />
      <rect x={0} y={2} width={11} height={1} fill={alive ? '#FF6B81' : '#3D4170'} />
      <rect x={0} y={3} width={11} height={1} fill={alive ? '#FF4757' : '#3D4170'} />
      <rect x={1} y={4} width={9} height={1} fill={alive ? '#FF4757' : '#3D4170'} />
      <rect x={1} y={5} width={9} height={1} fill={alive ? '#E63946' : '#2A2D4A'} />
      <rect x={2} y={6} width={7} height={1} fill={alive ? '#E63946' : '#2A2D4A'} />
      <rect x={3} y={7} width={5} height={1} fill={alive ? '#CC2936' : '#2A2D4A'} />
      <rect x={4} y={8} width={3} height={1} fill={alive ? '#CC2936' : '#2A2D4A'} />
      <rect x={5} y={9} width={1} height={1} fill={alive ? '#B71C1C' : '#2A2D4A'} />
      {/* Highlight pixel */}
      {alive && <rect x={2} y={1} width={1} height={1} fill="#FFA0A0" opacity={0.7} />}
    </svg>
  )
}

export default function HeartsDisplay({ hearts, maxHearts = 3 }) {
  const prevHearts = useRef(hearts)
  const [animatingIndex, setAnimatingIndex] = useState(null)

  useEffect(() => {
    if (hearts < prevHearts.current) {
      const lost = hearts
      setAnimatingIndex(lost)
      const t = setTimeout(() => setAnimatingIndex(null), 600)
      prevHearts.current = hearts
      return () => clearTimeout(t)
    }
    prevHearts.current = hearts
  }, [hearts])

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: maxHearts }, (_, i) => (
        <PixelHeart
          key={i}
          alive={i < hearts}
          animating={animatingIndex === i}
        />
      ))}
    </div>
  )
}
