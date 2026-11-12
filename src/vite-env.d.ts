/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  // Who runs this copy of the site (src/shared/site.ts). All optional.
  readonly VITE_OPERATOR_NAME?: string;
  readonly VITE_OPERATOR_ADDRESS?: string;
  readonly VITE_OPERATOR_COUNTRY?: string;
  readonly VITE_OPERATOR_AUTHORITY?: string;
  readonly VITE_OPERATOR_EMAIL?: string;
  readonly VITE_OPERATOR_GITHUB?: string;
  readonly VITE_OPERATOR_LINKEDIN?: string;
}
