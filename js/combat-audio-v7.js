(function(){
  'use strict';

  const STORAGE_KEY='powder_combat_audio_v1';
  const DEFAULTS={sfx:.76,music:.46,domainVoice:.22,muted:false,musicEnabled:true,domainVoiceEnabled:true,domainVoiceProfile:'auto',mixVersion:4};
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
  const now=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();

  function loadSettings(){
    try{
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||{};
      const oldMix=Number(raw.mixVersion)||0;
      let music=clamp(raw.music??DEFAULTS.music),domainVoice=clamp(raw.domainVoice??DEFAULTS.domainVoice);
      // 8.1.2 migration: prior builds could persist a nearly inaudible BGM mix and an overly hot Domain voice.
      if(oldMix<3){
        if(music<=.32)music=DEFAULTS.music;
        if(domainVoice>=.32)domainVoice=DEFAULTS.domainVoice;
      }
      return {...DEFAULTS,...raw,sfx:clamp(raw.sfx??DEFAULTS.sfx),music,domainVoice,muted:oldMix<4?false:Boolean(raw.muted),musicEnabled:oldMix<4?true:raw.musicEnabled!==false,domainVoiceEnabled:oldMix<4?true:raw.domainVoiceEnabled!==false,domainVoiceProfile:(()=>{const p=(raw.domainVoiceProfile==='calm'||raw.domainVoiceProfile==='system')?'auto':raw.domainVoiceProfile==='dark'?'sample1':raw.domainVoiceProfile;return ['auto','sample1','sample2','sample3','sample4','alternate'].includes(p)?p:'auto';})(),mixVersion:4};
    }catch(_){return {...DEFAULTS};}
  }
  function saveSettings(s){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(s));}catch(_){}}

  class CombatAudioV7{
    constructor(){
      this.ctx=null;this.master=null;this.sfxGain=null;this.musicGain=null;this.compressor=null;
      this.settings=loadSettings();this.musicTimer=null;this.musicNodes=new Set();this.unlocked=false;
      this.noiseBuffer=null;this.activeNodes=new Set();this.performanceTier='high';this.maxPolyphony=56;
      this.stats={playCalls:0,eventCalls:0,telegraphs:0,releases:0,lastEvent:null,lastPlay:null,noiseCalls:0,noiseBufferBuilds:0,skippedPolyphony:0,peakNodes:0,tierChanges:0};
      this.lastByKey=new Map();this.musicStep=0;this.domainVoiceFlip=0;this.domainMedia=null;this.domainVoiceMedia=null;this.domainVoiceRuntime=new Set();this.domainDuckTimer=null;this.battleMusicMedia=null;this.battleMusicStandalone=null;this.battleMusicLastError='';this.musicRequested=false;this.musicDuckFactor=1;this.canonicalBgmPresent=false;
    }
    globalEnabled(){
      try{return window.POWDER_APP?.getSave?.()?.settings?.sound!==false;}catch(_){return true;}
    }
    vibrationEnabled(){
      try{return window.POWDER_APP?.getSave?.()?.settings?.vibration!==false;}catch(_){return false;}
    }
    effectiveEnabled(){return this.globalEnabled()&&!this.settings.muted;}
    setPerformanceTier(tier='high'){const t=['high','medium','low'].includes(String(tier))?String(tier):'high';if(this.performanceTier!==t)this.stats.tierChanges++;this.performanceTier=t;this.maxPolyphony=t==='low'?28:t==='medium'?40:56;return this.performanceTier;}
    performanceSnapshot(){return {tier:this.performanceTier,maxPolyphony:this.maxPolyphony,activeNodes:this.activeNodes.size,peakNodes:this.stats.peakNodes,skippedPolyphony:this.stats.skippedPolyphony,noiseBufferBuilds:this.stats.noiseBufferBuilds,tierChanges:this.stats.tierChanges};}
    getSettings(){return {...this.settings,globalSound:this.globalEnabled(),contextState:this.ctx?.state||'closed',canonicalBgmPresent:Boolean(this.getBattleMusicMedia()),battleMusicError:this.battleMusicLastError,performanceTier:this.performanceTier,maxPolyphony:this.maxPolyphony};}
    setVolume(kind,value){
      if(!['sfx','music','domainVoice'].includes(kind))return;
      this.settings[kind]=clamp(value);saveSettings(this.settings);this.applyMix();if(kind==='domainVoice')this.applyDomainVoiceMix();
    }
    setMusicEnabled(on){this.settings.musicEnabled=Boolean(on);saveSettings(this.settings);if(on)this.startMusic();else this.stopMusic();this.applyMix();}
    setDomainVoiceEnabled(on){this.settings.domainVoiceEnabled=Boolean(on);saveSettings(this.settings);if(!this.settings.domainVoiceEnabled)this.stopDomainVoice();else this.applyDomainVoiceMix();return this.settings.domainVoiceEnabled;}
    setDomainVoiceProfile(profile='auto'){const legacy=(profile==='calm'||profile==='system')?'auto':profile==='dark'?'sample1':profile;const p=['auto','sample1','sample2','sample3','sample4','alternate'].includes(legacy)?legacy:'auto';this.settings.domainVoiceProfile=p;saveSettings(this.settings);return p;}
    toggleMute(){this.settings.muted=!this.settings.muted;saveSettings(this.settings);this.applyMix();return this.settings.muted;}
    resetSettings(){this.settings={...DEFAULTS};saveSettings(this.settings);this.applyMix();if(this.settings.musicEnabled)this.startMusic();return this.getSettings();}
    async unlock(){
      try{
        if(!this.ctx){
          const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
          this.ctx=new AC();
          this.master=this.ctx.createGain();this.sfxGain=this.ctx.createGain();this.musicGain=this.ctx.createGain();
          this.compressor=this.ctx.createDynamicsCompressor();
          this.compressor.threshold.value=-18;this.compressor.knee.value=16;this.compressor.ratio.value=4;this.compressor.attack.value=.006;this.compressor.release.value=.16;
          this.sfxGain.connect(this.master);this.musicGain.connect(this.master);this.master.connect(this.compressor).connect(this.ctx.destination);this.buildNoiseBuffer();
        }
        if(this.ctx.state==='suspended')await this.ctx.resume().catch(()=>{});
        this.unlocked=this.ctx.state==='running';this.applyMix();return this.unlocked;
      }catch(_){return false;}
    }
    applyMix(){
      if(!this.ctx||!this.master)return;
      const t=this.ctx.currentTime;const enabled=this.effectiveEnabled();
      this.master.gain.cancelScheduledValues(t);this.master.gain.setTargetAtTime(enabled?1:0,t,.025);
      this.sfxGain.gain.cancelScheduledValues(t);this.sfxGain.gain.setTargetAtTime(this.settings.sfx,t,.025);
      this.musicGain.gain.cancelScheduledValues(t);this.musicGain.gain.setTargetAtTime(this.settings.musicEnabled?this.settings.music:0,t,.06);
      this.applyBattleMusicMix(this.musicDuckFactor||1);this.applyDomainVoiceMix();
    }
    applyBattleMusicMix(factor=1){
      const a=this.getBattleMusicMedia();if(!a)return;
      const enabled=this.effectiveEnabled()&&this.settings.musicEnabled;
      a.volume=enabled?clamp((Number(this.settings.music)||0)*.96*clamp(factor)):0;
    }
    domainVoiceOutput(){
      // User-provided clips are mastered hot. Keep the slider useful while capping the actual playback ceiling.
      return clamp(this.settings.domainVoice)*.62;
    }
    trackDomainVoiceMedia(a){
      if(!a)return null;
      this.domainVoiceMedia=a;this.domainVoiceRuntime.add(a);
      const cleanup=()=>{this.domainVoiceRuntime.delete(a);if(this.domainVoiceMedia===a)this.domainVoiceMedia=null;};
      try{a.addEventListener('ended',cleanup,{once:true});a.addEventListener('error',cleanup,{once:true});}catch(_){}
      this.applyDomainVoiceMix();return a;
    }
    applyDomainVoiceMix(){
      const v=this.effectiveEnabled()&&this.settings.domainVoiceEnabled!==false?this.domainVoiceOutput():0;
      const ids=['powder-domain-voice-deep','powder-domain-voice-sample-1','powder-domain-voice-sample-2','powder-domain-voice-sample-3','powder-domain-voice-sample-4'];
      for(const id of ids){const a=this.mediaElement(id);if(a)try{a.volume=v;}catch(_){}}
      for(const a of [...this.domainVoiceRuntime]){try{a.volume=v;}catch(_){this.domainVoiceRuntime.delete(a);}}
      if(this.domainVoiceMedia)try{this.domainVoiceMedia.volume=v;}catch(_){}
      return v;
    }
    stopDomainVoice(){
      try{window.speechSynthesis?.cancel?.();}catch(_){}
      for(const a of [...this.domainVoiceRuntime]){try{a.pause();a.currentTime=0;}catch(_){}this.domainVoiceRuntime.delete(a);}
      if(this.domainVoiceMedia){try{this.domainVoiceMedia.pause();this.domainVoiceMedia.currentTime=0;}catch(_){}this.domainVoiceMedia=null;}
    }
    getBattleMusicMedia(){
      // 8.2.1: legacy Heroic/procedural BGM was removed by user request.
      // Only the user's canonical long-form BGM may occupy this slot.
      if(this.battleMusicMedia)return this.battleMusicMedia;
      const a=this.mediaElement('powder-battle-music-user');
      if(a){a.loop=true;a.preload='auto';this.battleMusicMedia=a;this.canonicalBgmPresent=true;return a;}
      this.canonicalBgmPresent=false;
      this.battleMusicLastError='canonical-user-bgm-missing';
      return null;
    }

    buildNoiseBuffer(){
      if(!this.ctx||this.noiseBuffer)return;
      const sr=this.ctx.sampleRate,len=Math.max(1,Math.floor(sr*2.5)),buf=this.ctx.createBuffer(1,len,sr),data=buf.getChannelData(0);
      let last=0;
      for(let i=0;i<len;i++){
        const white=Math.random()*2-1;
        last=last*.72+white*.28;
        data[i]=white*.72+last*.28;
      }
      this.noiseBuffer=buf;this.stats.noiseBufferBuilds++;
    }
    registerNode(node){
      if(!node)return true;
      if(this.activeNodes.size>=this.maxPolyphony){this.stats.skippedPolyphony++;return false;}
      this.activeNodes.add(node);this.stats.peakNodes=Math.max(this.stats.peakNodes,this.activeNodes.size);
      const old=node.onended;
      node.onended=()=>{this.activeNodes.delete(node);if(typeof old==='function')try{old();}catch(_){}};
      return true;
    }
    dedup(key,ms=50){
      const t=now(),last=this.lastByKey.get(key)||0;if(t-last<ms)return false;this.lastByKey.set(key,t);
      if(this.lastByKey.size>80)for(const [k,v] of this.lastByKey)if(t-v>4000)this.lastByKey.delete(k);
      return true;
    }
    async ensure(){if(!this.ctx)await this.unlock();if(this.ctx?.state==='suspended')await this.ctx.resume().catch(()=>{});this.applyMix();return Boolean(this.ctx);}
    track(name){this.stats.playCalls++;this.stats.lastPlay=name;}
    vibrate(pattern){if(!this.vibrationEnabled()||!navigator?.vibrate)return;try{navigator.vibrate(pattern);}catch(_){}}

    tone({freq=440,to=null,type='sine',gain=.08,duration=.12,delay=0,attack=.005,release=.08,bus='sfx',detune=0}={}){
      if(!this.ctx||!this.effectiveEnabled())return;
      const t=this.ctx.currentTime+Math.max(0,delay),o=this.ctx.createOscillator();
      if(!this.registerNode(o))return;
      const g=this.ctx.createGain();
      o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),t);if(to)o.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+duration);o.detune.value=detune;
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+attack);g.gain.setValueAtTime(Math.max(.0002,gain),Math.max(t+attack,t+duration-release));g.gain.exponentialRampToValueAtTime(.0001,t+duration);
      o.connect(g).connect(bus==='music'?this.musicGain:this.sfxGain);o.start(t);o.stop(t+duration+.02);
      if(bus==='music')this.musicNodes.add(o);
    }
    noise({gain=.08,duration=.1,delay=0,filter=1200,q=.7,type='bandpass',bus='sfx'}={}){
      if(!this.ctx||!this.effectiveEnabled())return;
      this.buildNoiseBuffer();if(!this.noiseBuffer)return;this.stats.noiseCalls++;
      const src=this.ctx.createBufferSource();if(!this.registerNode(src))return;
      const f=this.ctx.createBiquadFilter(),g=this.ctx.createGain(),t=this.ctx.currentTime+Math.max(0,delay);
      src.buffer=this.noiseBuffer;f.type=type;f.frequency.value=Math.max(80,filter);f.Q.value=q;g.gain.setValueAtTime(Math.max(.0002,gain),t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
      src.connect(f).connect(g).connect(bus==='music'?this.musicGain:this.sfxGain);
      const maxOffset=Math.max(0,this.noiseBuffer.duration-duration-.01),offset=maxOffset?Math.random()*maxOffset:0;
      src.start(t,offset,Math.min(duration,this.noiseBuffer.duration-offset));src.stop(t+duration+.02);
      if(bus==='music')this.musicNodes.add(src);
    }
    chord(freqs=[110,165,220],gain=.015,duration=3.2,delay=0){freqs.forEach((f,i)=>this.tone({freq:f,type:i%2?'sine':'triangle',gain:gain/(1+i*.18),duration,delay:delay+i*.02,attack:.6,release:1.1,bus:'music'}));}

    elementBase(element){
      const e=String(element||'neutral').toLowerCase();
      const map={fire:196,lava:165,water:294,ice:392,leaf:262,earth:131,lightning:466,storm:349,wind:330,poison:220,steel:247,light:523,dark:147};
      return map[e]||280;
    }
    roleBase(role){
      const r=String(role||'').toLowerCase();
      return ({marksman:760,assassin:620,mage:430,tank:105,knight:230,healer:520,enchanter:360,fighter:160})[r]||300;
    }

    async ui(kind='click'){
      await this.ensure();if(!this.dedup(`ui:${kind}`,25))return;this.track(`ui:${kind}`);
      if(kind==='open'){this.tone({freq:520,to:690,type:'sine',gain:.025,duration:.08});return;}
      if(kind==='confirm'){this.tone({freq:620,type:'triangle',gain:.03,duration:.07});this.tone({freq:840,type:'sine',gain:.018,duration:.09,delay:.045});return;}
      this.tone({freq:430,type:'triangle',gain:.018,duration:.045});
    }

    async telegraph(unit,key,ability,profile={}){
      await this.ensure();this.stats.telegraphs++;if(!this.dedup(`tele:${unit?.id}:${key}`,120))return;
      const element=String(unit?.element||'neutral').toLowerCase(),role=String(profile.role||unit?.combatRole||'').toLowerCase(),ef=this.elementBase(element),rf=this.roleBase(role);
      this.track(`telegraph:${key}`);
      if(key==='ultimate'){
        this.tone({freq:55,to:92,type:'sine',gain:.12,duration:1.15,attack:.08,release:.35});
        this.tone({freq:ef*.5,to:ef*1.25,type:'sawtooth',gain:.045,duration:1.4,attack:.18,release:.45});
        this.noise({gain:.035,duration:.8,filter:900,type:'lowpass'});this.vibrate([24,32,42]);return;
      }
      if(key==='exclusive'){
        this.tone({freq:ef*.65,to:ef*1.1,type:'triangle',gain:.055,duration:.78,attack:.08,release:.24});
        this.tone({freq:rf,to:rf*1.2,type:'sine',gain:.025,duration:.5,delay:.1});return;
      }
      if(role==='marksman'){this.noise({gain:.024,duration:.08,filter:2400,type:'highpass'});this.tone({freq:rf,to:rf*1.08,type:'square',gain:.018,duration:.055});}
      else if(role==='assassin'){this.noise({gain:.03,duration:.16,filter:1600,type:'bandpass'});this.tone({freq:ef,to:ef*1.5,type:'triangle',gain:.024,duration:.18});}
      else if(role==='mage'||role==='enchanter'||role==='healer'){this.tone({freq:ef*.8,to:ef*1.18,type:'sine',gain:.035,duration:.42,attack:.08,release:.16});}
      else if(role==='tank'||role==='fighter'){this.tone({freq:rf,to:rf*.82,type:'sine',gain:.05,duration:.24});this.noise({gain:.024,duration:.12,filter:500,type:'lowpass'});}
      else this.tone({freq:ef*.75,to:ef,type:'triangle',gain:.03,duration:.22});
    }

    async release(unit,key,ability,profile={}){
      await this.ensure();this.stats.releases++;if(!this.dedup(`release:${unit?.id}:${key}`,120))return;
      const role=String(profile.role||unit?.combatRole||'').toLowerCase(),element=String(unit?.element||'neutral').toLowerCase(),ef=this.elementBase(element);
      this.track(`release:${key}`);
      if(key==='ultimate'){
        this.noise({gain:.09,duration:.22,filter:1350,type:'bandpass'});this.tone({freq:ef*1.1,to:ef*.58,type:'sawtooth',gain:.065,duration:.38});return;
      }
      if(role==='marksman'){this.noise({gain:.06,duration:.055,filter:3300,type:'highpass'});this.tone({freq:920,to:610,type:'square',gain:.025,duration:.07});}
      else if(role==='assassin'||role==='knight'){this.noise({gain:.06,duration:.16,filter:2100,type:'bandpass'});this.tone({freq:ef*1.3,to:ef*.8,type:'triangle',gain:.03,duration:.14});}
      else if(role==='mage'||role==='enchanter'){this.tone({freq:ef*1.25,to:ef*.78,type:'sine',gain:.05,duration:.2});this.noise({gain:.025,duration:.18,filter:2600,type:'highpass'});}
      else if(role==='healer'){this.tone({freq:ef,type:'sine',gain:.035,duration:.18});}
      else {this.tone({freq:120,to:78,type:'sine',gain:.055,duration:.14});this.noise({gain:.045,duration:.12,filter:720,type:'lowpass'});}
    }

    async impact({crit=false,absorbed=0,element='neutral',amount=0,strong=false}={}){
      await this.ensure();const e=String(element||'neutral').toLowerCase(),f=this.elementBase(e);this.track(crit?'impact:crit':'impact');
      const weight=strong?1.28:1;
      this.tone({freq:92,to:54,type:'sine',gain:.085*weight,duration:.16});
      this.noise({gain:.065*weight,duration:.11,filter:e==='steel'||e==='earth'?650:e==='lightning'?3100:1500,type:e==='lightning'?'highpass':'bandpass'});
      if(['fire','lava'].includes(e))this.noise({gain:.035,duration:.24,filter:950,type:'lowpass',delay:.03});
      if(['water','ice'].includes(e))this.tone({freq:f*1.35,to:f*.92,type:'sine',gain:.025,duration:.22,delay:.02});
      if(['lightning','storm'].includes(e)){this.tone({freq:f*1.6,to:f*.65,type:'square',gain:.028,duration:.075});this.noise({gain:.035,duration:.06,filter:4400,type:'highpass'});}
      if(['light','dark','poison'].includes(e))this.tone({freq:f,type:'triangle',gain:.026,duration:.26,delay:.02});
      if(absorbed>0)this.tone({freq:610,to:420,type:'triangle',gain:.032,duration:.13});
      if(crit){this.tone({freq:980,type:'triangle',gain:.045,duration:.12});this.tone({freq:1320,type:'sine',gain:.035,duration:.15,delay:.045});this.vibrate([18,16,32]);}
      else this.vibrate(amount>0?18:8);
    }

    async guard(){await this.ensure();this.track('guard');this.tone({freq:180,to:125,type:'triangle',gain:.075,duration:.18});this.noise({gain:.065,duration:.18,filter:1750,type:'bandpass'});this.tone({freq:720,to:510,type:'sine',gain:.025,duration:.22,delay:.02});this.vibrate([22,18,26]);}
    async shieldBreak(){await this.ensure();this.track('break');[920,1180,1540].forEach((f,i)=>this.tone({freq:f,to:f*.58,type:'triangle',gain:.033/(1+i*.15),duration:.16+i*.035,delay:i*.018}));this.noise({gain:.055,duration:.2,filter:3100,type:'highpass'});this.vibrate([30,18,35]);}
    async kill(){await this.ensure();this.track('kill');this.tone({freq:84,to:38,type:'sine',gain:.12,duration:.48,attack:.008,release:.24});this.noise({gain:.055,duration:.28,filter:520,type:'lowpass'});this.tone({freq:520,to:260,type:'triangle',gain:.025,duration:.36,delay:.04});this.vibrate([36,24,48]);}
    async heal(){await this.ensure();this.track('heal');[440,554,660].forEach((f,i)=>this.tone({freq:f,type:'sine',gain:.027,duration:.28,delay:i*.065,attack:.02,release:.14}));}
    async cleanse(){await this.ensure();this.track('cleanse');[740,930,1175].forEach((f,i)=>this.tone({freq:f,type:'sine',gain:.022,duration:.22,delay:i*.045}));}
    async status(kind,status=''){
      await this.ensure();this.track(`status:${kind}:${status}`);const s=String(status).toLowerCase();
      if(s.includes('burn')||s.includes('magma')){this.noise({gain:.025,duration:.18,filter:1500,type:'bandpass'});this.tone({freq:180,to:120,type:'triangle',gain:.018,duration:.18});}
      else if(s.includes('poison')||s.includes('curse')){this.tone({freq:150,to:105,type:'sine',gain:.028,duration:.28});}
      else if(s.includes('freeze')||s.includes('frost')){this.tone({freq:1120,to:640,type:'triangle',gain:.028,duration:.18});this.noise({gain:.018,duration:.1,filter:4200,type:'highpass'});}
      else if(s.includes('stun')||s.includes('paral')){this.tone({freq:780,to:1180,type:'square',gain:.018,duration:.075});this.tone({freq:1030,to:630,type:'square',gain:.016,duration:.07,delay:.08});}
      else if(kind==='heal')this.heal();
      else this.tone({freq:410,to:520,type:'sine',gain:.018,duration:.16});
    }

    mediaElement(id){
      try{return document.getElementById(id)||null;}catch(_){return null;}
    }
    playMediaElement(id,{volume=1,restart=true}={}){
      if(!this.effectiveEnabled())return false;
      try{
        const a=this.mediaElement(id);if(!a)return false;
        if(restart){try{a.pause();a.currentTime=0;}catch(_){}}
        a.volume=clamp(volume);const play=a.play?.();if(play?.catch)play.catch(()=>{});return true;
      }catch(_){return false;}
    }
    duckMusic(ms=2500,factor=.25){
      if(!this.settings.musicEnabled)return;
      try{
        this.musicDuckFactor=clamp(factor);
        if(this.ctx&&this.musicGain){
          const t=this.ctx.currentTime,target=clamp(this.settings.music)*this.musicDuckFactor;
          this.musicGain.gain.cancelScheduledValues(t);this.musicGain.gain.setTargetAtTime(target,t,.035);
        }
        this.applyBattleMusicMix(this.musicDuckFactor);
        if(this.domainDuckTimer)clearTimeout(this.domainDuckTimer);
        this.domainDuckTimer=setTimeout(()=>{this.domainDuckTimer=null;this.musicDuckFactor=1;this.applyMix();},Math.max(200,ms));
      }catch(_){}
    }
    domainEpicMediaId(kind='expansion'){
      const id=['frenzy','fortress','timeflow','vitality'].includes(String(kind))?String(kind):'expansion';
      return `powder-domain-epic-${id}`;
    }
    playDomainEpic(kind='expansion'){
      const id=this.domainEpicMediaId(kind);
      if(this.domainMedia&&this.domainMedia!==this.mediaElement(id)){try{this.domainMedia.pause();this.domainMedia.currentTime=0;}catch(_){}}
      const a=this.mediaElement(id);if(!a)return false;
      this.domainMedia=a;this.duckMusic(2600,.18);
      return this.playMediaElement(id,{volume:clamp((Number(this.settings.sfx)||.76)*.62),restart:true});
    }
    playDeepDomainVoice(){
      const id='powder-domain-voice-deep';
      const a=this.mediaElement(id);if(!a)return false;
      if(this.domainVoiceMedia&&this.domainVoiceMedia!==a){try{this.domainVoiceMedia.pause();this.domainVoiceMedia.currentTime=0;}catch(_){}}
      this.domainVoiceMedia=a;
      this.trackDomainVoiceMedia(a);return this.playMediaElement(id,{volume:this.domainVoiceOutput(),restart:true});
    }
    hasJapaneseMaleVoice(){return Boolean(this.pickJapaneseVoice('dark'));}
    playSampleDomainVoice(profile='sample1'){
      const n=Math.max(1,Math.min(4,Number(String(profile).replace('sample',''))||1));
      const id=`powder-domain-voice-sample-${n}`;
      const a=this.mediaElement(id);if(!a)return false;
      if(this.domainVoiceMedia&&this.domainVoiceMedia!==a){try{this.domainVoiceMedia.pause();this.domainVoiceMedia.currentTime=0;}catch(_){}}
      this.domainVoiceMedia=a;
      this.trackDomainVoiceMedia(a);return this.playMediaElement(id,{volume:this.domainVoiceOutput(),restart:true});
    }
    domainVoiceProfileFor(domainId='expansion'){
      let forced=this.settings.domainVoiceProfile||'auto';
      if(forced==='calm')forced='system';
      if(forced==='dark')forced='sample1';
      if(['sample1','sample2','sample3','sample4'].includes(forced))return forced;
      if(forced==='alternate'){
        this.domainVoiceFlip=(this.domainVoiceFlip+1)%4;
        return `sample${this.domainVoiceFlip+1}`;
      }
      const byDomain={frenzy:'sample1',fortress:'sample2',timeflow:'sample3',vitality:'sample4',expansion:'sample1'};
      return byDomain[String(domainId)]||'sample1';
    }
    domainJapaneseLine(domainId='expansion'){
      // Short command delivery is intentionally used for the bundled deep voice.
      return '領域……展開。';
    }
    pickJapaneseVoice(profile='calm'){
      try{
        const synth=window.speechSynthesis;if(!synth)return null;
        const ja=(synth.getVoices?.()||[]).filter(v=>String(v.lang||'').toLowerCase().startsWith('ja'));
        if(!ja.length)return null;
        const maleHint=/\b(male|man)\b|ichiro|otoya|takumi|daisuke|hiroshi|kenji|masaru|keita|naoki|shinji|akira|ryo|daichi/i;
        const femaleHint=/\b(female|woman)\b|nanami|haruka|kyoko|ayumi|sayaka|yuri|aoi|sakura|miku/i;
        if(profile==='dark'){
          const ranked=ja.map(v=>({v,score:(maleHint.test(v.name+' '+v.voiceURI)?8:0)-(femaleHint.test(v.name+' '+v.voiceURI)?12:0)+(v.localService?1:0)})).sort((a,b)=>b.score-a.score);
          return ranked[0]?.score>0?ranked[0].v:null;
        }
        return ja.find(v=>femaleHint.test(v.name+' '+v.voiceURI))||ja[0];
      }catch(_){return null;}
    }
    speakJapaneseDomain(domainId='expansion'){
      if(!this.effectiveEnabled()||this.settings.domainVoiceEnabled===false)return false;
      try{
        const profile=this.domainVoiceProfileFor(domainId);
        if(profile.startsWith('sample')&&this.playSampleDomainVoice(profile)){
          this.track(`domain-voice-usercut:${profile}:${domainId}`);return true;
        }
        const fallback=this.domainVoiceProfileFor('frenzy');
        if(fallback.startsWith('sample')&&this.playSampleDomainVoice(fallback)){
          this.track(`domain-voice-usercut-fallback:${fallback}:${domainId}`);return true;
        }
        return false;
      }catch(_){return false;}
    }
    async domain(kind='expansion'){
      await this.ensure();this.track(`domain:${kind}`);
      if(kind==='simple'){this.tone({freq:310,to:420,type:'triangle',gain:.028,duration:.22});return;}
      // 7.4.2: pre-rendered heroic orchestral stinger replaces the old harsh oscillator stack.
      if(this.playDomainEpic(kind)){
        this.vibrate([22,14,46]);return;
      }
      // Minimal soft fallback if media playback is unavailable.
      const roots={frenzy:73.42,fortress:65.41,timeflow:82.41,vitality:87.31,expansion:73.42};
      const r=roots[kind]||roots.expansion;
      this.tone({freq:r*.5,to:r*.42,type:'sine',gain:.10,duration:.65,attack:.008,release:.3});
      [r,r*1.5,r*2].forEach((f,i)=>this.tone({freq:f,type:'triangle',gain:.026/(1+i*.15),duration:.75,delay:.08+i*.025,attack:.05,release:.34}));
      this.noise({gain:.022,duration:.18,filter:620,type:'lowpass',delay:.08});
      this.vibrate([22,14,46]);
    }
    async bossIntro(unit,type='daily'){
      await this.ensure();this.track(`boss-intro:${type}`);
      const weekly=type==='weekly', promotion=type==='promotion';
      this.tone({freq:weekly?38:promotion?44:52,to:weekly?31:36,type:'sawtooth',gain:weekly?.11:.085,duration:weekly?1.45:1.05,attack:.06,release:.42});
      this.noise({gain:weekly?.05:.035,duration:weekly?.95:.7,filter:weekly?520:680,type:'lowpass'});
      [98,147,196].forEach((f,i)=>this.tone({freq:f,type:'triangle',gain:.014,duration:.65,delay:.22+i*.11,attack:.05,release:.3}));
      this.vibrate?.(weekly?[45,35,60]:[30,24,40]);
    }
    async bossThreat(unit,key='skill1',ability=null){
      await this.ensure();this.track(`boss-threat:${key}`);
      const strong=key==='ultimate'||key==='exclusive';
      this.tone({freq:strong?78:112,to:strong?54:84,type:'square',gain:strong?.047:.03,duration:strong?.42:.26,attack:.01,release:.14});
      this.tone({freq:strong?260:330,to:strong?190:260,type:'triangle',gain:.016,duration:strong?.34:.22,delay:.07});
      if(strong)this.noise({gain:.022,duration:.22,filter:900,type:'bandpass'});
    }

    async battleResult(result){
      await this.ensure();this.track(`battle:${result}`);
      if(result==='win'){
        [392,523,659,784].forEach((f,i)=>this.tone({freq:f,type:'triangle',gain:.04,duration:.38,delay:i*.12,attack:.02,release:.18}));
      }else [330,247,196,147].forEach((f,i)=>this.tone({freq:f,type:'sine',gain:.035,duration:.42,delay:i*.12,attack:.02,release:.2}));
      setTimeout(()=>this.stopMusic(),1000);
    }

    async playEvent(evt,helpers={}){
      if(!evt)return;this.stats.eventCalls++;this.stats.lastEvent=evt.type;
      const ref=id=>helpers.unitRef?.(id)||null;
      if(evt.type==='battle-start'){await this.ensure();this.track('battle-start');this.tone({freq:220,to:330,type:'triangle',gain:.03,duration:.32});this.startMusic();return;}
      if(evt.type==='guard')return this.guard();
      if(evt.type==='heal')return this.heal();
      if(evt.type==='cleanse')return this.cleanse();
      if(evt.type==='break')return this.shieldBreak();
      if(evt.type==='kill')return this.kill();
      if(evt.type==='damage'){
        const src=ref(evt.sourceId);const element=src?.unit?.element||'neutral';
        const impacts=evt.impacts||[];const crit=impacts.some(x=>x.crit);const absorbed=impacts.reduce((a,x)=>a+Number(x.absorbed||0),0);const amount=impacts.reduce((a,x)=>a+Number(x.damage||0),0);
        const key=src?.unit?.lastAction?.key||'';return this.impact({crit,absorbed,element,amount,strong:key==='ultimate'||key==='exclusive'});
      }
      if(evt.type==='status-apply')return this.status('apply',evt.status);
      if(evt.type==='status-expire')return this.status('expire',evt.status);
      if(evt.type==='status-tick'){
        const e=evt.event||{};if(e.kind==='heal')return this.status('heal',e.status);return this.status('tick',e.status);
      }
      if(evt.type==='tamer-simple')return this.domain('simple');
      if(evt.type==='tamer-expansion'){this.speakJapaneseDomain(evt.id||'expansion');return this.domain(evt.id||'expansion');}
      if(evt.type==='tamer-domain-end'){await this.ensure();this.tone({freq:410,to:130,type:'sine',gain:.03,duration:.55});return;}
      if(evt.type==='replacement'){await this.ensure();this.track('replacement');this.tone({freq:290,to:520,type:'triangle',gain:.027,duration:.25});return;}
      if(evt.type==='boss-phase'){await this.ensure();this.track('boss-phase');this.tone({freq:70,to:45,type:'sawtooth',gain:.075,duration:.55});this.noise({gain:.04,duration:.3,filter:700,type:'lowpass'});return;}
      if(evt.type==='battle-end')return this.battleResult(evt.result);
    }

    startFallbackMusic(){
      // Deliberately disabled: never substitute Heroic/procedural music for the user's canonical BGM.
      this.battleMusicLastError='canonical-user-bgm-missing';
      return false;
    }

    startMusic(){
      this.musicRequested=true;
      if(!this.settings.musicEnabled||!this.effectiveEnabled())return false;
      const a=this.getBattleMusicMedia();
      if(!a){this.battleMusicLastError='canonical-user-bgm-missing';return false;}
      let attempted=false;
      try{
        a.loop=true;a.muted=false;this.applyBattleMusicMix(this.musicDuckFactor||1);
        if(a.readyState===0&&a.load)a.load();
        if(a.paused||a.ended){
          const p=a.play?.();attempted=true;
          if(p?.then)p.then(()=>{this.battleMusicLastError='';}).catch(err=>{this.battleMusicLastError=String(err?.name||err||'play-blocked');});
        }else attempted=true;
      }catch(err){this.battleMusicLastError=String(err?.name||err||'play-error');}
      this.ensure().then(()=>{
        this.applyBattleMusicMix(this.musicDuckFactor||1);
        const m=this.getBattleMusicMedia();
        if(m&&(m.paused||m.ended)){try{m.play?.().catch?.(err=>{this.battleMusicLastError=String(err?.name||err||'retry-blocked');});}catch(err){this.battleMusicLastError=String(err?.name||err||'retry-error');}}
      }).catch(()=>{});
      return attempted;
    }

    ensureMusicRunning(){
      if(!this.settings.musicEnabled||!this.effectiveEnabled())return false;
      this.musicRequested=true;const a=this.getBattleMusicMedia();
      if(a&&!a.paused&&!a.ended)return true;
      return this.startMusic();
    }

    stopMusic(){
      this.musicRequested=false;
      if(this.musicTimer){clearInterval(this.musicTimer);this.musicTimer=null;}
      for(const n of this.musicNodes){try{n.stop();}catch(_){}this.activeNodes.delete(n);}this.musicNodes.clear();
      const a=this.getBattleMusicMedia();if(a){try{a.pause();a.currentTime=0;}catch(_){}}
      this.musicDuckFactor=1;
    }
    debugSnapshot(){const a=this.getBattleMusicMedia();return {...this.stats,settings:this.getSettings(),musicRequested:this.musicRequested,musicRunning:Boolean(this.musicTimer||(a&&!a.paused&&!a.ended)),musicPaused:a?Boolean(a.paused):null,musicCurrentTime:a?Number(a.currentTime||0):0,musicReadyState:a?Number(a.readyState||0):0,musicError:this.battleMusicLastError,musicMode:a?'user-canonical':'missing-user-canonical',canonicalBgmPresent:Boolean(a),domainVoiceActual:this.domainVoiceOutput(),hasContext:Boolean(this.ctx)};}

  }

  function bindGlobalAudioSettings(audio){
    const bind=()=>{
      const music=document.getElementById('combatMusicVolume');
      const voice=document.getElementById('domainVoiceVolume');
      const musicOut=document.getElementById('combatMusicVolumeValue');
      const voiceOut=document.getElementById('domainVoiceVolumeValue');
      const musicToggle=document.getElementById('combatMusicToggle');
      const voiceToggle=document.getElementById('domainVoiceToggle');
      const musicTest=document.getElementById('combatMusicTestBtn');
      const voiceTest=document.getElementById('domainVoiceTestBtn');
      const sync=()=>{const s=audio.getSettings();if(music){music.value=Math.round(s.music*100);if(musicOut)musicOut.textContent=`${Math.round(s.music*100)}%`;}if(voice){voice.value=Math.round(s.domainVoice*100);if(voiceOut)voiceOut.textContent=`${Math.round(s.domainVoice*100)}%`;}if(musicToggle)musicToggle.checked=s.musicEnabled!==false;if(voiceToggle)voiceToggle.checked=s.domainVoiceEnabled!==false;};
      if(music&&!music.dataset.bound){music.dataset.bound='1';music.addEventListener('input',()=>{audio.setVolume('music',Number(music.value)/100);if(musicOut)musicOut.textContent=`${music.value}%`;});}
      if(voice&&!voice.dataset.bound){voice.dataset.bound='1';voice.addEventListener('input',()=>{audio.setVolume('domainVoice',Number(voice.value)/100);if(voiceOut)voiceOut.textContent=`${voice.value}%`;});}
      if(musicToggle&&!musicToggle.dataset.bound){musicToggle.dataset.bound='1';musicToggle.addEventListener('change',()=>audio.setMusicEnabled(musicToggle.checked));}
      if(voiceToggle&&!voiceToggle.dataset.bound){voiceToggle.dataset.bound='1';voiceToggle.addEventListener('change',()=>audio.setDomainVoiceEnabled(voiceToggle.checked));}
      if(musicTest&&!musicTest.dataset.bound){musicTest.dataset.bound='1';musicTest.addEventListener('click',async()=>{await audio.unlock();audio.setMusicEnabled(true);audio.startMusic();if(musicToggle)musicToggle.checked=true;});}
      if(voiceTest&&!voiceTest.dataset.bound){voiceTest.dataset.bound='1';voiceTest.addEventListener('click',async()=>{await audio.unlock();audio.setDomainVoiceEnabled(true);audio.speakJapaneseDomain('frenzy');if(voiceToggle)voiceToggle.checked=true;});}
      const sound=document.getElementById('soundToggle');if(sound&&!sound.dataset.combatAudioBound){sound.dataset.combatAudioBound='1';sound.addEventListener('change',()=>setTimeout(()=>{audio.applyMix();if(sound.checked&&audio.settings.musicEnabled&&audio.musicRequested)audio.ensureMusicRunning();},0));}
      try{
        const repairKey='powder_audio_repair_v924';
        if(localStorage.getItem(repairKey)!=='1'){
          audio.settings.muted=false;audio.settings.musicEnabled=true;audio.settings.domainVoiceEnabled=true;
          if(audio.settings.sfx<=.05)audio.settings.sfx=DEFAULTS.sfx;
          if(audio.settings.music<=.05)audio.settings.music=DEFAULTS.music;
          if(audio.settings.domainVoice<=.05)audio.settings.domainVoice=DEFAULTS.domainVoice;
          saveSettings(audio.settings);
          if(sound&&!sound.checked){sound.checked=true;sound.dispatchEvent(new Event('change',{bubbles:true}));}
          localStorage.setItem(repairKey,'1');
        }
      }catch(_){}
      sync();
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  }

  window.POWDER_COMBAT_AUDIO=new CombatAudioV7();
  bindGlobalAudioSettings(window.POWDER_COMBAT_AUDIO);
  const unlockCombatAudioOnce=()=>{window.POWDER_COMBAT_AUDIO?.unlock?.().catch?.(()=>{});};
  try{document.addEventListener('pointerdown',unlockCombatAudioOnce,{once:true,capture:true});document.addEventListener('keydown',unlockCombatAudioOnce,{once:true,capture:true});}catch(_){}
})();
