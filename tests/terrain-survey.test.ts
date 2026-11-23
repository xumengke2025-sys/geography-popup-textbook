import { describe,expect,it } from 'vitest';
import {SURVEY_GRID as G,surveyNodes,sampleSurvey,surveyReading} from '../src/textbook-terrain-survey';
import {terrainSurveyDrawing} from '../src/textbook-terrain-survey-drawing';
describe('four measurements on one sampled landscape',()=>{
  it('lands on the rendered triangle and uses its downhill normal for the compass',()=>{
    for(let n=0;n<=100;n++){
      const read=surveyReading(n/100,3),q=read.point,cell=Math.floor(q.faceIndex/2),x=cell%G.nx,z=Math.floor(cell/G.nx),k=z*(G.nx+1)+x;
      const [a,e,d]=(q.faceIndex%2?[k+1,k+G.nx+1,k+G.nx+2]:[k,k+G.nx+1,k+1]).map(i=>surveyNodes[i]);
      for(const v of [a,e,d])expect(q.h+(v.x-q.x)*q.gx+(v.z-q.z)*q.gz).toBeCloseTo(v.h,9);
      expect(read.aspect!.x*q.gx+read.aspect!.z*q.gz).toBeCloseTo(-Math.hypot(q.gx,q.gz),8);
      expect(read.relativeHeight).toBeCloseTo(read.fixed.h-q.h,10);
      expect(read.slopeRadians).toBeCloseTo(Math.atan2(read.relativeHeight,Math.hypot(read.fixed.x-q.x,read.fixed.z-q.z)),10);
    }
  });
  it('uses the same contact through all four detents and shows both northern and southern exposures',()=>{
    const exposures=new Set<string>();
    for(const phase of [0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]){
      const contact=surveyReading(phase,0).point;
      for(let i=0;i<4;i++)expect(surveyReading(phase,i).point).toEqual(contact);
      exposures.add(surveyReading(phase,3).exposure);
      expect(sampleSurvey(contact.x,contact.z).h).toBeCloseTo(contact.h,9);
    }
    expect(exposures.has('阳坡')&&exposures.has('阴坡')).toBe(true);
  });
  it('draws the same moving probe in the reading view with four direct mode keys',()=>{
    for(const t of [.02,.51,.94])for(let n=0;n<4;n++){
      const state=surveyReading(t,n),svg=terrainSurveyDrawing(t,n);
      expect(svg).toContain('data-terrain-probe="'+state.point.faceIndex+'"');
      expect(svg).toContain('data-phase-track="移动地貌测针"');
      expect(svg.match(/data-keep-phase=/g)).toHaveLength(4);
      if(n===3)expect(svg).toContain(state.cardinal+'坡');
    }
  });
});
