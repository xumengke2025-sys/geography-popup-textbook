/** Dip-resistant beds split along cross joints on two exposed shoulders.
 * The probe track and the original summit datum both lie outside the cut. */
const ease=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const bell=(x:number)=>Math.exp(-x*x);
export function surveyOutcrop(x:number,z:number,h:number){
  const measuredZ=33+(x-15)*11/71;
  const free=ease((Math.abs(z-measuredZ)-2.8)/3.3)*ease((35-h)/2.7);
  const west=bell((x-29)/17)*bell((z-27.5+.17*(x-26))/7.0);
  const east=bell((x-76)/16)*bell((z-34-.23*(x-74))/6.2);
  const shoulder=Math.max(west,east)*free;
  const d=z+.21*x+.70*Math.sin(.21*x)+.31*Math.sin(.68*x+.11*z);
  const s=(d-21.4)/5.35, bed=s-Math.floor(s);
  const breakLine=x*.194+.055*z+.27*Math.sin(z*.36+x*.094);
  const crack=bell((breakLine-Math.round(breakLine))/.104);
  const scarp=ease(bed/.22)*(1-ease((bed-.24)/.72));
  return {recess:shoulder*(3.8*scarp+1.65*crack),face:shoulder*ease(bed/.12)*(1-ease((bed-.28)/.27)),
    crown:shoulder*(1-scarp)*(1-.48*crack),weathered:shoulder*crack};
}
