import { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import type { ActionResult, AppActions, AppState, HazardLibraryItem, ReportSnapshot, RouteState, Scenario, SensorConfig, World } from '../../shared/contracts';
import type { WorldScene } from '../engine/scene';
import type { Evaluation, PlaybackFrame } from '../engine/evaluate';
import { createSensorConfig } from '../engine/presets';
import { AUTHORED_BULK_HAZARD, createScenario } from '../engine/scenario';
import { confirmWorldCalibration } from '../engine/calibration';
import { nextSnapshot } from '../engine/versions';

type Bootstrap={sessionId:string;ownerToken:string;controllerToken:string};
type LocalSession={localToken:string;bootstrap:Bootstrap|null;world:World|null;bulk:HazardLibraryItem|null};
const wire=(value:unknown)=>JSON.parse(JSON.stringify(value));
export const DEFAULT_DEMO_REPORT_ID='c95256fa-abb3-4e16-afab-36c06c7c8869';
const demoReportId=()=>import.meta.env.VITE_DEMO_REPORT_ID?.trim()||DEFAULT_DEMO_REPORT_ID;
export function routeFromPath(path:string):RouteState {
  if(path==='/'||path==='/engine.html')return {kind:'workspace'};
  const control=/^\/control\/([a-zA-Z0-9_.:-]{1,128})$/.exec(path);if(control)return {kind:'controller',sessionId:control[1]!};
  const report=/^\/reports\/([a-zA-Z0-9_.:-]{1,128})$/.exec(path);if(report)return {kind:'report',reportId:report[1]!};return {kind:'not_found'};
}
export function publicLink(path:string,origin=import.meta.env.VITE_PUBLIC_APP_ORIGIN):string|null {
  if(!origin)return null;try{const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||/^(localhost|127\.|\[::1\])/.test(u.hostname))return null;return new URL(path,u.origin).href;}catch{return null;}
}
const initial=():AppState=>({contractVersion:1,mode:'live',route:routeFromPath(location.pathname),status:'empty',connection:'connecting',capabilities:{authoring:false,run:false,publish:false},session:null,world:null,scenario:null,config:null,library:[],frame:null,latestRun:null,report:null,reportLoading:false,reportUrl:null,error:null,stageLabel:null,elapsedMs:null});
export class RuntimeStore {
  state=initial();private listeners=new Set<()=>void>();private client:ConvexClient|null=null;private unsubscribe:(()=>void)|null=null;
  private local:LocalSession|null=null;private scene:WorldScene|null=null;private instanceId=crypto.randomUUID();private controllerToken='';private heartbeat:ReturnType<typeof setInterval>|null=null;
  private busy=false;private leaseExpiresAt=0;private lastOperation:(()=>Promise<void>)|null=null;private lastEvaluation:Evaluation|null=null;private playback:ReturnType<typeof setInterval>|null=null;
  private disposed=false;private editing=false;private publicDemo=false;private publicDemoAutostarted=false;private uploads=new Map<string,string>();private lifecycle=0;private routeEpoch=0;
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
  snapshot=()=>this.state;
  private patch(update:Partial<AppState>){if(this.disposed)return;this.state={...this.state,...update};this.listeners.forEach(fn=>fn());}
  private deriveCapabilities(){const local=this.state.route.kind==='workspace'&&!!this.local,demo=this.state.route.kind==='workspace'&&this.publicDemo;
    this.patch({capabilities:{authoring:local,run:(local||demo)&&!!this.scene?.registration.loaded&&this.state.world?.calibration.status==='verified'&&!this.busy,
      publish:!!this.local?.bootstrap&&!!this.state.latestRun&&this.state.latestRun.config.version===this.state.session?.requestedConfigVersion&&!!publicLink('/'),
      ...(!local?{authoringReason:demo?'Judge demo preloaded from an immutable published run. New world authoring stays on the operator laptop.':'World authoring runs on the connected operator laptop.'}:{})}});}
  private fail(error:unknown){let message=error instanceof Error?error.message:'Operation failed.';
    const structured=/Uncaught ConvexError: (\{[^\n]+\})/.exec(message);if(structured){try{message=JSON.parse(structured[1]!).message||message;}catch{}}
    for(const secret of [this.local?.localToken,this.local?.bootstrap?.ownerToken,this.local?.bootstrap?.controllerToken,this.controllerToken])if(secret)message=message.split(secret).join('[redacted]');
    const safe=message.replace(/https?:\/\/\S+/g,'[service]').replace(/(?:Bearer|WLT-Api-Key)\s+\S+/gi,'[redacted]').slice(0,450);
    this.patch({status:'error',error:{code:'OPERATION_FAILED',message:safe,retryable:true},stageLabel:null});}
  private async operation(fn:()=>Promise<void>):Promise<ActionResult>{this.lastOperation=fn;this.patch({error:null});try{await fn();this.deriveCapabilities();return {ok:true};}catch(e){this.fail(e);return {ok:false,error:this.state.error!};}}
  private async localFetch<T>(path:string,body?:unknown):Promise<T>{const r=await fetch(`/api/local/${path}`,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Blindspot-Local-Token':this.local?.localToken||''},body:JSON.stringify(body)})});
    if(!r.ok){const d=await r.json().catch(()=>null);throw new Error(d?.error?.message||'Local operator service is unavailable.');}return r.json() as Promise<T>;}
  async init(){const generation=++this.lifecycle;this.disposed=false;this.client=new ConvexClient(import.meta.env.VITE_CONVEX_URL||'https://standing-pony-711.convex.cloud',{logger:false});
    window.addEventListener('popstate',this.onNavigation);window.addEventListener('offline',this.offline);window.addEventListener('online',this.online);
    await this.openRoute();if(this.disposed||generation!==this.lifecycle)return;this.heartbeat=setInterval(()=>{this.updateOnline();void this.operatorTick();},5000);}
  private offline=()=>this.patch({connection:'offline'});private online=()=>this.patch({connection:'connecting'});
  private onNavigation=()=>{this.patch({route:routeFromPath(location.pathname)});void this.openRoute();};
  private async openRoute(){const epoch=++this.routeEpoch;this.unsubscribe?.();this.unsubscribe=null;const route=this.state.route;
    if(route.kind==='report'){this.publicDemo=false;this.patch({mode:'live',reportLoading:true,report:null,capabilities:{authoring:false,run:false,publish:false}});
      this.unsubscribe=this.client!.onUpdate(api.reports.get,{reportId:route.reportId},result=>{this.patch({connection:'connected',reportLoading:false,report:result as ReportSnapshot|null,status:result?'published':'empty',stageLabel:result?null:'Report not found.'});},e=>{this.patch({reportLoading:false});this.fail(e);});return;}
    if(route.kind==='controller'){
      this.publicDemo=false;this.patch({mode:'live'});
      const key=`blindspot-control:${route.sessionId}`,fragment=new URLSearchParams(location.hash.slice(1)).get('token');
      if(fragment){sessionStorage.setItem(key,fragment);history.replaceState(null,'',location.pathname);}this.controllerToken=sessionStorage.getItem(key)||'';
      this.subscribeSession(route.sessionId);this.deriveCapabilities();return;
    }
    if(route.kind!=='workspace')return;
    const isOperator=import.meta.env.VITE_AUTHORING_ENABLED==='true'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);
    if(!isOperator){this.publicDemo=true;this.publicDemoAutostarted=false;this.lastEvaluation=null;this.patch({mode:'recording',connection:'connecting',status:'empty',stageLabel:'Loading the published judge demo…'});
      try{const report=await this.client!.query(api.reports.get,{reportId:demoReportId()}) as ReportSnapshot|null;if(this.disposed||epoch!==this.routeEpoch)return;if(!report)throw new Error('The published judge demo could not be found.');
        const scenario=report.scenario;this.patch({mode:'recording',connection:'connected',world:scenario.world,scenario,library:scenario.hazards.map(h=>h.libraryItem),config:report.run.config,latestRun:report.run,report,
          reportUrl:publicLink(`/reports/${report.id}`),status:'ready',frame:null,stageLabel:'Published scenario loaded. Replaying the evaluation in this browser.'});this.deriveCapabilities();
      }catch(e){if(this.disposed||epoch!==this.routeEpoch)return;this.fail(e);}return;}
    this.publicDemo=false;
    try{const local=await this.localFetch<LocalSession>('session');if(this.disposed||epoch!==this.routeEpoch)return;this.local=local;
      if(local.bootstrap)this.subscribeSession(local.bootstrap.sessionId);
      else if(local.world){const scenario=createScenario(local.world,local.bulk||AUTHORED_BULK_HAZARD);this.patch({mode:'fixture',connection:'connected',world:local.world,scenario,library:scenario.hazards.map(h=>h.libraryItem),config:createSensorConfig('baseline'),status:local.world.calibration.status==='verified'?'ready':'calibrating',stageLabel:'Cached Marble and Mint rover loaded. Seed the operator session to enable persistence.'});}
      else this.patch({connection:'connected',stageLabel:'Prepare one cached world before evaluation.'});this.deriveCapabilities();
    }catch(e){this.fail(e);}
  }
  private subscribeSession(sessionId:string){this.unsubscribe=this.client!.onUpdate(api.sessions.getPublic,{sessionId},result=>{
    if(!result){this.patch({status:'empty',stageLabel:'Session not found.'});return;}
    this.leaseExpiresAt=result.leaseExpiresAt;
    const controllerUrl=this.local?.bootstrap?.controllerToken?publicLink(`/control/${sessionId}#token=${encodeURIComponent(this.local.bootstrap.controllerToken)}`):null;
    const scenario=result.scenario as unknown as Scenario;
    this.patch({mode:'live',connection:'connected',session:{...result.session,controllerUrl},...(!this.editing?{world:result.world as World,scenario,library:result.library as unknown as HazardLibraryItem[],config:result.config as unknown as SensorConfig}:{}),
      latestRun:result.latestRun as AppState['latestRun'],reportUrl:result.latestReportId?publicLink(`/reports/${result.latestReportId}`):null,...(!this.busy?{status:result.status as AppState['status']}:{}),stageLabel:result.status==='queued'?'Sensor configuration queued. Waiting for the operator.':null});this.deriveCapabilities();
  },e=>this.fail(e));}
  private updateOnline(){if(this.client&&!navigator.onLine)this.patch({connection:'offline'});else if(this.client)this.patch({connection:this.client.connectionState().isWebSocketConnected?'connected':'connecting'});if(this.state.session)this.patch({session:{...this.state.session,operatorOnline:this.leaseExpiresAt>Date.now()&&this.state.connection!=='offline'}});}
  attachScene(scene:WorldScene|null){this.scene=scene;this.deriveCapabilities();}
  sceneReady(){this.deriveCapabilities();if(this.publicDemo&&!this.publicDemoAutostarted){this.publicDemoAutostarted=true;void this.actions.startRun();return;}void this.operatorTick();}
  getScene(){return this.scene;}
  openLocalControllerTest(){
    if(!import.meta.env.DEV||!this.local?.bootstrap||!['localhost','127.0.0.1'].includes(location.hostname))return;
    this.actions.navigate(`/control/${this.local.bootstrap.sessionId}#token=${encodeURIComponent(this.local.bootstrap.controllerToken)}`);
  }
  private frame=(frame:PlaybackFrame)=>this.patch({frame:{timeMs:frame.timeMs,pass:frame.pass,pose:frame.pose,speedMps:frame.speedMps,playback:'playing',perceivedPointCount:frame.points.length},stageLabel:frame.pass==='diagnostic'?'Measuring full-route detection coverage':'Evaluating detection, latency and braking'});
  private async operatorTick(){if(!this.local?.bootstrap||!this.client||this.state.route.kind!=='workspace')return;
    const auth={sessionId:this.local.bootstrap.sessionId,token:this.local.bootstrap.ownerToken,instanceId:this.instanceId};
    try{const lease=await this.client.mutation(api.sessions.claimLease,auth);this.leaseExpiresAt=lease.leaseExpiresAt;if(!lease.leased)return;}catch(e){this.fail(e);return;}
    if(this.busy||this.editing||!this.scene?.registration.loaded||this.state.world?.calibration.status!=='verified')return;
    this.busy=true;
    try{const claimed=await this.client.mutation(api.runs.claimNext,auth);if(!claimed)return;
      if(this.scene.scenario.id!==claimed.scenario.id||this.scene.scenario.version!==claimed.scenario.version){this.busy=false;return;}
      this.patch({status:'running',error:null});this.deriveCapabilities();const scene=this.scene;
      const started=performance.now();
      const result=await scene.run(claimed.config as unknown as SensorConfig,claimed.runId,this.frame);
      const completion=await this.client.mutation(api.runs.complete,wire({runId:claimed.runId,token:auth.token,instanceId:this.instanceId,scenarioVersion:claimed.scenario.version,configVersion:claimed.config.version,result:result.run,brakingDecision:result.brakingDecision}));
      if(completion.acceptedForDisplay){this.lastEvaluation=result;scene.setEvents(result.run.events);const final=result.frames.at(-1);if(final){scene.setFrame(final);this.frame(final);}
        this.patch({status:'ready',frame:this.state.frame?{...this.state.frame,playback:'finished'}:null,stageLabel:null,elapsedMs:Math.round(performance.now()-started)});
      }else this.patch({status:'queued',stageLabel:'A newer configuration is queued. Previous result retained.'});
    }catch(e){this.fail(e);}finally{this.busy=false;this.deriveCapabilities();}}
  private async waitJob(jobId:string){const until=Date.now()+15*60*1000;while(Date.now()<until){const job=await this.localFetch<{status:string;result?:World;error?:{message:string}}>(`jobs/${jobId}`);
    if(job.status==='completed'&&job.result)return job.result;if(job.status==='failed')throw new Error(job.error?.message||'Generation failed.');await new Promise(r=>setTimeout(r,10000));if(this.disposed)throw new Error('Operator closed while generation was pending.');}
    throw new Error('Generation is still pending. Retry resumes the accepted job.');}
  private async durableUrl(url:string,expectedHash?:string):Promise<string>{if(url.startsWith('https://'))return url;if(this.uploads.has(url))return this.uploads.get(url)!;
    if(!url.startsWith('/api/local/assets/')||!this.local?.bootstrap)throw new Error('Only owned cached assets may be ingested.');
    const r=await fetch(url);if(!r.ok)throw new Error('Cached asset is missing.');const bytes=await r.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(expectedHash&&hash!==expectedHash)throw new Error('Cached asset checksum mismatch.');
    const auth={sessionId:this.local.bootstrap.sessionId,token:this.local.bootstrap.ownerToken};await new Promise(resolve=>setTimeout(resolve,1100));
    const {uploadUrl}=await this.client!.mutation(api.assets.generateUploadUrl,auth);
    const uploaded=await fetch(uploadUrl,{method:'POST',headers:{'Content-Type':r.headers.get('content-type')||'application/octet-stream'},body:bytes});if(!uploaded.ok)throw new Error('Durable asset upload failed.');
    const {storageId}=await uploaded.json();const saved=await this.client!.mutation(api.assets.completeUpload,{...auth,storageId,sha256:hash});this.uploads.set(url,saved.url);return saved.url;
  }
  private async persistScenario(world:World,bulk:HazardLibraryItem,sentence:string,version:number):Promise<Scenario>{
    if(!this.local?.bootstrap)return createScenario(world,bulk,sentence,version);
    const auth={sessionId:this.local.bootstrap.sessionId,token:this.local.bootstrap.ownerToken};
    const sourcePhotoUrl=await this.durableUrl(world.sourcePhotoUrl),splatUrl=await this.durableUrl(world.splat.url,world.splat.sha256),colliderUrl=await this.durableUrl(world.collider.url,world.collider.sha256);
    const previousWorld=await this.client!.query(api.worlds.latest,{...auth,worldId:world.id}) as World|null;
    const prepared=nextSnapshot({...world,sourcePhotoUrl,splat:{...world.splat,url:splatUrl},collider:{...world.collider,url:colliderUrl}},previousWorld);
    await this.client!.mutation(api.worlds.ingest,wire({...auth,world:prepared}));
    if(bulk.asset)bulk={...bulk,asset:{...bulk.asset,url:await this.durableUrl(bulk.asset.url,bulk.asset.sha256)}};
    const library=await this.client!.query(api.library.list,{sessionId:auth.sessionId}) as unknown as HazardLibraryItem[];
    bulk=nextSnapshot(bulk,library.find(item=>item.id===bulk.id)??null);
    await this.client!.mutation(api.library.ingest,wire({...auth,item:bulk}));
    const current=await this.client!.query(api.sessions.getPublic,{sessionId:auth.sessionId});
    const id=current?.scenario.world.id===world.id?current.scenario.id:`scenario-${world.id}`;
    const previousScenario=await this.client!.query(api.scenarios.latest,{...auth,scenarioId:id}) as unknown as Scenario|null;
    const preparedScenario=createScenario(prepared,bulk,sentence);
    const localVisual=preparedScenario.platform.visualAsset;
    const visualAsset=localVisual?{...localVisual,url:await this.durableUrl(localVisual.url,localVisual.sha256),...(localVisual.thumbnailUrl?{thumbnailUrl:await this.durableUrl(localVisual.thumbnailUrl)}:{})}:undefined;
    const scenario=nextSnapshot({...preparedScenario,id,platform:{...preparedScenario.platform,...(visualAsset?{visualAsset}:{})}},previousScenario);
    await this.client!.mutation(api.scenarios.create,wire({...auth,scenario}));return scenario;
  }
  actions:AppActions={
    authorScenario:input=>this.operation(async()=>{
      if(!this.local)throw new Error('Authoring requires the local operator service.');
      if(this.busy)throw new Error('Wait for the current evaluation before changing its scenario.');
      if(input.worldId&&input.worldId!==this.state.world?.id)throw new Error('This operator supports its current prepared world.');
      this.editing=true;this.patch({status:input.photo?'uploading':'generating'});let world=this.state.world;
      if(input.photo){const bytes=new Uint8Array(await input.photo.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
        const {jobId}=await this.localFetch<{jobId:string}>('worlds',{generate:true,prompt:input.sentence,photo:{base64:btoa(binary),extension:input.photo.name.split('.').pop()?.toLowerCase()}});
        this.patch({status:'generating',stageLabel:'Marble generation accepted. Reusing this job until it completes.'});world=await this.waitJob(jobId);
        this.patch({world,scenario:createScenario(world,this.local.bulk||AUTHORED_BULK_HAZARD,input.sentence),status:'calibrating',stageLabel:'Inspect world registration and confirm a reference before evaluation.'});return;}
      if(!world)throw new Error('Select a prepared world or upload a permitted source photo.');
      const bulk=this.state.library.find(item=>item.type==='bulk')||this.local.bulk||AUTHORED_BULK_HAZARD;
      const response=await this.localFetch<{scenario:Scenario}>('scenarios',{sentence:input.sentence,world,bulk,version:(this.state.scenario?.version||0)+1});
      const scenario=await this.persistScenario(world,bulk,input.sentence,response.scenario.version);this.editing=false;
      this.patch({scenario,world:scenario.world,status:'ready',latestRun:null,stageLabel:'Preset authoring: fixed ground route, two cables and one bulk obstacle.'});
    }),
    confirmCalibration:input=>this.operation(async()=>{
      if(!this.local||!this.state.world)throw new Error('Load a local world first.');if(this.busy)throw new Error('Wait for the current evaluation before changing calibration.');
      const registration=this.scene?.registration;const inspected=!!registration?.loaded&&registration.floorHeightM!==null&&Math.abs(registration.floorHeightM)<0.15;
      const world=confirmWorldCalibration(this.state.world,input,inspected);
      await this.localFetch('calibration',{world});this.local.world=world;
      const bulk=this.state.library.find(item=>item.type==='bulk')||this.local.bulk||AUTHORED_BULK_HAZARD;
      const scenario=await this.persistScenario(world,bulk,this.state.scenario?.sentence||'Ground route with two cables and one bulk obstacle.',(this.state.scenario?.version||0)+1);this.editing=false;
      this.patch({world:scenario.world,scenario,status:'ready',stageLabel:'Estimated scale confirmed. Reconstruction remains approximate.'});
    }),
    requestConfig:presetId=>this.operation(async()=>{
      if(!this.state.session){if(!this.local&&!this.publicDemo)throw new Error('Session unavailable.');const config=createSensorConfig(presetId,(this.state.config?.version||0)+1);
        this.patch({config,status:'ready',...(this.publicDemo?{}:{latestRun:null})});return;}
      const token=this.state.route.kind==='controller'?this.controllerToken:this.local?.bootstrap?.ownerToken;
      if(!token)throw new Error('A valid controller capability is required.');
      await this.client!.mutation(api.configs.request,{sessionId:this.state.session.id,token,presetId,clientRequestId:crypto.randomUUID()});this.patch({status:'queued'});
    }),
    startRun:()=>this.operation(async()=>{
      if(!this.scene||!this.state.config)throw new Error('Load the scene and confirm calibration before running.');
      // The 5 s heartbeat briefly holds `busy` while it polls for queued work; a click in that window must queue, not fail.
      if(this.local?.bootstrap){if(!this.busy&&!this.state.capabilities.run)throw new Error('Load the scene and confirm calibration before running.');const requested=await this.actions.requestConfig(this.state.config.presetId);if(!requested.ok)throw new Error(requested.error.message);await this.operatorTick();return;}
      if(this.busy||!this.state.capabilities.run)throw new Error('Load the scene and confirm calibration before running.');
      this.busy=true;this.patch({status:'running'});this.deriveCapabilities();try{const result=await this.scene.run(this.state.config,`${this.publicDemo?'demo':'local'}-${crypto.randomUUID()}`,this.frame);this.lastEvaluation=result;this.scene.setEvents(result.run.events);this.patch({latestRun:result.run,status:'ready',stageLabel:this.publicDemo?'Judge demo replay completed in this browser. Open the immutable report for the published result.':'Local development run. Persistence requires a seeded live session.',frame:this.state.frame?{...this.state.frame,playback:'finished'}:null});}finally{this.busy=false;}
    }),
    publishReport:()=>this.operation(async()=>{if(!this.local?.bootstrap||!this.state.latestRun)throw new Error('A completed live run is required.');if(!publicLink('/'))throw new Error('Public app origin is not configured.');
      if(this.state.latestRun.config.version!==this.state.session?.requestedConfigVersion)throw new Error('Wait for the selected sensor configuration to finish.');this.patch({status:'publishing'});
      const {reportId}=await this.client!.mutation(api.reports.publish,{runId:this.state.latestRun.id,token:this.local.bootstrap.ownerToken});this.patch({status:'published',reportUrl:publicLink(`/reports/${reportId}`)});
    }),
    retry:()=>this.lastOperation?this.operation(this.lastOperation):Promise.resolve({ok:false,error:{code:'NO_RETRY',message:'There is no failed operation to retry.',retryable:false}}),
    navigate:path=>{if(!path.startsWith('/')||path.startsWith('//'))return;history.pushState(null,'',path);this.onNavigation();},
    setPlayback:value=>{if(this.playback)clearInterval(this.playback);this.playback=null;if(!this.lastEvaluation)return;
      this.patch({frame:this.state.frame?{...this.state.frame,playback:value}:null});if(value==='playing'){let time=this.state.frame?.timeMs||0;const end=this.lastEvaluation.frames.at(-1)!.timeMs;if(time>=end)time=0;
        this.playback=setInterval(()=>{time+=50;this.actions.seek(Math.min(time,end));if(time>=end){if(this.playback)clearInterval(this.playback);this.playback=null;this.patch({frame:this.state.frame?{...this.state.frame,playback:'finished'}:null});}},50);}},
    seek:time=>{if(!this.lastEvaluation||!Number.isFinite(time)||this.busy)return;const frames=this.lastEvaluation.frames;const frame=frames.find(f=>f.timeMs>=Math.max(0,time))||frames.at(-1)!;this.scene?.setFrame(frame);this.patch({frame:{timeMs:frame.timeMs,pass:'recording',pose:frame.pose,speedMps:frame.speedMps,playback:this.state.frame?.playback||'paused',perceivedPointCount:frame.points.length}});},
  };
  async dispose(){this.disposed=true;++this.lifecycle;++this.routeEpoch;this.unsubscribe?.();if(this.heartbeat)clearInterval(this.heartbeat);if(this.playback)clearInterval(this.playback);window.removeEventListener('popstate',this.onNavigation);window.removeEventListener('offline',this.offline);window.removeEventListener('online',this.online);const client=this.client;this.client=null;await client?.close();}
}
