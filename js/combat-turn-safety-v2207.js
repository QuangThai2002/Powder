(()=>{'use strict';
if(window.POWDER_COMBAT_TURN_SAFETY_V2207)return;
const VERSION='22.0.7';
const state={installed:false,effectiveRepairs:0,meterRepairs:0,schedulerRepairs:0,identityBootstraps:0,lastAt:0,lastReason:'boot'};
const Core=window.POWDER_COMBAT_CORE_V7,P=Core?.BattleCore?.prototype;
const finite=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;
function fallbackSpeed(unit){const raw=finite(unit?.stats?.speed,finite(unit?.baseStats?.speed,1));return Math.max(1,raw)}
function install(){
  if(!P||P.__powderTurnSafety2207)return false;
  const oldEffective=P.effective,oldNext=P.nextReadyUnit;
  if(typeof oldEffective!=='function'||typeof oldNext!=='function')return false;
  Object.defineProperty(P,'__powderTurnSafety2207',{value:true,configurable:true});
  P.effective=function(unit){
    const stats=oldEffective.call(this,unit)||{};
    if(Number.isFinite(Number(stats.speed))&&Number(stats.speed)>0)return stats;
    state.effectiveRepairs++;state.lastAt=Date.now();state.lastReason='invalid-effective-speed';
    return {...stats,speed:fallbackSpeed(unit)};
  };
  P.nextReadyUnit=function(){
    const alive=[...this.living('player'),...this.living('enemy')];
    if(!alive.length)return null;
    for(const u of alive){
      const meter=Number(u?.meter);
      if(!Number.isFinite(meter)){u.meter=0;state.meterRepairs++;state.lastAt=Date.now();state.lastReason='invalid-meter';}
      else if(meter<0||meter>100)u.meter=Math.max(0,Math.min(100,meter));
    }
    const ready=alive.filter(u=>Number(u.meter)>=100).sort((a,b)=>{
      const md=(Number(b?.meter)||0)-(Number(a?.meter)||0);if(Math.abs(md)>1e-9)return md;
      const sd=(finite(this.effective(b)?.speed,1))-(finite(this.effective(a)?.speed,1));if(Math.abs(sd)>1e-9)return sd;
      return String(a?.id||'').localeCompare(String(b?.id||''));
    });
    if(ready.length)return ready[0];
    let time=Infinity;
    for(const u of alive){
      const speed=Math.max(1,finite(this.effective(u)?.speed,fallbackSpeed(u)));
      const remaining=Math.max(0,100-finite(u.meter,0));
      const dt=remaining/speed;
      if(Number.isFinite(dt))time=Math.min(time,dt);
    }
    if(!Number.isFinite(time)){
      state.schedulerRepairs++;state.lastAt=Date.now();state.lastReason='invalid-turn-time';
      const pick=alive.slice().sort((a,b)=>finite(this.effective(b)?.speed,1)-finite(this.effective(a)?.speed,1)||String(a?.id||'').localeCompare(String(b?.id||'')))[0]||null;
      if(pick)pick.meter=100;
      return pick;
    }
    for(const u of alive){
      const speed=Math.max(1,finite(this.effective(u)?.speed,fallbackSpeed(u)));
      u.meter=Math.min(100,Math.max(0,finite(u.meter,0)+speed*time));
    }
    const next=alive.filter(u=>Number(u.meter)>=99.999).sort((a,b)=>{
      const md=(Number(b?.meter)||0)-(Number(a?.meter)||0);if(Math.abs(md)>1e-9)return md;
      const sd=finite(this.effective(b)?.speed,1)-finite(this.effective(a)?.speed,1);if(Math.abs(sd)>1e-9)return sd;
      return String(a?.id||'').localeCompare(String(b?.id||''));
    })[0]||null;
    if(!next){
      state.schedulerRepairs++;state.lastAt=Date.now();state.lastReason='no-next-after-advance';
      const pick=alive.slice().sort((a,b)=>finite(this.effective(b)?.speed,1)-finite(this.effective(a)?.speed,1))[0]||null;
      if(pick)pick.meter=100;
      return pick;
    }
    return next;
  };
  state.installed=true;state.lastAt=Date.now();state.lastReason='installed';return true;
}
function activateIdentity(){
  if(window.POWDER_COMBAT_IDENTITY_BREAKTHROUGH_V2210||document.getElementById('powderCombatIdentityBreakthrough2210'))return false;
  const s=document.createElement('script');s.id='powderCombatIdentityBreakthrough2210';s.src='js/combat-identity-breakthrough-v2210.js?v=2210';s.async=true;document.head.appendChild(s);state.identityBootstraps++;return true;
}
function snapshot(){return{version:VERSION,...state,identity:window.POWDER_COMBAT_IDENTITY_BREAKTHROUGH_V2210?.snapshot?.()||null,policy:'Finite SPEED and turn-meter hardening only; formulas, skill effects and timers are unchanged. 22.1.0 visual identity runtime is bootstrapped separately.'}}
window.POWDER_COMBAT_TURN_SAFETY_V2207={version:VERSION,install,activateIdentity,snapshot};
install();activateIdentity();
})();
