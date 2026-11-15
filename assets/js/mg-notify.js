/* Notifications: built from live incident state (GET /api/safety/notifications).
   – bell in the top bar with an unread badge and a panel,
   – "Needs your action" list on the dashboard,
   – a toast when something new is waiting for you. Read-state is per browser (localStorage). */
(function(){
const MG=window.MG,esc=MG.esc,KEY='mg_seen';
const N=MG.notify={items:[],loaded:false,timer:null};
const seen=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
const saveSeen=m=>{try{localStorage.setItem(KEY,JSON.stringify(m))}catch{}};
const lv=l=>l==='HQ'?'HQ':'ASO';
N.text=i=>{const r=MG.state.user.role,mgr=r==='MINE_MANAGER',so=MG.can.isMineSO();
  switch(i.kind){
    case 'report_submitted':return mgr?'New incident reported — review required':'Your report was sent to the Mine Manager';
    case 'review_to_so':return mgr?'Sent to the Safety Officer for action':'Mine Manager sent remarks & recommendations — action required';
    case 'action_taken':return mgr?'Safety Officer took action — final review & closure':'Action submitted to the Mine Manager';
    case 'escalation_request':return mgr?'Safety Officer requests escalation to '+lv(i.level):'Escalation requested';
    case 'escalation':return so?'Mine Manager escalated this to '+lv(i.level):'Escalated to you — recommendation needed';
    case 'recommendation':return mgr?'Recommendation received — review and decide':'Recommendation sent to the Mine Manager';
    case 'closure':return 'Closed by the Mine Manager';
    default:return (MG.STAGE[i.stage]||{}).pending||'Update';}};
const href=i=>(MG.can.isMineSO()?'/my-reports/':'/incidents/')+i.incident_id;
const unseen=()=>{const s=seen();return N.items.filter(i=>s[i.incident_id]!==i.version)};
const need=()=>N.items.filter(i=>i.requires_action);
N.markSeen=ids=>{const s=seen();N.items.forEach(i=>{if(!ids||ids.includes(i.incident_id))s[i.incident_id]=i.version});saveSeen(s);N.paintBadge()};

N.fetch=async()=>{
  const first=!N.loaded;
  try{const d=await MG.api('/api/safety/notifications');const before=new Set(unseen().map(i=>i.incident_id+':'+i.version));N.items=d.items||[];N.loaded=true;
    const fresh=unseen().filter(i=>i.requires_action&&!before.has(i.incident_id+':'+i.version));
    if(fresh.length&&(first||document.visibilityState==='visible'))MG.toast(fresh.length===1?N.text(fresh[0])+' · '+(fresh[0].incident_ref||''):fresh.length+' incidents need your attention');
  }catch{/* notifications are best-effort; the rest of the portal is unaffected */}
  N.paintBadge();return N.items;
};
N.refresh=()=>N.fetch();
N.start=()=>{N.fetch();clearInterval(N.timer);N.timer=setInterval(()=>{if(document.visibilityState==='visible')N.fetch()},45000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')N.fetch()})};
N.paintBadge=()=>{const b=document.getElementById('bellN');if(!b)return;const n=need().length,u=unseen().length;b.textContent=n>99?'99+':String(n);b.classList.toggle('on',n>0);b.classList.toggle('new',u>0);
  const bt=document.getElementById('bell');if(bt)bt.setAttribute('aria-label',n?n+' incident'+(n>1?'s':'')+' need your action':'Notifications')};

const row=(i,s)=>{const sev=MG.sevMeta(i.severity);
  return '<button type="button" class="nt-row'+(i.requires_action?' act':'')+'" data-id="'+esc(i.incident_id)+'" style="--c:'+sev.color+'"><span class="nt-dot'+(s[i.incident_id]!==i.version?' new':'')+'"></span><span class="nt-main"><b>'+esc(i.incident_type||'Incident')+' <small>'+esc(i.incident_ref||'')+'</small></b><span>'+esc(N.text(i))+'</span><small>'+esc(MG.relTime(i.at))+(i.note?' · “'+esc(String(i.note).slice(0,80))+(String(i.note).length>80?'…':'')+'”':'')+'</small></span>'+(i.requires_action?'<span class="nt-tag">Action</span>':'')+'</button>'};
const bind=(el,close)=>el.querySelectorAll('.nt-row').forEach(b=>b.onclick=()=>{const it=N.items.find(x=>x.incident_id===b.dataset.id);if(it)N.markSeen([it.incident_id]);if(close)close();MG.go(href(it))});

N.mountBell=host=>{
  host.insertAdjacentHTML('afterbegin','<div class="bell-wrap"><button class="btn btn-secondary btn-icon" id="bell" aria-label="Notifications" aria-haspopup="true" aria-expanded="false" title="Notifications">'+MG.icon('bell')+'<span class="bell-n" id="bellN">0</span></button><div class="bell-panel hidden" id="bellPanel" role="dialog" aria-label="Notifications"></div></div>');
  const btn=host.querySelector('#bell'),pan=host.querySelector('#bellPanel');
  const close=()=>{pan.classList.add('hidden');btn.setAttribute('aria-expanded','false');document.removeEventListener('click',out,true)};
  const out=e=>{if(!pan.contains(e.target)&&!btn.contains(e.target))close()};
  const draw=()=>{const s=seen(),items=N.items;
    pan.innerHTML='<div class="bp-h"><b>Notifications</b>'+(unseen().length?'<button type="button" class="btn btn-ghost btn-sm" id="bpAll">Mark all read</button>':'')+'</div>'
      +(items.length?'<div class="bp-list">'+items.map(i=>row(i,s)).join('')+'</div>':'<div class="bp-empty">'+MG.icon('check')+'<p>You\'re all caught up.</p><small>New incidents and requests will appear here.</small></div>');
    bind(pan,close);const all=pan.querySelector('#bpAll');if(all)all.onclick=()=>{N.markSeen();draw()}};
  btn.onclick=async()=>{if(!pan.classList.contains('hidden')){close();return}draw();pan.classList.remove('hidden');btn.setAttribute('aria-expanded','true');setTimeout(()=>document.addEventListener('click',out,true),0);await N.fetch();if(!pan.classList.contains('hidden'))draw()};
  N.paintBadge();
};

/* Dashboard card: incidents waiting on the signed-in user. */
N.mountPanel=host=>{
  if(!host||!host.isConnected)return;const items=need();
  if(!items.length){host.innerHTML='';return}
  const s=seen();
  host.innerHTML='<section class="card act-card" aria-label="Needs your action"><div class="card-h"><div><h3>'+MG.icon('bell')+' Needs your action <span class="act-n">'+items.length+'</span></h3><p class="sub">Incidents waiting on you right now</p></div></div><div class="nt-list">'+items.slice(0,6).map(i=>row(i,s)).join('')+'</div>'+(items.length>6?'<p class="small muted" style="margin-top:8px">+'+(items.length-6)+' more · open the bell to see all</p>':'')+'</section>';
  bind(host);
};
})();
