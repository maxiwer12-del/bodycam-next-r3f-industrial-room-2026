import fs from 'node:fs';
const cat=JSON.parse(fs.readFileSync('data/catalog.json'));const level=JSON.parse(fs.readFileSync('data/level.layout.json'));const issues=[];
const supported=new Set(level.anchors),ids=new Set();
for(const o of level.objects){
 if(ids.has(o.id))issues.push('DUPLICATE '+o.id);ids.add(o.id);
 const asset=cat.find(a=>a.id===o.asset);
 if(!asset){issues.push('MISSING_ASSET '+o.id);continue}
 if(o.variant&&!asset.bounds[o.variant])issues.push('MISSING_VARIANT '+o.id+' '+o.variant);
 if(!supported.has(o.anchor))issues.push('ANCHOR '+o.id);
 if(o.position.concat(o.scale,o.rotation).some(n=>!Number.isFinite(n)))issues.push('NAN '+o.id);
 if(o.scale.some(n=>n<.01||n>1.5))issues.push('INVALID_SCALE '+o.id);
 const [x,y,z]=o.position;
 if(Math.abs(x)>6.5||Math.abs(z)>6.5||y<-.01||y>6.3)issues.push('OUT_OF_WORLD '+o.id);
 if(o.anchor==='FloorAnchor'&&Math.abs(y)>.01)issues.push('FLOATING_ANCHOR '+o.id);
 if(o.anchor==='WindowAnchor' && y!==3)issues.push('BAD_WINDOW_HEIGHT '+o.id);
}
console.log('PLACEMENTS',level.objects.length,'ISSUES',issues.length);if(issues.length){console.error(issues.join('\n'));process.exit(1)}

