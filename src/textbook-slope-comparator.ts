import { THREE as T } from './reference/engine.js';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { applyEarthScan } from './textbook-earth-scan';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { slopeDisplayY, slopeTerrainElevationAt } from './textbook-slope-model';

type Plan = readonly [number, number];
type Transform = (coordinates: readonly number[]) => Vec3;
const sections: { site:string; start:Plan; end:Plan; mountX:number }[] = [
  { site:'main-gully-bank', start:[42,24],end:[22,24],mountX:16 },
  { site:'right-tributary-bank', start:[74,53],end:[74,73],mountX:60 },
];

/** Front cutaways use the same triangle interpolation and equal horizontal
 * and vertical model scales. The sight arm touches the two END elevations;
 * it spans the undulating profile between them. The arc has no degree values
 * because the relief itself is vertically exaggerated. */
export function addSlopeComparators(b:TextbookGeometry,p:Transform,s:number) {
  const material = applyEarthScan(createSpecimenMaterial(b.pop,{role:'land',color:'#ad8862'}),'loam',10*s);
  const brass = createSpecimenMaterial(b.pop,{role:'brass',color:'#ac8647'});
  const steel = createSpecimenMaterial(b.pop,{role:'steel',color:'#6e7470'});
  const ivory = createSpecimenMaterial(b.pop,{role:'ivory',color:'#d3c9a8'});
  const attach = (geometry:any,finish:any,tag:string) => {
    const mesh=b.mesh(geometry,'#a88b50',false);
    mesh.material=finish; mesh.userData.slopeRole=tag;
    mesh.userData.modelInput={kind:'select',selection:1,label:'抬升地形，对照主沟与支沟的剖面'};
    return mesh;
  };
  const z=81, baseY=.5, miniScale=.86;
  const instruments=sections.map(({site,start,end,mountX})=>{
    const length = Math.hypot(end[0]-start[0],end[1]-start[1])*miniScale;
    const segments=40, elevations:number[]=[], vertices:number[]=[],indices:number[]=[];
    for(let i=0;i<=segments;i++){
      const t=i/segments,x=mountX+t*length;
      elevations.push(slopeTerrainElevationAt(start[0]+t*(end[0]-start[0]),start[1]+t*(end[1]-start[1])));
      for(const [h,depth] of [[baseY,z-2.4],[baseY+2,z-2.4],[baseY+2,z+1.2],[baseY,z+1.2]])
        vertices.push(...p([x,h,depth]));
      if(i<segments){
        const k=i*4;
        for(let side=0;side<4;side++){const a=k+side,c=k+(side+1)%4;indices.push(a,c,a+4,c,c+4,a+4);}
      }
    }
    const last=segments*4;indices.push(0,2,1,0,3,2,last,last+1,last+2,last,last+2,last+3);
    const geometry=new T.BufferGeometry();
    const positions=new T.Float32BufferAttribute(vertices,3);geometry.setAttribute('position',positions);geometry.setIndex(indices);
    geometry.computeVertexNormals();const specimen=attach(geometry,material,'gully-profile-specimen');
    specimen.userData.sectionSite=site;
    const arm=attach(new T.CylinderGeometry(.23*s,.23*s,1,16),brass,'sighting-arm');
    const axis=new T.Vector3(0,1,0);
    const mapPins=[start,end].map(()=>attach(new T.SphereGeometry(.45*s,12,8),brass,'transect-pin'));
    const transectGeometry = new T.BufferGeometry();
    const mapTrace=new T.Float32BufferAttribute(new Float32Array((segments+1)*6),3);
    const triangles:number[]=[];
    for(let i=0;i<segments;i++){const k=i*2;triangles.push(k,k+1,k+2,k+1,k+3,k+2);}
    transectGeometry.setAttribute('position',mapTrace);transectGeometry.setIndex(triangles);transectGeometry.computeVertexNormals();
    const ribbon=attach(transectGeometry,brass,'transect-inlay');ribbon.userData.sectionSite=site;

    const pivotGeometry=turnedShaftGeometry([0,0,-.4*s],[0,0,.55*s],[[.75*s,0],[.89*s,.22],[.89*s,.62],[.69*s,1]]);
    const hinge=attach(pivotGeometry,brass,'sighting-hinge');
    const contact=attach(new T.SphereGeometry(.53*s,16,8),steel,'sighting-contact');
    const radius=3.12*s,face=new T.Shape();
    face.moveTo(0,0);face.absarc(0,0,radius,0,Math.PI*.5,false);face.lineTo(0,0);
    const quadrant=attach(new T.ExtrudeGeometry(face,{depth:.16*s,bevelEnabled:false,curveSegments:24}),ivory,'quadrant');
    const tickGeometries=[];
    for(let i=0;i<=10;i++){
      const a=i*Math.PI/20,extent=radius*(i%5===0?.28:.14);
      const tick=chamferedPlateGeometry([radius-extent,-.045*s,.165*s],[radius,.045*s,.2*s],0);
      tick.rotateZ(a);tickGeometries.push(tick);
    }
    const ticks=attach(mergeInstrumentGeometry(tickGeometries),steel,'quadrant-engraving');
    const height=(e:number,phase:number)=>baseY+slopeDisplayY(e,phase)*miniScale;
    let armRadians=0;
    return { update(phase:number){
      for(let i=0;i<=segments;i++)for(const corner of [1,2])
        positions.setY(i*4+corner,height(elevations[i],phase)*s);
      positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
      const dx=end[0]-start[0],dz=end[1]-start[1],span=Math.hypot(dx,dz);
      for(let i=0;i<=segments;i++)for(const side of [0,1]){
        const t=i/segments,offset=side?.14:-.14;
        const where=p([start[0]+dx*t-dz/span*offset,slopeDisplayY(elevations[i],phase)+.19,start[1]+dz*t+dx/span*offset]);
        mapTrace.setXYZ(i*2+side,...where);
      }
      mapTrace.needsUpdate=true;transectGeometry.computeVertexNormals();transectGeometry.computeBoundingSphere();
      [start,end].forEach(([x,z],i)=>mapPins[i].position.set(...p([x,slopeDisplayY(elevations[i*segments],phase)+.23,z])));
      const y0=height(elevations[0],phase),y1=height(elevations[segments],phase),depth=z+1.9;
      const a=new T.Vector3(...p([mountX,y0,depth])),c=new T.Vector3(...p([mountX+length,y1,depth]));
      const delta=c.clone().sub(a); armRadians=Math.atan2(y1-y0,length);
      arm.position.copy(a).addScaledVector(delta,.5);arm.scale.y=delta.length();
      arm.quaternion.setFromUnitVectors(axis,delta.normalize());
      hinge.position.copy(a);contact.position.copy(c);
      quadrant.position.set(...p([mountX,y0,depth-.41]));ticks.position.copy(quadrant.position);
    },describe:()=>({site,start,end,endElevationsM:[elevations[0],elevations[segments]],sampleCount:elevations.length,armRadians})};
  });
  return {update:(phase:number)=>instruments.forEach(i=>i.update(phase)),
    describe:()=>({usesSameTerrainTriangles:true,verticalExaggeration:true,surveyedAngle:false,sections:instruments.map(i=>i.describe())})};
}
