import { evaluateFloodSequence } from './textbook-ground-process-model';
import { basinIndices,basinNodes,connectedFlood,floodChannel,floodSample,floodSites,tributaries } from './textbook-flood-basin';

const xMap=(x:number)=>35+(x-4)*6.18,zMap=(z:number)=>69+(z-9)*1.86;
const zLine=floodSites[0][1],yCut=(height:number)=>341-height*7.6;
const pair=(x:number,y:number)=>x.toFixed(1)+' '+y.toFixed(1);
const point=(x:number,z:number)=>pair(xMap(x),zMap(z));
const label=(x:number,y:number,s:string)=>'<text x="'+x+'" y="'+y+'" text-anchor="middle" font-family="FieldSerif,SimSun,serif" fill="#394338">'+s+'</text>';
let landPlate='';
function etchedPlan(){
  if(landPlate)return landPlate;
  let contours='';
  for(const h of [5,7,9,11,13,15,17]){
    const segments:string[]=[];
    for(let j=0;j<basinIndices.length;j+=3){
      const crosses:string[]=[];
      for(let k=0;k<3;k++){
        const a=basinNodes[basinIndices[j+k]],b=basinNodes[basinIndices[j+(k+1)%3]];
        if((a.h<h)===(b.h<h))continue;
        const t=(h-a.h)/(b.h-a.h);crosses.push(point(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t));
      }
      if(crosses.length===2)segments.push('M'+crosses[0]+'L'+crosses[1]);
    }
    contours+='<path d="'+segments.join('')+'" fill="none" stroke="#797c5c" stroke-width="1.1"/>';
  }
  const axis=(samples:number[][])=>'M'+samples.map(([x,z])=>point(x,z)).join('L');
  const d=axis(Array.from({length:65},(_,i)=>{const z=9+56*i/64;return [floodChannel(z),z]}));
  return landPlate='<rect x="34" y="67" width="571" height="109" rx="4" fill="#dbd6b9" stroke="#8a7e60" stroke-width="2"/>'+contours+'<path d="'+d+'" fill="none" stroke="#638e91" stroke-width="4"/>'+
    tributaries.map(route=>'<path d="'+axis(route)+'" stroke="#648b87" stroke-width="2.6" fill="none"/>').join('');
}
let previousLevel=-1,previousInundation='';
export function floodSectionDrawing(t:number,mode:number){
  const state=evaluateFloodSequence(t,mode),level=state.waterLevel;
  if(level!==previousLevel){
    const profile=connectedFlood(level),bands:string[]=[];
    // Follow only connected submerged intervals, including the isolated
    // floodplain depression only after water has crossed its threshold.
    for(let z=9.5;z<65;z+=1.3){
      let start:number|undefined;
      for(let x=4;x<=96.5;x+=.5){
        const wet=x<=96&&profile.inundated(x,z);
        if(wet&&start===undefined)start=x-.25;
        if(!wet&&start!==undefined){bands.push('M'+point(start,z)+'H'+xMap(x-.25).toFixed(1));start=undefined;}
      }
    }
    const waterCut:string[]=[];
    for(let x=4;x<96;x+=.5){
      const x1=x+.5,a=floodSample(x,zLine).h,b=floodSample(x1,zLine).h;
      if(a>=level&&b>=level)continue;
      const lim=x+(level-a)/(b-a)*.5;
      const l=a<level?x:lim,r=b<level?x1:lim;
      if(!profile.inundated((l+r)/2,zLine))continue;
      waterCut.push('M'+pair(xMap(l),yCut(level))+'L'+pair(xMap(r),yCut(level))+'L'+pair(xMap(r),yCut(Math.min(level,b)))+'L'+pair(xMap(l),yCut(Math.min(level,a)))+'Z');
    }
    const y=yCut(level);
    previousInundation='<path d="'+bands.join('')+'" stroke="#7caaa8" stroke-width="2.6" opacity=".86"/>'+
      floodSites.map(([x,z],i)=>'<rect x="'+(xMap(x)-3.9)+'" y="'+(zMap(z)-3.5)+'" width="8" height="7" fill="'+(profile.sites[i]?'#ae6c4f':'#745541')+'" stroke="#544835"/>').join('')+'|'+
      '<path d="'+waterCut.join('')+'" fill="#7aa6ac" stroke="#7aa6ac" stroke-width=".6" opacity=".89"/>'+
      '<path d="M'+pair(xMap(floodChannel(zLine))-11,y)+'h22l-3 4h-16z" fill="#896749" stroke="#5b4a34"/>';
    previousLevel=level;
  }
  const [planWet,cutWet]=previousInundation.split('|');
  const land=Array.from({length:93},(_,i)=>pair(xMap(i+4),yCut(floodSample(i+4,zLine).h))).join('L');
  const x=xMap(floodSites[0][0]),y=yCut(floodSample(floodSites[0][0],zLine).h);
  const rulerX=xMap(floodChannel(zLine))+15;
  const ruler=Array.from({length:10},(_,i)=>'M'+pair(rulerX,yCut(2.9+i*.5))+'h'+(i%2?4:8)).join('');
  const z=zMap(zLine);
  return label(145,44,'集水坡')+label(486,44,'低地聚落')+etchedPlan()+planWet+
    '<path d="M39 '+z+'H598" stroke="#624a43" stroke-dasharray="6 5" fill="none" opacity=".8"/>'+
    label(122,223,'横剖面')+label(464,223,'水位 +'+(level-2.9).toFixed(1)+' 格')+
    '<path d="M'+land+'V348H35Z" fill="#bda688" stroke="#695e4c" stroke-width="2"/><path d="M35 348h568v13H35Z" fill="#8c7152" stroke="#695a44"/>'+
    '<g transform="translate('+pair(x,y)+')"><path d="M-10 0v-14h20V0z" fill="#e4d8bc" stroke="#635644" stroke-width="1.8"/><path d="M-14-14 0-24 14-14z" fill="#896b57" stroke="#635644"/><path d="M-3 0v-8h5v8" fill="#756956"/></g>'+cutWet+
    '<path d="M'+pair(rulerX,yCut(8.2))+'V'+yCut(2.0)+'" stroke="#69563c" stroke-width="2.8"/><path d="'+ruler+'" stroke="#69563c" stroke-width="1.4"/>';
}