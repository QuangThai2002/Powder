import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

const FLAG='__combat2144RealSpriteTest';
const VERSION='2.14.4';
const SHEET='combat2144-real-action';
const URL='/assets/combat/vfx/real/action-test6-12x6.webp';
const CTX='__combat2144ctx';
const PERSIST='__combat2144persist';
const ROWS={fire:0,water:1,ice:2,earth:3,storm:4,steel:5} as const;
type E=keyof typeof ROWS;

function plain(v:unknown){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function element(v:unknown):E|null{const s=plain(v);if(s.includes('fire')||s.includes('lua'))return'fire';if(s.includes('water')||s.includes('nuoc'))return'water';if(s.includes('ice')||s.includes('bang'))return'ice';if(s.includes('earth')||s.includes('dat'))return'earth';if(s.includes('storm')||s.includes('bao')||s.includes('lightning')||s.includes('set')||s.includes('electric'))return'storm';if(s.includes('steel')||s.includes('thep'))return'steel';return null;}
function status(v:unknown):E|null{const s=plain(v);if(s.includes('burn')||s.includes('thieu dot'))return'fire';if(s.includes('freeze')||s.includes('dong bang')||s.includes('frost'))return'ice';if(s.includes('stun')||s.includes('choang')||s.includes('paralysis')||s.includes('te liet'))return'storm';if(s.includes('shield')||s.includes('khien')||s.includes('barrier')||s.includes('guard'))return'steel';if(s.includes('heal')||s.includes('hoi mau')||s.includes('hoi phuc')||s.includes('regeneration')||s.includes('revive'))return'water';return null;}
function own(v:any):E|null{return element(`${v?.pow?.elementKey||''} ${v?.pow?.element||''}`);}
function abilityStatus(a?:CombatAbility):E|null{return a?status(`${a.name||''} ${a.type||''} ${a.status||''} ${a.description||''}`):null;}
function key(e:E,p:'cast'|'travel'|'impact'|'loop'){return `combat2144-${e}-${p}`;}
function ensure(scene:Phaser.Scene){if(!scene.textures.exists(SHEET))return 0;let count=0;for(const e of Object.keys(ROWS) as E[]){const base=ROWS[e]*12;const defs:[string,number,number,number,number][]=[['cast',0,4,8,0],['travel',2,7,14,-1],['impact',4,11,9,0],['loop',0,11,7,-1]];for(const [p,a,b,fps,repeat] of defs){const k=key(e,p as 'cast'|'travel'|'impact'|'loop');if(!scene.anims.exists(k))scene.anims.create({key:k,frames:scene.anims.generateFrameNumbers(SHEET,{start:base+a,end:base+b}),frameRate:fps,repeat,skipMissedFrames:true});if(scene.anims.exists(k))count++;}}return count;}
function position(v:any){try{return v.getWorldPosition() as Phaser.Math.Vector2;}catch{return new Phaser.Math.Vector2(v?.container?.x||0,v?.container?.y||0);}}
function sprite(scene:Phaser.Scene,x:number,y:number,size:number,depth=60,alpha=.95){if(!scene.textures.exists(SHEET))return null;return scene.add.sprite(x,y,SHEET,0).setDepth(depth).setDisplaySize(size,size).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha);}
function once(scene:Phaser.Scene,fx:Phaser.GameObjects.Sprite,k:string){return new Promise<void>(resolve=>{let done=false;const end=()=>{if(done)return;done=true;if(fx.scene)fx.destroy();resolve();};fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE,end);scene.events.once(Phaser.Scenes.Events.SHUTDOWN,end);fx.play(k);});}
async function burst(scene:Phaser.Scene,e:E,phase:'cast'|'impact',x:number,y:number,strong=false){ensure(scene);const k=key(e,phase);if(!scene.anims.exists(k))return false;const fx=sprite(scene,x,y,phase==='impact'?(strong?390:325):(strong?290:235),strong?88:64,phase==='impact'?.98:.9);if(!fx)return false;await once(scene,fx,k);return true;}
async function travel(scene:Phaser.Scene,e:E,from:Phaser.Math.Vector2,x:number,y:number){ensure(scene);const k=key(e,'travel');if(!scene.anims.exists(k))return false;const fx=sprite(scene,from.x,from.y-5,180,66,.98);if(!fx)return false;fx.setRotation(Math.atan2(y-from.y,x-from.x)).play(k);await new Promise<void>(r=>scene.tweens.add({targets:fx,x,y:y-5,duration:600,ease:'Sine.easeInOut',onComplete:()=>r()}));fx.destroy();await burst(scene,e,'impact',x,y-5);return true;}
function persistentKind(unit:any):E|null{if(unit?.controlActionsRemaining>0&&unit?.controlStatus==='freeze')return'ice';if(unit?.controlActionsRemaining>0||unit?.paralysisActionsRemaining>0)return'storm';if(unit?.burnActionsRemaining>0)return'fire';if(Number(unit?.shield||0)>0)return'steel';if(unit?.regenerationActionsRemaining>0)return'water';return null;}

export function installCombat2144RealSpriteTestPatch(BattleSceneClass:any,PowViewClass:any):void{
 const root=globalThis as any;if(root[FLAG])return;root[FLAG]=true;
 const bp=BattleSceneClass.prototype as any;
 const preload=bp.preload;bp.preload=function(this:Phaser.Scene,...a:any[]){preload?.apply(this,a);if(!this.textures.exists(SHEET))this.load.spritesheet(SHEET,URL,{frameWidth:16,frameHeight:16,endFrame:71});};
 const create=bp.create;bp.create=function(this:any,...a:any[]){const r=create?.apply(this,a);const anims=ensure(this);if(root.POWDER_COMBAT2_BALANCED_VFX_TEST_ROSTER){for(const u of this.combatState?.units||[])u.ragePoints=4;this.refreshViews?.();}this.add.text(this.scale.width-18,this.scale.height-18,`${VERSION} · REAL SPRITE · 6E+5S · ${anims} ANIMS · 4 NỘ`,{fontFamily:COMBAT_DISPLAY_FONT,fontSize:'12px',color:anims>=24?'#aef7d3':'#ffb38c',fontStyle:'bold',backgroundColor:'#041018dd',padding:{x:7,y:4}}).setOrigin(1,1).setDepth(150);return r;};
 const ability=bp.performAbility;if(ability)bp.performAbility=async function(this:any,actor:any,target:any,slot:any){const prev=this[CTX];const ab=slot==='ultimate'?actor.pow.abilities.ultimate:actor.pow.abilities.skills[slot];this[CTX]={ability:ab,element:actor.pow.elementKey||actor.pow.element};try{return await ability.call(this,actor,target,slot);}finally{if(prev===undefined)delete this[CTX];else this[CTX]=prev;}};

 const pp=PowViewClass.prototype as any;
 const oldCast=pp.playCastSignature;pp.playCastSignature=async function(this:any,support:boolean){const scene=this.scene as Phaser.Scene;ensure(scene);const ctx=(scene as any)[CTX];const e=(support?abilityStatus(ctx?.ability):null)||own(this);const p=position(this);if(e&&await burst(scene,e,'cast',p.x,p.y-6,support))return;return oldCast?.call(this,support);};
 const oldTravel=pp.playElementTravel;pp.playElementTravel=async function(this:any,x:number,y:number){const scene=this.scene as Phaser.Scene;const e=own(this);if(e&&await travel(scene,e,position(this),x,y))return;return oldTravel?.call(this,x,y);};
 const oldImpact=pp.playElementImpact;pp.playElementImpact=async function(this:any,x:number,y:number){const scene=this.scene as Phaser.Scene;const e=own(this);if(e&&await burst(scene,e,'impact',x,y))return;return oldImpact?.call(this,x,y);};
 const oldSupport=pp.playSupportAura;pp.playSupportAura=async function(this:any){const scene=this.scene as Phaser.Scene;const e=abilityStatus((scene as any)[CTX]?.ability)||status(this.runtimeVisualStatus)||own(this);const p=position(this);if(e&&await burst(scene,e,'impact',p.x,p.y-4,true))return;return oldSupport?.call(this);};
 const oldControl=pp.playControlLock;pp.playControlLock=async function(this:any,label:string){const scene=this.scene as Phaser.Scene;const e=status(label);const p=position(this);if(e&&await burst(scene,e,'impact',p.x,p.y-4,true)){const sx=this.container.x;await new Promise<void>(r=>scene.tweens.add({targets:this.container,x:sx+8,duration:80,yoyo:true,repeat:2,onComplete:()=>r()}));this.container.setX(sx);return;}return oldControl?.call(this,label);};
 const oldUpdate=pp.updateRuntime;pp.updateRuntime=function(this:any,unit:any){oldUpdate?.call(this,unit);ensure(this.scene);const kind=persistentKind(unit);let fx=this[PERSIST] as Phaser.GameObjects.Sprite|undefined;if(!kind||!unit?.alive||unit.fieldSlot===null){fx?.destroy();this[PERSIST]=null;return;}const wanted=key(kind,'loop');if(!fx?.scene||fx.getData('kind')!==kind){fx?.destroy();fx=sprite(this.scene,0,0,kind==='steel'?255:225,56,kind==='steel'?.58:.72)||undefined;if(!fx)return;fx.setData('kind',kind).play(wanted);this[PERSIST]=fx;}const p=position(this);fx.setPosition(p.x,p.y-5).setVisible(true);const ready=this.combat271UltimateReadyFx;if(ready?.scene&&!ready.getData?.('__2144keep')){ready.destroy(true);this.combat271UltimateReadyFx=undefined;}};
 root.POWDER_COMBAT2_RUNTIME_VERSION=VERSION;root.POWDER_COMBAT2_REAL_SPRITE_VFX={version:VERSION,frameBased:true,sheet:SHEET,elements:Object.keys(ROWS),statuses:['burn','freeze','stun','heal','shield'],testRage:4};
}
