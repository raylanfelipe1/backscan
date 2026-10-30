import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readPublicConfig } from "../src/config.js";

test("configuração pública aceita apenas projeto dedicado e chave publicável", () => {
  const url = "https://abcdefghijklmnopqrst.supabase.co";
  const key = "sb_publishable_fixture";
  assert.deepEqual(readPublicConfig(url, key), { url, key });
  assert.equal(readPublicConfig(), null);
  for (const bad of ["sb_secret_fixture", "eyJhbGciOiJIUzI1NiJ9.fixture.signature", "", undefined]) {
    assert.equal(readPublicConfig(url, bad), null);
  }
  for (const bad of ["http://abcdefghijklmnopqrst.supabase.co", `${url}/path`, `${url}/`,
    "https://wgchpjumclfjwxxxwbgt.supabase.co", "https://dvjgjhalheveohtcxifc.supabase.co",
    "https://example.com", undefined]) {
    assert.equal(readPublicConfig(bad, key), null);
  }
});

test("build interrompe configurações inseguras antes de gerar o bundle", () => {
  for (const vars of [
    { VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_do_not_bundle" },
    { VITE_SUPABASE_URL: "https://wgchpjumclfjwxxxwbgt.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture" },
    { VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "" }
  ]) {
    const result = spawnSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], {
      cwd: new URL("..", import.meta.url), env: { ...process.env, ...vars }, encoding: "utf8"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Configuração Supabase inválida/);
    assert.ok(!result.stderr.includes("sb_secret_do_not_bundle"));
  }
});
