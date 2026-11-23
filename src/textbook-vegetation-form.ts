import { botanicalBlade } from './textbook-botanical-blade';
import { buildTreeSkeletonSurface, type CrownHabit, type NaturalPoint, type NaturalSurface } from './textbook-natural-form-geometry';

/** Botanical profiles belong to this lesson. They are structural examples,
 * not identified species, measured leaf areas, or a succession sequence. */
export function vegetationCrown(habit: CrownHabit, seed: number): NaturalSurface {
  if (habit === 'rainforest') {
    const canopy: NaturalSurface = { positions: [], indices: [] };
    const blade = botanicalBlade(true);
    // Each spray grows along one bough. Air can be seen between adjacent
    // sprays, especially from below when the reader inspects the vine.
    for (let bough = 0; bough < 13; bough++) {
      const azimuth = seed*.73 + bough*2.39996;
      const level = bough / 12;
      const reach = .36 + .68*Math.sqrt(1-level);
      const baseY = -.34 + .72*level;
      const tipYaw = azimuth + .19*Math.sin(2.64+seed);
      branch(canopy,[0,baseY-.08,0],[Math.cos(tipYaw)*reach*.88,baseY+.06,Math.sin(tipYaw)*reach*.73],.021,.009);
      for (let joint = 0; joint < 5; joint++) {
        const q = .16 + joint*.18;
        const yaw = azimuth + .19*Math.sin(q*3+seed);
        const cx = Math.cos(yaw)*reach*q;
        const cz = Math.sin(yaw)*reach*q*.83;
        const cy = baseY + .17*Math.sin(q*Math.PI);
        for (let side = -1; side <= 1; side++) {
          const dir = yaw + side*(.9+.2*Math.sin(joint+seed));
          const length = .32 + .07*Math.cos(bough+joint*2);
          const start = canopy.positions.length/3;
          for (let i = 0; i < blade.positions.length; i += 3) {
            const t = blade.positions[i], along = t*length, across = blade.positions[i+2]*.55;
            canopy.positions.push(cx+along*Math.cos(dir)-across*Math.sin(dir),
              cy+blade.positions[i+1]*.38+Math.sin(t*Math.PI)*.035-t*t*.054+across*.29*Math.sin(dir+seed+joint),
              cz+along*Math.sin(dir)+across*Math.cos(dir));
          }
          for (const index of blade.indices) canopy.indices.push(start+index);
        }
      }
    }
    return canopy;
  }
  const out:NaturalSurface={positions:[],indices:[]};
  const foliate=(origin:NaturalPoint,yaw:number,pitch:number,len:number,width:number,fold:number)=>{
    const dx=Math.cos(yaw),dz=Math.sin(yaw),first=out.positions.length/3;
    for (let j=0;j<=4;j++){
      const t=j/4,w=width*Math.sin(t*Math.PI)**.78;
      for(const side of [-1,0,1])out.positions.push(origin[0]+dx*t*len-dz*w*side,
        origin[1]+pitch*t+fold*Math.sin(Math.PI*t)*(side===0?1.0:.36)-.082*t*t,
        origin[2]+dz*t*len+dx*w*side);
      if(j){const k=first+j*3;out.indices.push(k-3,k,k-2,k-2,k,k+1,k-2,k+1,k-1,k-1,k+1,k+2);}
    }
  };
  const conifer=habit==='conifer',umbrella=habit==='savanna',shrub=habit==='shrub', evergreen=habit==='evergreen';
  const levels=conifer?9:shrub?7:umbrella?11:16;
  for(let i=0;i<levels;i++){
    const t=i/(levels-1),n=conifer?5:1,base=conifer?-.7+1.45*t:umbrella?-.26+.60*t:shrub?-.47+.78*t:-.49+1.30*t;
    for(let whorl=0;whorl<n;whorl++){
      const a=seed*.71+i*2.39996+whorl*Math.PI*2/n+.19*Math.cos(i*2.73+seed);
      const span=(conifer?1.09*(1-.87*t):umbrella?.58+.44*Math.sin(t*2.31):.42+.61*Math.sin(.52+t*2.40))*(.91+.13*Math.cos(i+seed));
      const dx=Math.cos(a),dz=Math.sin(a),yTip=base+(conifer?-.16:umbrella?.12:.21);
      const tip:NaturalPoint=[span*dx,yTip,span*dz];branch(out,[0,base,0],tip,conifer?.024:.021,.006);
      for(let j=0;j<(conifer?5:6);j++) {
        const q=.18+j*(conifer?.17:.146),root:NaturalPoint=[dx*span*q,base+(yTip-base)*q,dz*span*q];
        for(const side of [-1,1]) {
          const yaw=a+side*(conifer?1.10:1.06+.16*Math.sin(seed+j)),reach=(conifer?.36:.40)*(.94-.40*q)*(1-(conifer?.58:0)*t);
          const end:NaturalPoint=[root[0]+reach*Math.cos(yaw),root[1]+.065,root[2]+reach*Math.sin(yaw)];
          branch(out,root,end,.012,.003);
          for(let tip=0;tip<4;tip++){
            const u=.17+tip/4*.85,stem:NaturalPoint=[root[0]+(end[0]-root[0])*u,root[1]+.064*u,root[2]+(end[2]-root[2])*u];
            const direction=yaw+(tip%2?1:-1)*.75, narrow=conifer?.045:shrub?.069:umbrella?.071:evergreen?.088:.128;
            foliate(stem,direction,conifer?.06:umbrella?.045:.11,(conifer?.22:shrub?.22:.32)*(1-.16*q),narrow,conifer?.017:.042);
          }
        }
      }
    }
  }
  return out;
}

function branch(out: NaturalSurface, a: NaturalPoint, c: NaturalPoint, r0: number, r1: number) {
  const d = c.map((v, i) => v - a[i]), length = Math.hypot(...d), axis = d.map(v => v / length);
  const helper = Math.abs(axis[1]) > .9 ? [1, 0, 0] : [0, 1, 0];
  const cross = (u: number[], v: number[]) => [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  let u = cross(axis, helper); const n = Math.hypot(...u); u = u.map(v => v / n); const v = cross(axis, u);
  const start = out.positions.length / 3, sides = 9;
  for (let end = 0; end < 2; end++) for (let j = 0; j < sides; j++) {
    const angle = j / sides * Math.PI * 2, radius = end ? r1 : r0, center = end ? c : a;
    out.positions.push(...center.map((p, i) => p + radius * (u[i] * Math.cos(angle) + v[i] * Math.sin(angle))));
  }
  const low = out.positions.length / 3; out.positions.push(...a, ...c);
  for (let j = 0; j < sides; j++) { const k = (j + 1) % sides;
    out.indices.push(start+j,start+k,start+j+sides,start+k,start+k+sides,start+j+sides,
      low,start+k,start+j,low+1,start+j+sides,start+k+sides);
  }
}

export function vegetationStem(habit: CrownHabit, seed: number, featured = false): NaturalSurface {
  if (!['conifer','savanna','shrub'].includes(habit)) {
    const tree=buildTreeSkeletonSurface(seed,featured);
    for(let j=0;j<10;j++) {
      const yaw=j*2.39996+seed*.5, h=.46+.040*j, span=.22-.009*j;
      const elbow:NaturalPoint=[.58*span*Math.cos(yaw),h+.083,.58*span*Math.sin(yaw)];
      branch(tree,[.006*Math.sin(h+seed),h,.004*Math.cos(seed)],elbow,.015-.0008*j,.006);
      for(const side of [-1,1]) {
        const a=yaw+side*.53,tip:NaturalPoint=[elbow[0]+.55*span*Math.cos(a),elbow[1]+.064+.011*side,elbow[2]+.55*span*Math.sin(a)];
        branch(tree,elbow,tip,.006,.002);
      }
    }
    return tree;
  }
  const out: NaturalSurface = { positions: [], indices: [] };
  if (habit === 'shrub') {
    for (let i = 0; i < 5; i++) { const a = seed * .3 + i * Math.PI * 2 / 5;
      branch(out, [0, 0, 0], [Math.cos(a) * .19, .52 + (i % 3) * .065, Math.sin(a) * .16], .025, .004);
    }
  } else if (habit === 'savanna') {
    branch(out, [0,0,0], [.012,.47,0], .037, .018);
    for (let i = 0; i < 5; i++) { const a = seed * .4 + i * Math.PI * 2 / 5;
      const elbow: NaturalPoint = [Math.cos(a)*.10,.65,Math.sin(a)*.085];
      branch(out,[.012,.43,0],elbow,.018,.008);
      branch(out,elbow,[Math.cos(a)*.29,.80 + (i%2)*.025,Math.sin(a)*.23],.008,.002);
    }
  } else {
    branch(out, [0,0,0], [0,.99,0], .025, .002);
    for (let level = 0; level < 7; level++) for (let i = 0; i < 5; i++) {
      const y = .32 + level * .087, a = i * Math.PI * 2 / 5 + level * .53 + seed * .3, radius = .25 * (1 - y);
      branch(out,[0,y,0],[Math.cos(a)*radius,y-.035,Math.sin(a)*radius],.007*(1-y)+.002,.0015);
    }
  }
  return out;
}
