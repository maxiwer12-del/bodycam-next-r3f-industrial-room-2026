import fs from 'node:fs';const l=JSON.parse(fs.readFileSync('data/level.layout.json'));let issues=[];
if(l.room.width<10||l.room.length<10||l.room.height<4)issues.push('ROOM_DIMENSIONS');
const walls=l.objects.filter(x=>x.id.startsWith('arch-'));
const doors=walls.filter(x=>x.variant?.includes('door'));
if(walls.length<28)issues.push('INCOMPLETE_SHELL');
if(doors.length<1)issues.push('NO_DOORWAY');
const props=l.objects.filter(x=>x.anchor==='FloorAnchor');
for(const p of props)if(Math.abs(p.position[0])<.8&&Math.abs(p.position[2])<.8)issues.push('BLOCKED_CENTRAL_ROUTE '+p.id);
console.log('WORLD shellModules',walls.length,'doors',doors.length,'props',props.length,'issues',issues.length);if(issues.length){console.error(issues);process.exit(1)}

