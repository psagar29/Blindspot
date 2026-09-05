import type { HazardInstance, Platform, Pose, Vec3 } from '../../shared/contracts';
import { add, distance, lerp, localPoint, scale, segmentBoxDistance, segmentDistance } from './math';

// The physical envelope is a vertical capsule, independent of its decorative GLB.
export function robotAxis(pose: Pose,p: Platform): [Vec3,Vec3] {
  return [add(pose.positionM,[0,p.radiusM,0]),add(pose.positionM,[0,Math.max(p.radiusM,p.heightM-p.radiusM),0])];
}
export function clearance(pose: Pose,p: Platform,h: HazardInstance) {
  const [a,b]=robotAxis(pose,p),g=h.geometry;
  if(g.kind==='cable')return segmentDistance(a,b,g.startM,g.endM)-p.radiusM-g.diameterM/2;
  return segmentBoxDistance(localPoint(a,g.pose),localPoint(b,g.pose),scale(g.dimensionsM,0.5))-p.radiusM;
}
export function sweptContact(from: Pose,to: Pose,p: Platform,hazards: readonly HazardInstance[]) {
  const smallest=Math.min(0.004,...hazards.flatMap(h=>h.geometry.kind==='cable'?[h.geometry.diameterM/4]:[]));
  const count=Math.max(1,Math.ceil(distance(from.positionM,to.positionM)/smallest));
  if(count>10000)throw new Error('Unbounded collision step');
  for(let i=0;i<=count;i++){const pose={...from,positionM:lerp(from.positionM,to.positionM,i/count)};
    for(const h of hazards)if(clearance(pose,p,h)<=0)return {hazardId:h.id,fraction:i/count,pose};}
  return null;
}
