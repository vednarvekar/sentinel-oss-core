import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export type GraphNode = {
  id: string;
  label: string;
  rank?: number;
  score?: number;
  group?: string;
};

export type GraphEdge = {
  source: string;
  target: string;
  label?: string;
};

interface CodeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function topLevelGroup(label: string) {
  const [first] = label.split("/");
  return first || "root";
}

function shortLabel(label: string) {
  const parts = label.split("/");
  if (parts.length <= 2) return label;
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

const GROUP_COLORS = ["#58a6ff", "#3fb950", "#d29922", "#bc8cff", "#f78166", "#56d4dd", "#e3b341"];

const CodeGraph = ({ nodes, edges }: CodeGraphProps) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return { nodes, edges };

    const q = query.toLowerCase();
    const matched = new Set(nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id));

    const related = new Set<string>(matched);
    for (const e of edges) {
      if (matched.has(e.source) || matched.has(e.target)) {
        related.add(e.source);
        related.add(e.target);
      }
    }

    return {
      nodes: nodes.filter((n) => related.has(n.id)),
      edges: edges.filter((e) => related.has(e.source) && related.has(e.target)),
    };
  }, [nodes, edges, query]);

  const positioned = useMemo(() => {
    const grouped = new Map<string, GraphNode[]>();
    for (const node of filtered.nodes) {
      const g = topLevelGroup(node.label);
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g)!.push(node);
    }

    const groupOrder = Array.from(grouped.keys()).sort((a, b) => grouped.get(b)!.length - grouped.get(a)!.length);
    const colorMap = new Map<string, string>();
    groupOrder.forEach((g, i) => colorMap.set(g, GROUP_COLORS[i % GROUP_COLORS.length]));

    const reactNodes: Node[] = [];

    for (let gx = 0; gx < groupOrder.length; gx++) {
      const group = groupOrder[gx];
      const items = grouped.get(group)!;

      items
        .sort((a, b) => a.label.localeCompare(b.label))
        .forEach((item, idx) => {
          reactNodes.push({
            id: item.id,
            position: {
              x: gx * 340 + (idx % 2) * 140,
              y: Math.floor(idx / 2) * 54,
            },
            data: { label: shortLabel(item.label) },
            style: {
              background: "#101820",
              color: colorMap.get(group) || "#c9d1d9",
              border: `1px solid ${colorMap.get(group) || "#30363d"}`,
              borderRadius: "8px",
              padding: "7px 10px",
              fontSize: "10.5px",
              fontFamily: "'JetBrains Mono', monospace",
              maxWidth: 220,
              boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            },
          });
        });
    }

    const nodeIdSet = new Set(reactNodes.map((n) => n.id));
    const reactEdges: Edge[] = filtered.edges
      .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
      .map((edge, i) => ({
        id: `e-${i}-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        animated: false,
        style: { stroke: "#445063", strokeWidth: 1.1, opacity: 0.55 },
      }));

    return { nodes: reactNodes, edges: reactEdges, groups: groupOrder.length };
  }, [filtered]);

  if (!nodes.length) {
    return (
      <div className="rounded-lg glass-subtle p-4 font-mono text-xs text-muted-foreground">
        Repository graph not available yet.
      </div>
    );
  }

  return (
    <div className="h-[560px] w-full overflow-hidden rounded-xl border border-border/60">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2 bg-black/20">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter paths in graph..."
          className="w-full max-w-sm rounded-md border border-border/50 bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary/40"
        />
        <div className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
          nodes {positioned.nodes.length} · edges {positioned.edges.length} · groups {positioned.groups}
        </div>
      </div>

      <ReactFlow
        nodes={positioned.nodes}
        edges={positioned.edges}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Background color="#293241" gap={22} size={1} />
        <MiniMap
          pannable
          zoomable
          style={{ backgroundColor: "#0f1720", border: "1px solid #293241" }}
          nodeColor="#5b8cff"
        />
        <Controls
          showInteractive={false}
          style={{ background: "#0f1720", border: "1px solid #293241", borderRadius: "6px" }}
        />
        <Panel position="top-right" className="rounded-md border border-border/50 bg-black/35 px-2 py-1 text-[10px] font-mono text-muted-foreground">
          Whole-repo import graph
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default CodeGraph;
