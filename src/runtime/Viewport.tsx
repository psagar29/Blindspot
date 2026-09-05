import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useBlindspot, useRuntimeStore } from './context';
import { WorldScene } from '../engine/scene';

function Renderer({overlay,onError,onReady}:{overlay:boolean;onError:(s:string)=>void;onReady:(s:string)=>void}){
  const {gl,size}=useThree(),{state}=useBlindspot(),store=useRuntimeStore(),ref=useRef<WorldScene|null>(null);
  const scenario=state.scenario;
  useEffect(()=>{if(!scenario)return;const scene=new WorldScene(gl,scenario);ref.current=scene;store.attachScene(scene);
    scene.load().then(()=>{if(ref.current!==scene)return;store.sceneReady();onError('');onReady(`Collider floor: ${scene.registration.floorHeightM?.toFixed(3)??'unavailable'} m. White ruler: 1 m. GPU plane error: ${scene.registration.depthCheck?.maxErrorM.toExponential(1)} m; floor excluded.`);}).catch(error=>onError(error instanceof Error&&error.message.startsWith('GPU_DEPTH_PROBE')?error.message:'World assets or GPU depth validation failed. Metric evaluation is unavailable.'));
    return()=>{store.attachScene(null);ref.current=null;scene.dispose();};
  // Subscription updates return new object identities; immutable versions govern GPU rebuilds.
  },[gl,scenario?.id,scenario?.version,scenario?.world.version,store,onError,onReady]);
  useEffect(()=>ref.current?.setOverlay(overlay),[overlay]);
  useFrame(()=>ref.current?.render(size.width,size.height),1);return null;
}
export default function BlindspotViewport(){const {state}=useBlindspot(),[overlay,setOverlay]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState('Loading calibrated geometry...');
  if(state.route.kind!=='workspace')return null;if(!state.scenario)return <div role="status">Prepare a world to open the 3D workspace.</div>;
  return <div style={{position:'relative',height:'100%',minHeight:460,background:'#101719',borderRadius:14,overflow:'hidden'}}>
    <Canvas gl={{antialias:false,alpha:false}} dpr={[1,1.5]} fallback={<p>WebGL is unavailable. Controller and published reports remain accessible.</p>}><Suspense fallback={null}><Renderer overlay={overlay} onError={setError} onReady={setReady}/></Suspense></Canvas>
    <div style={{position:'absolute',inset:'12px 16px auto',display:'flex',justifyContent:'space-between',pointerEvents:'none',color:'#dce9e5',font:'12px monospace'}}><span>GROUND TRUTH</span><span>MODELED PERCEPTION</span></div>
    <div style={{position:'absolute',bottom:12,left:16,right:16,display:'flex',gap:12,alignItems:'center',color:'#dce9e5',fontSize:12}}><button type="button" onClick={()=>setOverlay(!overlay)}>{overlay?'Hide':'Show'} collider</button><span role="status">{error||ready} Drag to orbit; scroll to zoom.</span></div>
  </div>;
}
