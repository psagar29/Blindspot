import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, configured, type Config } from './config';
import { Providers, ProviderError, atomicJson } from './providers';
import { AUTHORED_BULK_HAZARD, createScenario } from '../../../src/engine/scenario';

export function localRequestAllowed(req:IncomingMessage,c:Config) {
  const expected=new URL(c.operatorOrigin);
  const host=req.headers.host||'';
  if(![expected.host,`127.0.0.1:${c.port}`,`localhost:${c.port}`].includes(host))return false;
  return req.headers.origin===expected.origin||(!req.headers.origin&&req.headers['sec-fetch-site']==='same-origin'&&host===expected.host);
}
async function body(req:IncomingMessage) {
  if(!req.headers['content-type']?.startsWith('application/json'))throw new ProviderError('CONTENT_TYPE','Expected application/json.',415);
  const chunks:Buffer[]=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>14*1024*1024)throw new ProviderError('BODY_SIZE','Request exceeds the upload limit.',413);chunks.push(Buffer.from(chunk));}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ProviderError('JSON','Invalid JSON.');}
}
export function createProviderServer(config:Config) {
  const providers=new Providers(config),localToken=randomBytes(32).toString('base64url');
  const send=(res:ServerResponse,status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const matches=(token:unknown)=>typeof token==='string'&&token.length===localToken.length&&timingSafeEqual(Buffer.from(token),Buffer.from(localToken));
  return createServer(async(req,res)=>{
    try {
      if(!localRequestAllowed(req,config))throw new ProviderError('LOCAL_ORIGIN','Only the configured local operator origin is allowed.',403);
      const url=new URL(req.url||'/',config.operatorOrigin),path=url.pathname;
      if(req.method==='GET'&&path==='/api/local/health'){send(res,200,{providers:configured(config),authoring:'preset'});return;}
      if(req.method==='GET'&&path==='/api/local/session'){
        let bootstrap=null;try{const saved=JSON.parse(await readFile(join(config.cacheDir,'bootstrap.json'),'utf8'));if(saved.ready)bootstrap=saved;}catch{/* Seeding is explicit. */}
        let world=null;try{world=JSON.parse(await readFile(join(config.cacheDir,'marble-demo.json'),'utf8'));}catch{}
        send(res,200,{localToken,bootstrap,world,bulk:AUTHORED_BULK_HAZARD,providers:configured(config),authoring:'preset'});return;
      }
      if(req.method!=='GET'&&!matches(req.headers['x-blindspot-local-token']))throw new ProviderError('LOCAL_TOKEN','Local operator session token required.',403);
      if(req.method==='GET'&&path.startsWith('/api/local/assets/')){
        const id=decodeURIComponent(path.slice('/api/local/assets/'.length));
        if(!/^(?:source-)?[a-f0-9]{64}\.(spz|glb|jpg|jpeg|png|webp)$/.test(id))throw new ProviderError('ASSET_ID','Unknown local asset.',404);
        const file=join(config.cacheDir,'assets',id);const info=await stat(file).catch(()=>{throw new ProviderError('ASSET_NOT_FOUND','Local asset is not cached.',404);});
        if(!info.isFile())throw new ProviderError('ASSET_NOT_FOUND','Local asset is not cached.',404);
        res.writeHead(200,{'Content-Type':id.endsWith('.glb')?'model/gltf-binary':/\.jpe?g$/.test(id)?'image/jpeg':id.endsWith('.png')?'image/png':id.endsWith('.webp')?'image/webp':'application/octet-stream','Content-Length':info.size,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'});
        res.end(await readFile(file));return;
      }
      if(req.method==='GET'&&path.startsWith('/api/local/jobs/')){const job=await providers.poll(path.slice('/api/local/jobs/'.length));await providers.cacheResult(job);send(res,200,job);return;}
      if(req.method==='POST'&&path==='/api/local/worlds'){
        const input=await body(req);if(input.generate!==true)throw new ProviderError('OPERATOR_ACTION','An explicit Generate action is required.');
        if(typeof input.prompt!=='string')throw new ProviderError('PROMPT','A supported prompt is required.');
        let photo;
        if(input.photo){if(typeof input.photo.base64!=='string'||typeof input.photo.extension!=='string')throw new ProviderError('PHOTO','Invalid photo upload.');photo={bytes:Buffer.from(input.photo.base64,'base64'),extension:input.photo.extension};
          const b=photo.bytes,valid=photo.extension==='png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):['jpg','jpeg'].includes(photo.extension)?b[0]===255&&b[1]===216:photo.extension==='webp'?b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP':false;
          if(!valid)throw new ProviderError('PHOTO','Photo bytes do not match the permitted image type.');}
        const job=await providers.start('marble',input.prompt,photo);send(res,202,{jobId:job.id});return;
      }
      if(req.method==='POST'&&path==='/api/local/scenarios'){
        const input=await body(req);
        if(typeof input.sentence!=='string'||!input.world||!input.bulk)throw new ProviderError('SCENARIO','Provide a supported sentence, prepared world and bulk hazard.');
        if(input.world.calibration?.status!=='verified')throw new ProviderError('CALIBRATION','Confirm world calibration before authoring.');
        send(res,200,{authoring:'preset',scenario:createScenario(input.world,input.bulk,input.sentence,input.version||1)});return;
      }
      if(req.method==='POST'&&path==='/api/local/calibration'){
        const input=await body(req),world=input.world;
        if(!world||world.calibration?.status!=='verified'||!world.id||!Number.isFinite(world.calibration.correctionFactor)||world.calibration.correctionFactor<0.1||world.calibration.correctionFactor>10||!world.calibration.reference)throw new ProviderError('CALIBRATION','A validated operator reference is required.');
        const cached=JSON.parse(await readFile(join(config.cacheDir,'marble-demo.json'),'utf8'));
        if(cached.id!==world.id||cached.splat.sha256!==world.splat?.sha256||cached.collider.sha256!==world.collider?.sha256)throw new ProviderError('WORLD_ID','Calibration must refer to the owned cached world.');
        await atomicJson(join(config.cacheDir,'marble-demo.json'),world);send(res,200,{ok:true});return;
      }
      throw new ProviderError('NOT_FOUND','Unknown local endpoint.',404);
    }catch(e){const error=e instanceof ProviderError?e:new ProviderError('LOCAL_ERROR','Local operation failed. Provider responses and credentials are not logged.',500);send(res,error.status,{error:{code:error.code,message:error.message,retryable:error.status>=500}});}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const c=loadConfig();createProviderServer(c).listen(c.port,'127.0.0.1',()=>console.log(`Blindspot local provider listening on 127.0.0.1:${c.port}. Provider values are never logged.`));
}
