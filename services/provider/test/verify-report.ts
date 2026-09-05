import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import type { ReportSnapshot } from '../../../shared/contracts';

// Intentionally reads no env file and sends no capability or provider credential.
const client=new ConvexHttpClient('https://standing-pony-711.convex.cloud',{logger:false});
const reportId=process.argv[2];assert.ok(reportId,'Pass a published report ID.');
const report=await client.query(makeFunctionReference<'query'>('reports:get'),{reportId}) as ReportSnapshot|null;
assert.ok(report);assert.equal(report.id,reportId);
const json=JSON.stringify(report),sha256=createHash('sha256').update(json).digest('hex');
if(process.argv[3])assert.equal(sha256,process.argv[3],'Published snapshot changed.');
assert.ok(!/ownerToken|controllerToken|capabilityHash|localToken|WLT-Api-Key/.test(json));
const assets=[report.scenario.world.splat,report.scenario.world.collider,...report.scenario.hazards.flatMap(h=>h.libraryItem.asset?[h.libraryItem.asset]:[])];
const verified=[];
for(const asset of assets){assert.equal(new URL(asset.url).protocol,'https:');const r=await fetch(asset.url,{redirect:'error'});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);verified.push({id:asset.id,bytes:bytes.length,sha256:asset.sha256});}
const image=await fetch(report.scenario.world.sourcePhotoUrl,{redirect:'error'});assert.equal(image.status,200);
console.log(JSON.stringify({reportId,runId:report.run.id,scenarioVersion:report.scenario.version,configVersion:report.run.config.version,status:report.status,coverage:report.run.coverage.percent,outcome:report.run.outcome.termination,snapshotSha256:sha256,verifiedAssets:verified,sourcePreviewStatus:image.status,authenticated:false},null,2));
