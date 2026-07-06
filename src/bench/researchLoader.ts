export interface ResearchTask {
  sampleId: string;
  prompt: string;
  rubricCount: number;
}

export interface PilotManifest {
  dataset: string;
  seed: number;
  count: number;
  items: { sampleId: string; rubricCount: number }[];
}

/**
 * Copy of the swe-judge-bench loader's PRNG; that branch is parked.
 * Mulberry32 — a simple seeded PRNG returning a function that yields [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Parse rows from JSON pages.
 * Each page is JSON with structure: { rows: { row: { sample_id, prompt, rubrics[] } }[] }
 * Skips rows missing sample_id or prompt.
 * Returns ResearchTask[] with rubricCount = rubrics.length
 */
export function parseRowsPages(pages: string[]): ResearchTask[] {
  const tasks: ResearchTask[] = [];

  for (const pageStr of pages) {
    const pageData = JSON.parse(pageStr) as { rows: { row: unknown }[] };
    for (const { row } of pageData.rows) {
      const r = row as Record<string, unknown>;
      const sample_id = r.sample_id as string | undefined;
      const prompt = r.prompt as string | undefined;
      const rubrics = r.rubrics as unknown[] | undefined;

      // Skip rows missing sample_id or prompt
      if (!sample_id || !prompt) continue;

      tasks.push({
        sampleId: sample_id,
        prompt,
        rubricCount: rubrics?.length ?? 0,
      });
    }
  }

  return tasks;
}

/**
 * Sample tasks using Fisher-Yates shuffle with a seeded PRNG.
 * If `exclude` is given, tasks whose sampleId is in the set are filtered out
 * BEFORE sorting/shuffling (deterministic given tasks-minus-exclude, count,
 * seed) — this is how the held-out manifest guarantees disjointness from the
 * in-set manifest.
 * Sorts tasks by sampleId first, then shuffles using mulberry32, then slices to count.
 */
export function sampleTasks(
  tasks: ResearchTask[],
  count: number,
  seed: number,
  exclude?: Set<string>
): ResearchTask[] {
  const pool = exclude ? tasks.filter((t) => !exclude.has(t.sampleId)) : tasks;

  // Sort by sampleId
  const sorted = [...pool].sort((a, b) => a.sampleId.localeCompare(b.sampleId));

  // Fisher-Yates shuffle with seeded PRNG
  const rng = mulberry32(seed);
  for (let i = sorted.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  }

  // Slice to count (capped at array length)
  return sorted.slice(0, count);
}

/**
 * Build pilot manifest from sampled tasks.
 */
export function buildPilotManifest(
  tasks: ResearchTask[],
  seed: number
): PilotManifest {
  return {
    dataset: "ScaleAI/researchrubrics",
    seed,
    count: tasks.length,
    items: tasks.map((t) => ({
      sampleId: t.sampleId,
      rubricCount: t.rubricCount,
    })),
  };
}
