/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional build-time overrides for src/appConfig.ts (public values only). */
  readonly VITE_CHAIN_ID?: string
  readonly VITE_SPLITSTREAM_ADDRESS?: string
  readonly VITE_DEPLOY_BLOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
