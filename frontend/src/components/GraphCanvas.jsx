import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

const POS_COLOR = {
  Noun:      '#3b82f6',
  Verb:      '#f97316',
  Adjective: '#22c55e',
  Adverb:    '#a855f7',
  default:   '#6060e8',
}

function posColor(pos) {
  return POS_COLOR[pos] || POS_COLOR.default
}

export default function GraphCanvas({ graphData, width, height }) {
  const svgRef    = useRef(null)
  const [tooltip, setTooltip] = useState(null)   // { x, y, data }

  useEffect(() => {
    if (!graphData || !svgRef.current || width < 10 || height < 10) return

    const { root, nodes, edges, example_words } = graphData

    // Build sense_id → example lookup
    const exampleMap = {}
    example_words.forEach((ex) => { exampleMap[ex.sense_id] = ex })

    // ── D3 node objects ──────────────────────────────────────────────────
    const d3Nodes = [
      {
        id: 'root', label: root.word_ta, sublabel: root.romanized,
        type: 'root', color: '#6060e8', r: 38, glowColor: '#8080ff',
      },
      ...nodes.map((n) => {
        const isMorph = n.node_type === 'morph'
        const color   = isMorph ? posColor(n.pos) : posColor(n.pos)
        return {
          id: n.id, label: n.label_ta, sublabel: isMorph ? '' : n.label_en,
          pos: n.pos, domain: n.domain, type: n.node_type,
          color, r: isMorph ? 14 : 26,
          glowColor: color,
          example: exampleMap[n.id],
        }
      }),
    ]

    // ── D3 link objects ──────────────────────────────────────────────────
    const d3Links = edges.map((e) => ({
      source:   e.from_,
      target:   e.to,
      label:    e.relation,
      context:  e.context,
      weight:   e.weight,
      isMorph:  e.relation === 'form',
    }))

    // ── Setup SVG ────────────────────────────────────────────────────────
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Defs: arrow markers + glow filter
    const defs = svg.append('defs')

    // Glow filter
    const filter = defs.append('filter').attr('id', 'glow')
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur')
    const merge = filter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Arrow marker for sense edges
    defs.append('marker')
      .attr('id', 'arrow-sense')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 8).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#4a4ad0')

    // Arrow marker for morph edges (lighter)
    defs.append('marker')
      .attr('id', 'arrow-morph')
      .attr('viewBox', '0 -3 6 6')
      .attr('refX', 6).attr('refY', 0)
      .attr('markerWidth', 4).attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-3L6,0L0,3').attr('fill', '#3a3a6a')

    const g = svg.append('g')

    // Zoom + pan
    svg.call(
      d3.zoom().scaleExtent([0.25, 4])
        .on('zoom', (event) => g.attr('transform', event.transform))
    )

    // ── Force simulation ─────────────────────────────────────────────────
    const simulation = d3.forceSimulation(d3Nodes)
      .force('link', d3.forceLink(d3Links)
        .id((d) => d.id)
        .distance((d) => {
          if (d.source.id === 'root' || d.target.id === 'root') return 160
          if (d.isMorph) return 65
          // Cross-sense: similar senses cluster closer
          return 70 + (1 - d.weight) * 180
        })
        .strength((d) => d.isMorph ? 0.6 : 0.4)
      )
      .force('charge', d3.forceManyBody().strength((d) =>
        d.type === 'root' ? -600 : d.type === 'morph' ? -80 : -350
      ))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d) => d.r + 18))

    // ── Links ────────────────────────────────────────────────────────────
    const link = g.append('g')
      .selectAll('line')
      .data(d3Links)
      .join('line')
      .attr('stroke', (d) => d.isMorph ? '#2a2a5a' : '#4a4ad0')
      .attr('stroke-opacity', (d) => d.isMorph ? 0.35 : d.weight * 0.7 + 0.1)
      .attr('stroke-width', (d) => {
        if (d.source === 'root' || d.target === 'root') return 2
        if (d.isMorph) return 1
        return 1 + d.weight * 2
      })
      .attr('stroke-dasharray', (d) => d.isMorph ? '4,3' : null)
      .attr('marker-end', (d) => d.isMorph ? 'url(#arrow-morph)' : 'url(#arrow-sense)')

    // ── Edge labels (only for non-morph edges) ───────────────────────────
    const edgeLabel = g.append('g')
      .selectAll('text')
      .data(d3Links.filter((d) => !d.isMorph))
      .join('text')
      .attr('font-size', 9)
      .attr('fill', '#7070a0')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .text((d) => d.label)

    // ── Node groups ──────────────────────────────────────────────────────
    const node = g.append('g')
      .selectAll('g')
      .data(d3Nodes)
      .join('g')
      .attr('cursor', (d) => (d.type === 'sense' && d.example) ? 'pointer' : 'grab')
      .call(
        d3.drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )
      .on('click', (event, d) => {
        event.stopPropagation()
        if (d.type === 'sense' && d.example) {
          setTooltip({ x: event.pageX, y: event.pageY, data: d })
        }
      })

    // Glow halo (root + sense only)
    node.filter((d) => d.type !== 'morph')
      .append('circle')
      .attr('r', (d) => d.r + 8)
      .attr('fill', (d) => d.glowColor + '18')
      .attr('stroke', 'none')
      .attr('filter', 'url(#glow)')

    // Main circle
    node.append('circle')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => {
        if (d.type === 'root')  return '#202060'
        if (d.type === 'morph') return d.color + '18'
        return d.color + '28'
      })
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', (d) => d.type === 'root' ? 3 : d.type === 'morph' ? 1 : 2)

    // Tamil label
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', '"Noto Sans Tamil", sans-serif')
      .attr('font-size', (d) => d.type === 'root' ? 19 : d.type === 'morph' ? 10 : 13)
      .attr('font-weight', (d) => d.type === 'morph' ? 400 : 700)
      .attr('fill', (d) => d.type === 'morph' ? d.color + 'cc' : 'white')
      .attr('y', (d) => (d.sublabel && d.type !== 'morph') ? -5 : 0)
      .attr('pointer-events', 'none')
      .text((d) => d.label)

    // English/romanized sublabel (sense + root only)
    node.filter((d) => d.sublabel)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', (d) => d.type === 'root' ? 14 : 12)
      .attr('font-size', (d) => d.type === 'root' ? 9 : 8)
      .attr('fill', '#8080b0')
      .attr('pointer-events', 'none')
      .text((d) => d.sublabel)

    // Click-hint dot for sense nodes with examples
    node.filter((d) => d.type === 'sense' && d.example)
      .append('circle')
      .attr('r', 3)
      .attr('cx', (d) => d.r - 4)
      .attr('cy', (d) => -(d.r - 4))
      .attr('fill', '#ffd700')

    // ── Tick ─────────────────────────────────────────────────────────────
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => {
          const dx = d.target.x - d.source.x
          const dy = d.target.y - d.source.y
          const dist = Math.hypot(dx, dy) || 1
          return d.target.x - (dx / dist) * (d.target.r + 3)
        })
        .attr('y2', (d) => {
          const dx = d.target.x - d.source.x
          const dy = d.target.y - d.source.y
          const dist = Math.hypot(dx, dy) || 1
          return d.target.y - (dy / dist) * (d.target.r + 3)
        })

      edgeLabel
        .attr('x', (d) => (d.source.x + d.target.x) / 2)
        .attr('y', (d) => (d.source.y + d.target.y) / 2 - 5)

      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    svg.on('click', () => setTooltip(null))

    return () => simulation.stop()
  }, [graphData, width, height])

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} width={width} height={height} className="w-full h-full" />

      {/* Tooltip — shown on clicking a sense node */}
      {tooltip && (
        <div
          className="fixed z-50 card p-4 max-w-xs pointer-events-none animate-fadeIn"
          style={{ left: Math.min(tooltip.x + 14, window.innerWidth - 220), top: tooltip.y - 10 }}
        >
          <p className="text-xs text-white/40 uppercase tracking-widest mb-1">
            {tooltip.data.pos} · {tooltip.data.label_en || tooltip.data.pos}
          </p>
          <p className="tamil text-white text-sm leading-relaxed">
            {tooltip.data.example?.example_ta}
          </p>
          <p className="text-xs text-white/50 mt-1 italic">
            ({tooltip.data.example?.example_en})
          </p>
        </div>
      )}
    </div>
  )
}
