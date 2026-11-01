export type TrimNode = { id: string; parent_node_id: string | null; variation_name: string | null };

/** Delete only the continuation on the selected path and its descendants, never sibling branches. */
export function continuationToRemove<T extends TrimNode>(nodes: T[], path: string[], keepCount: number): T[] {
  if (!Number.isInteger(keepCount) || keepCount < 0 || keepCount > path.length) throw new Error("Choose a valid move first.");
  const firstRemoved = path[keepCount];
  if (!firstRemoved) return [];
  if (!nodes.some(node => node.id === firstRemoved)) throw new Error("The saved continuation could not be found.");
  const removed = new Set([firstRemoved]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parent_node_id && removed.has(node.parent_node_id) && !removed.has(node.id)) {
        removed.add(node.id);
        changed = true;
      }
    }
  }
  return nodes.filter(node => removed.has(node.id));
}
