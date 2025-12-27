
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { JTBDNode, JobLevel } from '../types';

interface TreeDiagramProps {
  data: JTBDNode;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
}

// Monochrome/Grayscale palette for strict professional look
const LEVEL_COLORS: Record<JobLevel, string> = {
  [JobLevel.SUPER_BIG]: '#020617', // Slate 950 (Black)
  [JobLevel.BIG]: '#334155',       // Slate 700
  [JobLevel.SMALL]: '#64748b',     // Slate 500
  [JobLevel.CORE]: '#94a3b8',      // Slate 400
  [JobLevel.MICRO]: '#cbd5e1',     // Slate 300
};

export const TreeDiagram: React.FC<TreeDiagramProps> = ({ data, selectedNodeId, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight, // Removed fixed fallback height to rely on CSS
        });
      }
    };
    window.addEventListener('resize', handleResize);
    // Call immediately to set initial size
    handleResize();
    // Also use a ResizeObserver for more robust size detection
    const resizeObserver = new ResizeObserver(() => handleResize());
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
    }
  }, []);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || !data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 80, right: 40, bottom: 80, left: 40 };

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const root = d3.hierarchy<JTBDNode>(data);
    
    // Increased nodeSize to accommodate larger cards
    // Width: 280 (was 220), Height: 150 (was 120) to prevent vertical overlap with taller cards
    const treeLayout = d3.tree<JTBDNode>().nodeSize([280, 150]);
    treeLayout(root);

    const descendants = root.descendants();
    const links = root.links();

    // Node Dimensions
    const NODE_WIDTH = 240;
    const NODE_HEIGHT = 80; // Increased height for multi-line text
    const NODE_X_OFFSET = -NODE_WIDTH / 2;
    const NODE_Y_OFFSET = -NODE_HEIGHT / 2;

    // Vertical Links - Sharp, clean lines
    const linkSelection = g.selectAll('.link')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('id', d => `link-${d.source.data.id}-${d.target.data.id}`) // ID for targeting
      .attr('fill', 'none')
      .attr('stroke', '#e2e8f0') // Slate 200 default
      .attr('stroke-width', 1.5)
      .attr('d', d3.linkVertical<any, any>()
        .x(d => d.x)
        .y(d => d.y)
      );

    // Nodes
    const nodeSelection = g.selectAll('.node')
      .data(descendants)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('id', d => `node-${d.data.id}`) // ID for targeting
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick(d.data.id);
      });

    // Tooltip
    nodeSelection.append('title')
      .text(d => `[${d.data.type}]\n${d.data.name}\n\n${d.data.description || ''}\n\nПочему: ${d.data.annotation || 'Нет аннотации'}`);

    // Node shapes - Rectangular, sharper radius (shadcn style)
    nodeSelection.append('rect')
      .attr('width', NODE_WIDTH)
      .attr('height', NODE_HEIGHT) 
      .attr('x', NODE_X_OFFSET)
      .attr('y', NODE_Y_OFFSET)
      .attr('rx', 6)
      .attr('class', 'node-rect')
      .attr('fill', '#ffffff')
      .attr('stroke', d => d.data.id === selectedNodeId ? '#0f172a' : '#cbd5e1') 
      .attr('stroke-width', d => d.data.id === selectedNodeId ? 2 : 1)
      .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))');

    // Type indicator strip (left side)
    nodeSelection.append('rect')
      .attr('width', 6)
      .attr('height', NODE_HEIGHT)
      .attr('x', NODE_X_OFFSET)
      .attr('y', NODE_Y_OFFSET)
      .attr('rx', 0)
      .attr('fill', d => LEVEL_COLORS[d.data.type])
      // Emulate rounded left corners with clip path or just keep straight. 
      // Simple strip is fine for UI consistency.
      .attr('clip-path', `inset(0 0 0 0 round 6px 0 0 6px)`);

    // Improved Text Rendering using foreignObject for HTML wrapping
    nodeSelection.append('foreignObject')
      .attr('x', NODE_X_OFFSET + 12) // padding left + strip width
      .attr('y', NODE_Y_OFFSET)
      .attr('width', NODE_WIDTH - 16) // padding right
      .attr('height', NODE_HEIGHT)
      .style('pointer-events', 'none') // Let clicks pass through to the group/rect
      .html(d => `
        <div style="
          width: 100%; 
          height: 100%; 
          display: flex; 
          flex-direction: column; 
          justify-content: center; 
          font-family: 'Inter', sans-serif;
        ">
          <div style="
            font-size: 9px; 
            color: #64748b; 
            font-weight: 700; 
            text-transform: uppercase; 
            letter-spacing: 0.05em; 
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${d.data.type}</div>
          <div style="
            font-size: 12px; 
            font-weight: 600; 
            color: #0f172a; 
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          ">${d.data.name}</div>
        </div>
      `);

    // --- Interaction Logic for Highlighting ---
    
    const updateHighlights = (targetData: d3.HierarchyNode<JTBDNode> | null) => {
      // Reset all to base state
      g.selectAll('.node-rect')
        .attr('stroke', (d: any) => d.data.id === selectedNodeId ? '#0f172a' : '#cbd5e1')
        .attr('stroke-width', (d: any) => d.data.id === selectedNodeId ? 2 : 1);
      
      g.selectAll('.link')
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1.5);

      if (!targetData) {
        if (selectedNodeId) {
             const selectedNode = descendants.find(d => d.data.id === selectedNodeId);
             if (selectedNode) highlightRelationships(selectedNode, true);
        }
        return;
      }
      
      highlightRelationships(targetData, false);
    };

    const highlightRelationships = (d: d3.HierarchyNode<JTBDNode>, isSelection: boolean) => {
        const primaryColor = isSelection ? '#0f172a' : '#334155'; // Black for selection, dark gray for hover
        const secondaryColor = '#94a3b8'; // Light slate for connections

        // Highlight Self
        g.select(`#node-${d.data.id} .node-rect`)
          .attr('stroke', primaryColor)
          .attr('stroke-width', 2);

        // Highlight Parent Link & Node
        if (d.parent) {
           g.select(`#link-${d.parent.data.id}-${d.data.id}`)
            .attr('stroke', secondaryColor)
            .attr('stroke-width', 2);
           
           g.select(`#node-${d.parent.data.id} .node-rect`)
             .attr('stroke', secondaryColor)
             .attr('stroke-width', 2);
        }

        // Highlight Children Links & Nodes
        if (d.children) {
          d.children.forEach(child => {
             g.select(`#link-${d.data.id}-${child.data.id}`)
               .attr('stroke', secondaryColor)
               .attr('stroke-width', 2);
             
             g.select(`#node-${child.data.id} .node-rect`)
               .attr('stroke', secondaryColor)
               .attr('stroke-width', 2);
          });
        }
    }

    // Attach events
    nodeSelection
      .on('mouseover', function(event, d) {
          updateHighlights(d);
      })
      .on('mouseout', function() {
          updateHighlights(null);
      });

    // Initial highlight check (if a node is already selected on mount/update)
    updateHighlights(null);

    // Auto-center zoom.
    const initialTransform = d3.zoomIdentity.translate(dimensions.width / 2, margin.top).scale(0.85);
    svg.call(zoom.transform, initialTransform);

  }, [data, dimensions, selectedNodeId]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-white rounded-md border border-slate-200 overflow-hidden" onClick={() => onNodeClick('')}>
      <div className="absolute top-4 left-4 flex flex-col gap-2 bg-white/95 p-3 rounded-md border border-slate-200 text-[10px] shadow-sm z-10 pointer-events-none">
        <div className="font-semibold text-slate-900 mb-1 uppercase tracking-wider">Легенда</div>
        {Object.entries(LEVEL_COLORS).map(([level, color]) => (
          <div key={level} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }}></span>
            <span className="text-slate-600 font-medium uppercase text-[9px]">{level}</span>
          </div>
        ))}
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></svg>
    </div>
  );
};
