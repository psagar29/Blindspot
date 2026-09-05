import test from 'node:test';
import assert from 'node:assert/strict';
import type { HazardFinding, HazardLibraryItem, World } from '../../../shared/contracts';
import { createSensorConfig } from '../../../src/engine/presets';
import { createScenario } from '../../../src/engine/scenario';
import { evaluate, stoppingDistance, coverageMetrics } from '../../../src/engine/evaluate';
import { backProject, project, intrinsics, linearDepth, analyticSampler, thresholdRange } from '../../../src/engine/sensor';
import { sweptContact } from '../../../src/engine/geometry';
import { transform } from '../../../src/engine/math';
import { confirmWorldCalibration } from '../../../src/engine/calibration';

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const asset={id:'fixture',source:'marble' as const,url:'/fixture',sha256:'0'.repeat(64),createdAt:'2026-09-05T00:00:00Z'};
export const world:World={id:'test-world',version:1,name:'Explicit test fixture',sourcePhotoUrl:'/fixture',splat:asset,collider:asset,cached:true,preparationMs:null,
  calibration:{status:'verified',source:'estimated_reference',splatToWorld:identity,colliderToWorld:identity,correctionFactor:1,uncertaintyNote:'Unit-test fixture only.'}};
const bulk:HazardLibraryItem={id:'fixture-box',version:1,name:'Fixture control box',type:'bulk',dimensionsM:[0.7,0.55,0.6],dimensionEvidence:'assumed',materialClass:'opaque',returnAssumption:'Test fixture.'};
const scenario=createScenario(world,bulk),base=createSensorConfig('baseline');
test('live scenarios attach the real Mint visual without changing the physical envelope',()=>{
  assert.equal(scenario.platform.visualAsset?.source,'mint');
  assert.equal(scenario.platform.visualAsset?.sha256,'85f69933396b670d9b46c8d3cdd61167a106567e3a28b0ff9ad15693ce3bc845');
  assert.equal(scenario.platform.radiusM,0.25);assert.equal(scenario.platform.heightM,0.7);
});
test('projection/back-projection round trip uses actual raster focal length and rejects invalid depths',()=>{
  const s=base.sensors[0];assert.ok(Math.abs(intrinsics(s).fx-80)<1e-10);
  const p=project([0.3,0.1,-5],s)!;const back=backProject(p.u,p.v,p.depth,s)!;
  [0.3,0.1,-5].forEach((v,i)=>assert.ok(Math.abs(v-back[i])<1e-12));
  assert.equal(linearDepth(1,0.1,10),null);assert.equal(linearDepth(NaN,0.1,10),null);
  assert.equal(backProject(80,60,Infinity,s),null);assert.ok(Math.abs(linearDepth(0,0.1,10)!-0.1)<1e-12);
});
test('Marble raw axes and ground offset produce a metric 1m reference',()=>{
  const s=2,g=0.5,m=[s,0,0,0,0,-s,0,0,0,0,-s,0,0,g,0,1];
  assert.deepEqual(transform([0,0.25,0],m),[0,0,0]);assert.deepEqual(transform([0.5,0.25,0.5],m),[1,0,-1]);
});
test('absolute calibration corrections apply once and preserve estimated evidence',()=>{
  const input={worldId:world.id,referenceLabel:'Assumed 1m ruler',referenceLengthM:1,evidence:'assumed' as const,correctionFactor:2};
  const first=confirmWorldCalibration(world,input,true),second=confirmWorldCalibration(first,input,true);
  assert.deepEqual(first.calibration.splatToWorld,second.calibration.splatToWorld);assert.equal(second.calibration.source,'estimated_reference');
  assert.throws(()=>confirmWorldCalibration(world,input,false));
});
test('ideal 8mm cable candidates exist before thresholding and become visible nearby',()=>{
  const sample=analyticSampler(scenario,base.sensors[0]);const far=sample({positionM:[0,0,-2],orientation:[0,0,0,1]});
  assert.ok(far.candidates.includes('cable-1'));assert.ok(!far.points.some(p=>p.hazardId==='cable-1'));
  assert.ok(sample({positionM:[0,0,-3],orientation:[0,0,0,1]}).points.some(p=>p.hazardId==='cable-1'));
  assert.ok(Math.abs(thresholdRange(0.008,base.sensors[0])-0.64)<1e-10);
});
test('an intervening opaque box occludes analytical cable samples',()=>{
  const blocked={...scenario,hazards:[scenario.hazards[0],{...scenario.hazards[2],geometry:{kind:'box' as const,pose:{positionM:[0,0.5,-3.2] as const,orientation:[0,0,0,1] as const},dimensionsM:[4,2,0.1] as const}}]};
  const frame=analyticSampler(blocked,base.sensors[0])({positionM:[0,0,-3],orientation:[0,0,0,1]});
  assert.ok(!frame.candidates.includes('cable-1'));assert.ok(!frame.points.some(p=>p.hazardId==='cable-1'));
});
test('bounded swept collision cannot tunnel through an 8mm cable',()=>{
  const hit=sweptContact({positionM:[0,0,-3],orientation:[0,0,0,1]},{positionM:[0,0,-4],orientation:[0,0,0,1]},scenario.platform,[scenario.hazards[0]]);
  assert.equal(hit?.hazardId,'cable-1');assert.ok(hit!.fraction>0&&hit!.fraction<0.5);
});
test('baseline detects late and collides during finite braking; higher resolution stops with same scenario',async()=>{
  const a=await evaluate(scenario,base),b=await evaluate(scenario,createSensorConfig('higher_resolution'));
  assert.equal(a.run.coverage.eligibleEncounters,3);assert.equal(a.run.findings[0].status,'late');assert.equal(a.run.outcome.termination,'collision');
  assert.equal(b.run.outcome.termination,'stopped');assert.equal(b.run.coverage.percent,100);assert.equal(b.run.outcome.falseStopPercent,0);
  assert.ok(a.run.events.find(e=>e.kind==='braking')!.timeMs<a.run.events.find(e=>e.kind==='collision')!.timeMs);
  const braking=a.run.events.find(e=>e.kind==='braking')!,collision=a.run.events.find(e=>e.kind==='collision')!;
  const expectedImpactSpeed=1.1-1.3*Math.max(0,(collision.timeMs-braking.timeMs)/1000-0.15);
  assert.ok(Math.abs(a.frames.at(-1)!.speedMps-expectedImpactSpeed)<0.002);
  assert.equal(a.run.outcome.completionTimeMs,null);assert.equal(a.run.outcome.falseStopPercent,null);
  assert.equal(a.run.coverage.detectedBeforeBoundary,2);assert.ok(a.brakingDecision!.truthHazardIds.includes('cable-1'));
});
test('seeded geometry, sensor, metrics and events reproduce exactly',async()=>{
  const opts={completedAt:'2026-09-05T00:00:00Z'},a=await evaluate(scenario,base,opts),b=await evaluate(scenario,base,opts);assert.deepEqual(a,b);
});
test('unknown and zero eligible denominators suppress coverage',()=>{
  const f={hazardId:'x',status:'unknown'} as HazardFinding;
  assert.equal(coverageMetrics([f]).percent,null);assert.equal(coverageMetrics([]).percent,null);assert.equal(coverageMetrics([f]).unknown,1);
});
test('false stops use the saved decision corridor and pre-braking speed',async()=>{
  const empty={...scenario,hazards:[]};
  const result=await evaluate(empty,base,{sample:pose=>({points:[{positionM:[0,0.35,pose.positionM[2]-0.7]}],candidates:[],unknown:[],method:'analytic_with_occlusion'})});
  assert.equal(result.run.outcome.termination,'stopped');assert.equal(result.run.outcome.falseStopPercent,100);
  assert.equal(result.brakingDecision!.speedMps,1.1);assert.ok(result.brakingDecision!.corridorM>0.6);
  assert.equal(result.run.coverage.percent,null);
});
test('empty scene with no stops has null false-stop rate and completes route',async()=>{
  const result=await evaluate({...scenario,hazards:[]},base);assert.equal(result.run.outcome.termination,'completed');assert.equal(result.run.outcome.falseStopPercent,null);
});
test('unverified calibration blocks evaluation',async()=>{
  await assert.rejects(evaluate({...scenario,world:{...world,calibration:{...world.calibration,status:'unverified'}}},base));
  assert.ok(Math.abs(stoppingDistance(1.1,0.15,1.3,0.08)-0.7103846153846154)<1e-10);
});

test('accelerated triangle occlusion agrees with Three raycasting and ignores only the target',async()=>{
  const THREE=await import('three');const {OcclusionIndex}=await import('../../../src/engine/occlusion');
  const scene=new THREE.Scene();const target=new THREE.Mesh(new THREE.BoxGeometry(1,1,0.1),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));target.position.set(0,0,-2);target.userData.hazardId='target';scene.add(target);
  const blocker=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.2),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));blocker.position.set(0.4,0,-1);scene.add(blocker);scene.updateMatrixWorld(true);
  const index=new OcclusionIndex(scene),ray=new THREE.Raycaster();
  for(let i=-20;i<=20;i++){const end=new THREE.Vector3(i/10,0,-3);ray.set(new THREE.Vector3(),end.clone().normalize());ray.near=0.0001;ray.far=end.length()-0.0005;
    assert.equal(index.occluded([0,0,0],end.toArray() as any),ray.intersectObjects(scene.children,true).length>0);}
  assert.equal(index.occluded([0,0,0],[0,0,-2],'target'),false);assert.equal(index.occluded([0,0,0],[0.8,0,-2],'target'),true);
});
