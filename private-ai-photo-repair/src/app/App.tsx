import { useAppController } from "./AppState";
import { Header } from "../components/Header";
import { PrivacyExplainer } from "../components/PrivacyExplainer";
import { DeviceCapabilityCard } from "../components/DeviceCapabilityCard";
import { ImageUploader } from "../components/ImageUploader";
import { ReferenceImageUploader } from "../components/ReferenceImageUploader";
import { PromptBox } from "../components/PromptBox";
import { SuggestedCommandChips } from "../components/SuggestedCommandChips";
import { ModelRequirementCard } from "../components/ModelRequirementCard";
import { ModelSetupCard } from "../components/ModelSetupCard";
import { DownloadProgressCard } from "../components/DownloadProgressCard";
import { ModelLoadProgressCard } from "../components/ModelLoadProgressCard";
import { ProcessingTimeline } from "../components/ProcessingTimeline";
import { TileProgressCard } from "../components/TileProgressCard";
import { BeforeAfterPreview } from "../components/BeforeAfterPreview";
import { ExportPanel } from "../components/ExportPanel";
import { ModelManager } from "../components/ModelManager";
import { DiagnosticsPanel } from "../components/DiagnosticsPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { useI18n } from "../i18n/i18n";

export function App(): JSX.Element {
  const c = useAppController();
  const { t } = useI18n();

  const freeStorageBytes =
    c.capabilities?.storageQuotaBytes != null
      ? c.capabilities.storageQuotaBytes - (c.capabilities.storageUsageBytes ?? 0)
      : null;

  const engine = c.plan?.engine ?? null;
  const taskRecognised = !!c.intent && c.intent.task !== "unknown" && !!c.selection?.model;
  // Only raw-ONNX models must be pre-downloaded; Transformers.js fetches on use.
  const needsDownload = !!c.plan && engine === "onnx" && !c.selectedModelCached;
  const canStart =
    !!c.mainImage && taskRecognised && !needsDownload && !c.isBusy && c.tier !== "unsupported";

  const startHint = (() => {
    if (!c.mainImage) return t("process.hint.upload");
    if (!taskRecognised) return t("process.hint.recognise");
    if (c.tier === "unsupported") return t("process.hint.unsupported");
    if (needsDownload) return t("process.hint.download");
    if (c.plan?.useMock) return t("process.hint.readyMock");
    if (engine === "transformers") return t("process.hint.readyFirstUse");
    return t("process.hint.ready");
  })();

  // Gentle warning when a required real model isn't downloaded yet.
  const modelWarning = (() => {
    if (!c.plan || !c.selection?.model || !taskRecognised) return null;
    if (engine === "onnx" && !c.selectedModelCached) return t("process.modelWarnOnnx");
    if (engine === "transformers" && !c.result && c.phase !== "processing") {
      return t("process.modelWarn", { size: `${c.selection.model.estimatedSizeMb} MB` });
    }
    return null;
  })();

  return (
    <div className="app-shell">
      <Header />
      <ErrorBanner message={c.error} onDismiss={c.dismissError} />

      {/* The image is the focus: uploader and result preview lead the page. */}
      <ImageUploader
        asset={c.mainImage}
        onFile={(f) => void c.setMainImageFile(f)}
        onRemove={c.removeMainImage}
        disabled={c.isBusy}
        maxWorkingSize={c.maxWorkingSize}
      />

      <BeforeAfterPreview beforeAsset={c.mainImage} result={c.result} />
      <ExportPanel result={c.result} onExport={(fmt) => void c.exportResult(fmt)} />

      <PromptBox value={c.prompt} onChange={c.setPrompt} intent={c.intent} disabled={c.isBusy} />

      <SuggestedCommandChips
        onSelect={(cmd) => c.setPrompt(cmd.prompt)}
        disabled={c.isBusy}
      />

      <section className="card">
        <h2>{t("process.title")}</h2>
        <p className="muted">{startHint}</p>
        {modelWarning && (
          <p className="muted" style={{ color: "var(--warn)", marginTop: 4 }}>
            {modelWarning}
          </p>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <button
            className="primary"
            onClick={() => void c.startProcessing()}
            disabled={!canStart}
          >
            {c.phase === "processing" ? t("process.processing") : t("process.start")}
          </button>
          {c.phase === "processing" && (
            <button className="danger" onClick={c.cancelProcessing}>
              {t("process.cancel")}
            </button>
          )}
        </div>
      </section>

      <ProcessingTimeline progress={c.processingProgress} onCancel={c.cancelProcessing} />
      <TileProgressCard progress={c.tileProgress} active={c.phase === "processing"} />

      <ReferenceImageUploader
        references={c.referenceImages}
        onAdd={(f) => void c.addReferenceFile(f)}
        onRemove={c.removeReference}
        onTypeChange={c.setReferenceType}
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

      {!c.startupDownloading && (
        <DownloadProgressCard progress={c.downloadProgress} onCancel={c.cancelDownload} />
      )}
      <ModelLoadProgressCard progress={c.modelLoadProgress} />

      {c.showModelSetup && (
        <ModelSetupCard
          models={c.eligibleStartupModels}
          freeStorageBytes={freeStorageBytes}
          downloading={c.startupDownloading}
          progress={c.downloadProgress}
          queue={c.startupQueue}
          onDownload={(ids) => void c.startModelSetup(ids)}
          onCancel={c.cancelModelSetup}
          onDismiss={(dontAsk) => void c.dismissModelSetup(dontAsk)}
        />
      )}

      <PrivacyExplainer />

      <DeviceCapabilityCard
        capabilities={c.capabilities}
        tier={c.tier}
        backend={c.backend}
        maxWorkingSize={c.maxWorkingSize}
      />

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
        {t("footer")}
      </footer>
    </div>
  );
}
