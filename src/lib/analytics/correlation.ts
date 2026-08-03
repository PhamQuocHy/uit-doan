/** Pearson correlation matrix for numeric feature columns */
export function pearsonMatrix(
  rows: Record<string, number | null>[],
  labels: string[]
): { matrix: number[][]; sampleSize: number } {
  const n = labels.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));

  const cols = labels.map((label) =>
    rows.map((r) => {
      const v = r[label];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    })
  );

  let sampleSize = 0;

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let k = 0; k < rows.length; k++) {
        const x = cols[i][k];
        const y = cols[j][k];
        if (x !== null && y !== null) {
          xs.push(x);
          ys.push(y);
        }
      }
      sampleSize = Math.max(sampleSize, xs.length);
      const corr = pearson(xs, ys);
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return { matrix, sampleSize };
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return 0;
  return Math.round((num / den) * 1000) / 1000;
}

export function medicalGradeToOrdinal(grade: string | null): number | null {
  if (!grade) return null;
  const m = grade.match(/(\d)/);
  return m ? Number(m[1]) : null;
}
