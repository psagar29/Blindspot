import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useBlindspot, useRuntimeStore } from './context';
import { WorldScene } from '../engine/scene';
import { DepthSensor } from '../engine/depth';

function Renderer({overlay,follow,onError,onReady}:{overlay:boolean;follow:boolean;onError:(s:string)=>void;onReady:(s:string)=>void}){
  const {gl,size}=useThree(),{state}=useBlindspot(),store=useRuntimeStore(),ref=useRef<WorldScene|null>(null);
  const scenario=state.scenario;
  useEffect(()=>{if(!scenario)return;const scene=new WorldScene(gl,scenario);ref.current=scene;store.attachScene(scene);
    if(import.meta.env.DEV)Object.assign(window,{__blindspotScene:scene,__DepthSensor:DepthSensor});
    scene.load().then(()=>{if(ref.current!==scene)return;store.sceneReady();onError('');onReady(`Collider floor ${scene.registration.floorHeightM?.toFixed(3)??'unavailable'} m · white ruler 1 m · GPU plane error ${scene.registration.depthCheck?.maxErrorM.toExponential(1)} m`);}).catch(error=>onError(error instanceof Error&&error.message.startsWith('GPU_DEPTH_PROBE')?error.message:'World assets or GPU depth validation failed. Metric evaluation is unavailable.'));
    return()=>{store.attachScene(null);ref.current=null;scene.dispose();};
  // Subscription updates return new object identities; immutable versions govern GPU rebuilds.
  },[gl,scenario?.id,scenario?.version,scenario?.world.version,store,onError,onReady]);
  useEffect(()=>ref.current?.setOverlay(overlay),[overlay]);
  useEffect(()=>ref.current?.setFollow(follow),[follow]);
  useFrame(()=>ref.current?.render(size.width,size.height),1);return null;
}
// A's ViewportShell owns the corner labels and the time / run-id row; this layer only adds
// the WebGL canvas plus one registration line above that row, so nothing overlaps.
const chip:React.CSSProperties={font:'12px "IBM Plex Mono","SF Mono",monospace',letterSpacing:'0.04em',color:'#eef3f6',background:'rgba(17,24,32,0.78)',border:'1px solid #25333d',borderRadius:6,padding:'4px 8px'};
export default function BlindspotViewport(){const {state}=useBlindspot(),[overlay,setOverlay]=useState(false),[follow,setFollow]=useState(true),[error,setError]=useState(''),[ready,setReady]=useState('Loading calibrated geometry…');
  if(state.route.kind!=='workspace')return null;if(!state.scenario)return <div role="status">Prepare a world to open the 3D workspace.</div>;
  return <div style={{position:'absolute',inset:0,background:'#101719'}}>
    <Canvas gl={{antialias:false,alpha:false}} dpr={[1,1.5]} fallback={<p>WebGL is unavailable. Controller and published reports remain accessible.</p>}><Suspense fallback={null}><Renderer overlay={overlay} follow={follow} onError={setError} onReady={setReady}/></Suspense></Canvas>
    <div style={{position:'absolute',left:16,right:16,bottom:52,display:'flex',gap:8,alignItems:'center',justifyContent:'flex-start',pointerEvents:'none',flexWrap:'nowrap',minWidth:0}}>
      <button type="button" onClick={()=>setFollow(!follow)} aria-pressed={follow} style={{...chip,pointerEvents:'auto',cursor:'pointer',whiteSpace:'nowrap',borderColor:follow?'#74e5dc':'#25333d'}}>{follow?'Following rover':'Free camera'}</button>
      <button type="button" onClick={()=>setOverlay(!overlay)} aria-pressed={overlay} style={{...chip,pointerEvents:'auto',cursor:'pointer',whiteSpace:'nowrap',borderColor:overlay?'#93fbca':'#25333d'}}>{overlay?'Hide':'Show'} collider</button>
      <span role="status" title={`${error||ready}. Drag to orbit, scroll to zoom.`} style={{...chip,color:error?'#f2b8a8':'#aebac4',borderColor:error?'#a33422':'#25333d',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>{error||ready} · drag to orbit, scroll to zoom</span>
    </div>
  </div>;
}
