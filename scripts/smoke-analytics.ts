import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const { buildAnalyticsDashboard } = await import("../src/lib/analytics");
  const { getPool } = await import("../src/lib/db");
  const d = await buildAnalyticsDashboard({
    sessionUnitCode: "bo",
    hierarchyLevel: "bo",
    year: 2026,
  });
  console.log(
    JSON.stringify(
      {
        overview: d.overview,
        years: d.recruitmentStatsByYear,
        defer: d.defermentReasons,
        quotas: d.quotas.length,
        funnel: d.funnel,
        corrSample: d.correlations.sampleSize,
      },
      null,
      2
    )
  );
  await getPool().end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
