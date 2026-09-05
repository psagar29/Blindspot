import { Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RuntimeRoot, useBlindspot, BlindspotViewport } from './index';
import { useRuntimeStore } from './context';

function Harness(){const {state,actions}=useBlindspot(),store=useRuntimeStore(),[sentence,setSentence]=useState('Evaluate two cables and one equipment crate on the ground route.');
  const report=state.report;return <main style={{fontFamily:'system-ui',padding:24,color:'#e8eeeb',background:'#152024',minHeight:'100vh',boxSizing:'border-box'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h1 style={{marginTop:0}}>Blindspot <small style={{fontSize:14,color:'#a9b9b4'}}>engine harness</small></h1><span>{state.mode} / {state.connection} / {state.status}</span></header>
    {state.route.kind==='workspace'&&<><p>{state.world?.name||'Local operator workspace'} · {state.world?.calibration.status||'no world'} · Preset authoring</p>
      <div style={{height:'65vh',minHeight:460}}><Suspense fallback={<p>Loading 3D renderer...</p>}><BlindspotViewport/></Suspense></div>
      <div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:18}}>
        <button disabled={!state.world} onClick={()=>state.world&&void actions.confirmCalibration({worldId:state.world.id,referenceLabel:'Assumed meter reference after floor, axes and ruler inspection',referenceLengthM:1,evidence:'assumed',correctionFactor:1})}>Confirm inspected estimated scale</button>
        <button disabled={!state.capabilities.run} onClick={()=>void actions.startRun()}>Run evaluation</button><button onClick={()=>actions.setPlayback('playing')}>Replay result</button><button onClick={()=>actions.setPlayback('paused')}>Pause</button>
        <button disabled={!state.capabilities.publish} onClick={()=>void actions.publishReport()}>Publish report</button>
        {import.meta.env.DEV&&state.session&&<button onClick={()=>store.openLocalControllerTest()}>Open local controller test</button>}
      </div><form onSubmit={e=>{e.preventDefault();void actions.authorScenario({sentence});}} style={{display:'flex',gap:8,marginTop:12}}><input aria-label="Scenario sentence" value={sentence} onChange={e=>setSentence(e.target.value)} style={{flex:1,padding:10}}/><button disabled={!state.capabilities.authoring}>Author preset</button></form></>}
    {state.route.kind!=='report'&&<div style={{display:'flex',gap:10,marginTop:16}}>{(['baseline','higher_resolution','permissive'] as const).map(id=><button key={id} aria-pressed={state.config?.presetId===id} onClick={()=>void actions.requestConfig(id)}>{id.replaceAll('_',' ')}</button>)}</div>}
    {state.route.kind==='controller'&&<p>{state.session?.operatorOnline?'Operator online':'Waiting for operator'} · requested {state.session?.requestedConfigVersion} · completed {state.session?.completedConfigVersion}</p>}
    <p role="status">{state.stageLabel}</p>{state.frame&&<p>Sample time {state.frame.timeMs} ms · {state.frame.perceivedPointCount} perceived points · {state.frame.pass}</p>}{state.error&&<p role="alert" style={{color:'#ffb69a'}}>{state.error.message}</p>}
    {(state.latestRun||report)&&<section><h2>{report?.title||'Computed result'}</h2><p>Coverage: {(report?.run||state.latestRun)!.coverage.percent?.toFixed(1)??'Not evaluated'}% · Outcome: {(report?.run||state.latestRun)!.outcome.termination}</p><pre style={{whiteSpace:'pre-wrap',fontSize:12}}>{JSON.stringify(report||state.latestRun,null,2)}</pre></section>}
    {state.reportUrl&&<a href={state.reportUrl}>Open immutable report</a>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<RuntimeRoot><Harness/></RuntimeRoot>);
