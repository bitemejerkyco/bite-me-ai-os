import OpenAI from "openai";

type RunTextAgentInput = {
  name: string;
  instructions: string;
  input: string;
};

export async function runTextAgent({ name, instructions, input }: RunTextAgentInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing from .env.local.");

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    instructions: `${instructions}\n\nYou are the ${name} inside LaunchAI. Return polished markdown only.`,
    input,
  });

  const text = response.output_text?.trim();
  if (!text) throw new Error(`${name} returned an empty response.`);
  return text;
}
