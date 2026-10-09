import fs from 'node:fs';
const cat=JSON.parse(fs.readFileSync('data/catalog.json'));const layout=JSON.parse(fs.readFileSync('data/level.layout.json'));
let issues=[];
for(const a of cat){
 const file='public'+a.url;
 if(!fs.existsSync(file)){issues.push('MISSING '+file);continue}
 const data=fs.readFileSync(file);
 if(data.toString('utf8',0,4)!=='glTF')issues.push('BAD_GLTF_MAGIC '+a.id);
 if(data.readUInt32LE(4)!==2)issues.push('BAD_GLTF_VERSION '+a.id);
 if(data.readUInt32LE(8)!==data.length)issues.push('BAD_GLTF_LENGTH '+a.id);
 const chunksize=data.readUInt32LE(12);const chunk=data.toString('utf8',20,20+chunksize).trim();let gltf;
 try{gltf=JSON.parse(chunk)}catch{issues.push('UNPARSEABLE_JSON '+a.id);continue}
 if(!gltf.meshes?.length)issues.push('NO_MESHES '+a.id);
 if(!gltf.materials?.length)issues.push('NO_MATERIALS '+a.id);
 for(const [name,b] of Object.entries(a.bounds))if(b.dimensions.some(n=>!Number.isFinite(n)||n<0))issues.push('BAD_BOUNDS '+a.id+':'+name);
 console.log('ASSET',a.id,'BYTES',data.length,'MESHES',gltf.meshes?.length||0,'MATERIALS',gltf.materials?.length||0);
}
if(issues.length){console.error(issues.join('\n'));process.exit(1)}console.log('VALIDATED',cat.length,'assets');

