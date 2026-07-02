export interface BlackboardEntry {
  agentId: string;
  subtask: string;
  notes: string; // free-prose nuance for downstream agents
  result: string; // the deliverable
}

/**
 * Shared workspace. Content travels at full fidelity — the dependency graph
 * schedules execution, but it does not filter what agents can read.
 */
export class Blackboard {
  private entries: BlackboardEntry[] = [];

  add(entry: BlackboardEntry): void {
    this.entries.push(entry);
  }

  all(): BlackboardEntry[] {
    return [...this.entries];
  }

  render(): string {
    if (this.entries.length === 0) return "(no prior agent output yet)";
    return this.entries
      .map((e) =>
        [`### ${e.agentId} — ${e.subtask}`, `**Result:**`, e.result, `**Notes:**`, e.notes].join("\n")
      )
      .join("\n\n");
  }
}
