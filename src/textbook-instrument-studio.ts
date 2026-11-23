import { THREE as T } from './reference/engine.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import probeUrl from './assets/studio/instrument-room.hdr?inline';

/** A linear-light Blender studio shared by all instrument finishes in this book.
 * Decode locally so the opening frame and offline classroom use the same light. */
export function createInstrumentStudio(renderer:any){
  const binary=atob(probeUrl.slice(probeUrl.indexOf(',')+1));
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const hdr=new HDRLoader().parse(bytes.buffer);
  const probe=new T.DataTexture(hdr.data,hdr.width,hdr.height,T.RGBAFormat,hdr.type);
  probe.mapping=T.EquirectangularReflectionMapping;
  probe.colorSpace=T.LinearSRGBColorSpace;probe.flipY=true;
  probe.minFilter=T.LinearFilter;probe.magFilter=T.LinearFilter;probe.needsUpdate=true;
  const generator=new T.PMREMGenerator(renderer);
  try{
    const target=generator.fromEquirectangular(probe);
    target.texture.name='Blender instrument studio';
    return {texture:target.texture,dispose:()=>target.dispose()};
  }finally{generator.dispose();probe.dispose()}
}
