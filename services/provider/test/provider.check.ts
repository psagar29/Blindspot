import test from 'node:test';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProviderServer } from '../src/server';
import { Providers, atomicJson, safeAssetUrl, type Job } from '../src/providers';
import type { Config } from '../src/config';
import type { World } from '../../../shared/contracts';
import { nextSnapshot } from '../../../src/engine/versions';
import { createScenario } from '../../../src/engine/scenario';

const localRequest=(url:string,options:{method?:string;headers?:Record<string,string>;body?:string}={})=>new Promise<{status:number;text:()=>Promise<string>;json:()=>Promise<any>}>((resolve,reject)=>{
  const req=request(url,{method:options.method,headers:options.headers},res=>{let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode!,text:async()=>data,json:async()=>JSON.parse(data)}));});req.on('error',reject);req.end(options.body);
});
const config=(cacheDir:string):Config=>({cacheDir,worldKey:'test-only-secret',tripoKey:'',deployKey:'',convexUrl:'https://example.convex.cloud',publicOrigin:'',modelKey:'',modelBaseUrl:'',modelId:'',port:0,operatorOrigin:'http://localhost:5173'});
test('SSRF allowlist rejects lookalikes, credentials, loopback and redirects targets',()=>{
  for(const url of ['http://worldlabs.ai/file','https://worldlabs.ai.evil.test/file','https://worldlabs.ai@127.0.0.1/file','https://localhost/file','https://storage.googleapis.com:8443/file'])assert.throws(()=>safeAssetUrl(url));
  assert.equal(safeAssetUrl('https://cdn.worldlabs.ai/file').hostname,'cdn.worldlabs.ai');
});
test('protected local server rejects foreign origins, DNS rebinding, missing tokens and traversal',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'blindspot-provider-test-')),server=createProviderServer(config(dir));
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const address=server.address() as {port:number},url=`http://127.0.0.1:${address.port}/api/local`;
  try{
    assert.equal((await localRequest(`${url}/session`)).status,403);
    assert.equal((await localRequest(`${url}/session`,{headers:{host:'evil.test',origin:'http://localhost:5173'}})).status,403);
    assert.equal((await localRequest(`${url}/session`,{headers:{host:'localhost:5173',origin:'https://evil.test'}})).status,403);
    const headers={host:'localhost:5173',origin:'http://localhost:5173'};
    const session=await (await localRequest(`${url}/session`,{headers})).json() as {localToken:string};assert.ok(session.localToken.length>=32);
    assert.equal((await localRequest(`${url}/worlds`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,403);
    const result=await localRequest(`${url}/worlds`,{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Blindspot-Local-Token':session.localToken},body:'{"generate":false}'});
    assert.equal(result.status,400);assert.ok(!(await result.text()).includes('test-only-secret'));
    assert.equal((await localRequest(`${url}/assets/%2e%2e%2fbootstrap.json`,{headers})).status,404);
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await rm(dir,{recursive:true,force:true});}
});
test('accepted jobs are cache-first and inspected calibration survives resume',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'blindspot-cache-test-')),p=new Providers(config(dir));
  try{
    const world={id:'world',splat:{sha256:'a'},collider:{sha256:'b'},calibration:{status:'verified',correctionFactor:2}} as World;
    await atomicJson(join(dir,'marble-demo.json'),world);
    const job={id:'a'.repeat(64),provider:'marble',status:'completed',requestHash:'a'.repeat(64),model:'test',createdAt:'2026-09-05T00:00:00Z',providerTaskId:'accepted-task',result:{...world,calibration:{...world.calibration,status:'unverified'}}} as Job;
    await atomicJson(join(dir,'jobs',`${job.id}.json`),job);
    assert.equal((await p.poll(job.id)).providerTaskId,'accepted-task');await p.cacheResult(job);
    assert.deepEqual(JSON.parse(await readFile(join(dir,'marble-demo.json'),'utf8')),world);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('new entities start at version one; identical retries and scenario identity remain stable',()=>{
  const one=nextSnapshot({id:'world',version:9,data:{b:2,a:1}},null);assert.equal(one.version,1);
  const again=nextSnapshot({id:'world',version:10,data:{a:1,b:2}},one);assert.equal(again,one);
  assert.equal(nextSnapshot({...one,data:{a:2,b:2}},one).version,2);
  assert.throws(()=>nextSnapshot({...one,id:'different'},one));
  const world={id:'world'} as World,bulk={dimensionsM:[1,1,1]} as any;
  assert.equal(createScenario(world,bulk,'Test route',1).id,createScenario(world,bulk,'Test route',2).id);
});
