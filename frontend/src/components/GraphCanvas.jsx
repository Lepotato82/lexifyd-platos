import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

const POS_COLOR = {
  Noun:      '#3b82f6',
  Verb:      '#f97316',
  Adjective: '#22c55e',
  Adverb:    '#a855f7',
}

export default function GraphCanvas({ graphData, width, height }) {
  const svgRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    if (!graphData || !svgRef.current) return

    const { root, nodes, edges, example_words } = graphData
    const exampleMap = {}
    example_words.forEach((ex) => { exampleMap[ex.sense_id] = ex })

    // Build D3 nodes and links
    const d3Nodes = [
      { id: 'root', label: root.word_ta, sublabel: root.romanized, type: 'root', color: '#6060e8', r: 36 },
      ...nodes.map((n) => ({
        id: n.id,
        label: n.label_ta,
        sublabel: n.label_en,
        pos: n.pos,
        domain: n.domain,
        type: 'sense',
        color: POS_COLOR[n.pos] || '#6060e8',
        r: 24,
        example: exampleMap[n.id],
      })),
    ]

    const d3Links = edges.map((e) => ({
      source: e.from_ || e.from || 'root',
      target: e.to,
      label: e.relation,
      context: e.context,
    }))

    // Clear previous render
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const g = svg.append('g')

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    // Simulation
    const simulation = d3.forceSimulation(d3Nodes)
      .force('link', d3.forceLink(d3Links).id((d) => d.id).distance(140))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d) => d.r + 20))

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#6060e8')

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(d3Links)
      .join('line')
      .attr('stroke', '#4a4ad0')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow)')

    // Edge labels
    const edgeLabel = g.append('g')
      .selectAll('text')
      .data(d3Links)
      .join('text')
      .attr('font-size', 10)
      .attr('fill', '#9090c0')
      .attr('text-anchor', 'middle')
      .text((d) => d.label)

    // Node groups
    const node = g.append('g')
      .selectAll('g')
      .data(d3Nodes)
      .join('g')
      .attr('cursor', 'pointer')
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
        if (d.example) {
          setTooltip({ x: event.pageX, y: event.pageY, data: d })
        }
      })

    // Node circles
    node.append('circle')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => d.color + '30')
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', 2)

    // Tamil label
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', '"Noto Sans Tamil", sans-serif')
      .attr('font-size', (d) => d.type === 'root' ? 18 : 14)
      .attr('font-weight', 600)
      .attr('fill', 'white')
      .attr('y', (d) => d.type === 'root' ? -4 : -2)
      .text((d) => d.label)

    // Sublabel (romanized / English)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', (d) => d.type === 'root' ? 14 : 13)
      .attr('font-size', 9)
      .attr('fill', '#9090c0')
      .text((d) => d.sublabel)

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => {
          const dx = d.target.x - d.source.x
          const dy = d.target.y - d.source.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          return d.target.x - (dx / dist) * d.target.r
        })
        .attr('y2', (d) => {
          const dx = d.target.x - d.source.x
          const dy = d.target.y - d.source.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          return d.target.y - (dy / dist) * d.target.r
        })

      edgeLabel
        .attr('x', (d) => (d.source.x + d.target.x) / 2)
        .attr('y', (d) => (d.source.y + d.target.y) / 2 - 6)

      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    return () => simulation.stop()
  }, [graphData, width, height])

  return (
    <div className="relative w-full h-full" onClick={() => setTooltip(null)}>
      <svg ref={svgRef} width={width} height={height} className="w-full h-full" />

      {/* Node tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 card p-3 max-w-xs text-sm pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 20 }}
        >
          <p className="tamil font-semibold text-white">{tooltip.data.example?.example_ta}</p>
          <p className="text-white/60 mt-1">{tooltip.data.example?.example_en}</p>
          <p className="text-xs text-white/30 mt-1">{tooltip.data.domain}</p>
        </div>
      )}
    </div>
  )
}
