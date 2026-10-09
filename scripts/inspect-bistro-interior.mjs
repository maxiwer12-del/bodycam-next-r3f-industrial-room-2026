import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=process.env.BISTRO_SOURCE_DIR||'research/large-bistro/Bistro';
const gltf=JSON.parse(fs.readFileSync(root+'/BistroInterior.gltf','utf8'));
const bytes=fs.readFileSync(root+'/BistroInterior.bin');
if(bytes.length!==gltf.buffers[0].byteLength||bytes.subarray(0,48).toString().startsWith('version https://git-lfs'))throw Error('BistroInterior binary absent or only an LFS pointer');
const node=gltf.nodes[gltf.scenes[0].nodes[0]];
const report={source:'Amazon Lumberyard BistroInterior',license:'CC BY 4.0',binaryBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),meshCount:gltf.meshes.length,materialCount:gltf.materials.length,imageCount:gltf.images.length,root:{name:node.name,scale:node.scale||[1,1,1],rotation:node.rotation||[0,0,0,1]},status:'SOURCE_VERIFIED_ALIGNMENT_PENDING',note:'Must align geometry and door/floor before enabling gameplay.'};
fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/bistro-interior-source-audit.json',JSON.stringify(report,null,2)+'\n');console.log('BISTRO_INTERIOR_SOURCE_VERIFIED',JSON.stringify(report));
