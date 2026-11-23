import { Group, Mesh, MeshStandardMaterial, DoubleSide } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Authoring transfer only. Browser callbacks and shader-driven pen strokes
// stay in the textbook. Preserve object hierarchy and dormant mesh variants.
export async function captureModel(){
  const entry=window.textbookDebug.entry;
  const original=entry.art.geometry.root;
  const materials=new Map();
  const convertMaterial=source=>{
    if(materials.has(source.uuid))return materials.get(source.uuid);
    const role=source.userData.materialRole||'specimen';
    const material=new MeshStandardMaterial({color:source.color??0xffffff,roughness:source.roughness??.82,
      metalness:source.metalness??0,side:DoubleSide,vertexColors:!!source.vertexColors});
    material.name=role+' '+material.color.getHexString();
    if(source.userData.earthScan) {
      material.userData.earthScan=source.userData.earthScan;
      material.userData.scanTileSize=source.userData.scanTileSize;
      material.name+=' '+source.userData.earthScan;
    }
    if(source.map?.image){material.map=source.map;material.transparent=source.transparent;material.alphaTest=source.alphaTest;}
    else if(source.opacity<1){material.opacity=source.opacity;material.transparent=true}
    materials.set(source.uuid,material);return material;
  };
  let count=0;
  function copy(node,path,shown){
    const visible=shown&&node.visible;
    const geometry=node.geometry;
    const supported=node.isMesh&&geometry?.attributes.position&&!geometry.isInstancedBufferGeometry
      && !node.material?.isShaderMaterial;
    const obj=supported?new Mesh(geometry,Array.isArray(node.material)?node.material.map(convertMaterial):convertMaterial(node.material)):new Group();
    const data=node.userData;
    const name=data.text??node.name??'';
    const role=Object.entries(data).find(([key,value])=>/Role$|Part$/.test(key)&&typeof value==='string')?.[1];
    obj.name=name||role||data.kind||'Assembly';
    if(supported){
      count++;
      obj.userData={partPath:path,initiallyVisible:!!visible};
      if(data.modelInput)obj.userData.modelInput=JSON.stringify(data.modelInput);
    }
    obj.position.copy(node.position);obj.quaternion.copy(node.quaternion);obj.scale.copy(node.scale);
    node.children.forEach((child,i)=>{const sub=copy(child,path+'.'+i,visible);if(sub)obj.add(sub)});
    return supported||obj.children.length?obj:null;
  }
  const root=copy(original,'0',true);
  if(!root||!count)throw Error('No editable geometry for '+entry.figure.id);
  root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.setScalar(.025);
  root.name=entry.figure.title;
  // Keep the engraved parallels and gore seams on the sectional globe when
  // the specimen is opened at full size in the Blender workshop.
  const maxTextureSize=entry.figure.id==='earth'?2048:512;
  const glb=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false,maxTextureSize});
  const bytes=new Uint8Array(glb);let raw='';
  for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const geometry=entry.art.geometry;
  const ink={};
  for(const [name,lines] of Object.entries({structure:geometry.pen.lines.lines,
    contours:geometry.outlines,flow:geometry.flow,accent:geometry.accentStrokes})){
    ink[name]=lines.map(line=>{
      const points=line.points??line.pts??[];
      return {width:line.width??1,closed:!!line.closed,xyz:points.map(p=>
        [p.x,p.y,p.z].map(n=>Math.round(n*1000)/1000))};
    }).filter(line=>line.xyz.length>=2);
  }
  const state=window.textbookDiagnostics.state;
  return {count,ink,phase:state.phase,selection:state.selection,base64:btoa(raw)};
}
