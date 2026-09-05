import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export function loadConfig() {
  const file = process.env.BLINDSPOT_ENV_FILE || resolve(repoRoot, '.env.local');
  try { loadEnvFile(file); } catch { /* Optional until a provider action is requested. */ }
  const first = (...names: string[]) => names.map(n => process.env[n]).find(Boolean) || '';
  return {
    worldKey: first('WORLD_LABS_API_KEY', 'WORLDLABS_API_KEY', 'WLT_API_KEY'),
    deployKey: first('CONVEX_DEPLOY_KEY'),
    convexUrl: first('VITE_CONVEX_URL', 'CONVEX_URL') || 'https://standing-pony-711.convex.cloud',
    publicOrigin: first('VITE_PUBLIC_APP_ORIGIN'),
    modelKey: first('MODEL_API_KEY'), modelBaseUrl: first('MODEL_BASE_URL'), modelId: first('MODEL_ID'),
    port: Number(first('PROVIDER_PORT') || 8788),
    operatorOrigin: first('BLINDSPOT_OPERATOR_ORIGIN') || 'http://localhost:5173',
    cacheDir: resolve(repoRoot, '.local/provider'),
  };
}
export type Config = ReturnType<typeof loadConfig>;
export function configured(c: Config) {
  return { marble: !!c.worldKey, mintAsset: true, convex: !!c.deployKey, model: !!(c.modelKey && c.modelBaseUrl && c.modelId) };
}
