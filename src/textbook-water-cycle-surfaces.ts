import type { Mesh } from 'three';
import { THREE as T } from './reference/engine.js';
import { applyEarthScan } from './textbook-earth-scan';
import type { TextbookGeometry } from './textbook-geometry';
import { waterCycleCoastX, waterCycleRiverLevel, waterCycleRiverZ, waterCycleTerrainHeight } from './textbook-water-cycle-model';

const smooth = T.MathUtils.smoothstep;

/** The closed sample has two different surfaces, a living watershed and its
 * sawn edge. Groundwater is shown in the permeable stratum on that edge. */
export function finishWaterCycleSurfaces(b: TextbookGeometry, land: Mesh, sea: Mesh, river: Mesh, scale: number, back: number) {
  const verts = land.geometry.attributes.position, normals = land.geometry.attributes.normal;
  const colors = new T.Float32BufferAttribute(new Float32Array(verts.count*3),3);
  const facies = new T.Float32BufferAttribute(new Float32Array(verts.count*3),3);
  const leaf = new T.Color('#7b875b'), shade = new T.Color('#576a4d'), limestone = new T.Color('#a49b86');
  const sand = new T.Color('#bfa779'), wet = new T.Color('#776a4f'), humus = new T.Color('#544738');
  const shale = new T.Color('#766a59'), silt = new T.Color('#b28e65'), gravel = new T.Color('#788577');
  const pigment = new T.Color();
  for(let i=0;i<verts.count;i++){
    const x = verts.getX(i)/scale, y = verts.getY(i)/scale, z = (verts.getZ(i)-back)/scale;
    const coast = waterCycleCoastX(z), depth = waterCycleTerrainHeight(x,z)-y;
    const local = .56*Math.sin(x*.37+z*.18)+.36*Math.cos(z*.29-x*.23);
    const cut = depth>.32 || (Math.abs(normals.getY(i))<.08 && (z>49.98||z<8.02||x<4.02||Math.abs(x-coast)<.06));
    if(cut){
      const level = y+.045*x+.55*Math.sin(x*.075+z*.1);
      const bedding = .5+.5*Math.sin(level*1.19+.55*Math.sin(level*.57));
      const aquifer = 1-smooth(Math.abs(y-(8.74-.018*x)),.55,2.6);
      const soil = 1-smooth(depth,.38,1.65);
      pigment.copy(shale).lerp(silt,.19+.65*bedding).lerp(gravel,aquifer*.85).lerp(humus,soil*.8);
      facies.setXYZ(i,.53*(1-soil)*(1-aquifer),(.31+.43*aquifer)*(1-soil),0);
    }else{
      const slope = 1-Math.abs(normals.getY(i));
      const exposure = smooth(y,17.5,31)*.70 + smooth(slope,.18,.75)*.30;
      const coastBank = 1-smooth(coast-x,.5,8);
      const nearRiver = Math.hypot(z-waterCycleRiverZ(Math.max(23,x)),Math.max(0,23-x));
      const riverBank = (1-smooth(nearRiver,1.05,3.65))*smooth(x,22,29);
      const deposit = Math.max(coastBank,riverBank*(1-.55*exposure));
      const wetted = Math.max(1-smooth(coast-x,.1,2.6),riverBank*(1-smooth(y-waterCycleRiverLevel(x),-.14,1.25)));
      pigment.copy(shade).lerp(leaf,.52+.34*local).lerp(limestone,Math.min(1,exposure)).lerp(sand,deposit).lerp(wet,wetted*.83);
      facies.setXYZ(i,exposure*(1-deposit),deposit,(1-deposit)*(1-exposure)*.83);
    }
    pigment.multiplyScalar(1+.065*local);
    colors.setXYZ(i,pigment.r,pigment.g,pigment.b);
  }
  land.geometry.setAttribute('color',colors);
  land.geometry.setAttribute('facies',facies);
  land.material = applyEarthScan(b.materialFor('land','#ffffff',{roughness:.83,vertexColors:true}),'valley',11.6*scale);

  const shallow = new T.Color('#8db0a0'), offshore = new T.Color('#587f89'), stream = new T.Color('#6d9e9d');
  function dyeWater(mesh: Mesh, freshwater: boolean) {
    const positions=mesh.geometry.attributes.position;
    const colors=new T.Float32BufferAttribute(new Float32Array(positions.count*3),3);
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i)/scale,z=(positions.getZ(i)-back)/scale;
      const y=positions.getY(i)/scale,distance=x-waterCycleCoastX(z);
      if(freshwater) pigment.copy(stream).lerp(shallow,smooth(distance,-4,.8));
      else pigment.copy(shallow).lerp(offshore,smooth(distance,0,28));
      const top = freshwater ? waterCycleRiverLevel(x) : 8;
      pigment.multiplyScalar(1-.31*smooth(top-y,.15,6));
      colors.setXYZ(i,pigment.r,pigment.g,pigment.b);
    }
    mesh.geometry.setAttribute('color',colors);
    mesh.material = b.materialFor('water','#ffffff',{roughness:.31,metalness:.035,vertexColors:true});
  }
  dyeWater(sea,false);
  dyeWater(river,true);
}
