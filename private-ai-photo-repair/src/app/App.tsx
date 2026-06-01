import { useAppController } from "./AppState";
import { Header } from "../components/Header";
import { PrivacyExplainer } from "../components/PrivacyExplainer";
import { DeviceCapabilityCard } from "../components/DeviceCapabilityCard";
import { ImageUploader } from "../components/ImageUploader";
import { ReferenceImageUploader } from "../components/ReferenceImageUploader";
import { PromptBox } from "../components/PromptBox";
import { SuggestedCommandChips } from "../components/SuggestedCommandChips";
import { ModelRequirementCard } from "../components/ModelRequirementCard";
import { DownloadProgressCard } from "../components/DownloadProgressCard";
import { ModelLoadProgressCard } from "../components/ModelLoadProgressCard";
import { ProcessingTimeline } from "../components/ProcessingTimeline";
import { TileProgressCard } from "../components/TileProgressCard";
import { BeforeAfterPreview } from "../components/BeforeAfterPreview";
import { ExportPanel } from "../components/ExportPanel";
import { ModelManager } from "../components/ModelManager";
import { DiagnosticsPanel } from "../components/DiagnosticsPanel";
import { ErrorBanner } from "../components/ErrorBanner";

export function App(): JSX.Element {
  const c = useAppController();

  const freeStorageBytes =
    c.capabilities?.storageQuotaBytes != null
      ? c.capabilities.storageQuotaBytes - (c.capabilities.storageUsageBytes ?? 0)
      : null;

  const taskRecognised = !!c.intent && c.intent.task !== "unknown" && !!c.selection?.model;
  const needsDownload =
    !!c.plan && !c.plan.useMock && !c.selectedModelCached;
  const canStart =
    !!c.mainImage && taskRecognised && !needsDownload && !c.isBusy && c.tier !== "unsupported";

  const startHint = (() => {
    if (!c.mainImage) return "Upload a main photo to begin.";
    if (!taskRecognised) return "Enter or pick a command so the task can be recognised.";
    if (needsDownload) return "Download the required model before processing.";
    if (c.tier === "unsupported") return "This device does not support local AI processing.";
    return c.plan?.useMock
      ? "Ready. This task will run in mock mode (simulated)."
      : "Ready to process locally.";
  })();

  return (
    <div className="app-shell">
      <Header />
      <ErrorBanner message={c.error} onDismiss={c.dismissError} />
      <PrivacyExplainer />

      <DeviceCapabilityCard
        capabilities={c.capabilities}
        tier={c.tier}
        backend={c.backend}
        maxWorkingSize={c.maxWorkingSize}
      />

      <ImageUploader
        asset={c.mainImage}
        onFile={(f) => void c.setMainImageFile(f)}
        onRemove={c.removeMainImage}
        disabled={c.isBusy}
        maxWorkingSize={c.maxWorkingSize}
      />

      <ReferenceImageUploader
        references={c.referenceImages}
        onAdd={(f) => void c.addReferenceFile(f)}
        onRemove={c.removeReference}
        onTypeChange={c.setReferenceType}
        disabled={c.isBusy}
      />

      <PromptBox value={c.prompt} onChange={c.setPrompt} intent={c.intent} disabled={c.isBusy} />

      <SuggestedCommandChips
        onSelect={(cmd) => c.setPrompt(cmd.prompt)}
        disabled={c.isBusy}
      />

      <ModelRequirementCard
        model={c.selection?.model ?? null}
        plan={c.plan}
        cached={c.selectedModelCached}
        freeStorageBytes={freeStorageBytes}
        onDownload={() => void c.downloadModel()}
        disabled={c.isBusy}
      />

      <DownloadProgressCard progress={c.downloadProgress} onCancel={c.cancelDownload} />
      <ModelLoadProgressCard progress={c.modelLoadProgress} />

      <section className="card">
        <h2>Process</h2>
        <p className="muted">{startHint}</p>
        <div className="row" style={{ marginTop: 8 }}>
          <button
            className="primary"
            onClick={() => void c.startProcessing()}
            disabled={!canStart}
          >
            {c.phase === "processing" ? "Processing…" : "Start"}
          </button>
          {c.phase === "processing" && (
            <button className="danger" onClick={c.cancelProcessing}>
              Cancel
            </button>
          )}
        </div>
      </section>

      <ProcessingTimeline progress={c.processingProgress} onCancel={c.cancelProcessing} />
      <TileProgressCard progress={c.tileProgress} active={c.phase === "processing"} />

      <BeforeAfterPreview beforeAsset={c.mainImage} result={c.result} />
      <ExportPanel result={c.result} onExport={(fmt) => void c.exportResult(fmt)} />

      <ModelManager
        cachedModels={c.cachedModels}
        settings={c.settings}
        onDelete={(id) => void c.deleteModel(id)}
        onRedownload={(m) => void c.redownloadModel(m)}
        onRefresh={() => void c.refreshCachedModels()}
        onDeleteAll={() => void c.deleteAllModels()}
        onToggleSaver={(v) => void c.setStorageSaver(v)}
        onSetSaverDays={(d) => void c.setStorageSaverDays(d)}
        disabled={c.isBusy}
      />

      <DiagnosticsPanel
        capabilities={c.capabilities}
        tier={c.tier}
        backend={c.backend}
        mainImage={c.mainImage}
        referenceCount={c.referenceImages.length}
        selectedModel={c.selection?.model ?? null}
        selectedModelCached={c.selectedModelCached}
        cachedModels={c.cachedModels}
        downloadProgress={c.downloadProgress}
        modelLoadProgress={c.modelLoadProgress}
        processingProgress={c.processingProgress}
        tileProgress={c.tileProgress}
        logs={c.logs}
      />

      <footer className="muted" style={{ textAlign: "center", paddingTop: 8 }}>
        Private AI Photo Repair · All processing happens locally · No image upload
      </footer>
    </div>
  );
}
