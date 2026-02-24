import { NextResponse } from "next/server";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

export async function POST(req: Request) {
  if (!PEXELS_API_KEY) {
    return NextResponse.json({ error: "Missing PEXELS_API_KEY" }, { status: 500 });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "1");

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: PEXELS_API_KEY,
      },
      // Use a short timeout via AbortController to avoid hanging
      next: { revalidate: 0 },
    });

    if (!resp.ok) {
      return NextResponse.json({ error: `Pexels error ${resp.status}` }, { status: 502 });
    }

    const data = await resp.json();
    const photo = data?.photos?.[0];
    const imageUrl = photo?.src?.medium || photo?.src?.large || photo?.src?.original || null;

    return NextResponse.json({ imageUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}
