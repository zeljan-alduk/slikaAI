# Private AI Photo Repair

**Your photos never leave your device.**

Privacy-first, local AI photo retouching and restoration that runs entirely in
the browser — on phones, tablets, laptops and desktops. The app detects your
device capabilities, picks the best local execution backend (WebGPU → WASM →
mock), downloads a neural model **once**, stores it locally, and processes your
photos on-device. **No images are uploaded to any server.**

> This is an MVP. When no real ONNX models are configured it runs in **mock
> mode**: the full UX, progress, caching and pipeline architecture are real, but
> the image transforms are classic-CV approximations clearly labelled as
> simulated. The architecture is ready to drop in real ONNX models later.

---

## Why it's different

Most AI photo editors upload your images to cloud servers. This app downloads AI
models to your device and runs them locally:

- **Download AI models once.** The first download may be large, but it only
  happens once.
- **Use them repeatedly.** Cached locally in IndexedDB.
- **Delete them whenever you want.** From the Model Manager.
- **Process photos locally.** Heavy work runs in a Web Worker.
- **Keep photos private.** No image upload in this MVP.

---

## Architecture

```
src/
  main.tsx                     # React entry
  app/
    App.tsx                    # Top-level UI composition
    AppState.ts                # useAppController() — all state + actions
  components/                  # Presentational + container components
  core/
    capabilities/              # Device/browser detection, tier + backend choice
    models/                    # Registry, selector, IndexedDB cache + storage, validation
    prompt/                    # Deterministic HR/EN prompt parser + suggestions
    image/                     # Loading, resizing, tiling, export, reference analysis
    inference/                 # Pipeline interface, ONNX skeleton, mock pipelines, tensors
    progress/                  # Progress types, tracker, formatters
    diagnostics/               # Logger + diagnostics snapshot
  workers/
    inference.worker.ts        # Runs the pipeline off the main thread
    workerClient.ts            # Main-thread worker wrapper (transferables)
    workerMessages.ts          # Strongly-typed worker protocol
  styles/global.css
```

**Data flow**

1. `detectCapabilities()` → `computeDeviceTier()` → `selectBackend()`.
2. The prompt is parsed by `parseRetouchPrompt()` into a `RetouchIntent`.
3. `selectModelForTask()` picks a registry entry; `planPipeline()` decides
   real-ONNX vs mock and the backend.
4. If a real model is needed, `modelCache.downloadAndCacheModel()` streams it
   with progress and stores it in IndexedDB.
5. `runInferenceInWorker()` transfers the decoded image (as an `ImageBitmap`) to
   the worker, which runs `runPipeline()` and streams back processing/tile/log
   events plus the final result.
6. The UI shows before/after and lets you export PNG/JPEG/WebP.

---

## Install & run

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build
npm run preview  # preview the production build
```

Requires Node 18+.

> The dev server sets `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`
> headers so multi-threaded WASM (SharedArrayBuffer) is available for
> onnxruntime-web. If you deploy, set the same headers on your host.

---

## How model caching works

- Model **binaries** are stored as `Blob`s in **IndexedDB** (object store
  `model-blobs`), with metadata in `model-meta`. Settings live in `settings`.
- Downloads use `fetch` + `ReadableStream` to report real progress (percentage,
  MB, speed, ETA) and support cancellation via `AbortController`.
- Each run updates `lastUsedAt`. The optional **storage saver** removes models
  unused for N days (default 30).

### Why not `localStorage`?

`localStorage` is synchronous, string-only, and capped at ~5 MB — it cannot hold
multi-MB/GB binary model files and would block the main thread. We use
**IndexedDB** (async, binary `Blob` support, large quota) instead. `localStorage`
is never used for model binaries.

---

## Configuring real model URLs

Copy `.env.example` to `.env` and set any of:

```
VITE_BACKGROUND_REMOVAL_MODEL_URL=
VITE_DENOISE_MODEL_URL=
VITE_ENHANCE_MODEL_URL=
VITE_SUPER_RESOLUTION_MODEL_URL=
VITE_RESTORE_OLD_PHOTO_MODEL_URL=
VITE_REFERENCE_GUIDED_RESTORE_MODEL_URL=
VITE_ENABLE_MOCK_MODE=true
```

- Leave a URL blank → that task stays in **mock mode**.
- Provide a URL → the app downloads/caches it and attempts real ONNX inference
  through `OnnxImagePipeline`.
- The model file must be a valid ONNX served with CORS enabled. Optionally set
  `hashSha256` on the registry entry to enforce integrity validation.

---

## Adding a new model

1. Add a `ModelRegistryEntry` to `src/core/models/modelRegistry.ts` (id, name,
   `task`, `estimatedSizeMb`, `expectedInputSize`, `minimumTier`,
   `preferredBackend`, `supportsTiling`, `supportsReferenceImages`,
   `mockAvailable`, and a `modelUrl` sourced from an env var).
2. If the model needs special pre/post-processing, set a `TensorSpec` via
   `OnnxImagePipeline.setTensorSpec()` (or add a model-specific adapter).

## Adding a new task

1. Add the value to `RetouchTask` in `src/core/models/types.ts`.
2. Add keywords to `TASK_RULES` in
   `src/core/prompt/parseRetouchPrompt.ts` (Croatian + English).
3. Add a step template to `TASK_STEPS` in
   `src/core/progress/progressUtils.ts`.
4. Add a branch in `runPipeline()` (`ImageInferencePipeline.ts`) and a mock
   processor in `MockPipelines.ts`.
5. Optionally add suggestion chips in `promptSuggestions.ts` and a registry
   entry.

---

## How mock mode works

Mock pipelines (`MockPipelines.ts`) implement each task with classic image
processing on the worker's `OffscreenCanvas`:

- **background-removal** — feathered elliptical alpha → transparent PNG.
- **enhance** — brightness/contrast/saturation + unsharp mask.
- **denoise** — edge-preserving box-blur blend.
- **super-resolution** — tiled high-quality canvas upscale (real per-tile
  progress).
- **restore-old-photo** — auto-levels, gentle denoise, warm rebalance.
- **reference-guided-restore** — analyses references (quality/face heuristics)
  and applies restoration. **It never performs face-swapping** and clearly
  labels results as simulated.
- **generative-edit** — applies a deterministic creative grade (enhanced
  contrast/saturation + warm cinematic tone + soft vignette). It **cannot add
  or replace content** and is always labelled as a simulation; real generative
  editing needs the local WebGPU model or the opt-in cloud engine (see below).

Every mock result is labelled “generated in mock mode”.

---

## Hybrid generative editing

“Describe any edit” (the **generative-edit** task) needs a diffusion-class
model. There is no small generative editor that runs well in a phone browser,
so this task is deliberately **hybrid**, and you choose the engine per edit:

| Engine | Privacy | Runs on | Configure |
| --- | --- | --- | --- |
| **On-device** | 100% private — image never leaves the device | WebGPU-capable machines | `VITE_GENERATIVE_EDIT_MODEL_URL` (ONNX). Blank → clearly-labelled simulation. |
| **Cloud (opt-in)** | Image **leaves the device** | Any device, incl. phones | `VITE_CLOUD_EDIT_ENDPOINT` (default contract = this repo's `/api/edit`, FLUX Kontext). |

How it works:

- `selectGenerativeEngine()` (`core/generative/engineSelector.ts`) is a pure,
  deterministic function that picks **local** vs **cloud** from the device
  capabilities, the user's preference (Auto / On-device / Cloud) and consent.
  In **Auto** it prefers a real on-device model, then a consented cloud
  endpoint, then the on-device simulation.
- The **cloud engine is strictly opt-in**: it is only reachable after the user
  ticks an explicit consent checkbox acknowledging that the image is uploaded.
  Without a configured endpoint *and* consent, the cloud engine is unavailable.
- The on-device engine runs through the normal Web Worker pipeline; the cloud
  engine runs on the main thread (`core/generative/cloudEditClient.ts`) because
  it uploads the image. Both produce the same before/after result, and the
  result is tagged with its **engine** and **privacy** posture in the UI.

---

## Honesty notes

- Mock results are simulated and clearly marked. They are **not** production AI.
- Real ONNX inference is often a single black-box call, so the pipeline shows
  **pipeline-level** progress (and real **tile-level** progress where tiling is
  used) rather than fake per-layer progress.
- Reference-guided restoration is for **restoring the same person** using better
  references — not replacing identities. Identity-preserving restoration
  requires a real compatible model.
- Generative editing is the **one** task that can send your image off-device,
  and only via the **opt-in cloud engine** after explicit consent. The default
  (and the on-device path) keeps everything local; the cloud result is clearly
  labelled “left your device”.

---

## Browser support

- **Best:** Chromium-based browsers with WebGPU + cross-origin isolation.
- **Good:** Any modern browser with WASM + IndexedDB (slower).
- **Mock mode:** works wherever Canvas + Web Workers + IndexedDB exist.
- Detected as **unsupported** only if Web Workers, WASM, and storage APIs are
  all missing.

---

## Limitations

- Ships with mock pipelines only; real model weights are not bundled.
- The ONNX skeleton uses a generic tensor spec — most real models need a
  model-specific adapter.
- Face detection/embedding in references is a heuristic placeholder.
- Very large images are resized to a per-tier working size before processing.

## Future improvements

Real ONNX background removal (e.g. U²-Net / MODNet), Real-ESRGAN / SwinIR
super-resolution, GFPGAN/CodeFormer face restoration, real face
detection/alignment/embedding, identity-preserving restoration, WebNN backend,
PWA offline mode, model versioning/update, batch processing, local history,
"AI-restored" watermarking, and manual brush mask editing.
