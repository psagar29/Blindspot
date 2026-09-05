import * as THREE from 'three';
import type { Vec3 } from '../../shared/contracts';

type Entry={triangle:THREE.Triangle;hazardId?:string};
type Node={bounds:THREE.Box3;left?:Node;right?:Node;triangles?:Entry[]};
function build(triangles:Entry[]):Node {
  const bounds=new THREE.Box3();for(const {triangle:t} of triangles)bounds.expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c);
  if(triangles.length<=16)return {bounds,triangles};
  const extent=bounds.getSize(new THREE.Vector3()),axis=extent.x>=extent.y&&extent.x>=extent.z?'x':extent.y>=extent.z?'y':'z';
  triangles.sort(({triangle:a},{triangle:b})=>(a.a[axis]+a.b[axis]+a.c[axis])-(b.a[axis]+b.b[axis]+b.c[axis]));const mid=Math.floor(triangles.length/2);
  return {bounds,left:build(triangles.slice(0,mid)),right:build(triangles.slice(mid))};
}
// Static world triangles are indexed once; each cable ray visits intersecting bounds only.
export class OcclusionIndex {
  private root:Node;private ray=new THREE.Ray();private hit=new THREE.Vector3();
  constructor(object:THREE.Object3D){const triangles:Entry[]=[];object.updateMatrixWorld(true);
    object.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position'),indices=o.geometry.index;
      for(let i=0;i<(indices?.count??p.count);i+=3){const at=(j:number)=>new THREE.Vector3().fromBufferAttribute(p,indices?indices.getX(j):j).applyMatrix4(o.matrixWorld);triangles.push({triangle:new THREE.Triangle(at(i),at(i+1),at(i+2)),hazardId:o.userData.hazardId});}});
    this.root=build(triangles);
  }
  occluded=(from:Vec3,to:Vec3,ignoreId?:string):boolean=>{
    const origin=new THREE.Vector3(...from),end=new THREE.Vector3(...to),length=origin.distanceTo(end)-0.0005;this.ray.set(origin,end.sub(origin).normalize());
    const visit=(node:Node):boolean=>{if(!this.ray.intersectBox(node.bounds,this.hit))return false;
      if(!node.bounds.containsPoint(origin)&&this.hit.distanceTo(origin)>length)return false;
      if(node.triangles)return node.triangles.some(({triangle:t,hazardId})=>(!ignoreId||hazardId!==ignoreId)&&!!this.ray.intersectTriangle(t.a,t.b,t.c,false,this.hit)&&this.hit.distanceTo(origin)>0.0001&&this.hit.distanceTo(origin)<length);
      return !!((node.left&&visit(node.left))||(node.right&&visit(node.right)));};return visit(this.root);
  };
}
