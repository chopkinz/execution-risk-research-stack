import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function POST(request: Request) {
  const payload = (await request.json()) as { ticker?: string; range?: string; context?: string };

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({
      ok: true,
      source: "heuristic",
      text: `${payload.ticker ?? "Ticker"} is shown over ${payload.range ?? "selected"} range. AI insight is disabled until OPENAI_API_KEY is configured.`
    });
  }

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system:
      "You are a neutral market assistant. Return concise, factual commentary with no hype or financial advice. Keep output under 80 words.",
    prompt: `Ticker: ${payload.ticker}. Range: ${payload.range}. Context: ${payload.context ?? "No context provided."}`
  });

  return result.toDataStreamResponse();
}
