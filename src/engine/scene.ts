import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import type { HazardInstance, Pose, Scenario, SensorConfig, Vec3 } from '../../shared/contracts';
import { DepthSensor, depthMaterial } from './depth';
import { evaluate, type Evaluation, type PlaybackFrame } from './evaluate';
import { robotAxis } from './geometry';
import { segmentDistance } from './math';
import { checkGpuDepth } from './depth-probe';

const vector=(p:Vec3)=>new THREE.Vector3(...p);
function disposeObject(root:THREE.Object3D) {root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof THREE.Texture)value.dispose();m.dispose();}}});}
export function hazardMesh(h:HazardInstance,material:THREE.Material) {
  const g=h.geometry;let mesh:THREE.Mesh;
  if(g.kind==='cable'){const a=vector(g.startM),b=vector(g.endM);mesh=new THREE.Mesh(new THREE.CylinderGeometry(g.diameterM/2,g.diameterM/2,a.distanceTo(b),12),material);mesh.position.copy(a).lerp(b,0.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());}
  else{mesh=new THREE.Mesh(new THREE.BoxGeometry(...g.dimensionsM),material);mesh.position.set(...g.pose.positionM);mesh.quaternion.set(...g.pose.orientation);}
  mesh.userData.hazardId=h.id;return mesh;
}
class EnvironmentCollider {
  private cells=new Map<string,THREE.Triangle[]>();
  constructor(root:THREE.Object3D) {
    root.updateMatrixWorld(true);
    root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position'),index=o.geometry.index;
      for(let i=0;i<(index?.count??p.count);i+=3){const vertex=(j:number)=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(j):j).applyMatrix4(o.matrixWorld);
        const t=new THREE.Triangle(vertex(i),vertex(i+1),vertex(i+2)),normal=t.getNormal(new THREE.Vector3());
        if(Math.abs(normal.y)>0.85&&[t.a,t.b,t.c].every(v=>Math.abs(v.y)<0.08))continue;
        const box=new THREE.Box3().setFromPoints([t.a,t.b,t.c]);if(box.max.y<0.03||box.min.y>1.5)continue;
        for(let x=Math.floor(box.min.x);x<=Math.floor(box.max.x);x++)for(let z=Math.floor(box.min.z);z<=Math.floor(box.max.z);z++){
          const key=`${x},${z}`,cell=this.cells.get(key)||[];cell.push(t);this.cells.set(key,cell);}
      }
    });
  }
  clearance(pose:Pose,scenario:Scenario) {
    const [av,bv]=robotAxis(pose,scenario.platform),a=vector(av),b=vector(bv),radius=scenario.platform.radiusM;
    const nearby=new Set<THREE.Triangle>();for(let x=Math.floor(a.x-radius);x<=Math.floor(a.x+radius);x++)for(let z=Math.floor(a.z-radius);z<=Math.floor(a.z+radius);z++)for(const t of this.cells.get(`${x},${z}`)||[])nearby.add(t);
    let best=Infinity;const scratch=new THREE.Vector3(),axis=new THREE.Line3(a,b),axisDirection=b.clone().sub(a),axisLength=axisDirection.length();
    const ray=new THREE.Ray(a,axisDirection.normalize());
    for(const t of nearby){
      const hit=ray.intersectTriangle(t.a,t.b,t.c,false,scratch);if(hit&&hit.distanceTo(a)<=axisLength)return -radius;
      best=Math.min(best,t.closestPointToPoint(a,scratch).distanceTo(a),t.closestPointToPoint(b,scratch).distanceTo(b));
      for(const v of [t.a,t.b,t.c])best=Math.min(best,axis.closestPointToPoint(v,true,scratch).distanceTo(v));
      for(const [c,d] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]] as const)best=Math.min(best,segmentDistance(av,bv,c.toArray() as unknown as Vec3,d.toArray() as unknown as Vec3));
    }
    return best-radius;
  }
}
export class WorldScene {
  readonly truth=new THREE.Scene();readonly perceived=new THREE.Scene();readonly proxy=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(58,1,0.02,100);
  readonly controls:OrbitControls;readonly robot=new THREE.Group();private points:THREE.Points;
  private splat?:SplatMesh;private spark:SparkRenderer;private sensor?:DepthSensor;private environment?:EnvironmentCollider;
  private colliderOverlay=new THREE.Group();private collider?:THREE.Object3D;private disposed=false;
  readonly registration={loaded:false,floorHeightM:null as number|null,colliderBounds:null as number[]|null,depthCheck:null as ReturnType<typeof checkGpuDepth>|null};
  constructor(private renderer:THREE.WebGLRenderer,readonly scenario:Scenario) {
    this.truth.background=new THREE.Color('#101719');this.perceived.background=new THREE.Color('#071519');
    this.spark=new SparkRenderer({renderer});this.truth.add(this.spark);
    this.camera.position.set(0.8,1.6,1.8);this.controls=new OrbitControls(this.camera,renderer.domElement);this.controls.target.set(0,0.35,-4.5);this.controls.enableDamping=true;this.controls.maxDistance=35;this.controls.minDistance=0.5;this.controls.update();
    for(const scene of [this.truth,this.perceived]){scene.add(new THREE.HemisphereLight(0xffffff,0x333944,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,8,4);scene.add(light);
      const grid=new THREE.GridHelper(24,24,0x63777c,0x263b3e);grid.position.y=0.005;scene.add(grid);scene.add(new THREE.AxesHelper(1));}
    const ruler=new THREE.Group();for(let i=0;i<=10;i++){const tick=new THREE.Mesh(new THREE.BoxGeometry(0.007,0.004,i%5===0?0.12:0.06),new THREE.MeshBasicMaterial({color:0xffffff}));tick.position.set(i/10-0.5,0.012,0.5);ruler.add(tick);}
    const line=new THREE.Mesh(new THREE.BoxGeometry(1,0.004,0.006),new THREE.MeshBasicMaterial({color:0xffffff}));line.position.set(0,0.012,0.5);ruler.add(line);this.truth.add(ruler);
    const radius=scenario.platform.radiusM,height=scenario.platform.heightM;
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(radius,height-2*radius,8,16),new THREE.MeshStandardMaterial({color:0xb1c7b9,metalness:0.4,roughness:0.3}));body.position.y=height/2;this.robot.add(body);
    const visor=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.08,0.04),new THREE.MeshStandardMaterial({color:0x58e0e8,emissive:0x146c72}));visor.position.set(0,0.38,-radius);this.robot.add(visor);this.truth.add(this.robot);
    this.points=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0x74e5dc,size:0.028,sizeAttenuation:true}));this.perceived.add(this.points);
    scenario.hazards.forEach((h,i)=>{this.proxy.add(hazardMesh(h,depthMaterial(i+2,12)));const visual=hazardMesh(h,new THREE.MeshStandardMaterial({color:h.geometry.kind==='cable'?0xe86b38:0xe9a04f,roughness:0.6}));this.truth.add(visual);});
    const route=new THREE.BufferGeometry().setFromPoints(scenario.route.map(p=>new THREE.Vector3(p.positionM[0],0.02,p.positionM[2])));this.truth.add(new THREE.Line(route,new THREE.LineDashedMaterial({color:0x80c8ad,dashSize:0.2,gapSize:0.1})).computeLineDistances());
  }
  async load() {
    this.registration.depthCheck=checkGpuDepth(this.renderer,this.scenario);
    const loader=new GLTFLoader();
    const [gltf,splat]=await Promise.all([loader.loadAsync(this.scenario.world.collider.url),(async()=>{const s=new SplatMesh({url:this.scenario.world.splat.url,lod:false});this.splat=s;await s.initialized;return s;})()]);
    if(this.disposed){disposeObject(gltf.scene);splat.dispose();return;}
    splat.matrixAutoUpdate=false;splat.matrix.fromArray([...this.scenario.world.calibration.splatToWorld]);this.truth.add(splat);
    gltf.scene.matrixAutoUpdate=false;gltf.scene.matrix.fromArray([...this.scenario.world.calibration.colliderToWorld]);gltf.scene.updateMatrixWorld(true);this.collider=gltf.scene;
    gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.material=depthMaterial(1,12);o.userData.environment=true;}});this.proxy.add(gltf.scene);
    this.environment=new EnvironmentCollider(gltf.scene);
    const overlay=gltf.scene.clone(true);overlay.traverse(o=>{if(o instanceof THREE.Mesh)o.material=new THREE.MeshBasicMaterial({color:0x93fbca,wireframe:true,transparent:true,opacity:0.25,depthWrite:false});});this.colliderOverlay.add(overlay);this.truth.add(this.colliderOverlay);this.colliderOverlay.visible=false;
    const bounds=new THREE.Box3().setFromObject(gltf.scene);this.registration.colliderBounds=[...bounds.min.toArray(),...bounds.max.toArray()];
    const ray=new THREE.Raycaster(new THREE.Vector3(0,2,-2),new THREE.Vector3(0,-1,0));this.registration.floorHeightM=ray.intersectObject(gltf.scene,true)[0]?.point.y??null;
    await Promise.all(this.scenario.hazards.map(async h=>{if(h.geometry.kind!=='box'||!h.libraryItem.asset)return;const box=h.geometry;await loader.loadAsync(h.libraryItem.asset.url).then(model=>{if(this.disposed){disposeObject(model.scene);return;}
      const b=new THREE.Box3().setFromObject(model.scene),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());const group=new THREE.Group();model.scene.position.sub(center);group.add(model.scene);group.scale.set(box.dimensionsM[0]/size.x,box.dimensionsM[1]/size.y,box.dimensionsM[2]/size.z);group.position.set(...box.pose.positionM);group.quaternion.set(...box.pose.orientation);this.truth.add(group);
      const proxyVisual=this.truth.children.find(o=>o.userData.hazardId===h.id);if(proxyVisual)proxyVisual.visible=false;
    });}));
    this.registration.loaded=true;
    const mint=this.scenario.platform.visualAsset;
    if(mint)loader.loadAsync(mint.url).then(model=>{if(this.disposed){disposeObject(model.scene);return;}const b=new THREE.Box3().setFromObject(model.scene),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());model.scene.position.sub(center);const visual=new THREE.Group();visual.add(model.scene);visual.scale.setScalar(Math.min(0.5/size.x,0.6/size.y,0.5/size.z));visual.position.y=0.35;this.robot.children.forEach(o=>o.visible=false);this.robot.add(visual);}).catch(()=>{});
  }
  setOverlay(value:boolean){this.colliderOverlay.visible=value;}
  setFrame(frame:PlaybackFrame|null) {
    if(!frame)return;this.robot.position.set(...frame.pose.positionM);this.robot.quaternion.set(...frame.pose.orientation);
    const data=new Float32Array(frame.points.flatMap(p=>[...p.positionM]));this.points.geometry.dispose();this.points.geometry=new THREE.BufferGeometry();this.points.geometry.setAttribute('position',new THREE.BufferAttribute(data,3));
  }
  async run(config:SensorConfig,runId:string,onFrame:(frame:PlaybackFrame)=>void):Promise<Evaluation> {
    if(!this.registration.loaded||!this.environment)throw new Error('World geometry is still loading.');
    this.sensor?.dispose();this.sensor=new DepthSensor(this.renderer,this.proxy,this.scenario,config.sensors[0]!);
    return evaluate(this.scenario,config,{runId,sample:this.sensor.capture,environmentClearance:pose=>this.environment!.clearance(pose,this.scenario),onProgress:({frame})=>{this.setFrame(frame);onFrame(frame);},yieldControl:()=>new Promise<void>((resolve,reject)=>{setTimeout(()=>this.disposed?reject(new Error('Viewport closed during evaluation.')):resolve(),0);})});
  }
  render(width:number,height:number) {
    if(this.disposed)return;this.controls.update();const half=Math.floor(width/2);this.camera.aspect=half/height;this.camera.updateProjectionMatrix();
    this.renderer.setScissorTest(true);this.renderer.setViewport(0,0,half,height);this.renderer.setScissor(0,0,half,height);this.renderer.render(this.truth,this.camera);
    this.renderer.setViewport(half,0,width-half,height);this.renderer.setScissor(half,0,width-half,height);this.renderer.render(this.perceived,this.camera);this.renderer.setScissorTest(false);
  }
  dispose(){this.disposed=true;this.controls.dispose();this.sensor?.dispose();this.splat?.dispose();this.spark.dispose();disposeObject(this.truth);disposeObject(this.perceived);if(this.collider)disposeObject(this.collider);}
}
