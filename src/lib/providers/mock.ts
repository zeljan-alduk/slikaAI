import type { EditInput, EditOutput } from "./types";

// Free, key-less dev provider: echoes the uploaded image back as a data URL
// after a short delay so the whole UI flow can be exercised without any backend.
export async function runMock(input: EditInput): Promise<EditOutput> {
  const buf = Buffer.from(await input.image.arrayBuffer());
  const type = input.image.type || "image/png";
  await new Promise((r) => setTimeout(r, 900));
  return { imageUrl: `data:${type};base64,${buf.toString("base64")}` };
}
