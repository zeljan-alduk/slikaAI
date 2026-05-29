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

1. Install [ComfyUI](https://github.com/comfyanonymous/ComfyUI) and download the
   FLUX.1 Kontext dev models (UNet, `clip_l`, `t5xxl`, `ae` VAE) into the matching
   `models/` folders. For brush/mask inpainting, also grab **FLUX.1 Fill dev**.
2. Start ComfyUI (defaults to `http://127.0.0.1:8188`).
3. In `.env.local`:
   ```bash
   PROVIDER=comfyui
   COMFYUI_URL=http://127.0.0.1:8188
   ```
4. The bundled workflow templates live in [`comfyui/`](./comfyui). They use four
   placeholders the server injects per request: `__PROMPT__`, `__IMAGE__`,
   `__MASK__`, `__SEED__`. **Edit the model filenames** in those files to match
   your install — or build a workflow in the ComfyUI UI, export it with
   **Save (API Format)**, drop in the four placeholders, and point
   `COMFYUI_EDIT_WORKFLOW` / `COMFYUI_INPAINT_WORKFLOW` at it.

How the ComfyUI provider works: it uploads the image (and mask) via
`/upload/image`, injects the placeholders, queues the graph at `/prompt`, polls
`/history/{id}`, then fetches the result from `/view` and returns it as a data URL.

> On Apple Silicon, **Draw Things** is an easier local alternative — wiring it as
> a fourth provider is straightforward following the same pattern.

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
