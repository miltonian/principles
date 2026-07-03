export interface GraphNode {
  id: string;
  dependsOn: string[];
}

/**
 * Kahn's algorithm grouped into parallel-executable levels.
 * Returns null if the graph contains a cycle.
 * Dependencies on unknown ids are ignored (coverage checks flag them).
 */
export function topoLevels(nodes: GraphNode[]): string[][] | null {
  const known = new Set(nodes.map((n) => n.id));
  const level = new Map<string, number>();
  const remaining = new Map(
    nodes.map((n) => [n.id, n.dependsOn.filter((d) => known.has(d))])
  );

  let progressed = true;
  while (remaining.size > 0 && progressed) {
    progressed = false;
    for (const [id, deps] of [...remaining]) {
      if (deps.every((d) => level.has(d))) {
        const lvl = deps.length === 0 ? 0 : Math.max(...deps.map((d) => level.get(d)!)) + 1;
        level.set(id, lvl);
        remaining.delete(id);
        progressed = true;
      }
    }
  }
  if (remaining.size > 0) return null; // cycle

  const levels: string[][] = [];
  for (const n of nodes) {
    const lvl = level.get(n.id)!;
    (levels[lvl] ??= []).push(n.id);
  }
  return levels;
}
