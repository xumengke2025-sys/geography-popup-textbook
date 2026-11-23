import { surveyOutcrop } from './textbook-survey-outcrops';

/** A fixed relief cabinet. Coordinates and dimensions of the specimen are
 * teaching geometry; the vertical datum is the sea-level reference. */
export const SURVEY_GRID={left:6,right:94,north:6,south:58,nx:110,nz:65};
export const SURVEY_MODES=['绝对高度','相对高度','坡度','坡向'] as const;
export const SURVEY_MODE_IDS=['absolute-height','relative-height','slope','aspect'] as const;
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const ease=(x:number)=>{const t=clamp(x);return t*t*(3-2*t)};
const crest=(d:number,w:number)=>Math.exp(-((Math.abs(d)/w)**1.45));
const river=(z:number)=>52+4.8*Math.sin(z*.096+.24)+.045*(z-28);
function relief(x:number,z:number){
  const channel=river(z),west=Math.max(0,channel-x),east=Math.max(0,x-channel);
  const ridgeZ=24+3.8*Math.sin(x*.15-.8)+.13*(x-30);
  const crestBand=crest(z-ridgeZ,10.6);
  const peak=ease((x-4)/21)*(1-ease((x-35)/22));
  const spurZ=ridgeZ+7.4+.57*(x-25);
  const spur=6.8*crest(z-spurZ,3.7)*ease((x-19)/12)*(1-ease((x-37)/15));
  const ledge=2.2*ease((z-ridgeZ+6)/1.7)*(1-ease((z-ridgeZ+2)/2));
  const westHill=(4.6+23.4*peak*crestBand+spur+ledge)*ease(west/13);
  const eastZ=41+.21*(x-74)-3.9*Math.sin(x*.19+.2);
  const eastHill=ease(east/12)*(3.8+16.4*crest(z-eastZ,8.3)*ease((x-52)/17)*(1-.51*ease((x-79)/14)));
  const notch=2.7*crest(z-33-.24*(x-26),1.7)*ease((x-21)/6)*(1-ease((x-47)/7));
  const exposure=Math.max(crestBand*peak*ease(west/12),.6*crest(z-eastZ,8)*ease(east/11));
  const beds=(.75*Math.sin(.48*x+.68*z)+.38*Math.sin(1.4*x-.52*z)+.3*Math.cos(1.9*z+.63*x))*exposure;
  const distance=Math.abs(channel-x);
  const valleyShoulder=(2.5*ease((distance-3.1)/2.2)+1.5*ease((distance-9)/2.8))*(.62+.27*Math.cos(z*.12));
  const tributary=3.7*crest(z-(34+.19*(x-52)+1.5*Math.sin(.23*x)),2.3)*ease(east/5)*(1-ease((east-25)/10));
  const dip=z+.21*x+1.3*Math.sin(x*.18)+.58*Math.sin(x*.49);
  const resistantBeds=[28,32.5,37.2].reduce((h,sill)=>h+1.75*ease((dip-sill+.48)/.95)*(1-ease((dip-sill-1)/3.25)),0);
  const incisors=(2.1*crest(z-(ridgeZ+5+.45*(x-34)),1.33)+1.4*crest(z-(ridgeZ+8+.66*(x-27)),1.22))*peak;
  const initial=3.2+.036*(58-z)+westHill+eastHill-notch+beds+valleyShoulder-tributary
    +resistantBeds*exposure-incisors;
  return initial-surveyOutcrop(x,z,initial).recess;
}
const {left,right,north,south,nx,nz}=SURVEY_GRID,dx=(right-left)/nx,dz=(south-north)/nz;
export const surveyNodes=Array.from({length:(nx+1)*(nz+1)},(_,i)=>{
  const x=left+i%(nx+1)*dx,z=north+Math.floor(i/(nx+1))*dz;return {x,z,h:relief(x,z)};
});
export const surveyPeak=surveyNodes.reduce((a,c)=>a.h>c.h?a:c);
export function sampleSurvey(x:number,z:number){
  const fx=clamp((x-left)/(right-left))*nx,fz=clamp((z-north)/(south-north))*nz;
  const i=Math.min(nx-1,Math.floor(fx)),j=Math.min(nz-1,Math.floor(fz)),u=fx-i,v=fz-j,k=j*(nx+1)+i;
  const a=surveyNodes[k].h,e=surveyNodes[k+1].h,c=surveyNodes[k+nx+1].h,d=surveyNodes[k+nx+2].h;
  const first=u+v<=1,gx=(first?e-a:d-c)/dx,gz=(first?c-a:d-e)/dz;
  const h=first?a+u*(e-a)+v*(c-a):d+(1-u)*(c-d)+(1-v)*(e-d);
  return {x:left+fx*dx,z:north+fz*dz,h,gx,gz,faceIndex:2*(j*nx+i)+(first?0:1)};
}
export function surveyReading(value:number,selection:number){
  const phase=clamp(value),mode=Math.max(0,Math.min(3,Math.round(Number.isFinite(selection)?selection:0)));
  const point=sampleSurvey(15+71*phase,33+11*phase);
  const relativeHeight=surveyPeak.h-point.h,horizontalDistance=Math.hypot(surveyPeak.x-point.x,surveyPeak.z-point.z);
  const down=Math.hypot(point.gx,point.gz),aspect=down<1e-6?null:{x:-point.gx/down,z:-point.gz/down};
  const azimuth=aspect?(Math.atan2(aspect.x,-aspect.z)*180/Math.PI+360)%360:null;
  const cardinal=azimuth===null?'平地':['北','东北','东','东南','南','西南','西','西北'][Math.round(azimuth/45)%8];
  const exposure=aspect===null||Math.abs(aspect.z)<.38?'':aspect.z>0?'阳坡':'阴坡';
  return {phase,mode,fixed:surveyPeak,point,exposure,absoluteHeight:point.h,relativeHeight,horizontalDistance,
    slopeRadians:Math.atan2(relativeHeight,horizontalDistance),aspect,azimuth,cardinal,datum:0};
}
export function surveyFacies(x:number,z:number){
  const {h,gx,gz}=sampleSurvey(x,z),slope=Math.hypot(gx,gz);
  const crag=ease((.52*slope+.055*(h-13)+.23*Math.sin(.52*x+.27*z)-.55)/.88);
  const alluvium=.64*(1-crag)*(1-ease((Math.abs(x-river(z))-2.5)/5));
  const pasture=(1-crag-alluvium)*(.46+.37*Math.sin(.15*x-.11*z)*Math.sin(.23*z+.12*x));
  return [crag,alluvium,pasture];
}
