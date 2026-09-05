import type { AppActions, Mat4, World } from '../../shared/contracts';

export function rescaleMatrix(m:Mat4,ratio:number):Mat4 {
  if(m.length!==16||!m.every(Number.isFinite)||!Number.isFinite(ratio)||ratio<=0)throw new Error('Invalid metric transform');
  return m.map((v,i)=>i%4===3?v:v*ratio);
}
export function confirmWorldCalibration(world:World,input:Parameters<AppActions['confirmCalibration']>[0],registrationInspected:boolean):World {
  if(input.worldId!==world.id||!registrationInspected)throw new Error('Load and inspect the splat, collider floor, axes and 1 m ruler before confirming calibration.');
  if(!Number.isFinite(input.referenceLengthM)||input.referenceLengthM<0.01||input.referenceLengthM>100||!Number.isFinite(input.correctionFactor)||input.correctionFactor<0.1||input.correctionFactor>10||!input.referenceLabel.trim()||input.referenceLabel.length>200||!['operator_measured','assumed'].includes(input.evidence))throw new Error('Invalid reference or correction.');
  const ratio=input.correctionFactor/world.calibration.correctionFactor;
  return {...world,version:world.version+1,calibration:{...world.calibration,status:'verified',source:input.evidence==='operator_measured'?'operator_reference':'estimated_reference',
    reference:{label:input.referenceLabel.trim(),lengthM:input.referenceLengthM,evidence:input.evidence},correctionFactor:input.correctionFactor,
    splatToWorld:rescaleMatrix(world.calibration.splatToWorld,ratio),colliderToWorld:rescaleMatrix(world.calibration.colliderToWorld,ratio),
    uncertaintyNote:(world.name.toLowerCase().includes('text-generated')?'Text-generated fallback; source preview is generated imagery, not a site photograph. ':'')+(input.evidence==='operator_measured'?'Operator supplied a measured reference and confirmed visual registration; reconstructed surfaces remain approximate.':'Operator confirmed visual registration with an assumed reference. Absolute dimensions remain estimated; no physical measurement is claimed.'),verifiedAt:new Date().toISOString()}};
}
