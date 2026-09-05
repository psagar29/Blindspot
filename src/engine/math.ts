import type { Mat4, Pose, Quaternion, Vec3 } from '../../shared/contracts';

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0]*k,a[1]*k,a[2]*k];
export const dot = (a: Vec3, b: Vec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const length = (a: Vec3) => Math.sqrt(dot(a,a));
export const distance = (a: Vec3,b: Vec3) => length(sub(a,b));
export const clamp = (n: number, a: number, b: number) => Math.max(a,Math.min(b,n));
export const lerp = (a: Vec3,b: Vec3,t: number) => add(a,scale(sub(b,a),t));
export const unit = (a: Vec3) => scale(a,1/(length(a)||1));
export const inverseQ = (q: Quaternion): Quaternion => [-q[0],-q[1],-q[2],q[3]];
export function rotate(v: Vec3,q: Quaternion): Vec3 {
  const [x,y,z,w]=q, [vx,vy,vz]=v;
  const tx=2*(y*vz-z*vy), ty=2*(z*vx-x*vz), tz=2*(x*vy-y*vx);
  return [vx+w*tx+y*tz-z*ty,vy+w*ty+z*tx-x*tz,vz+w*tz+x*ty-y*tx];
}
export function multiplyQ(a: Quaternion,b: Quaternion): Quaternion {
  return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
}
export const localPoint = (p: Vec3,pose: Pose) => rotate(sub(p,pose.positionM),inverseQ(pose.orientation));
export const worldPoint = (p: Vec3,pose: Pose) => add(rotate(p,pose.orientation),pose.positionM);
export function transform(p: Vec3,m: Mat4): Vec3 {
  if (m.length!==16 || !m.every(Number.isFinite)) throw new Error('Invalid transform');
  const [x,y,z]=p, w=m[3]!*x+m[7]!*y+m[11]!*z+m[15]!;
  if (Math.abs(w)<1e-12) throw new Error('Invalid homogeneous coordinate');
  return [(m[0]!*x+m[4]!*y+m[8]!*z+m[12]!)/w,(m[1]!*x+m[5]!*y+m[9]!*z+m[13]!)/w,(m[2]!*x+m[6]!*y+m[10]!*z+m[14]!)/w];
}
export function segmentDistance(a: Vec3,b: Vec3,c: Vec3,d: Vec3) {
  const u=sub(b,a), v=sub(d,c), w=sub(a,c), aa=dot(u,u),bb=dot(u,v),cc=dot(v,v),dd=dot(u,w),ee=dot(v,w);
  if(aa<1e-14) return distance(a,lerp(c,d,cc?clamp(ee/cc,0,1):0));
  if(cc<1e-14) return distance(c,lerp(a,b,clamp(-dd/aa,0,1)));
  const den=aa*cc-bb*bb;
  let s=den>1e-14?clamp((bb*ee-cc*dd)/den,0,1):0;
  let t=(bb*s+ee)/cc;
  if(t<0){t=0;s=clamp(-dd/aa,0,1);}else if(t>1){t=1;s=clamp((bb-dd)/aa,0,1);}
  return distance(lerp(a,b,s),lerp(c,d,t));
}
export function pointBoxDistance(p: Vec3,half: Vec3) {
  return Math.hypot(...p.map((n,i)=>Math.max(0,Math.abs(n)-half[i]!)));
}
export function segmentBoxDistance(a: Vec3,b: Vec3,half: Vec3) {
  let lo=0,hi=1;
  for(let i=0;i<40;i++){const u=(2*lo+hi)/3,v=(lo+2*hi)/3;
    if(pointBoxDistance(lerp(a,b,u),half)<pointBoxDistance(lerp(a,b,v),half))hi=v;else lo=u;}
  return Math.min(pointBoxDistance(a,half),pointBoxDistance(b,half),pointBoxDistance(lerp(a,b,(lo+hi)/2),half));
}
export function rayBox(origin: Vec3,target: Vec3,pose: Pose,size: Vec3): number|null {
  const o=localPoint(origin,pose),d=sub(localPoint(target,pose),o);let near=0,far=1;
  for(let i=0;i<3;i++){const h=size[i]!/2;if(Math.abs(d[i]!)<1e-12){if(Math.abs(o[i]!)>h)return null;continue;}
    const a=(-h-o[i]!)/d[i]!,b=(h-o[i]!)/d[i]!;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return null;}
  return near;
}
export function routeLength(route: readonly Pose[]) { return route.slice(1).reduce((n,p,i)=>n+distance(p.positionM,route[i]!.positionM),0); }
export function routePose(route: readonly Pose[],s: number): Pose {
  if(!route.length)throw new Error('Route is empty');
  for(let i=1;i<route.length;i++){const n=distance(route[i-1]!.positionM,route[i]!.positionM);
    if(s<=n){const d=unit(sub(route[i]!.positionM,route[i-1]!.positionM)),yaw=Math.atan2(-d[0],-d[2]);
      return {positionM:lerp(route[i-1]!.positionM,route[i]!.positionM,n?clamp(s/n,0,1):0),orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)]};}s-=n;}
  return route[route.length-1]!;
}
