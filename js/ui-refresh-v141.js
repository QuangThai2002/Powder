(()=>{
  const getActiveViewKey=()=>{
    const visible=[...document.querySelectorAll('.view')].find(el=>!el.hasAttribute('hidden'));
    return (visible?.id||'homeView').replace(/View$/,'');
  };
  const syncActiveView=()=>{
    const key=getActiveViewKey();
    document.body.dataset.activeView=key;
    document.documentElement.dataset.activeView=key;
  };
  let scrollFrame=0,lastScrolled=null;
  const syncScrolled=()=>{
    scrollFrame=0;const next=window.scrollY>12;if(next===lastScrolled)return;lastScrolled=next;document.body.classList.toggle('ui141-scrolled',next);
  };
  const queueScrolled=()=>{if(scrollFrame)return;const dom=window.POWDER_DOM_RUNTIME_V1825;if(dom?.frame)return dom.frame('ui141-scroll',syncScrolled);scrollFrame=requestAnimationFrame(syncScrolled)};
  const boot=()=>{
    syncActiveView();
    syncScrolled();
    const views=document.querySelectorAll('.view');
    const observer=new MutationObserver(syncActiveView);
    views.forEach(view=>observer.observe(view,{attributes:true,attributeFilter:['hidden']}));
    document.addEventListener('click',evt=>{
      if(evt.target.closest('[data-view],[data-open-view],[data-world-view],[data-close]')){
        requestAnimationFrame(()=>setTimeout(syncActiveView,0));
      }
    },true);
    window.addEventListener('scroll',queueScrolled,{passive:true});
    window.addEventListener('resize',queueScrolled,{passive:true});
    setTimeout(syncActiveView,80);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
