/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Convex Cloud client URL (public). Consumed by B's runtime, not by UI components. */
  readonly VITE_CONVEX_URL?: string;
  /** Deployed HTTPS origin for share links. Unset => sharing disabled with setup message. */
  readonly VITE_PUBLIC_APP_ORIGIN?: string;
  /** "false" on the public deployment: authoring shows read-only guidance. */
  readonly VITE_AUTHORING_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
