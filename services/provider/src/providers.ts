import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { AssetRef, World } from '../../../shared/contracts';
import type { Config } from './config';

export class ProviderError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
const MARBLE = 'https://api.worldlabs.ai/marble/v1';
export const FALLBACK_PROMPT = 'An empty realistic industrial warehouse aisle, flat level concrete floor, tall shelves only along the far sides, open clear central corridor at least 12 meters long and 5 meters wide, diffuse daylight, eye level view straight down the aisle. No people, no vehicles, no stairs. Architectural photo.';
export const digest = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
export const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export interface Job {
  id: string; provider: 'marble'; status: 'submitting' | 'running' | 'completed' | 'failed';
  requestHash: string; providerTaskId?: string; sourceAssetId?: string; createdAt: string; model: string;
  error?: { code: string; message: string }; result?: World;
}
type Json = Record<string, any>;
export async function requestJson(url: string, headers: Record<string, string>, body?: unknown): Promise<Json> {
  let r: Response;
  try { r = await fetch(url, { headers: { ...headers, 'Content-Type': 'application/json' },
    method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error', signal: AbortSignal.timeout(30000) }); }
  catch { throw new ProviderError('NETWORK', 'Provider request interrupted. Accepted work must be resumed, never automatically resubmitted.', 502); }
  if (!r.ok) throw new ProviderError(`HTTP_${r.status}`, `Provider returned HTTP ${r.status}.`, 502);
  const data = await r.json().catch(() => { throw new ProviderError('RESPONSE', 'Provider returned invalid JSON.', 502); }) as Json;
  if (typeof data.code === 'number' && data.code !== 0) throw new ProviderError(`PROVIDER_${data.code}`, 'Provider rejected this request. Check account access and credits.', 502);
  return data;
}
export function safeAssetUrl(value: unknown): URL {
  if (typeof value !== 'string') throw new ProviderError('EXPORT', 'Required provider export is absent.', 502);
  const url = new URL(value);
  const allowed = ['storage.googleapis.com', 'worldlabs.ai'];
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
    !allowed.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new ProviderError('ASSET_HOST', `Unapproved provider asset host: ${url.hostname}`, 502);
  }
  return url;
}
export async function atomicJson(file: string, data: unknown) {
  await mkdir(join(file, '..'), { recursive: true, mode: 0o700 });
  await writeFile(`${file}.tmp`, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(`${file}.tmp`, file);
}
export class Providers {
  constructor(readonly config: Config) {}
  private lock = Promise.resolve();
  private async serialized<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.lock; let release!: () => void;
    this.lock = new Promise(resolve => { release = resolve; });
    await previous; try { return await fn(); } finally { release(); }
  }
  headers(): Record<string, string> {
    if (!this.config.worldKey) throw new ProviderError('MISSING_KEY', 'marble is not configured.', 503);
    return { 'WLT-Api-Key': this.config.worldKey };
  }
  async preflight() {
    try {
      const data = await requestJson(`${MARBLE}/credits`, this.headers());
      return { marble: { status: 'authorized', creditsAvailable: Number(data.remaining_credits) > 0 }, mintAsset: { status: 'cached' } };
    } catch (error) {
      return { marble: { status: error instanceof ProviderError ? error.code : 'unreachable' }, mintAsset: { status: 'cached' } };
    }
  }
  async get(id: string): Promise<Job> {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new ProviderError('JOB_ID', 'Invalid job ID.', 404);
    try { return JSON.parse(await readFile(join(this.config.cacheDir, 'jobs', `${id}.json`), 'utf8')) as Job; }
    catch { throw new ProviderError('JOB_NOT_FOUND', 'Cached job not found.', 404); }
  }
  private save(job: Job) { return atomicJson(join(this.config.cacheDir, 'jobs', `${job.id}.json`), job); }
  async cacheResult(job: Job) {
    if (!job.result) return;
    const file = join(this.config.cacheDir, 'marble-demo.json');
    try {
      const existing: World = JSON.parse(await readFile(file, 'utf8'));
      const result = job.result;
      if (existing.id === result.id && existing.splat.sha256 === result.splat.sha256 && existing.collider.sha256 === result.collider.sha256 && existing.calibration.status === 'verified') return;
    } catch { /* No inspected cache yet. */ }
    await atomicJson(file, job.result);
  }
  async start(provider: Job['provider'], prompt: string, photo?: { bytes: Buffer; extension: string }): Promise<Job> {
    if (!prompt.trim() || prompt.length > 1024) throw new ProviderError('PROMPT', 'Use a prompt between 1 and 1024 characters.');
    const model = 'marble-1.1';
    const normalized = prompt.trim().replace(/\s+/g, ' ');
    const id = digest(JSON.stringify({ provider, model, prompt: normalized, image: photo ? digest(photo.bytes) : null }));
    return this.serialized(async () => {
      try { return await this.get(id); } catch (error) { if (!(error instanceof ProviderError) || error.code !== 'JOB_NOT_FOUND') throw error; }
      this.headers();
      const ledgerFile = join(this.config.cacheDir, 'generation-budget.json');
      let used: string[] = []; try { used = JSON.parse(await readFile(ledgerFile, 'utf8')); } catch { /* First run. */ }
      if (used.length >= 4) throw new ProviderError('BUDGET', 'The four-generation local demo budget is exhausted. Cached jobs remain available.', 429);
      const job: Job = { id, requestHash: id, provider, model, status: 'submitting', createdAt: new Date().toISOString() };
      await this.save(job);
      await atomicJson(ledgerFile, [...used, id]);
      try {
        let worldPrompt: unknown = { type: 'text', text_prompt: normalized };
        if (photo) {
          if (!['jpg', 'jpeg', 'png', 'webp'].includes(photo.extension) || photo.bytes.length > 10 * 1024 * 1024) throw new ProviderError('PHOTO', 'Use a JPEG, PNG or WebP smaller than 10 MB.');
          const upload = await requestJson(`${MARBLE}/media-assets:prepare_upload`, this.headers(), { file_name: `source.${photo.extension}`, kind: 'image', extension: photo.extension });
          const target = safeAssetUrl(upload.upload_info?.upload_url);
          const response = await fetch(target, { method: 'PUT', headers: upload.upload_info.required_headers || {}, body: new Uint8Array(photo.bytes), redirect: 'error', signal: AbortSignal.timeout(60000) });
          if (!response.ok) throw new ProviderError('UPLOAD', 'World input upload failed.', 502);
          worldPrompt = { type: 'image', text_prompt: normalized, image_prompt: { source: 'media_asset', media_asset_id: upload.media_asset.id } };
          await this.storeBytes(photo.bytes, `source-${id}.${photo.extension}`);
          job.sourceAssetId = `source-${id}.${photo.extension}`;
        }
        const data = await requestJson(`${MARBLE}/worlds:generate`, this.headers(), { display_name: photo ? 'Blindspot photo world' : 'Text-generated fallback warehouse', model, world_prompt: worldPrompt });
        job.providerTaskId = data.operation_id;
        if (typeof job.providerTaskId !== 'string') throw new ProviderError('TASK_ID', 'Provider response omitted its task identifier. Check provider history before any new submission.', 502);
        job.status = 'running';
      } catch (error) {
        job.status = 'failed'; job.error = { code: error instanceof ProviderError ? error.code : 'PROVIDER', message: error instanceof ProviderError ? error.message : 'Provider request failed. Inspect account history before resubmitting.' };
      }
      await this.save(job); return job;
    });
  }
  async storeBytes(bytes: Buffer, name: string) {
    await mkdir(join(this.config.cacheDir, 'assets'), { recursive: true, mode: 0o700 });
    await writeFile(join(this.config.cacheDir, 'assets', name), bytes, { mode: 0o600 });
    return { name, sha256: digest(bytes) };
  }
  async download(url: unknown, source: AssetRef['source'], taskId: string, model: string, extension: string): Promise<AssetRef> {
    const parsed = safeAssetUrl(url);
    const response = await fetch(parsed, { redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new ProviderError('DOWNLOAD', `Asset download returned HTTP ${response.status}.`, 502);
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > 128 * 1024 * 1024) { await response.body.cancel().catch(() => {}); throw new ProviderError('ASSET_SIZE', 'Export exceeds the 128 MB asset budget.', 502); }
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks); const sha256 = digest(bytes); const name = `${sha256}.${extension}`;
    if (extension === 'glb' && bytes.toString('ascii', 0, 4) !== 'glTF') throw new ProviderError('ASSET_FORMAT', 'Expected a GLB model export.', 502);
    await this.storeBytes(bytes, name);
    return { id: name, source, url: `/api/local/assets/${name}`, sha256, providerTaskId: taskId, providerModelId: model, createdAt: new Date().toISOString() };
  }
  async poll(id: string): Promise<Job> {
    return this.serialized(async () => {
      const job = await this.get(id);
      if (job.status !== 'running' || !job.providerTaskId) return job;
      const task = encodeURIComponent(job.providerTaskId);
      const data = await requestJson(`${MARBLE}/operations/${task}`, this.headers());
      if (!data.done) return job;
      if (data.error) { job.status = 'failed'; job.error = { code: 'GENERATION', message: 'Marble generation failed.' }; }
      else {
        const raw = data.response?.world || data.response;
        const assets = raw?.assets; const meta = assets?.splats?.semantics_metadata;
        if (!assets || !Number.isFinite(meta?.metric_scale_factor) || meta.metric_scale_factor <= 0 || !Number.isFinite(meta?.ground_plane_offset)) throw new ProviderError('METRIC_METADATA', 'Marble export lacks valid metric scale metadata.', 502);
        const splat = await this.download(assets.splats.spz_urls['100k'] || assets.splats.spz_urls['500k'], 'marble', job.providerTaskId, job.model, 'spz');
        const collider = await this.download(assets.mesh?.collider_mesh_url, 'marble', job.providerTaskId, job.model, 'glb');
        const photo = await this.download(assets.thumbnail_url || assets.imagery?.pano_url, 'marble', job.providerTaskId, job.model, 'jpg');
        const scale = meta.metric_scale_factor, ground = meta.ground_plane_offset;
        const worldId = raw.world_id || raw.id || data.metadata?.world_id;
        if (typeof worldId !== 'string') throw new ProviderError('WORLD_ID', 'Marble export omitted its world identifier.', 502);
        job.result = { id: worldId, version: 1, name: job.sourceAssetId ? 'Photo-generated world' : 'Text-generated fallback warehouse', sourcePhotoUrl: job.sourceAssetId ? `/api/local/assets/${job.sourceAssetId}` : photo.url, splat, collider,
          cached: true, preparationMs: Date.now() - Date.parse(job.createdAt),
          calibration: { status: 'unverified', source: 'provider_metric', rawMetricScaleFactor: scale, rawGroundPlaneOffset: ground,
            splatToWorld: [scale,0,0,0,0,-scale,0,0,0,0,-scale,0,0,ground,0,1], colliderToWorld: [scale,0,0,0,0,-scale,0,0,0,0,-scale,0,0,ground,0,1], correctionFactor: 1,
            uncertaintyNote: `${job.sourceAssetId ? 'World reconstructed from operator-supplied imagery.' : 'Text-generated fallback; preview is generated imagery, not a site photograph.'} Collider frame and floor registration require visual verification with a ruler before evaluation.` } };
        job.status = 'completed';
      }
      await this.save(job); return job;
    });
  }
}
