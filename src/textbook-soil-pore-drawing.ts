import { evaluateSoilPores } from './textbook-ground-process-model';
import { poreNetwork,poreNetworkFill,networkSides,aggregateFace } from './textbook-soil-pore-network';

const sx=(x:number)=>46+(x-11)*7.65,sy=(y:number)=>352-(y-8)*5.4;
const number=(n:number)=>n.toFixed(1);
const drawingCache=new Map<number,string>();

/** A longitudinal section through the sinuous pore axis shows the throats
 * behind the five visible chambers. The interface is the actual 3D stage. */
export function soilPoreDrawing(selection:number){
  const state=evaluateSoilPores(selection),cached=drawingCache.get(state.mode);
  if(cached)return cached;
  const network=poreNetwork(),level=sy(poreNetworkFill(network,state.water).level);
  const top:string[]=[],bottom:string[]=[];
  for(let i=0;i<network.axis.length;i++){
    const ring=network.inner.slice(i*networkSides,(i+1)*networkSides),x=sx(ring[0][0]);
    for(const [target,pick] of [[top,Math.max],[bottom,Math.min]] as const){
      target.push(number(x)+' '+number(sy(pick(...ring.map(v=>v[1])))));
    }
  }
  const passage='M'+top.join('L')+'L'+bottom.reverse().join('L')+'Z';
  const cap=Array.from({length:58},(_,i)=>number(45+i*9.55)+' '+number(92+5*Math.sin(i*.61)+2.2*Math.cos(i*1.48)));
  const soil='M'+cap.join('L')+'L591 348Q575 353 553 350L62 353Q44 353 45 339Z';
  const jointPaths:string[]=[];
  for(let y=10;y<54;y+=.55)for(let x=11;x<82;x+=.47){
    const joint=aggregateFace(x,y).joint;
    if(joint>.78)jointPaths.push('M'+number(sx(x))+' '+number(sy(y))+'l2 .8');
  }
  const minerals=Array.from({length:38},(_,i)=>{
    const x=57+(i*69.27)%515,y=104+(i*77.63)%236;
    return '<path transform="translate('+number(x)+' '+number(y)+') rotate('+i*37+')" d="M-6 1l3-4 5-1 4 3-3 4-5 1z" fill="'+['#bcab8e','#a29378','#716a5e'][i%3]+'" stroke="#5b5140" stroke-width="1.1"/>';
  }).join('');
  const humus=Array.from({length:18},(_,i)=>'<path transform="translate('+number(66+(i*71.27)%495)+' '+number(114+(i*61.71)%211)+') rotate('+i*29+')" d="M-9 1q5-4 10 0l6-2m-7 1 3-4" fill="none" stroke="#44392c" stroke-width="2.4" stroke-linecap="round"/>').join('');
  const labels=(x:number,y:number,name:string)=>'<text x="'+x+'" y="'+y+'" text-anchor="middle" fill="#353b32" font-family="FieldSerif,SimSun,serif">'+name+'</text>';
  const keys=['较干','适中','较湿'].map((name,i)=>{
    const x=72+173*i,pressed=i===state.mode;
    return '<g data-model-selection="'+i+'" data-specimen-key="" data-keep-phase="" role="button" tabindex="0" aria-label="选择'+name+'土样" aria-pressed="'+pressed+'"><rect x="'+x+'" y="426" width="153" height="61" rx="7" fill="#493a2c"/><rect x="'+(x+2)+'" y="'+(pressed?428:421)+'" width="149" height="57" rx="6" fill="'+(pressed?'#d4c199':'#eee2c0')+'" stroke="#9b7a48" stroke-width="3"/>'+labels(x+77,462,name)+'</g>';
  }).join('');
  const svg='<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 510" role="img" aria-label="同一土样的连通孔隙纵剖面，水占孔隙体积'+Math.round(state.water*100)+'%，余部为空气。"><defs><clipPath id="pore-cut"><path d="'+passage+'"/></clipPath><clipPath id="soil-cut"><path d="'+soil+'"/></clipPath><pattern id="soil-grain" width="15" height="13" patternUnits="userSpaceOnUse"><path d="M1 3l2 -.5m3 6 1-.6m5-4 1 1m-2 6 2-1" stroke="#dcc19b" stroke-width="1.1" opacity=".43"/></pattern><linearGradient id="soil-water" x2="0" y2="1"><stop stop-color="#a3c4c4"/><stop offset="1" stop-color="#587f83"/></linearGradient></defs>'+
    labels(154,47,'矿物质')+labels(478,47,'有机质')+
    '<path d="'+soil+'" fill="#8b6d50" stroke="#5b4935" stroke-width="3"/><g clip-path="url(#soil-cut)"><path d="'+jointPaths.join('')+'" stroke="#574936" opacity=".65" stroke-width="2.9"/><path d="'+soil+'" fill="url(#soil-grain)"/>'+minerals+humus+'</g>'+
    '<path d="'+passage+'" fill="#e8dfc7" stroke="#4d4134" stroke-width="5" stroke-linejoin="round"/><g clip-path="url(#pore-cut)"><rect x="43" y="'+number(level)+'" width="551" height="270" fill="url(#soil-water)"/><path d="M42 '+number(level)+'h554" stroke="#d5e9e2" stroke-width="3"/></g>'+
    '<path d="M156 56v24l26 40m297-64v19l-25 48" stroke="#83714e" fill="none" stroke-width="2"/><path d="M175 120l6-5 9 4-5 6-9-1z" fill="#b5a78e" stroke="#675942"/><path d="M445 126q7-8 16-4m-9-1 1-7" fill="none" stroke="#46382a" stroke-width="3"/>'+
    '<path d="M39 351v12h560v-12" fill="#a98c5e" stroke="#61533b" stroke-width="2"/>'+
    '<circle cx="107" cy="390" r="9" fill="#719a9a" stroke="#587b7b"/>'+labels(192,402,'孔隙水')+
    '<circle cx="397" cy="390" r="9" fill="#e8dfc7" stroke="#918772"/>'+labels(502,402,'孔隙空气')+keys+'</svg>';
  drawingCache.set(state.mode,svg);return svg;
}