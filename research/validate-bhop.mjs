import assert from 'node:assert/strict';
import {BistroMovement,MOVEMENT_TUNING,EYE_HEIGHT} from '../src/game/BistroMovement.ts';

function sim(dt=1/60,contact={floor:()=>0,clear:()=>true}){
 const physics=new BistroMovement(),pos={x:0,y:EYE_HEIGHT,z:0};
 const step=(seconds,{wishX=0,wishZ=-1,sprint=false,jumpPressed=false}={})=>{
  for(let elapsed=0;elapsed<seconds-.000001;elapsed+=dt){
   physics.update(Math.min(dt,seconds-elapsed),pos,{
    wishX,wishZ,sprint,jumpPressed:jumpPressed&&elapsed===0
   },contact);
  }
  return physics.snapshot();
 };
 return {physics,pos,step};
}
{
 const a=sim();
 a.step(1.8,{wishZ:-1,sprint:false});
 assert(Math.abs(a.physics.snapshot().speed-MOVEMENT_TUNING.walkSpeed)<.05);
 a.step(1.5,{wishZ:-1,sprint:true});
 assert(Math.abs(a.physics.snapshot().speed-MOVEMENT_TUNING.runSpeed)<.05);
 console.log('PASS walk and SHIFT sprint velocity');
}
{
 const a=sim();
 a.step(1,{sprint:true});
 a.step(.016,{sprint:true,jumpPressed:true});
 assert(!a.physics.grounded);
 assert(a.physics.jumps===1);
 a.step(1.8,{sprint:true});
 assert(a.physics.jumps===1,'Held Space must never autojump');
 assert(a.physics.grounded);
 console.log('PASS jump press edge, no held auto bunnyhop');
}
{
 const a=sim();
 a.step(1,{sprint:true});
 a.step(.016,{sprint:true,jumpPressed:true});
 while(!a.physics.grounded)a.step(1/60,{sprint:true});
 const landed=a.physics.clock;
 a.step(.048,{sprint:true});
 a.step(.016,{sprint:true,jumpPressed:true});
 assert(a.physics.jumps===2,'Fresh well-timed key press should jump again');
 assert(a.physics.chain===1,'Timing window must reward combo');
 assert(a.physics.snapshot().speed>MOVEMENT_TUNING.runSpeed,'Bhop should reward momentum');
 assert(a.physics.clock-landed<.13,'Perfect hop should be near landing');
 console.log('PASS skill chain + capped momentum');
}
{
 const a=sim();
 a.step(.9,{sprint:true});
 a.step(.016,{sprint:true,jumpPressed:true});
 while(!a.physics.grounded)a.step(1/60,{sprint:true});
 a.step(.19,{sprint:true});
 a.step(.016,{sprint:true,jumpPressed:true});
 assert(a.physics.chain===0,'Late jump must not preserve bunnyhop combo');
 console.log('PASS mistimed hop loses chain');
}
{
 const a=sim(1/30);
 a.step(.8,{sprint:true});
 a.step(.033,{sprint:true,jumpPressed:true});
 a.step(1.5,{sprint:true});
 assert(a.physics.jumps===1);
 assert(a.physics.grounded);
 console.log('PASS 30 FPS airborne integration');
}
{
 const c={floor:(x,z)=>z>-2?0:null,clear:()=>true};
 const a=sim(1/60,c);
 a.step(3,{sprint:true,wishZ:-1});
 assert(a.pos.z>-2.03,'Never run out of physical map even when visual map continues');
 console.log('PASS no navigation through an unfinished physical boundary');
}
console.log('BHOP_MOVEMENT_VALIDATION_PASS');
