import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot, type Config } from './config';
import { Providers, ProviderError, atomicJson, digest, type Job } from './providers';
import type { World } from '../../../shared/contracts';

export async function restoreDemo(c:Config){
  const directory=join(repoRoot,'public/demo'),world:World=JSON.parse(await readFile(join(directory,'world.json'),'utf8'));
  const job:Job=JSON.parse(await readFile(join(directory,'marble-job.json'),'utf8')),providers=new Providers(c);
  for(const name of new Set([world.splat.id,world.collider.id,world.sourcePhotoUrl.split('/').pop()!])){
    if(!/^[a-f0-9]{64}\.(spz|glb|jpg)$/.test(name))throw new ProviderError('BUNDLE','Unexpected bundled asset name.');
    const bytes=await readFile(join(directory,name));if(digest(bytes)!==name.split('.')[0])throw new ProviderError('BUNDLE_HASH','Bundled asset checksum mismatch.');
    await providers.storeBytes(bytes,name);
  }
  try{await providers.get(job.id);}catch(e){if(!(e instanceof ProviderError)||e.code!=='JOB_NOT_FOUND')throw e;await atomicJson(join(c.cacheDir,'jobs',`${job.id}.json`),job);}
  try{await readFile(join(c.cacheDir,'marble-demo.json'));}catch{await atomicJson(join(c.cacheDir,'marble-demo.json'),world);}
  return {worldId:world.id,restored:true,paidRequests:0};
}
