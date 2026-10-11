/**
 * Camera-height movement with authored Bistro collider callbacks.
 *
 * No continuous auto-jump: every hop requires a fresh key/button press.
 * Maintaining a bunnyhop chain requires a fresh press within 110 ms after
 * landing (or <= 85 ms before landing), while running and steering.
 * Motion is frame-rate-independent and uses no artificial floor geometry.
 */
export const EYE_HEIGHT=1.7;
export const MOVEMENT_TUNING=Object.freeze({
 walkSpeed:2.75,
 runSpeed:4.75,
 maxBhopSpeed:7.1,
 groundedAcceleration:11.2,
 airborneAcceleration:3.0,
 gravity:17.8,
 jumpImpulse:5.45,
 landingWindow:0.11,
 jumpBuffer:0.085,
 coyoteTime:0.065,
 maxStep:0.045
});

export type MotionCoordinates={x:number;y:number;z:number};
export type MotionTelemetry={
 speed:number;sprinting:boolean;grounded:boolean;chain:number;jumps:number;
 airTime:number;verticalSpeed:number;groundedTime:number
};
type MovementInput={
 wishX:number;wishZ:number;sprint:boolean;jumpPressed:boolean;
};
export type WorldContact={
 /** Returns true when the imported architecture has no wall along the attempted step. */
 clear:(x:number,z:number,dx:number,dz:number)=>boolean;
 /** Find real road/sidewalk/interior geometry under or near the player's feet. */
 floor:(x:number,z:number,feetY:number)=>number|null;
};

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const approach=(value:number,target:number,rate:number,dt:number)=>
 value+(target-value)*(1-Math.exp(-Math.max(0,rate)*dt));

export class BistroMovement {
 vx=0;vz=0;vy=0;
 grounded=true;
 chain=0;
 jumps=0;
 clock=0;
 lastLandedAt=-1e9;
 lastJumpAt=-1e9;
 bufferedUntil=-1e9;
 airTime=0;
 groundedTime=0;
 hasLaunched=false;
 initialized=false;
 sprinting=false;

 queueJump(){
  this.bufferedUntil=this.clock+MOVEMENT_TUNING.jumpBuffer;
 }

 snapshot():MotionTelemetry {
  return {
   speed:Math.hypot(this.vx,this.vz),sprinting:this.sprinting,grounded:this.grounded,
   chain:this.chain,jumps:this.jumps,airTime:this.airTime,verticalSpeed:this.vy,
   groundedTime:this.groundedTime
  };
 }

 update(
  elapsedSeconds:number,position:MotionCoordinates,
  {wishX,wishZ,sprint,jumpPressed}:MovementInput,
  contact:WorldContact
 ):MotionTelemetry {
  const dt=clamp(elapsedSeconds,0,MOVEMENT_TUNING.maxStep);
  if(dt<=0)return this.snapshot();
  this.clock+=dt;
  if(jumpPressed)this.queueJump();
  let magnitude=Math.hypot(wishX,wishZ);
  if(magnitude>1){wishX/=magnitude;wishZ/=magnitude;magnitude=1;}
  const run=!!sprint&&magnitude>.48;
  this.sprinting=run;

  const feetY=position.y-EYE_HEIGHT;
  let floor=contact.floor(position.x,position.z,feetY);
  if(!this.initialized){
   this.initialized=true;
   if(floor!==null&&Math.abs(floor-feetY)<.8)position.y=floor+EYE_HEIGHT;
   this.grounded=floor!==null;
  }
  // Gravity and safe support heights are resolved by the imported road collider.
  if(this.grounded&&floor!==null&&feetY-floor>.3){
   this.grounded=false;this.vy=0;this.airTime=0;
  }
  if(this.grounded){
   this.airTime=0;
   this.groundedTime+=dt;
   if(this.clock-this.lastLandedAt>MOVEMENT_TUNING.landingWindow&&this.hasLaunched)
    this.chain=0;
  }else this.airTime+=dt;

  const hopAllowed=this.bufferedUntil>=this.clock &&
   (this.grounded || (!this.grounded && this.clock-this.lastLandedAt<MOVEMENT_TUNING.coyoteTime));
  if(hopAllowed){
   const precise=this.hasLaunched&&this.grounded&&
    this.clock-this.lastLandedAt<=MOVEMENT_TUNING.landingWindow&&
    run&&magnitude>.62;
   this.chain=precise?Math.min(5,this.chain+1):0;
   const boost=precise?Math.min(.52,.19+this.chain*.075):0;
   const presentSpeed=Math.hypot(this.vx,this.vz);
   if(run&&boost>0&&presentSpeed>.2){
    const desired=Math.min(MOVEMENT_TUNING.maxBhopSpeed,presentSpeed+boost);
    this.vx=this.vx/presentSpeed*desired;
    this.vz=this.vz/presentSpeed*desired;
   }
   this.grounded=false;
   this.groundedTime=0;this.airTime=0;
   this.vy=MOVEMENT_TUNING.jumpImpulse;
   this.jumps++;
   this.hasLaunched=true;
   this.lastJumpAt=this.clock;
   this.bufferedUntil=-1e9;
  }

  const wantedSpeed=run?
   MOVEMENT_TUNING.runSpeed+this.chain*.23:MOVEMENT_TUNING.walkSpeed;
  if(this.grounded){
   const accel=MOVEMENT_TUNING.groundedAcceleration;
   if(magnitude>.05){
    this.vx=approach(this.vx,wishX*wantedSpeed,accel,dt);
    this.vz=approach(this.vz,wishZ*wantedSpeed,accel,dt);
   }else{
    this.vx=approach(this.vx,0,14.5,dt);
    this.vz=approach(this.vz,0,14.5,dt);
   }
  }else if(magnitude>.05){
   // Aerial strafing is subtle: it does not reverse momentum or create
   // unlimited acceleration without sprinting and correctly timed landings.
   const along=this.vx*wishX+this.vz*wishZ;
   const cap=run?MOVEMENT_TUNING.maxBhopSpeed:4.0;
   if(along<cap){
    const step=Math.min(cap-along,MOVEMENT_TUNING.airborneAcceleration*dt);
    this.vx+=wishX*step;
    this.vz+=wishZ*step;
   }
  }
  const limit=run?MOVEMENT_TUNING.maxBhopSpeed:Math.max(4.4,wantedSpeed);
  const speed=Math.hypot(this.vx,this.vz);
  if(speed>limit){
   const ratio=limit/speed;this.vx*=ratio;this.vz*=ratio;
  }

  // Resolve real building collision by trying full motion first, then
  // independent axis steps to slide along facades instead of teleporting.
  const dx=this.vx*dt,dz=this.vz*dt;
  const okFloor=(x:number,z:number)=>
   // A walkable street must exist; do not run beyond streamed geometry.
   contact.floor(x,z,position.y-EYE_HEIGHT)!==null;
  if(Math.abs(dx)+Math.abs(dz)>.0001){
   if(contact.clear(position.x,position.z,dx,dz)&&okFloor(position.x+dx,position.z+dz)){
    position.x+=dx;position.z+=dz;
   }else{
    if(Math.abs(dx)>.00001&&contact.clear(position.x,position.z,dx,0)&&okFloor(position.x+dx,position.z))position.x+=dx;
    else this.vx=0;
    if(Math.abs(dz)>.00001&&contact.clear(position.x,position.z,0,dz)&&okFloor(position.x,position.z+dz))position.z+=dz;
    else this.vz=0;
   }
  }

  floor=contact.floor(position.x,position.z,position.y-EYE_HEIGHT);
  if(this.grounded){
   if(floor!==null){
    const target=floor+EYE_HEIGHT;
    // Ground is smooth, not a full camera jump at every cobblestone triangle.
    position.y=approach(position.y,target,18,dt);
    this.vy=0;
   }else{this.grounded=false;this.vy=0;}
  }else{
   this.vy-=MOVEMENT_TUNING.gravity*dt;
   position.y+=this.vy*dt;
   if(floor!==null&&this.vy<=0&&position.y<=floor+EYE_HEIGHT){
    position.y=floor+EYE_HEIGHT;
    this.vy=0;
    this.grounded=true;
    this.lastLandedAt=this.clock;
    this.groundedTime=0;
    this.airTime=0;
    // An early but precisely buffered NEW press can chain the next hop.
    if(this.bufferedUntil>=this.clock){
     const precise=this.hasLaunched&&run&&magnitude>.62;
     this.chain=precise?Math.min(5,this.chain+1):0;
     if(precise){
      const old=Math.hypot(this.vx,this.vz);
      if(old>.3){
       const next=Math.min(MOVEMENT_TUNING.maxBhopSpeed,old+.2+this.chain*.075);
       this.vx*=next/old;this.vz*=next/old;
      }
     }
     this.grounded=false;
     this.vy=MOVEMENT_TUNING.jumpImpulse;
     this.jumps++;
     this.lastJumpAt=this.clock;
     this.bufferedUntil=-1e9;
     this.airTime=0;
     position.y+=this.vy*Math.min(dt,.012);
    }
   }
  }
  // Prevent a stale buffered jump from firing after the valid timing window.
  if(this.bufferedUntil<this.clock)this.bufferedUntil=-1e9;
  return this.snapshot();
 }

 reset(){
  this.vx=0;this.vz=0;this.vy=0;this.grounded=true;
  this.chain=0;this.jumps=0;this.clock=0;this.airTime=0;
  this.groundedTime=0;this.hasLaunched=false;this.initialized=false;
  this.lastLandedAt=-1e9;this.lastJumpAt=-1e9;this.bufferedUntil=-1e9;
  this.sprinting=false;
 }
}
