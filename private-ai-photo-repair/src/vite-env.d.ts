/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKGROUND_REMOVAL_MODEL_URL?: string;
  readonly VITE_DENOISE_MODEL_URL?: string;
  readonly VITE_ENHANCE_MODEL_URL?: string;
  readonly VITE_SUPER_RESOLUTION_MODEL_URL?: string;
  readonly VITE_RESTORE_OLD_PHOTO_MODEL_URL?: string;
  readonly VITE_REFERENCE_GUIDED_RESTORE_MODEL_URL?: string;
  readonly VITE_ENABLE_MOCK_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
