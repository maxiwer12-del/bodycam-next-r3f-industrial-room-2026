import * as THREE from 'three';

export type RigPose='idle'|'walk'|'run'|'shot'|'reload'|'draw';

/** Blended authored first-person animation clips from the licensed Cransh rig. */
export class BistroRigAnimator {
 private mixer:THREE.AnimationMixer;
 private actions:Partial<Record<RigPose,THREE.AnimationAction>>={};
 private active:THREE.AnimationAction|null=null;
 private oneShot:THREE.AnimationAction|null=null;
 private movement:'idle'|'walk'|'run'='idle';
 private transitionSeconds=.16;

 constructor(mixer:THREE.AnimationMixer,clips:THREE.AnimationClip[]){
  this.mixer=mixer;
  const patterns:Record<RigPose,RegExp>={
   idle:/AK_Idle/i,walk:/AK_Walk/i,run:/AK_Run/i,shot:/AK_Shot/i,
   reload:/AK_Reload(?!_)/i,draw:/AK_Draw/i
  };
  for(const [kind,pattern] of Object.entries(patterns) as [RigPose,RegExp][]){
   const clip=clips.find(x=>pattern.test(x.name));
   if(clip){
    const action=mixer.clipAction(clip);
    action.enabled=true;action.setEffectiveWeight(1);
    action.setLoop(kind==='idle'||kind==='walk'||kind==='run'?
      THREE.LoopRepeat:THREE.LoopOnce,kind==='idle'||kind==='walk'||kind==='run'?Infinity:1);
    action.clampWhenFinished=false;
    this.actions[kind]=action;
   }
  }
  const idle=this.actions.idle;
  if(!idle)throw Error('Animated arm rig has no idle clip');
  idle.setEffectiveTimeScale(.58);idle.play();this.active=idle;
  mixer.addEventListener('finished',this.finished);
 }

 private finished=(event:{action:THREE.AnimationAction})=>{
  if(event.action!==this.oneShot)return;
  const next=this.actions[this.movement]||this.actions.idle;
  this.oneShot=null;
  if(next)this.transition(next,.14);
 };

 private transition(next:THREE.AnimationAction,time=this.transitionSeconds){
  if(next===this.active)return;
  const previous=this.active;
  next.reset();next.enabled=true;next.setEffectiveWeight(1);
  next.play();
  if(previous&&previous!==next){
   previous.enabled=true;
   next.crossFadeFrom(previous,time,true);
  }
  this.active=next;
 }

 /**
  * Do not switch FPS arms to the author's full-body Walk/Run poses.
  * Those authored clips contain large root/arm offsets: switching on the
  * threshold of camera velocity snaps the AK and separates the grip.
  * Keep the authored idle pose as a stable base; locomotion sway is applied
  * with calibrated millimetre-sized camera-space offsets by BistroCombat.
  */
 update(dt:number,_metersPerSecond:number){
  this.mixer.update(Math.min(dt,.045));
 }

 trigger(kind:'shot'|'reload'|'draw',seconds?:number){
  const action=this.actions[kind];
  if(!action)return false;
  if(this.oneShot&&kind==='shot'&&this.oneShot===this.actions.reload)return false;
  // Auto fire can retrigger the same shot action before it finishes.
  // Resetting the active action without restarting leaves a frozen weapon.
  // Do not rewind a still-playing shot action every 115ms during automatic fire.
  // The ballistic shot and procedural kick are not gated by the clip.
  const retrigger=action===this.active;
  if(retrigger&&action.isRunning())return false;
  if(retrigger)action.stop();
  this.oneShot=action;
  action.reset();
  if(seconds&&action.getClip().duration>0){
   // Match physical magazine timing and source animation duration.
   action.setEffectiveTimeScale(action.getClip().duration/seconds);
  }else action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(1);
  action.clampWhenFinished=false;
  action.setLoop(THREE.LoopOnce,1);
  if(retrigger){action.play();this.active=action;}
  else this.transition(action,.075);
  return true;
 }

 get clipNames(){return Object.entries(this.actions).filter(([,v])=>!!v).map(([k])=>k);}
 dispose(){
  this.mixer.removeEventListener('finished',this.finished);
  this.mixer.stopAllAction();
 }
}

