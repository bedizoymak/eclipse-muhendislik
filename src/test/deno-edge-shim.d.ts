// Phase 13.4: src/test/schema_guard.test.ts imports pure functions from the
// Deno Edge Function source (supabase/functions/parasut-sync/*.ts) to unit
// test them under Vitest/Node. Those source files reference Deno-only
// globals (`Deno.env`, `Deno.serve`) and a `jsr:` specifier that only Deno's
// own resolver understands -- neither exists under the frontend's
// tsconfig.app.json (Node/browser lib, bundler resolution). Per Phase 13.4
// instructions, the frontend `tsc` must not attempt to actually type-check
// Deno sources in the wrong runtime context; the Edge Function's REAL type
// safety is verified separately with `deno check` (see
// reports/PHASE_13_4_FINAL_SOURCE_BOUNDARY_AND_UI_REPORT.md section 7).
// This file only silences the "wrong context" resolution noise for the
// frontend compiler graph -- it has zero effect on the actual Deno runtime
// or the `deno check` run, which does not read this file.
declare module "jsr:@supabase/supabase-js@2" {
  /* eslint-disable @typescript-eslint/no-explicit-any -- this shim only
     exists to let the frontend tsc graph resolve an import chain it will
     never execute (see file header); the real Edge Function types come
     from Deno's own `deno check`, not from this file. */
  export type SupabaseClient = any;
  export function createClient(...args: unknown[]): any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};
