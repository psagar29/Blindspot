import type { HazardInstance, Pose, Scenario, StereoSensor, Vec3 } from '../../shared/contracts';
import { lerp, localPoint, multiplyQ, rayBox, worldPoint } from './math';

export interface PerceivedPoint { positionM: Vec3; hazardId?: string }
export interface SensorFrame { points: PerceivedPoint[]; candidates: string[]; unknown: string[]; method: 'raster'|'analytic_with_occlusion' }
export type SampleSensor = (pose: Pose) => SensorFrame;
export const intrinsics=(s: StereoSensor)=>({fx:s.widthPx/(2*Math.tan(s.horizontalFovRad/2)),fy:s.widthPx/(2*Math.tan(s.horizontalFovRad/2)),cx:s.widthPx/2,cy:s.heightPx/2});
export function cameraPose(robot: Pose,s: StereoSensor): Pose {return {positionM:worldPoint(s.mount.positionM,robot),orientation:multiplyQ(robot.orientation,s.mount.orientation)};}
export function project(point: Vec3,s: StereoSensor) {
  const depth=-point[2];if(!Number.isFinite(depth)||depth<s.nearM||depth>s.farM)return null;
  const {fx,fy,cx,cy}=intrinsics(s);const u=fx*point[0]/depth+cx,v=cy-fy*point[1]/depth;
  return u>=0&&u<s.widthPx&&v>=0&&v<s.heightPx?{u,v,depth}:null;
}
export function backProject(u: number,v: number,depth: number,s: StereoSensor): Vec3|null {
  if(![u,v,depth].every(Number.isFinite)||depth<s.nearM||depth>s.farM||u<0||v<0||u>=s.widthPx||v>=s.heightPx)return null;
  const {fx,fy,cx,cy}=intrinsics(s);return [(u-cx)*depth/fx,(cy-v)*depth/fy,-depth];
}
export function linearDepth(z: number,near: number,far: number) {
  if(!Number.isFinite(z)||z<0||z>=1)return null;
  return 2*near*far/(far+near-(2*z-1)*(far-near));
}
export const projectedCableWidth=(diameter: number,depth: number,s: StereoSensor)=>intrinsics(s).fx*diameter/depth;
export const thresholdRange=(diameter: number,s: StereoSensor)=>intrinsics(s).fx*diameter/s.minResolvableWidthPx;
export function hazardSamples(h: HazardInstance): Vec3[] {
  const g=h.geometry;
  if(g.kind==='cable')return Array.from({length:25},(_,i)=>lerp(g.startM,g.endM,i/24));
  const points: Vec3[]=[];
  for(const x of [-0.5,0,0.5])for(const y of [-0.5,0,0.5])for(const z of [-0.5,0,0.5])
    if(x!==0||y!==0||z!==0)points.push(worldPoint([x*g.dimensionsM[0],y*g.dimensionsM[1],z*g.dimensionsM[2]],g.pose));
  return points;
}
export function analyticSampler(scenario: Scenario,s: StereoSensor,occluded?: (from: Vec3,to: Vec3,ignoreId: string)=>boolean, cablesOnly=false): SampleSensor {
  return robot=>{
    const camera=cameraPose(robot,s),points:PerceivedPoint[]=[],candidates:string[]=[];
    for(const h of scenario.hazards){if(cablesOnly&&h.geometry.kind!=='cable')continue;let ideal=false;
      for(const p of hazardSamples(h)){
        const projection=project(localPoint(p,camera),s);if(!projection)continue;
        const blocked=scenario.hazards.some(other=>other.id!==h.id&&other.geometry.kind==='box'&&
          (()=>{const hit=rayBox(camera.positionM,p,other.geometry.pose,other.geometry.dimensionsM);return hit!==null&&hit<1-1e-5;})());
        if(blocked||occluded?.(camera.positionM,p,h.id))continue;
        ideal=true;
        if(h.geometry.kind==='cable'&&projectedCableWidth(h.geometry.diameterM,projection.depth,s)<s.minResolvableWidthPx)continue;
        points.push({positionM:p,hazardId:h.id});
      }
      if(ideal)candidates.push(h.id);
    }
    return {points,candidates,unknown:[],method:'analytic_with_occlusion'};
  };
}
// Quantize once, then test a disk inflated by robot radius once. Floor/self are excluded at input.
export function occupancy(points: PerceivedPoint[],pose: Pose,cellM=0.025) {
  const cells=new Map<string,Vec3>();
  for(const p of points){const local=localPoint(p.positionM,pose);if(local[1]<0.03||local[1]>1.2)continue;
    const x=Math.round(local[0]/cellM)*cellM,z=Math.round(local[2]/cellM)*cellM;cells.set(`${x},${z}`,[x,local[1],z]);}
  return [...cells.values()];
}
export function obstacleClearance(points: PerceivedPoint[],pose: Pose,radius: number,height: number): number|null {
  let nearest=Infinity;
  for(const p of occupancy(points,pose)){
    if(p[1]>height||p[2]>=0||Math.abs(p[0])>radius)continue;
    // Forward capsule envelope at this lateral offset. No second radius in stopping threshold.
    nearest=Math.min(nearest,-p[2]-Math.sqrt(Math.max(0,radius*radius-p[0]*p[0])));
  }
  return Number.isFinite(nearest)?nearest:null;
}
