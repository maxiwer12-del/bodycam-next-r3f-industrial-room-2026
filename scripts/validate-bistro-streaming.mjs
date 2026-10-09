import fs from 'node:fs';
import path from 'node:path';
const root='public/maps/bistro-overhaul',a=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const errors=[],seen=new Set();
if(a.exterior.length<10)errors.push('Too few exterior spatial chunks');
if(a.interior.meshCount!==1186)errors.push('Interior mesh coverage must be complete');
if(a.coreMeshCount+a.additionalExteriorMeshes!==a.sourceExteriorMeshes)errors.push('Missing exterior source geometry');
for(const entry of [...a.exterior,a.interior]){
 if(seen.has(entry.id))errors.push('Duplicate '+entry.id);
 seen.add(entry.id);
 const location=path.join('public',entry.url),g=JSON.parse(fs.readFileSync(location));
 const bin=path.join(path.dirname(location),g.buffers[0].uri);
 if(!fs.existsSync(bin)||fs.statSync(bin).size!==g.buffers[0].byteLength)errors.push('Invalid buffer '+entry.id);
 if(g.nodes.length!==entry.meshCount+1)errors.push('Mesh count mismatch '+entry.id);
 if(g.meshes.length<1)errors.push('No meshes '+entry.id);
 if(!entry.bounds.every(v=>v.length===3&&v.every(Number.isFinite)))errors.push('Bad world bounds '+entry.id);
 if(g.materials.some(m=>m.extensions?.KHR_materials_specular?.specularTexture))errors.push('Unconverted packed specular '+entry.id);
 for(const i of g.images){if(!i.uri.endsWith('.ktx2'))errors.push('Non-KTX2 image '+entry.id)}
 for(const v of g.bufferViews)if(v.byteOffset+v.byteLength>g.buffers[0].byteLength)errors.push('Out-of-range buffer '+entry.id);
 for(const ac of g.accessors)if(ac.bufferView>=g.bufferViews.length)errors.push('Out-of-range accessor '+entry.id);
}
console.log('CITY_OVERHAUL_SPATIAL_ASSET_VALIDATION',JSON.stringify({cityChunks:a.cityChunks,sourceMeshes:a.sourceExteriorMeshes,extraMeshes:a.additionalExteriorMeshes,interiorMeshes:a.interior.meshCount,geometryMB:Math.round([...a.exterior,a.interior].reduce((s,e)=>s+e.geometryBytes,0)/1e6),errors}));
if(errors.length)process.exit(1);
