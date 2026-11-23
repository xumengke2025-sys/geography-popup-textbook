/** These details are cut into the existing Blender meshes in model units.
 * The moving dune carries its own stoss ripples and a quieter slip face. */
export function finishWindSpecimens(stone: any, yardang: any, dune: any, bed: any, s: number, z0: number) {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const bell = (x: number) => Math.exp(-x*x);
  const carve = (mesh: any, name: string,
    sculpt: (x: number,y: number,z: number) => [number,number,number,number,number,number]) => {
    const geometry = mesh.geometry, pos = geometry.attributes.position, color = geometry.attributes.color;
    for (let i=0;i<pos.count;i++) {
      const [x,y,z,r,g,b] = sculpt(pos.getX(i)/s, pos.getY(i)/s, (pos.getZ(i)-z0)/s);
      pos.setXYZ(i, x*s, y*s, z0+z*s);
      color.setXYZ(i, clamp(color.getX(i)*r), clamp(color.getY(i)*g), clamp(color.getZ(i)*b));
    }
    pos.needsUpdate = color.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    mesh.userData.landformDetail = name;
  };
  // Truncated facets meet on the upwind cap. Two weak beds recess into
  // the pedestal and leave the harder ochre cap projecting over the neck.
  carve(stone,'砂岩帽层断口与差异风蚀岩颈',(x,y,z) => {
    const xx=x-57, zz=z-26, r=Math.max(.1,Math.hypot(xx,zz));
    const h=y+.07*xx+.10*zz+.36*Math.sin(.34*zz+.1*xx);
    const band=bell((h-16.2)/.63)+.78*bell((h-19.7)/.70)+.55*bell((h-7.2)/.60);
    const cap=clamp((h-15.3)/3), cut=Math.max(0,-xx*.89+zz*.46-11.3,xx*.19+zz*.98-10.4);
    const scale=Math.max(.65,1-(band*.92+cut*cap*.85)/r);
    const iron=bell((h-17.2)/1.03)+.65*bell((h-21.3)/.86);
    const laminated=.86+.21*cap+.15*Math.sin(h*1.32)*clamp((h-11)/3)-.14*band;
    return [57+xx*scale,y,26+zz*scale,laminated*(1.03+.13*iron),laminated*(.99-.12*iron),laminated*(.89-.23*iron)];
  });
  // The long flanks are polished parallel to transport. Deflation leaves
  // a paler floor between the five sandstone remnants.
  carve(yardang,'雅丹长脊与顺风剥蚀槽',(x,y,z) => {
    const exposed=clamp((y-1.05)/3.7), layer=y+.039*x+.25*Math.sin(.51*z+.065*x);
    const seam=bell(Math.sin(layer*1.08)*3.1);
    const gutter=bell(Math.sin(z*1.4+.15*Math.sin(x*.19)+.18*y)*2.7);
    const relief=exposed*(.47*gutter+.39*seam);
    const tint=1.19-.17*exposed-.23*exposed*seam;
    return [x,y-relief,z,tint*(1+.06*exposed),tint*(1-.05*exposed),tint*(1-.15*exposed)];
  });
  const sandWave = (x:number,z:number) => {
    const angle=2.55*x+.31*z+.92*Math.sin(.42*z+.065*x)+.42*Math.sin(.91*z-.057*x);
    return .52*Math.sin(angle)+.22*Math.sin(2*angle-.64)+.08*Math.sin(3*angle-.32);
  };
  carve(dune,'迎风面横纹与背风面滑砂',(x,y,z) => {
    const q=(z-26)/16.3, span=clamp(1-q*q), crest=57+24*q*q+.69*Math.sin(5*q);
    const stoss=clamp((crest-x)*.9)*clamp((y-.98)*1.7);
    const wave=sandWave(x,z), ridge=stoss*wave;
    const slip=clamp((x-crest)*.7)*(1+.23*Math.sin(z*.76));
    const tint=1+.27*ridge-.07*slip;
    return [x,y+.27*ridge*span,z,1.04*tint,1.015*tint,.94*tint];
  });
  carve(bed,'风道床面缓起沙纹',(x,y,z) => {
    const drift=clamp(.38+.5*Math.sin(z*.26+.7*Math.sin(x*.11))+.25*Math.cos(x*.16));
    const wave=sandWave(x,z)*drift;
    return [x,y+.105*wave,z,1+.16*wave,.98+.15*wave,.90+.14*wave];
  });
}
