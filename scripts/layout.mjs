import fs from 'node:fs';
const list=[];const add=(id,asset,variant,p,r=[0,0,0],anchor='FloorAnchor')=>list.push({id,asset,variant,position:p,rotation:r,anchor,scale:[1,1,1],status:'PENDING_VISUAL_QA'});
const N=4;
for(let i=0;i<N;i++)for(const [side,rot,point] of [['south',0,[6-i*3,-6]],['north',Math.PI,[ -3+i*3,6]],['west',Math.PI/2,[-6,-3+i*3]],['east',-Math.PI/2,[6,6-i*3]]]){
 const [x,z]=point;
 for(let l=0;l<2;l++){
  let variant=l===1&&[1,2].includes(i)?'wall_window_centered_large_01':'wall_standard_standard_01';
  if(side==='south'&&l===0&&i===1)variant='wall_door_centered_large_01';
  add('arch-'+side+'-'+l+'-'+i,'modular_urban_apartments_facade',variant,[x,l*3,z],[0,rot,0],variant.includes('window')?'WindowAnchor':variant.includes('door')?'DoorAnchor':'WallAnchor');
  if(variant.includes('window'))add('glass-'+side+'-'+l+'-'+i,'modular_urban_apartments_facade','window_centered_large_01',[x,l*3,z],[0,rot,0],'WindowAnchor');
 }
}
add('industrial-shutter','rollershutter_door',null,[2.5,0,-5.93],[0,Math.PI,0],'DoorAnchor');
add('desk','metal_office_desk',null,[-4,0,3.8],[0,Math.PI/2,0]);
add('cabinet','painted_wooden_cabinet_02',null,[-5,0,-2.6],[0,Math.PI/2,0]);
add('crate01','plastic_crate_01',null,[3.2,0,3.9]);add('crate02','plastic_crate_01',null,[4.0,0,3.9]);
add('drum','barrel_03',null,[-3.6,0,-3.9]);add('drum2','barrel_03',null,[-2.9,0,-4.1]);
add('electric','utility_box_01',null,[5.77,2,-3.6],[0,-Math.PI/2,0],'WallAnchor');
add('industrial-box','industrial_pastic_container',null,[4.3,0,1.9]);
add('industrial-box2','industrial_pastic_container',null,[4.3,0,2.6]);
add('airduct','modular_airduct_rectangular_01','modular_airduct_rectangular_01_tripple_01',[-4.4,5.3,-3],[0,0,0],'StructuralAnchor');
add('airduct2','modular_airduct_rectangular_01','modular_airduct_rectangular_01_tripple_01',[-4.4,5.3,-1.2],[0,0,0],'StructuralAnchor');
add('sconce','industrial_caged_sconce','industrial_caged_sconce_c',[5.7,3.1,3.9],[0,-Math.PI/2,0],'WallAnchor');
add('barrier','concrete_road_barrier_02',null,[3.6,0,-2.7],[0,Math.PI/2,0]);
add('fence','modular_chainlink_fence','modular_chainlink_fence_door_gate',[-4.2,0,-1.0],[0,Math.PI/2,0],'StructuralAnchor');
fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/level.layout.json',JSON.stringify({room:{width:12,length:12,height:6},coordinateSystem:'right-handed, Y-up, metres',anchors:['FloorAnchor','WallAnchor','CeilingAnchor','ShelfAnchor','DoorAnchor','WindowAnchor','StructuralAnchor'],objects:list},null,2));console.log('placed',list.length);

