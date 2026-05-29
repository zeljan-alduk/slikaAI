# slikaAI

> _slika_ — Croatian for "picture / photo._

The ultimate web tool for AI photo recovery & editing. Upload a photo, describe
the change in plain words, and let **FLUX Kontext** (via [fal.ai](https://fal.ai))
transform or restore it. Fully bilingual — **English** and **Croatian**.

## Features

- **Whole-image editing** — re-imagine an entire photo from a text prompt
  (restore faded prints, change the time of day, colorize black & white).
- **Brush / mask inpainting** — paint over the exact area you want to change and
  describe the replacement.
- **Before / after compare** — drag-to-reveal slider on every result.
- **Iterative editing** — feed a result back in as the new base.
- **Multilingual** — English & Croatian (`next-intl`), easy to extend.
- **Darkroom UI** — warm, photographer-grade interface.

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19
- [Tailwind CSS v4](https://tailwindcss.com)
- [next-intl](https://next-intl.dev) for i18n
- [@fal-ai/client](https://fal.ai) → FLUX Kontext (edit) + FLUX Fill Pro (inpaint)

## Getting started

```bash
npm install
npm run dev          # runs in free mock mode out of the box (no key needed)
```

Open http://localhost:3000 — you'll be redirected to `/en` (or `/hr`).

To enable real edits, add a key:

```bash
cp .env.example .env.local   # add your FAL_KEY
```

## Providers

Editing runs through a small provider layer (`src/lib/providers`). Pick one with
the `PROVIDER` env var, or let it auto-detect:

| Provider  | Cost            | Where it runs        | Set                                            |
| --------- | --------------- | -------------------- | ---------------------------------------------- |
| `mock`    | free            | in-process (echo)    | nothing — the default with no credentials      |
| `comfyui` | free            | your machine (GPU)   | `COMFYUI_URL` (+ workflow paths)               |
| `fal`     | paid            | fal.ai (hosted)      | `FAL_KEY`                                       |

Auto-detection: `FAL_KEY` → `fal`; else `COMFYUI_URL` → `comfyui`; else `mock`.
`MOCK_EDIT=1` always forces mock.

### Free development — mock mode

With no credentials the app runs in **mock mode**: it echoes the uploaded image
back so the entire UI flow (upload → process → before/after → download →
iterate) works at zero cost.

### Free local edits — ComfyUI + FLUX Kontext dev

> LM Studio runs **text** LLMs and can't do image editing. For local image
> editing use **ComfyUI**, which runs the open-weights **FLUX.1 Kontext [dev]** —
> the same model family as the hosted `fal` provider.

> **Apple Silicon note (important):** fp8 weights (`*_fp8_*.safetensors`) do **not**
> run on the Mac MPS backend — you'll get `Trying to convert Float8_e4m3fn to the
> MPS backend`. Use **GGUF** (recommended — small, fast-ish, MPS-friendly) or full
> **bf16**. The bundled templates are configured for GGUF.

The bundled templates target a **GGUF** setup (Mac-friendly, ungated downloads):

1. Install [ComfyUI](https://github.com/comfyanonymous/ComfyUI) and the
   [ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF) custom node
   (`git clone` into `custom_nodes/`, then `pip install -r requirements.txt` into
   ComfyUI's venv), and restart ComfyUI.
2. Download into `models/`:
   - `unet/flux1-kontext-dev-Q4_K_M.gguf` — [QuantStack/FLUX.1-Kontext-dev-GGUF](https://huggingface.co/QuantStack/FLUX.1-Kontext-dev-GGUF)
   - `text_encoders/t5-v1_1-xxl-encoder-Q5_K_M.gguf` — [city96/t5-v1_1-xxl-encoder-gguf](https://huggingface.co/city96/t5-v1_1-xxl-encoder-gguf)
   - `text_encoders/clip_l.safetensors` — [comfyanonymous/flux_text_encoders](https://huggingface.co/comfyanonymous/flux_text_encoders)
   - `vae/ae.safetensors` — the FLUX VAE (e.g. Comfy-Org's Lumina repackage)
   - For brush/mask inpainting, also grab a **FLUX.1 Fill dev GGUF** into `unet/`.
3. Start ComfyUI and set `.env.local`:
   ```bash
   PROVIDER=comfyui
   COMFYUI_URL=http://127.0.0.1:8000   # the desktop app uses :8000; classic uses :8188
   ```
4. The templates in [`comfyui/`](./comfyui) use four placeholders the server
   injects per request: `__PROMPT__`, `__IMAGE__`, `__MASK__`, `__SEED__`. Adjust
   model filenames to match your install — or export your own workflow from the
   ComfyUI UI with **Save (API Format)**, add the placeholders, and point
   `COMFYUI_EDIT_WORKFLOW` / `COMFYUI_INPAINT_WORKFLOW` at it.

How the provider works: it uploads the image (and mask) via `/upload/image`,
strips annotation keys, injects the placeholders, queues the graph at `/prompt`,
polls `/history/{id}`, then fetches the result from `/view` as a data URL.
`COMFYUI_TIMEOUT_MS` (default 600000) bounds the wait.

**Speed on Apple Silicon.** FLUX Kontext is compute-heavy; expect **minutes per
edit**, not seconds. The edit template trades quality for speed by scaling the
working image to ~0.5 MP (`ImageScaleToTotalPixels`) and sampling 12 steps —
tune `megapixels` / `steps` in [`comfyui/flux-kontext-edit.json`](./comfyui/flux-kontext-edit.json).
A FLUX turbo/hyper LoRA (4–8 steps) speeds things up further.

> **Draw Things** (Mac-native, Apple Silicon) is an easier local alternative —
> wiring it as a fourth provider follows the same pattern.

### Paid / hosted — fal.ai

For free *real* edits without a GPU, Google's **Gemini 2.5 Flash Image**
("Nano Banana") also has a free daily quota and slots in as another provider.

### Environment variables

| Variable            | Required | Default                     | Purpose                              |
| ------------------- | -------- | --------------------------- | ------------------------------------ |
| `FAL_KEY`           | yes      | —                           | fal.ai API key (server-side only)    |
| `FAL_EDIT_MODEL`    | no       | `fal-ai/flux-pro/kontext`   | Whole-image, prompt-based editing    |
| `FAL_INPAINT_MODEL` | no       | `fal-ai/flux-pro/v1/fill`   | Brush / mask inpainting              |

Get a key at https://fal.ai/dashboard/keys. The key is only ever used in the
server-side API route (`src/app/api/edit/route.ts`); it is never exposed to the
browser.

## How it works

1. The browser sends the image (and, for brush mode, a black/white PNG mask
   where **white = the area to change**) to `/api/edit`.
2. The route uploads them to fal storage and calls the configured model.
3. The resulting image URL is returned and shown in the compare slider.

## Adding a language

1. Add the locale to `src/i18n/routing.ts`.
2. Copy `messages/en.json` → `messages/<locale>.json` and translate.

That's it — routing, metadata and the language switcher pick it up automatically.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
