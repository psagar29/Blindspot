import { afterEach, expect, test, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { RuntimeStore, publicLink, routeFromPath } from './store';
import type { WorldScene } from '../engine/scene';
import { buildFixtureReport, fixtureRuns, fixtureScenario, verifiedCalibration } from '../mocks/fixtureData';

const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise(resolveFn=>{resolve=resolveFn;});return {promise,resolve};};
afterEach(()=>vi.restoreAllMocks());
test('share origins never derive from localhost; routing is bounded',()=>{
  expect(publicLink('/control/id','http://localhost:5173')).toBeNull();expect(publicLink('/control/id','https://user:password@app.test')).toBeNull();
  expect(publicLink('/reports/id','https://blindspot.example/path')).toBe('https://blindspot.example/reports/id');
  expect(routeFromPath('/control/id')).toEqual({kind:'controller',sessionId:'id'});expect(routeFromPath('/control/id/extra')).toEqual({kind:'not_found'});
});
test('lease heartbeats cannot claim or execute a second run while a GPU run is pending',async()=>{
  const store=new RuntimeStore(),pending=deferred(),run=vi.fn(()=>pending.promise);
  const scenario={id:'scenario',version:1,world:{calibration:{status:'verified'}}};
  const mutation=vi.fn(async(ref,args)=>{const name=getFunctionName(ref);if(name==='sessions:claimLease')return {leased:true,leaseExpiresAt:Date.now()+15000};
    if(name==='runs:claimNext')return {runId:'run',scenario,config:{version:1}};if(name==='runs:complete')return {acceptedForDisplay:true};throw new Error(String(args));});
  Object.assign(store,{local:{bootstrap:{sessionId:'session',ownerToken:'test-owner'}},client:{mutation},scene:{registration:{loaded:true},scenario,run} as unknown as WorldScene});
  store.state={...store.state,world:scenario.world as any};
  const tick=()=> (store as unknown as {operatorTick():Promise<void>}).operatorTick();
  const first=tick();await vi.waitFor(()=>expect(run).toHaveBeenCalledTimes(1));
  await tick();await tick();expect(run).toHaveBeenCalledTimes(1);expect(mutation.mock.calls.filter(([ref])=>getFunctionName(ref)==='runs:claimNext')).toHaveLength(1);
  pending.resolve({run:{id:'run'},frames:[],brakingDecision:null});await first;
  expect(mutation.mock.calls.filter(([ref])=>getFunctionName(ref)==='runs:complete')).toHaveLength(1);
});
test('disposing an older React lifecycle cannot close the replacement client',async()=>{
  const store=new RuntimeStore(),closing=deferred(),replacement={close:vi.fn(async()=>{})};
  Object.assign(store,{client:{close:()=>closing.promise}});const disposed=store.dispose();Object.assign(store,{client:replacement});closing.resolve(undefined);await disposed;
  expect((store as unknown as {client:unknown}).client).toBe(replacement);expect(replacement.close).not.toHaveBeenCalled();
});
test('public workspace preloads an immutable report and enables credential-free replay once the scene is ready',async()=>{
  const world={...fixtureScenario.world,calibration:verifiedCalibration({referenceLabel:'Demo reference',referenceLengthM:1,evidence:'assumed',correctionFactor:1})};
  const scenario={...fixtureScenario,world};const report=buildFixtureReport({...fixtureRuns.baseline,scenarioId:scenario.id},scenario);const query=vi.fn(async()=>report);
  const store=new RuntimeStore();Object.assign(store,{client:{query}});
  await (store as unknown as {openRoute():Promise<void>}).openRoute();
  expect(store.state.mode).toBe('recording');expect(store.state.scenario?.id).toBe(scenario.id);expect(store.state.latestRun?.id).toBe(report.run.id);expect(store.state.capabilities.authoring).toBe(false);
  store.attachScene({registration:{loaded:true}} as unknown as WorldScene);
  expect(store.state.capabilities.run).toBe(true);expect(query).toHaveBeenCalledTimes(1);
});
