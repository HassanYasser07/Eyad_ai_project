// Node module-resolution hooks so the real Deno Edge Function source can be imported in tests.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("npm:@supabase/supabase-js")) return { url: "stub:supabase", shortCircuit: true };
  if (specifier.startsWith("jsr:")) return { url: "stub:empty", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "stub:supabase") return { format: "module", shortCircuit: true, source: "export const createClient = (...args) => globalThis.__createClient(...args);" };
  if (url === "stub:empty") return { format: "module", shortCircuit: true, source: "export {};" };
  return nextLoad(url, context);
}
