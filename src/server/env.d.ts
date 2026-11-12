// The Worker's bindings, as server code sees them. Kept by hand instead of including the
// generated worker-configuration.d.ts, whose Worker globals clash with the browser's DOM types
// in this single TypeScript project. Keep in sync with wrangler.jsonc "vars" and .dev.vars.
declare module "cloudflare:workers" {
  export const env: {
    SUPABASE_URL: string;
    SUPABASE_SECRET_KEY: string;
  };
}
