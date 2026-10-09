import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const here=process.cwd(),source=path.join(here,'research/large-bistro'),outputs=path.join(here,'public/maps/bistro-zone');
const run=(bin,args,timeout=180000)=>{console.log('RUN',bin,...args);execFileSync(bin,args,{stdio:'inherit',timeout,env:{...process.env,GIT_LFS_SKIP_SMUDGE:'1'}})};
const present=(file,bytes)=>fs.existsSync(file)&&fs.statSync(file).size>bytes;
if(!present(path.join(outputs,'scene-merged.gltf'),50000)||!present(path.join(outputs,'BistroMerged.bin'),10000000)){
 fs.mkdirSync(path.join(here,'research'),{recursive:true});
 if(!present(path.join(source,'Bistro/BistroExterior.gltf'),2000000)){
  fs.rmSync(source,{recursive:true,force:true});
  run('git',['clone','--depth','1','--filter=blob:none','https://github.com/qian-o/GLTF-Assets.git',source],400000);
 }
 if(!present(path.join(source,'Bistro/BistroExterior.bin'),100000000)){
  run('git',['-C',source,'lfs','pull','--include=Bistro/BistroExterior.bin','--exclude='],360000);
 }
 run('node',['research/analyze-bistro.mjs'],90000);
 run('node',['scripts/prepare-bistro-region.mjs'],150000);
 run('node',['scripts/repair-bistro-materials.mjs'],45000);
 if(!present(path.join(here,'research/tools/ktx/KTX-Software-4.4.2-Linux-x86_64/bin/ktx'),100000)){
  const dir=path.join(here,'research/tools/ktx');fs.mkdirSync(dir,{recursive:true});
  const tmp='/tmp/ktx-4.4.2.tar.bz2';
  run('curl',['-fLsS','--retry','3','--max-time','180','https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Linux-x86_64.tar.bz2','-o',tmp],205000);
  run('tar',['-xjf',tmp,'-C',dir],60000);
 }
 run('node',['scripts/optimize-bistro-textures.mjs'],1200000);
 run('node',['scripts/prepare-bistro-hdri.mjs'],90000);
 run('node',['--max-old-space-size=3072','scripts/optimize-bistro-geometry.mjs'],180000);
}
fs.mkdirSync(path.join(here,'public/basis'),{recursive:true});
for(const f of ['basis_transcoder.js','basis_transcoder.wasm']){
 const src=path.join(here,'node_modules/three/examples/jsm/libs/basis',f);
 if(!fs.existsSync(src))throw Error('Missing Basis transcoder '+src);
 fs.copyFileSync(src,path.join(here,'public/basis',f));
}
if(!present(path.join(outputs,'scene-merged.gltf'),50000)||!present(path.join(outputs,'BistroMerged.bin'),10000000)){
 throw Error('Missing prepared urban glTF or geometry buffer');
}
console.log('URBAN_BUILD_READY',fs.readdirSync(outputs).length,fs.statSync(path.join(outputs,'BistroMerged.bin')).size);

