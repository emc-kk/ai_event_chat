import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/services/database-service";

const JOB_MAP: Record<string, string> = {
  // P0
  jepx_spot: "fuji-jepx-spot-current",
  jepx_spot_prev: "fuji-jepx-spot-previous",
  nonfossil_fit: "fuji-nonfossil-fit",
  nonfossil_nonfit: "fuji-nonfossil-nonfit",
  renewable_surcharge: "fuji-renewable-surcharge",
  // P1
  jepx_forward: "fuji-jepx-forward",
  nonfossil_trends: "fuji-nonfossil-trends",
  carbon_credit: "fuji-carbon-credit",
  jcredit_price: "fuji-jcredit-price",
  // P2
  electricity_rate: "fuji-electricity-rate",
  grid_vacancy: "fuji-grid-vacancy",
  balancing_market: "fuji-balancing-market",
};

interface RecordRow {
  data: Record<string, unknown>;
  fetched_at: string;
}

interface JobStatusRow {
  status: string;
  updated_at: string | null;
}

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source");
  const days = parseInt(req.nextUrl.searchParams.get("days") || "90", 10);

  if (!source) {
    return NextResponse.json(
      { error: "Missing 'source' parameter" },
      { status: 400 }
    );
  }

  const jobId = JOB_MAP[source];
  if (!jobId) {
    return NextResponse.json(
      { error: `Unknown source: ${source}` },
      { status: 400 }
    );
  }

  try {
    const rows = await query<RecordRow>(
      `SELECT data, fetched_at
       FROM data_acquisition_records
       WHERE job_id = $1
         AND fetched_at > NOW() - INTERVAL '1 day' * $2
       ORDER BY fetched_at DESC
       LIMIT 5000`,
      [jobId, days]
    );

    const jobStatus = await query<JobStatusRow>(
      `SELECT dj.status, djr.completed_at as updated_at
       FROM data_acquisition_jobs dj
       LEFT JOIN data_acquisition_job_runs djr ON djr.job_id = dj.id
       WHERE dj.id = $1
       ORDER BY djr.completed_at DESC NULLS LAST
       LIMIT 1`,
      [jobId]
    );

    return NextResponse.json({
      source,
      records: rows.map((r) => ({ ...r.data, fetched_at: r.fetched_at })),
      meta: {
        count: rows.length,
        job_status: jobStatus[0]?.status || "unknown",
        last_updated: jobStatus[0]?.updated_at || null,
      },
    });
  } catch (err) {
    // DB接続失敗時は空レスポンス（フロントがサンプルデータにフォールバック）
    console.error("[fuji-electric/data] DB query failed:", err);
    return NextResponse.json({
      source,
      records: [],
      meta: { count: 0, job_status: "error", last_updated: null },
    });
  }
}
