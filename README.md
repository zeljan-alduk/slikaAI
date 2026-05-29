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
cp .env.example .env.local   # add your FAL_KEY
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/en` (or `/hr`).

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
