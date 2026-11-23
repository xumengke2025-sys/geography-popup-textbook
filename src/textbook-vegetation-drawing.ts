const names=['热带雨林','常绿阔叶林','落叶阔叶林','亚寒带针叶林','热带草原','温带草原','荒漠植被'];
const shortNames=['雨林','常绿林','落叶林','针叶林','热带草原','温带草原','荒漠'];
const traits=[['层次丰富','藤本、板根'],['常绿','革质叶片'],['春夏发叶','秋冬落叶'],['针状叶','抗寒抗旱'],['湿季葱绿','干季枯黄'],['夏绿冬枯','草本较低'],['旱生灌木','稀疏、耐旱']];
const num=(x:number)=>Number(x.toFixed(2)), tau=Math.PI*2;
const mark=(x:number,y:number,t:string,size=20)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="FieldSerif,SimSun,serif" fill="#413e2f" font-size="${size}">${t}</text>`;
function branchTree(x:number,y:number,h:number,seed:number,n:number,leaves:number) {
  let twig='',foliage='';
  const color=n===2&&leaves<.8?'#9a894c':n===0?'#647c49':n===6?'#7e895b':'#788956';
  const needles=n===3;const levels=needles?13:n===6?7:12;
  for(let i=0;i<levels;i++){
    const u=i/(levels-1),range=needles?(.28-.23*u):n===4?(.33+.08*u):.17+.10*Math.sin(u*2.8);
    for(const sign of [-1,1]){
      const base=needles?.30+.57*u:n===4?.46+.21*u:.43+.38*u,dy=h*base;
      const b=sign*h*range*(.80+.22*Math.cos(seed+i*3+sign)),lift=h*(needles?-.06:.10+.039*Math.sin(i+.7*seed));
      twig+=`M0 ${num(-dy)}q${num(b*.42)} ${num(-lift*.24)} ${num(b)} ${num(-lift)}`;
      if(leaves>.075)for(let k=1;k<=3;k++) {
        const t=k/3,X=b*t,Y=-dy-lift*t,rx=h*(needles?.060:n===4?.084:.083)*leaves,ry=h*(needles?.058:n===4?.036:.061)*leaves;
        foliage+=`M${num(X-rx)} ${num(Y+ry*.6)}q${num(rx*.31)} ${num(-ry*.74)} ${num(rx*.45)} ${num(-ry*.70)}q${num(rx*.17)} ${num(-ry*.88)} ${num(rx*.55)} ${num(-ry*.91)}q${num(rx*.27)} ${num(ry*.12)} ${num(rx*.43)} ${num(ry*.62)}q${num(rx*.41)} ${num(-ry*.13)} ${num(rx*.67)} ${num(ry*.61)}q${num(-rx*.90)} ${num(ry*.64)} ${num(-rx*2.1)} ${num(ry*.38)}Z`;
      }
    }
  }
  return `<g transform="translate(${x} ${y})"><path d="M-3 0Q-1 ${num(-h*.54)} .7 ${num(-h*.96)} Q.9 ${num(-h*.57)} 3 0Z" fill="#806e53"/><path d="${twig}" fill="none" stroke="#807356" stroke-width="${Math.max(.65,h*.009)}"/><path d="${foliage}" fill="${color}" stroke="#566744" stroke-width=".28"/></g>`;
}
function pressed(n:number){
 let s='<path d="M-4 46Q1 0 4-49" stroke="#857556" stroke-width="2" fill="none"/>';
 for(let j=0;j<(n===3?26:9);j++){
   const t=j/(n===3?26:9),x=-3+7*t,y=36-76*t,sg=j%2?1:-1,angle=sg>0?-23:199;
   const len=n===3?14:n===6?11:n>3?34:24,w=n===3?1.1:n>3?3:n===6?3:6.8;
   s+=`<g transform="translate(${num(x)} ${num(y)}) rotate(${angle})"><path d="M0 0Q${len*.43} ${-w} ${len} 0Q${len*.51} ${w*1.13} 0 0Z" fill="${n>3?'#8b8f60':'#71825a'}" stroke="#596746" stroke-width=".6"/><path d="M0 0L${len*.91} 0" stroke="#a4a179" stroke-width=".6"/></g>`;
 }
 return `<g transform="translate(538 165)"><rect x="-52" y="-68" width="104" height="141" rx="3" fill="#776048" stroke="#514938"/><rect x="-48" y="-65" width="96" height="134" rx="2" fill="#e4d8ba"/>${s}<rect x="-14" y="-63" width="28" height="6" rx="2" fill="#aa8d56"/></g>`;
}
export function vegetationDrawing(phase:number,n:number,inspection:string){
 const autumn=Math.min(1,Math.max(0,(phase-.28)/.54));const smooth=autumn*autumn*(3-2*autumn),leaves=n===2?1-.95*smooth:1;
 const grove=n<4,rootView=n===0&&['buttress','vine'].includes(inspection);
 let body='<path d="M34 305l31-13h515l22 11-10 23H44Z" fill="#93866a" stroke="#7c6c52"/><path d="M44 324h549v21H44Z" fill="#745740" stroke="#534531"/><path d="M45 327h547" stroke="#bc9e67" stroke-width="3"/>';
 if(grove){
  const plants=rootView?[[220,301,240]]:[[87,286,115],[157,282,159],[229,291,127],[305,280,144],[367,291,154],[432,291,117]];
  plants.forEach(([x,y,h],i)=>{
   body+=branchTree(x,y,h*(n===6?.5:n===3?.91:1),i+3,n,leaves);
   if(n===0&&i%2===0){
    body+=`<g data-plant-part="buttress" data-model-inspection="${inspection==='buttress'?'overview':'buttress'}" tabindex="0" role="button" aria-label="检视板根"><path d="M${x-17} ${y}q13-4 17-31q2 23 18 31l-13-3-5-11-4 12Z" fill="#9a8664" stroke="#72684e"/></g><g data-plant-part="vine" data-model-inspection="${inspection==='vine'?'overview':'vine'}" tabindex="0" role="button" aria-label="检视藤本"><rect x="${x-9}" y="${y-h*.63}" width="19" height="${h*.63}" fill="transparent"/><path d="M${x+6} ${y-h*.63}q-13 18-3 35t-2 35t0 24" fill="none" stroke="#788054" stroke-width="3"/></g>`;
   }
  });
  if(n===0||n===1)for(let i=0;i<9;i++)body+=branchTree(62+45*i,301-i%3*2,22+i%4*6,i+4,6,1);
  if(n===2)for(let j=0;j<12;j++){
    const release=.29+j/12*.37;
    if(phase<release)continue;
    const t=Math.min(1,Math.max(0,(phase-release)/.31)),q=t*t*(3-2*t),source=plants[j%6];
    body+=`<ellipse cx="${num(source[0]+Math.sin(j+.8)*11+4*q)}" cy="${num(source[1]-source[2]*.74*(1-q))}" rx="3.0" ry="1.1" fill="#a38a58"/>`;
  }
 }else{
  for(let i=0;i<(n===6?24:103);i++){
   const x=58+392*((i*.618034)%1),y=301-17*((i*.414214)%1),h=(8+(i%4)*2)*(n===4?2.0:n===5?1.25:.49);
   body+=`<path d="M${num(x)} ${num(y)}q-1 ${-h*.51} ${-h*.28} ${-h}q${h*.3} ${h*.31} ${h*.29} ${h*.77}q0 ${-h*.57} ${h*.28} ${-h*.8}l${-h*.23} ${h}" fill="${n===6?'#8e946c':phase>.49?'#b7a274':'#7e905f'}" stroke="#888868" stroke-width=".45"/>`;
  }
  if(n===4||n===6)for(const x of [118,345])body+=branchTree(x,288,n===4?76:28,4,n,1);
 }
 body+=pressed(n);
 const inspectKey=(id:string,x:number,title:string)=>`<g data-botanical-inspect data-model-inspection="${id}" tabindex="0" role="button" aria-label="${title}"><rect x="${x-36}" y="35" width="72" height="28" rx="3" fill="${inspection===id?'#d7c9a4':'#e8dfc8'}" stroke="#9c8762"/>${mark(x,55,title,17)}</g>`;
 if(n===0){
   body+=['overview','vine','buttress','layers'].map((k,i)=>inspectKey(k,153+i*86,['整体','藤本','板根','林层'][i])).join('');
   if(inspection==='layers')body+='<g data-plant-part="layers" stroke="#ac8e56" stroke-dasharray="7 5"><path d="M52 160H456M52 239H456M52 285H456"/></g>';
 }
 body+=`<g data-inspection="${inspection}">${mark(318,97,traits[n].join(' · '),20)}</g>`;
 if([2,4,5].includes(n)){
  const a=(.25-phase)*tau;body+=`<g data-model-crank="1" data-radius="26" transform="translate(552 283)" tabindex="0" role="slider" aria-label="转动季节盘" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(100*phase)}"><circle r="29" fill="#ab915e" stroke="#71634b"/><circle r="25" fill="#e6dbc1"/><path d="M0 0L${num(23*Math.cos(a))} ${num(23*Math.sin(a))}" stroke="#4f5952" stroke-width="2.8"/><circle cx="${num(23*Math.cos(a))}" cy="${num(23*Math.sin(a))}" r="4" fill="#846d49"/></g>`;
 }
 body+=shortNames.map((value,i)=>`<g class="biome-key" style="--key-x:${i<4?84+157*i:120+200*(i-4)}px;--key-y:${i<4?348:386}px" data-specimen-key data-keep-phase data-model-selection="${i}" tabindex="0" role="button" aria-label="换至${names[i]}" transform="translate(${50+i*89} 374)"><rect x="-41" y="-17" width="82" height="34" rx="4" fill="${i===n?'#c8ba94':'#eddfbd'}" stroke="#8d7a54"/>${mark(0,6,value,18)}</g>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg vegetation-cabinet-drawing" viewBox="0 0 640 403" role="group" aria-label="${names[n]}，${traits[n].join('，')}"><title>${names[n]}</title><style>@media(max-width:480px){.vegetation-cabinet-drawing text{font-size:28px}.vegetation-cabinet-drawing .biome-key{transform:translate(var(--key-x),var(--key-y))}.vegetation-cabinet-drawing .biome-key rect{x:-66px;width:132px}}</style>${body}</svg>`;
}
