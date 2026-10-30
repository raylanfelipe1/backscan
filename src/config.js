// Apenas configurações publicáveis podem entrar no bundle do navegador.
export function readPublicConfig(url, key) {
  if (!url && !key) return null;
  try {
    const parsed = new URL(url);
    const protectedProjects = ["wgchpjumclfjwxxxwbgt", "dvjgjhalheveohtcxifc"];
    if (parsed.protocol !== "https:" || parsed.origin !== url ||
        !/^[a-z0-9]{20}\.supabase\.co$/.test(parsed.hostname) ||
        protectedProjects.includes(parsed.hostname.split(".")[0]) ||
        !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key ?? "")) return null;
    return { url, key };
  } catch {
    return null;
  }
}
