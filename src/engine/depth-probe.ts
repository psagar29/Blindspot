import * as THREE from 'three';
import type { Scenario } from '../../shared/contracts';
import { DepthSensor, depthMaterial } from './depth';
import { createSensorConfig } from './presets';

// Browser acceptance probe, using actual GPU bytes through the production sensor.
export function checkGpuDepth(renderer:THREE.WebGLRenderer,scenario:Scenario){
  const proxy=new THREE.Scene(),material=depthMaterial(1,12);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(2,0.2),material);plane.position.set(0,0.35,-2);proxy.add(plane);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),material);floor.rotation.x=-Math.PI/2;floor.position.y=0.04;proxy.add(floor);
  const sensor=new DepthSensor(renderer,proxy,{...scenario,hazards:[]},createSensorConfig('baseline').sensors[0]!);
  try{const frame=sensor.capture({positionM:[0,0,0],orientation:[0,0,0,1]}),maxErrorM=Math.max(...frame.points.map(p=>Math.abs(p.positionM[2]+2)));
    if(frame.points.length<100||maxErrorM>0.001)throw new Error(`GPU_DEPTH_PROBE points=${frame.points.length} maxErrorM=${maxErrorM} raster=${JSON.stringify(sensor.diagnostics)}`);
    return {pointCount:frame.points.length,maxErrorM,floorExcluded:true};
  }finally{sensor.dispose();material.dispose();plane.geometry.dispose();floor.geometry.dispose();}
}
