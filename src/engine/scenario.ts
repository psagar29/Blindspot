import type { AssetRef, HazardLibraryItem, Scenario, World } from '../../shared/contracts';

/** Mint supplies only the decorative body; platform radius and height remain the collision envelope. */
export const MINT_PLATFORM_ASSET: AssetRef = {
  id: 'mint-teal-stripe-scout-rover',
  source: 'mint',
  url: '/api/local/assets/85f69933396b670d9b46c8d3cdd61167a106567e3a28b0ff9ad15693ce3bc845.glb',
  thumbnailUrl: '/api/local/assets/36df607ab5e8af64620c933bcf5012e7d02d1d990094633458dd019f40b39850.webp',
  sha256: '85f69933396b670d9b46c8d3cdd61167a106567e3a28b0ff9ad15693ce3bc845',
  providerTaskId: 'ks74ch8bya740cjkcz9zp55adx8dtnmn',
  createdAt: '2026-09-05T20:08:25.380Z',
};

export const AUTHORED_BULK_HAZARD: HazardLibraryItem = {
  id: 'authored-equipment-crate',
  version: 1,
  name: 'Authored equipment crate',
  type: 'bulk',
  dimensionsM: [0.7, 0.55, 0.6],
  dimensionEvidence: 'assumed',
  materialClass: 'opaque',
  returnAssumption: 'Procedural collision box used as an opaque detection control. Dimensions and sensor return are authored assumptions; Mint supplies the separate generated robot body.',
};

export function cableLibrary(): HazardLibraryItem[] {return [0.008,0.016].map((d,i)=>({id:`cable-${i+1}`,version:1,name:`${d*1000} mm authored cable`,type:'cable',dimensionsM:[2.4,d,d],dimensionEvidence:'assumed',materialClass:'opaque',returnAssumption:'Exact procedural geometry. Passive-stereo width threshold; no measured material-response claim.'}));}
export function createScenario(world: World,bulk: HazardLibraryItem=AUTHORED_BULK_HAZARD,sentence='Evaluate the warehouse ground route with two cables and an equipment crate.',version=1): Scenario {
  if(sentence.length<1||sentence.length>1024)throw new Error('Use a sentence between 1 and 1024 characters.');
  if(/\b(aerial|drone|lidar|tof|fly|flying)\b/i.test(sentence))throw new Error('This ground preset supports a robot, two cables and one bulk obstacle. Aerial and other sensors are not evaluated.');
  const cables=cableLibrary();
  return {id:`scenario-${world.id}`,version,world,seed:20260905,authoring:'preset',sentence,
    hazards:[...cables.map((item,i)=>({id:item.id,libraryItem:item,geometry:{kind:'cable' as const,startM:[-1.2,0.35,-3.5-i*3] as const,endM:[1.2,0.35,-3.5-i*3] as const,diameterM:item.dimensionsM[1]},placementSource:'preset' as const,observedInPhoto:false,justification:'Authored perpendicular stress span across the fixed route; dimensions are assumptions, not photo measurements.'})),
      {id:'bulk-1',libraryItem:bulk,geometry:{kind:'box',pose:{positionM:[0,bulk.dimensionsM[1]/2,-9.5],orientation:[0,0,0,1]},dimensionsM:bulk.dimensionsM},placementSource:'preset',observedInPhoto:false,justification:'Authored bulk obstacle used as an opaque detection control.'}],
    route:[{positionM:[0,0,0],orientation:[0,0,0,1]},{positionM:[0,0,-11],orientation:[0,0,0,1]}],
    platform:{mode:'ground',radiusM:0.25,heightM:0.7,speedMps:1.1,brakingDecelerationMps2:1.3,controlLatencyS:0.15,clearanceMarginM:0.08,visualAsset:MINT_PLATFORM_ASSET},
    assumptions:['Preset authoring: sentence selects the supported ground demonstration, not arbitrary scene reconstruction.','Two exact cables and one bulk envelope are authored stress tests, not observed infrastructure.','World reconstruction and reference scale remain estimates. Ground motion is a kinematic vertical capsule with finite braking.'],
  };
}
