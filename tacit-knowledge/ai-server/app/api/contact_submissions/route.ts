import { NextRequest, NextResponse } from "next/server";
import pg from "pg";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company_name, email, interested_services, service_ids } = body;

    if (!company_name || !email || !interested_services || !service_ids) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // DATABASE_URLが設定されている場合のみDB保存
    if (process.env.DATABASE_URL) {
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      try {
        const result = await client.query(
          `INSERT INTO contact_submissions (company_name, email, interested_services, service_ids, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING id`,
          [company_name, email, JSON.stringify(interested_services), JSON.stringify(service_ids)]
        );
        return NextResponse.json(
          { id: result.rows[0].id, message: "Contact submission saved successfully" },
          { status: 201 }
        );
      } finally {
        await client.end();
      }
    }

    // DB未設定の場合はログのみ
    console.log("[Contact] Submission (no DB):", { company_name, email, interested_services, service_ids });
    return NextResponse.json(
      { message: "Contact submission received (no DB configured)" },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[Contact] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save submission" },
      { status: 500 }
    );
  }
}
