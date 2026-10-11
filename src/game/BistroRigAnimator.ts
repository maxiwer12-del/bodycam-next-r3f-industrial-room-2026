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
  idle.play();this.active=idle;
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

 update(dt:number,metersPerSecond:number){
  const speed=Math.max(0,metersPerSecond);
  const mode=speed>4.8?'run':speed>0.35?'walk':'idle';
  if(mode!==this.movement){
   this.movement=mode;
   if(!this.oneShot){
    const desired=this.actions[mode]||this.actions.idle;
    if(desired)this.transition(desired,.2);
   }
  }
  this.mixer.update(dt);
 }

 trigger(kind:'shot'|'reload'|'draw',seconds?:number){
  const action=this.actions[kind];
  if(!action)return false;
  if(this.oneShot&&kind==='shot'&&this.oneShot===this.actions.reload)return false;
  // Auto fire can retrigger the same shot action before it finishes.
  // Resetting the active action without restarting leaves a frozen weapon.
  const retrigger=action===this.active;
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

/** Plays the original CC0 rigid slide/bolt/magazine clips on imported weapons. */
export class BistroWeaponPartAnimator {
 private mixer:THREE.AnimationMixer;
 private clips:THREE.AnimationClip[];
 private next:THREE.AnimationAction|null=null;
 private live=true;
 constructor(root:THREE.Object3D,clips:THREE.AnimationClip[]){
  this.mixer=new THREE.AnimationMixer(root);
  this.clips=clips;
  this.mixer.addEventListener('finished',this.finished);
 }
 private finished=(e:{action:THREE.AnimationAction})=>{
  if(!this.live)return;
  if(this.next){
   const following=this.next;
   this.next=null;
   following.reset().setLoop(THREE.LoopOnce,1);
   following.clampWhenFinished=false;
   following.play();
  }else{
   e.action.stop();
  }
 };
 trigger(kind:'shot'|'reload',weapon:'pistol'|'shotgun'){
  this.mixer.stopAllAction();
  const names=weapon==='pistol'?
    kind==='shot'?['slide-open','slide-close']:['magazine-open','magazine-close']:
    ['open','close'];
  const [a,b]=names.map(name=>this.clips.find(c=>c.name.toLowerCase()===name));
  if(!a)return;
  const first=this.mixer.clipAction(a);
  first.reset();first.setLoop(THREE.LoopOnce,1);
  first.clampWhenFinished=true;
  first.setEffectiveTimeScale(Math.max(1,a.duration/(kind==='shot'?.16:.55)));
  first.play();
  this.next=b?this.mixer.clipAction(b):null;
  if(this.next){
   this.next.stop();this.next.setEffectiveTimeScale(Math.max(1,b!.duration/(kind==='shot'?.14:.48)));
  }
 }
 update(dt:number){this.mixer.update(dt)}
 dispose(){this.live=false;this.mixer.removeEventListener('finished',this.finished);this.mixer.stopAllAction()}
}
