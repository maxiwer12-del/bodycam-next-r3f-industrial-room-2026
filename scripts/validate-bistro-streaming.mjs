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
 for(const image of g.images){
   const uri=image.uri||'';
   if(!uri.startsWith('/maps/bistro-zone/Textures/')||!uri.endsWith('.ktx2')||uri.includes('..')){
    errors.push('Non-local/invalid KTX2 URI '+entry.id+' '+uri);continue;
   }
   const tex='public'+uri;
   if(!fs.existsSync(tex)||fs.statSync(tex).size<150){
     errors.push('Missing Bistro texture '+uri);continue;
   }
   const fd=fs.openSync(tex,'r'),header=Buffer.alloc(12);
   try{fs.readSync(fd,header,0,12,0);}
   finally{fs.closeSync(fd);}
   if(!header.equals(Buffer.from([0xab,0x4b,0x54,0x58,0x20,0x32,0x30,0xbb,0x0d,0x0a,0x1a,0x0a])))
     errors.push('Invalid KTX2 content '+uri);
  }
 for(const v of g.bufferViews)if(v.byteOffset+v.byteLength>g.buffers[0].byteLength)errors.push('Out-of-range buffer '+entry.id);
 for(const ac of g.accessors)if(ac.bufferView>=g.bufferViews.length)errors.push('Out-of-range accessor '+entry.id);
}
console.log('CITY_OVERHAUL_SPATIAL_ASSET_VALIDATION',JSON.stringify({cityChunks:a.cityChunks,sourceMeshes:a.sourceExteriorMeshes,extraMeshes:a.additionalExteriorMeshes,interiorMeshes:a.interior.meshCount,geometryMB:Math.round([...a.exterior,a.interior].reduce((s,e)=>s+e.geometryBytes,0)/1e6),errors}));
if(errors.length)process.exit(1);
