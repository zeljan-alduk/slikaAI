import type { InferenceBackend } from "../capabilities/types";
import type { ModelLoadProgress, ModelLoadStatus, ModelRegistryEntry } from "../models/types";
import {
  imageDataToFloatTensor,
  tensorToImageData,
  resizeToModelInput,
  DEFAULT_TENSOR_SPEC,
  type TensorSpec,
} from "./tensorUtils";

// Phase-based percentages used when ONNX cannot report fine-grained progress.
const PHASE_PERCENT: Record<ModelLoadStatus, number | null> = {
  idle: 0,
  "loading-model-file": 15,
  "initializing-runtime": 30,
  "selecting-backend": 45,
  "creating-session": 70,
  "warming-up": 90,
  ready: 100,
  failed: null,
};

type OrtModule = typeof import("onnxruntime-web");
type OrtSession = import("onnxruntime-web").InferenceSession;

/**
 * Real ONNX Runtime Web pipeline skeleton. It is fully wired but only runs when
 * a real model blob is supplied; otherwise the worker uses the mock pipelines.
 *
 * Model-specific preprocessing/postprocessing differs per architecture, so the
 * tensor spec is kept pluggable via setTensorSpec(). For unknown models a
 * generic 0-1 normalised RGB pass is used.
 */
export class OnnxImagePipeline {
  private ort: OrtModule | null = null;
  private session: OrtSession | null = null;
  private backend: InferenceBackend = "wasm";
  private inputName: string | null = null;
  private outputName: string | null = null;
  private tensorSpec: TensorSpec = DEFAULT_TENSOR_SPEC;

  setTensorSpec(spec: TensorSpec): void {
    this.tensorSpec = spec;
  }

  private report(
    onProgress: ((p: ModelLoadProgress) => void) | undefined,
    modelId: string,
    status: ModelLoadStatus,
    message: string,
  ): void {
    onProgress?.({
      modelId,
      status,
      percentage: PHASE_PERCENT[status],
      message,
      backend: this.backend,
    });
  }

  async loadModel(options: {
    model: ModelRegistryEntry;
    backend: InferenceBackend;
    modelBlob: Blob;
    signal?: AbortSignal;
    onProgress?: (p: ModelLoadProgress) => void;
  }): Promise<void> {
    const { model, backend, modelBlob, signal, onProgress } = options;
    this.backend = backend;

    this.report(onProgress, model.id, "loading-model-file", "Loading model file from local storage…");
    const buffer = new Uint8Array(await modelBlob.arrayBuffer());
    if (signal?.aborted) throw new Error("Model load cancelled.");

    this.report(onProgress, model.id, "initializing-runtime", "Initializing ONNX Runtime…");
    this.ort = await import("onnxruntime-web");

    this.report(
      onProgress,
      model.id,
      "selecting-backend",
      backend === "webgpu" ? "Selecting WebGPU backend…" : "Selecting WASM backend…",
    );
    const executionProviders =
      backend === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];

    this.report(onProgress, model.id, "creating-session", "Creating inference session…");
    this.session = await this.ort.InferenceSession.create(buffer, {
      executionProviders,
      graphOptimizationLevel: "all",
    });
    this.inputName = this.session.inputNames[0] ?? null;
    this.outputName = this.session.outputNames[0] ?? null;
    if (!this.inputName || !this.outputName) {
      throw new Error("ONNX model does not expose the expected input/output names.");
    }

    this.report(onProgress, model.id, "warming-up", "Warming up model…");
    await this.warmUp(model);

    this.report(onProgress, model.id, "ready", "Model ready.");
  }

  private async warmUp(model: ModelRegistryEntry): Promise<void> {
    if (!this.ort || !this.session || !this.inputName || !this.outputName) return;
    const { width, height } = model.expectedInputSize;
    const dummy = new ImageData(width, height);
    const tensor = imageDataToFloatTensor(dummy, this.tensorSpec);
    const feeds: Record<string, import("onnxruntime-web").Tensor> = {
      [this.inputName]: new this.ort.Tensor("float32", tensor.data, tensor.dims),
    };
    await this.session.run(feeds);
  }

  /**
   * Run inference on an ImageData, resizing to the model's expected input and
   * scaling the output back to the original dimensions.
   */
  async runImage(input: ImageData, model: ModelRegistryEntry): Promise<ImageData> {
    if (!this.ort || !this.session || !this.inputName || !this.outputName) {
      throw new Error("ONNX session is not loaded.");
    }
    const { width, height } = model.expectedInputSize;
    const resized = resizeToModelInput(input, width, height);
    const tensor = imageDataToFloatTensor(resized, this.tensorSpec);
    const feeds: Record<string, import("onnxruntime-web").Tensor> = {
      [this.inputName]: new this.ort.Tensor("float32", tensor.data, tensor.dims),
    };
    const results = await this.session.run(feeds);
    const output = results[this.outputName];
    if (!output || !(output.data instanceof Float32Array)) {
      throw new Error("ONNX model returned an unexpected output type.");
    }
    const dims = output.dims as number[];
    // Infer output spatial size from dims (supports NCHW and NHWC).
    const { outWidth, outHeight, layout } = inferSpatialDims(dims, width, height);
    return tensorToImageData(
      { data: output.data, dims, layout },
      outWidth,
      outHeight,
      this.tensorSpec,
    );
  }

  async unloadModel(): Promise<void> {
    if (this.session) {
      await this.session.release().catch(() => undefined);
      this.session = null;
    }
    this.inputName = null;
    this.outputName = null;
  }

  isLoaded(): boolean {
    return this.session !== null;
  }
}

function inferSpatialDims(
  dims: number[],
  fallbackW: number,
  fallbackH: number,
): { outWidth: number; outHeight: number; layout: "nchw" | "nhwc" } {
  if (dims.length === 4) {
    // NCHW: [1, C, H, W]; NHWC: [1, H, W, C]
    const isNchw = dims[1]! <= 4 && dims[3]! > 4;
    if (isNchw) {
      return { outWidth: dims[3]!, outHeight: dims[2]!, layout: "nchw" };
    }
    return { outWidth: dims[2]!, outHeight: dims[1]!, layout: "nhwc" };
  }
  return { outWidth: fallbackW, outHeight: fallbackH, layout: "nchw" };
}
