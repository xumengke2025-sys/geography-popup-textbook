import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildSoilCareWorld } from '../src/textbook-soil-care-world';
import { evaluateSoilCare } from '../src/textbook-soil-care-model';

function fixture() {
  const root = new T.Group(), meshes: T.Mesh[] = [], mats = new Map<string, T.MeshStandardMaterial>();
  const b: any = { width: 300, height: 160, root, meshes,
    materialFor(role: string, color: string) { const k = role + color; if (!mats.has(k)) mats.set(k, new T.MeshStandardMaterial({color})); return mats.get(k)!; },
    mesh(geometry: T.BufferGeometry, color: string, _edges: boolean, _volume: boolean, role: string) {
      const m = new T.Mesh(geometry, this.materialFor(role,color)); root.add(m); meshes.push(m); return m;
    }, contour() {},
  };
  const motion = buildSoilCareWorld(b), role = (name: string) => meshes.filter(m => m.userData.soilCareRole === name);
  return { motion, meshes, root, role };
}
const bounds = (m: T.Mesh) => { m.updateWorldMatrix(true,false);m.geometry.computeBoundingBox();return m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld); };

describe('the complete retained water/salt instrument obeys the source model', () => {
  it('retains all twenty salt identities through every branch and reverse scrubbing', () => {
    const { motion, role } = fixture(), salt = role('salt-packet');
    expect(salt).toHaveLength(20);
    const geometryIds = salt.map(m => m.geometry.uuid);
    for (const selection of [0,1,2]) for (const phase of [0,.13,.4,.77,1,.4,0]) {
      motion.update(phase,selection,0,true); const state = evaluateSoilCare(phase,selection), actual = motion.describe!();
      for (const key of Object.keys(state) as (keyof typeof state)[]) expect(actual[key]).toEqual(state[key]);
      for (let i=0;i<20;i++) {
        const m=salt[i],packet=state.packets[i];
        expect(m.visible).toBe(true);expect(m.userData.soilCareSaltId).toBe(packet.id);
        expect(m.geometry.uuid).toBe(geometryIds[i]);
        expect(m.position.x/3).toBeCloseTo(packet.u*100,12);
        expect(m.position.y/3).toBeCloseTo(8+packet.height*1.8,12);
        expect(m.userData.drained).toBe(packet.drained);
      }
    }
  });
  it('keeps drained salt in the actual receiving vessel rather than making it disappear', () => {
    const { motion, role }=fixture(); motion.update(1,1,0,true);
    const receiver=bounds(role('receiver-water')[0]);
    const drained=role('salt-packet').filter(m=>m.userData.drained);
    expect(drained).toHaveLength(15);
    for(const m of drained)expect(receiver.containsPoint(m.position)).toBe(true);
    expect(motion.describe!()).toMatchObject({ retainedSalt:.25,drainedSalt:.75,totalSalt:1,actualReclamationDesign:false });
  });
  it('opens the real drainage gate only in the freshwater drainage condition', () => {
    const { motion,role,meshes }=fixture(),gate=role('drainage-gate')[0];
    for(const selection of [0,1,2,1,0]) {
      motion.update(.5,selection,0,true);
      expect(gate.position.y).toBe(selection===1?18:0);
      expect(role('freshwater')[0].visible).toBe(selection===1);
      expect(role('receiver-water')[0].visible).toBe(selection===1);
    }
    // The old intact right wall is hidden and replaced by a sill + back wall;
    // the salt's exit level lies above that sill and below the opened gate.
    const sill=meshes.find(m=>m.userData.soilInstrumentPart==='groundwater-open-exit-sill')!;
    expect(bounds(sill).max.y).toBeLessThan((8+4.5*1.8)*3);
  });
  it('retains the same soil solids and only adds natural cover, without claiming existing salt was removed', () => {
    const {motion,role}=fixture(),soil=role('soil-aggregate'),original=soil.map(m=>Array.from(m.geometry.attributes.position.array));
    for(const selection of [0,1,2,0]) {
      motion.update(1,selection,0,true);
      expect(soil.map(m=>Array.from(m.geometry.attributes.position.array))).toEqual(original);
      expect([...role('mulch-stems'),...role('mulch-leaves')].every(m=>m.visible===(selection===2))).toBe(true);
      expect(motion.describe!().coverRemovesExistingSalt).toBe(false);
    }
  });
  it('aligns eight open downspouts with schematic flow paths in one continuous soil specimen', () => {
    const {motion,role}=fixture(),spouts=role('freshwater-nozzle'),lanes=motion.describe!().schematicFlowLaneCenters as number[];
    expect(spouts).toHaveLength(8);expect(role('soil-aggregate')).toHaveLength(1);
    const soil=role('soil-aggregate')[0];expect(soil.userData.singleContinuousSoil).toBe(true);
    expect(soil.userData.schematicFlowLanes).toEqual(lanes);
    spouts.forEach((m,i)=>{expect(m.position.x/3).toBeCloseTo(lanes[i],12);expect(m.userData.openBoreRadius).toBeGreaterThan(0);});
    expect(motion.describe!()).toMatchObject({poreGeometryMeasured:false,waterAmountMeasured:false,schematicWaterTracers:true});
  });
  it('exposes real body controls and a reversible observation rider on the same state', () => {
    const {motion,role}=fixture(),slider=role('observation-slider')[0],track=slider.userData.modelInput.track;
    expect(role('soil-aggregate').every(m=>m.userData.modelInput.selection===0)).toBe(true);
    expect(role('groundwater')[0].userData.modelInput.selection).toBe(1);
    expect(role('mulch-stems')[0].userData.modelInput.selection).toBe(2);
    motion.update(0,0,0,true);expect(slider.position.toArray()).toEqual(track.start);
    motion.update(1,2,0,true);slider.position.toArray().forEach((v:number,i:number)=>expect(v).toBeCloseTo(track.end[i],12));
    motion.update(.4,1,0,true);const first=slider.position.toArray();
    motion.update(.9,1,0,true);motion.update(.4,1,0,true);expect(slider.position.toArray()).toEqual(first);
  });
});
