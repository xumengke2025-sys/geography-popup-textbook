import { drawingGrip } from './textbook-drawing-grip';
const mark=(x:number,y:number,label:string,size=27)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="#3c4238" font-family="FieldSerif,SimSun,serif">${label}</text>`;
const key=(x:number,y:number,label:string,i:number,w:number,current:number)=>`<g data-specimen-key data-model-selection="${i}" data-keep-phase tabindex="0" role="button" aria-label="${label}" transform="translate(${x} ${y})"><rect x="${-w/2}" y="-18" width="${w}" height="36" rx="4" fill="#a98c56" stroke="#745d3c" stroke-width="2"/><rect x="${2-w/2}" y="-16" width="${w-4}" height="31" rx="3" fill="${i===current?'#dfd1a7':'#eee4ca'}"/>${mark(0,8,label)}</g>`;
const defs=`<defs><linearGradient id="air-copper"><stop stop-color="#786043"/><stop offset=".18" stop-color="#a98f5e"/><stop offset=".46" stop-color="#d1b882"/><stop offset=".7" stop-color="#a28759"/><stop offset="1" stop-color="#715c43"/></linearGradient><linearGradient id="air-wood" x2="0" y2="1"><stop stop-color="#9a7a51"/><stop offset=".2" stop-color="#71553f"/><stop offset=".81" stop-color="#856746"/><stop offset="1" stop-color="#563f31"/></linearGradient><linearGradient id="optical-glass"><stop stop-color="#7baca3" stop-opacity=".3"/><stop offset=".15" stop-color="#cfdfcc" stop-opacity=".18"/><stop offset=".45" stop-color="#d6ddca" stop-opacity=".03"/><stop offset="1" stop-color="#82a59a" stop-opacity=".2"/></linearGradient><radialGradient id="smoke-puff"><stop stop-color="#5d5f55" stop-opacity=".67"/><stop offset=".47" stop-color="#6b6a5d" stop-opacity=".27"/><stop offset="1" stop-color="#7c766a" stop-opacity="0"/></radialGradient></defs>`;
const tray=(y:number)=>`<path d="M29 ${y}l12-6h556l13 6-7 13H35Z" fill="#42534a" stroke="#6d664e"/><path d="M35 ${y+13}h568v24H35Z" fill="url(#air-wood)" stroke="#5d4935"/><path d="M35 ${y+13}h568" stroke="#b79b5b" stroke-width="3"/>`;
const gear=(x:number,y:number,r:number,angle:number,puff:boolean)=>`<g transform="translate(${x} ${y}) rotate(${angle})"><circle r="${r}" fill="none" stroke="${puff?'#9b7555':'#8d7853'}" stroke-width="4"/>${Array.from({length:puff?6:3},(_,i)=>`<path transform="rotate(${(puff?60:120)*i})" d="${puff?'M1 1Q5 -4 13 -2L12 4Q6 5 1 2Z':'M0 0H'+r}" fill="${puff?'#988363':'none'}" stroke="#8b7854" stroke-width="${puff?1:3}"/>`).join('')}<circle r="3.6" fill="#75674d"/></g>`;
export function pressureDrawing(phase:number,selection:number){
 const diff=selection===0,gain=diff?13:0,probe=192+247*phase;
 const jar=(x:number,i:number)=>{const h=153+(i===0?gain:-gain);
   return `<g data-model-selection="${diff?1:0}" data-keep-phase tabindex="0" role="button" aria-label="调节双缸活塞"><rect x="${x-38}" y="94" width="76" height="143" fill="url(#optical-glass)" stroke="#93aba0"/><rect x="${x-4}" y="${h-75}" width="8" height="77" fill="url(#air-copper)"/><rect x="${x-36}" y="${h}" width="72" height="11" rx="3" fill="#987747" stroke="#776043"/><path d="M${x-42} 92h84l-5-9-20-6h-34l-20 6Z" fill="url(#air-copper)" stroke="#756447"/><path d="M${x-40} 238h80l4 8-9 8-3 12h-65l-4-12-8-5Z" fill="url(#air-copper)" stroke="#756447"/><path d="M${x-41} 94v146m82 0V94" stroke="#786f56" stroke-width="3"/></g>`;
 };
 const arrows=diff?Array.from({length:3},(_,i)=>{const x=177+((phase*2+i/3)%1)*293;return `<path d="M${x-8} 190h16l-4-3m4 3-4 3" fill="none" stroke="#537e83" stroke-width="2.2"/>`;}).join(''):'';
 const minY=122,delta=diff?15:0;
 return `<svg class="flat-model-svg pneumatic-drawing" viewBox="0 0 640 389" role="group" aria-label="同一高度的压力与水平风道比较">${defs}${tray(272)}
 <path d="M102 182V65Q102 58 110 58H270Q277 58 277 66v34m252 82V65q0-7-7-7H356q-7 0-7 8v34" fill="none" stroke="#9a8259" stroke-width="3"/>
 <rect x="256" y="42" width="115" height="133" rx="4" fill="url(#air-copper)" stroke="#745f44"/><rect x="261" y="47" width="105" height="123" rx="2" fill="#e3dac4"/>
 <path d="M277 58v83q0 26 36 26t36-26V58" fill="none" stroke="#a4bab0" stroke-width="12"/><path d="M277 ${minY+delta}v${141-minY-delta}q0 26 36 26t36-26V${minY-delta}" fill="none" stroke="#965f45" stroke-width="7"/>
 ${Array.from({length:9},(_,i)=>`<path d="M${i%2?308:303} ${69+10*i}h${i%2?10:20}" stroke="#746b56" stroke-width="1.1"/>`).join('')}
 ${jar(102,0)}${jar(529,1)}
 <rect x="142" y="178" width="347" height="24" rx="4" fill="url(#optical-glass)" stroke="#8fa89f"/>${[141,481].map(x=>`<rect x="${x}" y="174" width="13" height="32" rx="3" fill="url(#air-copper)" stroke="#736348"/>`).join('')}${arrows}
 <path d="M${probe} 282v-46l6-20v-28" fill="none" stroke="#827963" stroke-width="2"/><path d="${diff?'M'+(probe+6)+' 187q9 -3 16 0t13-1v4q-9 2-16 0l-13 1Z':'M'+(probe+6)+' 187q4 6 6 12l-4 1-5-12Z'}" fill="#49747e"/>
 <path d="M178 282h276m-276 6h276" stroke="#716f60" stroke-width="2.5"/><rect x="${probe-11}" y="278" width="22" height="11" rx="2" fill="#af9362"/><ellipse cx="${probe}" cy="278" rx="8" ry="6" fill="#507582"/>
 ${drawingGrip('推移同高测风探针',[192,280],[439,280],phase)}
 ${mark(103,32,diff?'相对高压':'等压')}${mark(527,32,diff?'相对低压':'等压')}
 ${key(210,349,'存在气压差',0,180,selection)}${key(433,349,'气压相同',1,162,selection)}</svg>`;
}
export function hazeChamberDrawing(state:{phase:number,mode:number,stock:number,fanAngle:number,windStrength:number,sourceRate:number,particles:readonly{id:number,cohort:string,x:number,y:number,z:number,size:number,visible:boolean}[]}){
 const {phase,mode}=state,grip=220+238*phase;
 const traces=state.particles.filter(p=>p.visible).map(q=>`<circle data-particle="${q.id}" data-cohort="${q.cohort}" cx="${(48+q.x*4.7).toFixed(2)}" cy="${(306-q.y*5.45+(q.z-40)*.22).toFixed(2)}" r="${(q.size*15.4).toFixed(2)}" fill="url(#smoke-puff)"/>`).join('');
 const filter=Math.min(1,state.stock/80),tone=Math.round(217-123*filter),ex=state.windStrength;
 return `<g class="haze-chamber-drawing">${defs}${tray(277)}
 <path d="M55 273V53l18-15h498l16 15v221Z" fill="url(#optical-glass)" stroke="#819c93" stroke-width="1.8"/><path d="M55 53h531m-520-5 14-8h484" fill="none" stroke="#b49c6b" stroke-width="2"/>
 ${[57,584].map(x=>`<path d="M${x} 56V274" stroke="#998459" stroke-width="3"/><circle cx="${x}" cy="53" r="4" fill="#aa925e"/>`).join('')}
 <g data-model-selection="1" data-model-toggle="0" data-keep-phase tabindex="0" role="button" aria-label="切换鼓风机"><rect x="28" y="101" width="61" height="63" fill="transparent"/><path d="M30 128h22v12H30Z" fill="#44574d"/>${gear(57,133,17,state.fanAngle*180/Math.PI,true)}</g>
 <g data-model-selection="2" data-model-toggle="0" data-keep-phase tabindex="0" role="button" aria-label="切换进烟阀"><path d="M107 270v-48l4-7 12-4v-11h9v11l13 4 6 7v48Z" fill="url(#air-copper)" stroke="#756346"/>
 <path d="M112 220h34m-38 42h41m-22-61v-10" stroke="#756346" stroke-width="3"/>${gear(111,254,11,(1-state.sourceRate)*.91/.82*180/Math.PI,false)}</g>
 ${[223,271,322].map((x,i)=>`<path d="M${x-16} 273v-${23+5*i}h33v${23+5*i}Z" fill="#d7cfb7" stroke="#8a816d"/><path d="M${x-20} ${250-5*i}l20-10 20 10Z" fill="#778682"/><path d="M${x-7} ${258-3*i}v5m9-5v5" stroke="#75796b" stroke-width="3"/>`).join('')}
 <rect x="425" y="177" width="37" height="36" fill="#ddd6bd" stroke="#8c7954"/>${Array.from({length:8},(_,j)=>`<rect x="${426+(2*(j%2)+Math.floor(j/2)%2)*8.8}" y="${178+Math.floor(j/2)*8.4}" width="8.8" height="8.4" fill="#4f5649"/>`).join('')}
 ${traces}<path d="M540 262v-89m0 0q${5+ex*9} ${19-ex*19} ${7+20*ex} ${21-ex*22}l-3 8-12-12Z" fill="#5a8592" stroke="#496268"/>
 <path d="M205 290h268m-268 5h268" fill="none" stroke="#9c916c" stroke-width="2.5"/>
 <rect x="${grip-11}" y="284" width="22" height="13" rx="2" fill="#a68a59"/><circle cx="${grip}" cy="278" r="12" fill="rgb(${tone},${tone+2},${tone-8})" stroke="#9a7f4e" stroke-width="3"/>
 ${drawingGrip('推移留存取样片',[220,283],[458,283],phase)}
 ${['排放积聚','通风扩散','减少排放'].map((v,i)=>key(128+192*i,348,v,i,165,mode)).join('')}</g>`;
}
