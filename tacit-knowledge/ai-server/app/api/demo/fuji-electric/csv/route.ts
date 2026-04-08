import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/services/database-service";
import sampleData from "@/data/demo/fuji-electric-sample.json";

const JOB_MAP: Record<string, string> = {
  jepx_spot: "fuji-jepx-spot-current",
  nonfossil_fit: "fuji-nonfossil-fit",
  nonfossil_nonfit: "fuji-nonfossil-nonfit",
  renewable_surcharge: "fuji-renewable-surcharge",
  jepx_forward: "fuji-jepx-forward",
  carbon_credit: "fuji-carbon-credit",
  jcredit_price: "fuji-jcredit-price",
  electricity_rate: "fuji-electricity-rate",
  balancing_market: "fuji-balancing-market",
};

const SOURCE_LABELS: Record<string, string> = {
  jepx_spot: "JEPXスポット市場",
  nonfossil_fit: "非化石証書_FIT",
  nonfossil_nonfit: "非化石証書_非FIT",
  renewable_surcharge: "再エネ賦課金",
  jepx_forward: "先渡市場",
  carbon_credit: "カーボンクレジット",
  jcredit_price: "Jクレジット",
  electricity_rate: "電気料金",
  balancing_market: "需給調整市場",
};

interface RecordRow {
  data: Record<string, unknown>;
}

function toCsv(records: Record<string, unknown>[]): string {
  if (records.length === 0) return "";

  const headers = Object.keys(records[0]);
  const lines: string[] = [headers.join(",")];

  for (const record of records) {
    const values = headers.map((h) => {
      const v = record[h];
      if (v === null || v === undefined) return "";
      const s = String(v);
      // CSV escape: quote if contains comma, quote, or newline
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source");

  if (!source || !JOB_MAP[source]) {
    return NextResponse.json(
      { error: "Invalid or missing 'source' parameter" },
      { status: 400 },
    );
  }

  let records: Record<string, unknown>[] = [];

  // Try DB first
  try {
    const rows = await query<RecordRow>(
      `SELECT data FROM data_acquisition_records
       WHERE job_id = $1
       ORDER BY fetched_at DESC
       LIMIT 10000`,
      [JOB_MAP[source]],
    );
    if (rows.length > 0) {
      records = rows.map((r) => r.data);
    }
  } catch {
    // DB not available
  }

  // Fallback to sample data
  if (records.length === 0) {
    const sample = sampleData[source as keyof typeof sampleData];
    if (sample) {
      records = sample.records as Record<string, unknown>[];
    }
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "No data available" }, { status: 404 });
  }

  const csv = toCsv(records);
  const label = SOURCE_LABELS[source] ?? source;
  const filename = `${label}_${new Date().toISOString().slice(0, 10)}.csv`;

  // BOM + UTF-8 for Excel compatibility
  const bom = "\uFEFF";
  const body = bom + csv;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
