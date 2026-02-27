import { fetchMarketData, isMarketRange } from "../../../lib/market";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const rangeParam = (searchParams.get("range") || "6m").toLowerCase();
  const range = isMarketRange(rangeParam) ? rangeParam : "6m";

  try {
    const payload = await fetchMarketData(symbol, range);
    return Response.json(payload, {
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=1200"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return Response.json({ error: message }, { status: 503 });
  }
}
