import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { AssetRef, World, HazardLibraryItem } from '../../../shared/contracts';
import type { Config } from './config';

export class ProviderError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
const MARBLE = 'https://api.worldlabs.ai/marble/v1';
const TRIPO = 'https://openapi.tripo3d.ai/v3';
export const FALLBACK_PROMPT = 'An empty realistic industrial warehouse aisle, flat level concrete floor, tall shelves only along the far sides, open clear central corridor at least 12 meters long and 5 meters wide, diffuse daylight, eye level view straight down the aisle. No people, no vehicles, no stairs. Architectural photo.';
export const BULK_PROMPT = 'A single low industrial orange plastic equipment crate, closed lid, rectangular solid shape, scuffed opaque plastic, centered isolated object, no cables, no text, game ready low polygon warehouse prop.';
export const digest = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
export const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export interface Job {
  id: string; provider: 'marble' | 'tripo'; status: 'submitting' | 'running' | 'completed' | 'failed';
  requestHash: string; providerTaskId?: string; sourceAssetId?: string; createdAt: string; model: string;
  error?: { code: string; message: string }; result?: World | HazardLibraryItem;
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
  const u = new URL(value);
  const allowed = ['storage.googleapis.com', 'worldlabs.ai', 'tripo3d.ai'];
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') ||
    !allowed.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
    throw new ProviderError('ASSET_HOST', `Unapproved provider asset host: ${u.hostname}`, 502);
  }
  return u;
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
  headers(p: Job['provider']): Record<string, string> {
    const key = p === 'marble' ? this.config.worldKey : this.config.tripoKey;
    if (!key) throw new ProviderError('MISSING_KEY', `${p} is not configured.`, 503);
    return p === 'marble' ? { 'WLT-Api-Key': key } : { Authorization: `Bearer ${key}` };
  }
  async preflight() {
    const out: Record<string, unknown> = {};
    for (const provider of ['marble', 'tripo'] as const) {
      try {
        const d = await requestJson(provider === 'marble' ? `${MARBLE}/credits` : `${TRIPO}/account/balance`, this.headers(provider));
        out[provider] = { status: 'authorized', creditsAvailable: Number(provider === 'marble' ? d.remaining_credits : d.data?.balance) > 0 };
      } catch (e) { out[provider] = { status: e instanceof ProviderError ? e.code : 'unreachable' }; }
    }
    return out;
  }
  async get(id: string): Promise<Job> {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new ProviderError('JOB_ID', 'Invalid job ID.', 404);
    try { return JSON.parse(await readFile(join(this.config.cacheDir, 'jobs', `${id}.json`), 'utf8')) as Job; }
    catch { throw new ProviderError('JOB_NOT_FOUND', 'Cached job not found.', 404); }
  }
  private save(job: Job) { return atomicJson(join(this.config.cacheDir, 'jobs', `${job.id}.json`), job); }
  async cacheResult(job:Job) {
    if(!job.result)return;
    const file=join(this.config.cacheDir,`${job.provider}-demo.json`);
    if(job.provider==='marble'){
      try{const existing:World=JSON.parse(await readFile(file,'utf8')),result=job.result as World;
        if(existing.id===result.id&&existing.splat.sha256===result.splat.sha256&&existing.collider.sha256===result.collider.sha256&&existing.calibration.status==='verified')return;
      }catch{/* No inspected cache yet. */}
    }
    await atomicJson(file,job.result);
  }
  async start(provider: Job['provider'], prompt: string, photo?: { bytes: Buffer; extension: string }): Promise<Job> {
    if (!prompt.trim() || prompt.length > 1024) throw new ProviderError('PROMPT', 'Use a prompt between 1 and 1024 characters.');
    const model = provider === 'marble' ? 'marble-1.1' : 'v3.1-20260211';
    const normalized = prompt.trim().replace(/\s+/g, ' ');
    const id = digest(JSON.stringify({ provider, model, prompt: normalized, image: photo ? digest(photo.bytes) : null }));
    return this.serialized(async () => {
      try { return await this.get(id); } catch (e) { if (!(e instanceof ProviderError) || e.code !== 'JOB_NOT_FOUND') throw e; }
      this.headers(provider);
      const ledgerFile = join(this.config.cacheDir, 'generation-budget.json');
      let used: string[] = []; try { used = JSON.parse(await readFile(ledgerFile, 'utf8')); } catch { /* First run. */ }
      if (used.length >= 4) throw new ProviderError('BUDGET', 'The four-generation local demo budget is exhausted. Cached jobs remain available.', 429);
      const job: Job = { id, requestHash: id, provider, model, status: 'submitting', createdAt: new Date().toISOString() };
      await this.save(job);
      await atomicJson(ledgerFile, [...used, id]);
      try {
        let data: Json;
        if (provider === 'marble') {
          let worldPrompt: unknown = { type: 'text', text_prompt: normalized };
          if (photo) {
            if (!['jpg', 'jpeg', 'png', 'webp'].includes(photo.extension) || photo.bytes.length > 10 * 1024 * 1024) throw new ProviderError('PHOTO', 'Use a JPEG, PNG or WebP smaller than 10 MB.');
            const upload = await requestJson(`${MARBLE}/media-assets:prepare_upload`, this.headers(provider), { file_name: `source.${photo.extension}`, kind: 'image', extension: photo.extension });
            const target = safeAssetUrl(upload.upload_info?.upload_url);
            const res = await fetch(target, { method: 'PUT', headers: upload.upload_info.required_headers || {}, body: new Uint8Array(photo.bytes), redirect: 'error', signal: AbortSignal.timeout(60000) });
            if (!res.ok) throw new ProviderError('UPLOAD', 'World input upload failed.', 502);
            worldPrompt = { type: 'image', text_prompt: normalized, image_prompt: { source: 'media_asset', media_asset_id: upload.media_asset.id } };
            await this.storeBytes(photo.bytes, `source-${id}.${photo.extension}`);
            job.sourceAssetId = `source-${id}.${photo.extension}`;
          }
          data = await requestJson(`${MARBLE}/worlds:generate`, this.headers(provider), { display_name: photo ? 'Blindspot photo world' : 'Text-generated fallback warehouse', model, world_prompt: worldPrompt });
          job.providerTaskId = data.operation_id;
        } else {
          data = await requestJson(`${TRIPO}/generation/text-to-model`, this.headers(provider), { prompt: normalized, model, face_limit: 10000, texture: true, pbr: true, texture_quality: 'standard', model_seed: 20260905, image_seed: 20260905, texture_seed: 20260905 });
          job.providerTaskId = data.data?.task_id;
        }
        if (typeof job.providerTaskId !== 'string') throw new ProviderError('TASK_ID', 'Provider response omitted its task identifier. Check provider history before any new submission.', 502);
        job.status = 'running';
      } catch (e) {
        job.status = 'failed'; job.error = { code: e instanceof ProviderError ? e.code : 'PROVIDER', message: e instanceof ProviderError ? e.message : 'Provider request failed. Inspect account history before resubmitting.' };
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
    const r = await fetch(parsed, { redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!r.ok || !r.body) throw new ProviderError('DOWNLOAD', `Asset download returned HTTP ${r.status}.`, 502);
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > 128 * 1024 * 1024) { await r.body.cancel().catch(() => {}); throw new ProviderError('ASSET_SIZE', 'Export exceeds the 128 MB asset budget.', 502); }
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
      const d = await requestJson(job.provider === 'marble' ? `${MARBLE}/operations/${task}` : `${TRIPO}/tasks/${task}`, this.headers(job.provider));
      if (job.provider === 'marble') {
        if (!d.done) return job;
        if (d.error) { job.status = 'failed'; job.error = { code: 'GENERATION', message: 'Marble generation failed.' }; }
        else {
          const raw = d.response?.world || d.response;
          const a = raw?.assets; const meta = a?.splats?.semantics_metadata;
          if (!a || !Number.isFinite(meta?.metric_scale_factor) || meta.metric_scale_factor <= 0 || !Number.isFinite(meta?.ground_plane_offset)) throw new ProviderError('METRIC_METADATA', 'Marble export lacks valid metric scale metadata.', 502);
          const splat = await this.download(a.splats.spz_urls['100k'] || a.splats.spz_urls['500k'], 'marble', job.providerTaskId, job.model, 'spz');
          const collider = await this.download(a.mesh?.collider_mesh_url, 'marble', job.providerTaskId, job.model, 'glb');
          const photo = await this.download(a.thumbnail_url || a.imagery?.pano_url, 'marble', job.providerTaskId, job.model, 'jpg');
          const s = meta.metric_scale_factor, g = meta.ground_plane_offset;
          const worldId = raw.world_id || raw.id || d.metadata?.world_id;
          if (typeof worldId !== 'string') throw new ProviderError('WORLD_ID', 'Marble export omitted its world identifier.', 502);
          job.result = { id: worldId, version: 1, name: job.sourceAssetId ? 'Photo-generated world' : 'Text-generated fallback warehouse', sourcePhotoUrl: job.sourceAssetId ? `/api/local/assets/${job.sourceAssetId}` : photo.url, splat, collider,
            cached: true, preparationMs: Date.now() - Date.parse(job.createdAt),
            calibration: { status: 'unverified', source: 'provider_metric', rawMetricScaleFactor: s, rawGroundPlaneOffset: g,
              splatToWorld: [s,0,0,0,0,-s,0,0,0,0,-s,0,0,g,0,1], colliderToWorld: [s,0,0,0,0,-s,0,0,0,0,-s,0,0,g,0,1], correctionFactor: 1,
              uncertaintyNote: `${job.sourceAssetId ? 'World reconstructed from operator-supplied imagery.' : 'Text-generated fallback; preview is generated imagery, not a site photograph.'} Collider frame and floor registration require visual verification with a ruler before evaluation.` } };
          job.status = 'completed';
        }
      } else {
        const data = d.data;
        if (['failed', 'cancelled'].includes(data?.status)) { job.status = 'failed'; job.error = { code: 'GENERATION', message: 'Tripo generation failed or was cancelled.' }; }
        else if (data?.status === 'success') {
          const asset = await this.download(data.output?.model_url, 'tripo', job.providerTaskId, job.model, 'glb');
          job.result = { id: 'tripo-crate', version: 1, name: 'Tripo equipment crate', type: 'bulk', asset,
            dimensionsM: [0.7, 0.55, 0.6], dimensionEvidence: 'assumed', materialClass: 'opaque',
            returnAssumption: 'Generated visual normalized into an authored 0.7 x 0.55 x 0.6 m collision box. Opaque return is assumed.' };
          job.status = 'completed';
        }
      }
      await this.save(job); return job;
    });
  }
}
