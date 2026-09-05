import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import type { HazardLibraryItem, World } from '../../../shared/contracts';
import { AUTHORED_BULK_HAZARD, createScenario, cableLibrary } from '../../../src/engine/scenario';
import { createSensorConfig } from '../../../src/engine/presets';
import { nextSnapshot } from '../../../src/engine/versions';
import { repoRoot, type Config } from './config';
import { atomicJson, digest, ProviderError } from './providers';

export async function runConvex(c:Config,args:string[]) {
  if(!c.deployKey||!c.deployKey.startsWith('dev:standing-pony-711|'))throw new ProviderError('CONVEX_TARGET','The supplied credential must target the standing-pony-711 dev deployment.');
  const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,CI:'1',CONVEX_DEPLOY_KEY:c.deployKey,CONVEX_DEPLOYMENT:'dev:standing-pony-711'};
  const output=await new Promise<string>((resolve,reject)=>{const child=spawn(process.execPath,[join(repoRoot,'node_modules/convex/bin/main.js'),...args],{cwd:repoRoot,env,stdio:['ignore','pipe','pipe']});let text='';
    child.stdout.on('data',chunk=>{text+=chunk;});child.stderr.on('data',chunk=>{text+=chunk;});child.on('error',()=>reject(new ProviderError('CONVEX_CLI','Convex CLI could not start.')));
    child.on('exit',code=>{for(const value of [c.deployKey,c.worldKey,c.modelKey])if(value)text=text.split(value).join('[redacted]');if(code===0)resolve(text);else reject(new ProviderError('CONVEX_CLI',text.slice(-5000),502));});});
  return output;
}
export async function seedDemo(c:Config) {
  let world:World,bulk:HazardLibraryItem=AUTHORED_BULK_HAZARD;
  try{world=JSON.parse(await readFile(join(c.cacheDir,'marble-demo.json'),'utf8'));}catch{throw new ProviderError('CACHE','Prepare the Marble world first.');}
  if(world.calibration.status!=='verified')throw new ProviderError('CALIBRATION','Inspect the 3D floor, ruler and axes, then confirm calibration in the local engine harness.');
  const file=join(c.cacheDir,'bootstrap.json');let bootstrap:{sessionId:string;ownerToken:string;controllerToken:string;ready?:boolean};
  try{const saved=JSON.parse(await readFile(file,'utf8'));bootstrap={sessionId:saved.sessionId,ownerToken:saved.ownerToken,controllerToken:saved.controllerToken,ready:saved.ready};}
  catch{bootstrap={sessionId:randomUUID(),ownerToken:randomBytes(32).toString('base64url'),controllerToken:randomBytes(32).toString('base64url')};await atomicJson(file,bootstrap);}
  const refreshing=bootstrap.ready===true;
  const initial=createScenario(world,bulk);const library=[...cableLibrary(),bulk];
  await runConvex(c,['run','seed:bootstrap',JSON.stringify({sessionId:bootstrap.sessionId,ownerCapabilityHash:digest(bootstrap.ownerToken),controllerCapabilityHash:digest(bootstrap.controllerToken),world,library,scenario:initial,baselineConfig:createSensorConfig('baseline')})]);
  const client=new ConvexHttpClient(c.convexUrl),auth={sessionId:bootstrap.sessionId,token:bootstrap.ownerToken};
  const mutation=(name:string,args:unknown)=>client.mutation(makeFunctionReference<'mutation'>(name),JSON.parse(JSON.stringify(args)));
  const query=(name:string,args:unknown)=>client.query(makeFunctionReference<'query'>(name),JSON.parse(JSON.stringify(args)));
  const existing=await query('sessions:getPublic',{sessionId:bootstrap.sessionId});
  const uploaded=new Map<string,string>();
  const mapFile=join(c.cacheDir,'uploaded-assets.json');try{for(const [k,v] of Object.entries(JSON.parse(await readFile(mapFile,'utf8'))))uploaded.set(k,String(v));}catch{}
  async function durable(url:string){if(url.startsWith('https://'))return url;if(uploaded.has(url))return uploaded.get(url)!;
    const name=url.split('/').pop()!;if(!/^(?:source-)?[a-f0-9]{64}\.(spz|glb|jpg|jpeg|png|webp)$/.test(name))throw new ProviderError('ASSET_ID','Unknown local report asset.');
    const bytes=await readFile(join(c.cacheDir,'assets',name));
    await new Promise(resolve=>setTimeout(resolve,1100));
    const {uploadUrl}=await mutation('assets:generateUploadUrl',auth);
    const response=await fetch(uploadUrl,{method:'POST',headers:{'Content-Type':name.endsWith('.glb')?'model/gltf-binary':/\.jpe?g$/.test(name)?'image/jpeg':name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'application/octet-stream'},body:new Uint8Array(bytes),signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw new ProviderError('STORAGE_UPLOAD',`Durable upload returned HTTP ${response.status}.`);
    const {storageId}=await response.json() as {storageId:string};const saved=await mutation('assets:completeUpload',{...auth,storageId,sha256:digest(bytes)});
    uploaded.set(url,saved.url);await atomicJson(mapFile,Object.fromEntries(uploaded));return saved.url as string;
  }
  world=nextSnapshot({...world,sourcePhotoUrl:await durable(world.sourcePhotoUrl),splat:{...world.splat,url:await durable(world.splat.url)},collider:{...world.collider,url:await durable(world.collider.url)}},await query('worlds:latest',{...auth,worldId:world.id}));
  const currentLibrary=await query('library:list',{sessionId:bootstrap.sessionId}) as HazardLibraryItem[];
  if(bulk.asset)bulk={...bulk,asset:{...bulk.asset,url:await durable(bulk.asset.url)}};
  bulk=nextSnapshot(bulk,currentLibrary.find((item:HazardLibraryItem)=>item.id===bulk.id)??null);
  await mutation('worlds:ingest',{...auth,world,inputHash:digest(`durable:${world.id}`)});
  await mutation('library:ingest',{...auth,item:bulk,requestHash:digest(`authored:${bulk.id}`)});
  const preparedScenario=createScenario(world,bulk,initial.sentence);
  const localVisual=preparedScenario.platform.visualAsset;
  const visualAsset=localVisual?{...localVisual,url:await durable(localVisual.url),...(localVisual.thumbnailUrl?{thumbnailUrl:await durable(localVisual.thumbnailUrl)}:{})}:undefined;
  const scenario=nextSnapshot({...preparedScenario,id:existing.scenario.id,platform:{...preparedScenario.platform,...(visualAsset?{visualAsset}:{})}},existing.scenario);
  await mutation('scenarios:create',{...auth,scenario});bootstrap.ready=true;await atomicJson(file,bootstrap);
  await atomicJson(join(c.cacheDir,'durable-demo.json'),{world,bulk,scenario});
  return {sessionId:bootstrap.sessionId,ready:true,assetProvider:'mint',refreshing};
}

export async function publishDemo(c:Config,runId?:string){
  const bootstrap=JSON.parse(await readFile(join(c.cacheDir,'bootstrap.json'),'utf8'));
  if(!bootstrap.ready)throw new ProviderError('BOOTSTRAP','Finish seeding before publication.');
  const client=new ConvexHttpClient(c.convexUrl,{logger:false});
  const session=await client.query(makeFunctionReference<'query'>('sessions:getPublic'),{sessionId:bootstrap.sessionId});
  const id=runId||session?.latestRun?.id;if(!id)throw new ProviderError('RUN_INCOMPLETE','Complete an operator evaluation before publication.');
  const {reportId}=await client.mutation(makeFunctionReference<'mutation'>('reports:publish'),{runId:id,token:bootstrap.ownerToken});
  const report=await client.query(makeFunctionReference<'query'>('reports:get'),{reportId});
  await atomicJson(join(c.cacheDir,'report-demo.json'),report);
  return {reportId,runId:id,publicOriginConfigured:!!c.publicOrigin};
}
