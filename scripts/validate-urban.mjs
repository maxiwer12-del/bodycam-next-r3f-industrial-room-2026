import fs from 'node:fs';
import path from 'node:path';
const root='public/maps/bistro-zone',file=path.join(root,'scene-merged.gltf');
const problems=[];
if(!fs.existsSync(file))problems.push('Missing prepared scene-merged.gltf');
let g;
try{g=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){problems.push('glTF file invalid JSON: '+String(e))}
if(g){
 const buf=g.buffers?.[0],bin=buf&&path.join(root,buf.uri);
 if(!buf||!fs.existsSync(bin)||fs.statSync(bin).size!==buf.byteLength)problems.push('Geometry buffer missing or wrong length');
 if(g.meshes.length<60)problems.push('Missing actual city geometry');
 if(g.meshes.reduce((n,m)=>n+m.primitives.length,0)>250)problems.push('Geometry not batched for mobile');
 if(g.materials.length<80)problems.push('Missing material library');
 if(g.images.length<250)problems.push('Missing PBR textures');
 for(const t of g.images){
  if(!t.uri||!fs.existsSync(path.join(root,t.uri))){problems.push('Missing texture '+t.uri);continue}
  const b=fs.readFileSync(path.join(root,t.uri));
  if(b.toString('ascii',1,4)!=='KTX')problems.push('Invalid KTX magic '+t.uri);
 }
 for(const m of g.materials){if(m.occlusionTexture){const tex=g.textures[m.occlusionTexture.index],source=tex?.extensions?.KHR_texture_basisu?.source??tex?.source;const uri=g.images[source]?.uri||'';if(uri.endsWith('_Specular.ktx2'))problems.push('Bad black AO in material '+m.name)}}
 const mtl=g.materials.length,textures=g.images.length,prim=g.meshes.reduce((n,m)=>n+m.primitives.length,0);
 console.log('MATERIALS',mtl,'TEXTURES',textures,'DRAW_PRIMITIVES',prim,'GEOMETRY_BYTES',buf?.byteLength);
}
const hdr=path.join(root,'san_giuseppe_1k.hdr');if(!fs.existsSync(hdr)||fs.statSync(hdr).size<10000)problems.push('Missing source-authored HDR environment');
console.log('URBAN_ASSET_CHECK',problems.length?'FAILED':'PASSED','issues',problems.length);
if(problems.length){console.error(problems.join('\n'));process.exit(1)}

