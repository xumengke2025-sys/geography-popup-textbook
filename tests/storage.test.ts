import {afterEach,expect,it,vi} from 'vitest';
import {initial,readProgress,STORAGE_KEY} from '../src/state';

afterEach(()=>vi.unstubAllGlobals());
function storage(raw:string) {
  const values=new Map([[STORAGE_KEY,raw]]);
  vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
}
it('damaged JSON resets safely without declaring working storage unavailable',()=>{
  storage('{broken');
  expect(readProgress()).toEqual({progress:initial(),available:true});
});
it('old progress migrates and invalid answers or observations cannot award completion',()=>{
  const old:any=initial();
  delete old.contentVersion;delete old.observationStep;
  old.diagram[0]='未知答案';old.transfer[0]=20;
  old.observations=[{kind:'午后',input:{phase:0,contrast:1},ground:'错误方向'}];
  storage(JSON.stringify(old));
  const {progress,available}=readProgress();
  expect(available).toBe(true);expect(progress.observationStep).toBe(0);
  expect(progress.diagram[0]).toBe('');expect(progress.transfer[0]).toBe(-1);
  expect(progress.observations).toEqual([]);
});
it('blocked storage leaves a usable temporary session',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>{throw Error('disabled')}});
  expect(readProgress()).toEqual({progress:initial(),available:false});
});
