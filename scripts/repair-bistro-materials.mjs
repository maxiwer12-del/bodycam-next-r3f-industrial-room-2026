import fs from 'node:fs';
const file='public/maps/bistro-zone/scene.gltf',g=JSON.parse(fs.readFileSync(file,'utf8'));
let modified=0,unused=0;
for(const material of g.materials||[]){
  const ext=material.extensions?.KHR_materials_specular;
  const packed=ext?.specularTexture;
  if(!packed)continue;
  const tex=g.textures?.[packed.index],source=tex?.extensions?.KHR_texture_basisu?.source??tex?.source;
  const uri=g.images?.[source]?.uri||'';
  if(!uri.endsWith('_Specular.ktx2'))continue;
  material.pbrMetallicRoughness ||= {};
  material.pbrMetallicRoughness.metallicRoughnessTexture={index:packed.index};
  material.occlusionTexture={index:packed.index,strength:1};
  delete material.extensions.KHR_materials_specular;
  if(!Object.keys(material.extensions).length)delete material.extensions;
  modified++;
}
const used=(g.materials||[]).some(x=>!!x.extensions?.KHR_materials_specular);
if(!used){
  g.extensionsUsed=g.extensionsUsed?.filter(x=>x!=='KHR_materials_specular');
  g.extensionsRequired=g.extensionsRequired?.filter(x=>x!=='KHR_materials_specular');
}
fs.writeFileSync(file,JSON.stringify(g));
console.log('PBR_MATERIAL_REPAIRED',modified,'of',g.materials.length,'used',g.extensionsUsed,'remainingIncorrect',used);
if(modified<95)process.exitCode=1;
