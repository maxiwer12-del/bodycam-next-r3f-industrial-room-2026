import fs from 'node:fs';
const file='data/bistro-walkability.json';
if(!fs.existsSync(file))throw Error('No raycast-based walkability samples; run node research/analyze-walkability.mjs');
const data=JSON.parse(fs.readFileSync(file,'utf8'));const failures=[];
const walkable=data.all.filter(p=>p.groundY!==null&&p.groundY>=-.2&&p.groundY<=1.2&&(p.slope??90)<=23);
if(data.all.length<80)failures.push('Not enough sampled world cells');
if(walkable.length<40)failures.push('Insufficient supported floor');
if(data.largest.length<35)failures.push('Navigable component too small');
if(data.connectedComponents[0]!==data.largest.length)failures.push('Component size mismatch');
const spawn=data.largest.find(p=>p.x===-9&&p.z===6);
if(!spawn)failures.push('Main camera spawn (-9,6) is not in connected walkable area');
else if(!Number.isFinite(spawn.groundY)||spawn.groundY>1)failures.push('Invalid spawn contact height');
let odd=0;
for(const p of data.largest){
 if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||!Number.isFinite(p.groundY)||!Number.isFinite(p.slope))odd++;
 if(Math.abs(p.x)>12.01||Math.abs(p.z)>12.01)odd++;
}
if(odd)failures.push('Invalid coordinates in walkability samples: '+odd);
console.log('WALKABILITY_SAMPLED',data.all.length,'SUPPORTED',walkable.length,'MAIN_CONNECTED',data.largest.length,'SPAWN_GROUND',spawn?.groundY,'ERRORS',failures.length);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}

