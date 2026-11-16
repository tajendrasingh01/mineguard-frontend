/* App shell: auth bootstrap, role-aware navigation, hash router, breadcrumbs / drill-down chrome.
   Hash routing keeps the app working on plain static hosting (no server rewrites) and avoids page reloads.
   Access control is enforced by the API; the guards here only decide which screens to offer. */
(function(){
const MG=window.MG,S=MG.state,D=MG.data,UI=MG.ui,esc=MG.esc,V=MG.views;
const EXPECTED_API='secl-safety-v1';
const TITLES={dashboard:'Safety Dashboard',incidents:'Incidents',incident:'Incident',analytics:'Analytics',report:'Report Incident',myreports:'My Reports',sops:'SOP Library',circulars:'Circulars & Guidelines',circularNew:'Issue communication',circular:'Communication'};
const WITH_RANGE=new Set(['dashboard','incidents','analytics','myreports']);
let cur=null,lastHash=null,pending=0;

/* ---------- routing ---------- */
const parse=hash=>{
  const raw=String(hash||'').replace(/^#/,'')||'/dashboard',[p,qs]=raw.split('?'),seg=p.split('/').filter(Boolean),query=new URLSearchParams(qs||'');
  const [a,b,c]=seg;
  if(a==='dashboard')return {name:'dashboard',params:{areaId:b==='area'?c||null:null,mineId:b==='mine'?c||null:null,query}};
  if(a==='incidents')return b?{name:'incident',params:{id:b,mine:false,query}}:{name:'incidents',params:{query}};
  if(a==='my-reports')return b?{name:'incident',params:{id:b,mine:true,query}}:{name:'myreports',params:{query}};
  if(a==='circulars')return b==='new'?{name:'circularNew',params:{query}}:b?{name:'circular',params:{id:b,query}}:{name:'circulars',params:{query}};
  if(a==='analytics'||a==='report'||a==='sops')return {name:a,params:{query}};
  return null;
};
const allowed=name=>name==='circularNew'?MG.circ.canPublish():name==='report'?MG.can.report():name==='myreports'?MG.can.isMineSO():name==='sops'?MG.can.viewNCPHSops():true;
MG.go=path=>{if(location.hash==='#'+path)route();else location.hash=path};
MG.back=fallback=>{if(lastHash&&history.length>1)history.back();else MG.go(fallback||'/dashboard')};
MG.refresh=()=>{S.loadedKey=null;S.detail.clear();route()};

/* ---------- navigation ---------- */
const NAV=[
  {name:'dashboard',href:'/dashboard',icon:'dashboard',label:'Dashboard',show:()=>true},
  {name:'incidents',href:'/incidents',icon:'list',label:'Incidents',show:()=>true},
  {name:'analytics',href:'/analytics',icon:'chart',label:'Analytics',show:()=>true},
  {name:'circulars',href:'/circulars',icon:'msg',label:'Circulars',show:()=>true},
  {name:'report',href:'/report',icon:'plus',label:'Report',show:()=>MG.can.report()},
  {name:'myreports',href:'/my-reports',icon:'file',label:'My Reports',show:()=>MG.can.isMineSO()},
  {name:'sops',href:'/sops',icon:'book',label:'SOP Library',show:()=>MG.can.viewNCPHSops()}
];
const navFor=r=>r.name==='circular'||r.name==='circularNew'?'circulars':r.name==='incident'?(r.params.mine?'myreports':'incidents'):r.name;
const initials=n=>String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
const homeScope=()=>MG.can.isHQ()?'Corporate HQ':MG.can.isArea()?(S.areas[0]?.name||'Area'):(S.mines[0]?.name||'');

function buildShell(){
  const u=S.user;
  MG.$('app').innerHTML=
   '<aside class="sidebar" aria-label="Main navigation"><div class="brand-stack"><div class="logo-plate"><img src="assets/img/secl-logo-wide.jpg" alt="Coal India · SECL"></div><b>Suraksha Prabandhan Pranali</b></div>'
   +'<div class="nav-label">Workspace</div><nav id="nav" style="display:contents">'+NAV.filter(n=>n.show()).map(n=>'<a class="nav-link" data-nav="'+n.name+'" href="#'+n.href+'">'+MG.icon(n.icon)+'<span>'+esc(n.label)+'</span></a>').join('')+'</nav>'
   +'<div class="side-spacer"></div><div class="userbox"><div><div class="u-name" title="'+esc(u.name)+'">'+esc(u.name||u.worker_id)+'</div><div class="u-role">'+esc(MG.role(u.role))+'</div>'+(homeScope()?'<div class="u-role">'+esc(homeScope())+'</div>':'')+'</div><button class="btn btn-secondary btn-sm" id="logout">'+MG.icon('logout')+'Sign out</button></div></aside>'
   +'<div class="main"><header class="topbar" id="topbar"><div class="crumbs" id="crumbs"></div><div class="top-actions" id="topActions"></div></header><main class="content"><div id="banner"></div><div id="view" aria-live="polite"></div></main></div>';
  MG.$('logout').onclick=MG.logout;
  window.addEventListener('scroll',()=>MG.$('topbar')&&MG.$('topbar').classList.toggle('scrolled',scrollY>4),{passive:true});
}

/* ---------- breadcrumbs / drill-down chrome ---------- */
const drillChain=name=>{
  /* Returns ancestors + current for HQ → Area → Mine drill-down, honouring the viewer's role. */
  const base='/'+(name==='incidents'?'incidents':name==='analytics'?'analytics':'dashboard');
  const area=S.scope.areaId?D.areaName(S.scope.areaId):'',mine=S.scope.mineId?D.mineName(S.scope.mineId):'';
  const can=name==='dashboard';
  const out=[];
  if(MG.can.isHQ()){
    if(area||mine)out.push({label:'HQ',href:base});
    if(mine&&area)out.push({label:area,href:can?'/dashboard/area/'+S.scope.areaId:null});
    out.push({label:mine||area||(name==='dashboard'?'HQ Safety Dashboard':TITLES[name])});
  }else if(MG.can.isArea()){
    const an=S.areas[0]?.name||'Area';
    if(mine){out.push({label:an,href:can?'/dashboard':null});out.push({label:mine})}else out.push({label:name==='dashboard'?an+' · Safety Dashboard':TITLES[name]});
  }else out.push({label:name==='dashboard'?(mine||S.mines[0]?.name||'Mine')+' · Safety Dashboard':TITLES[name]});
  return out;
};
const crumbHtml=list=>list.map((c,i)=>{const last=i===list.length-1;return last?'<h1 class="crumb-cur-h">'+esc(c.label)+'</h1>':(c.href?'<button class="crumb-btn" data-href="'+esc(c.href)+'">'+esc(c.label)+'</button>':'<span class="crumb-btn" style="cursor:default">'+esc(c.label)+'</span>')+'<span class="crumb-sep">'+MG.icon('right')+'</span>'}).join('');
function paintCrumbs(list){
  const el=MG.$('crumbs');if(!el)return;el.innerHTML=crumbHtml(list);
  el.querySelectorAll('[data-href]').forEach(b=>b.onclick=()=>MG.go(b.dataset.href));
  const last=list[list.length-1];document.title=(last?last.label+' · ':'')+'Suraksha Prabandhan Pranali';
}
MG.setCrumbs=(list,override)=>{if(!cur)return;if(override)cur.crumbs=list;paintCrumbs(list)};
MG.updateChrome=()=>{
  if(!cur)return;
  if(cur.name==='dashboard'||cur.name==='incidents')paintCrumbs(drillChain(cur.name));
  else if(cur.name==='incident')paintCrumbs(cur.crumbs||[{label:'Incidents',href:cur.params.mine?'/my-reports':'/incidents'},{label:'Incident'}]);
  else if(cur.name==='circular'||cur.name==='circularNew')paintCrumbs(cur.crumbs||[{label:'Circulars & Guidelines',href:'/circulars'},{label:cur.name==='circularNew'?'Issue communication':'Communication'}]);
  else paintCrumbs([{label:TITLES[cur.name]||''}]);
  /* the narrowing scope on list screens: let people clear it in one click */
  const sc=MG.$('scopeTag');if(sc)sc.remove();
};
function buildTopActions(){
  const el=MG.$('topActions');if(!el)return;
  el.innerHTML=(WITH_RANGE.has(cur.name)?'<div id="rangeHost"></div>':'')+'<button class="btn btn-secondary btn-icon" id="refresh" aria-label="Refresh data" title="Refresh data">'+MG.icon('refresh')+'</button>'
    +(MG.can.report()&&cur.name!=='report'?'<a class="btn btn-accent hide-sm" href="#/report">'+MG.icon('plus')+'Report incident</a>':'');
  const rh=MG.$('rangeHost');if(rh)UI.rangeControl(rh,()=>MG.refresh());
  MG.notify.mountBell(el);
  MG.$('refresh').onclick=e=>{const b=e.currentTarget;b.classList.add('loading');MG.refresh();setTimeout(()=>b.classList.remove('loading'),600)};
}

/* ---------- render ---------- */
const errorBanner=(host,e,retry)=>{host.innerHTML='<div class="banner error">'+MG.icon('alert')+'<span>'+esc(e&&e.message||'Something went wrong')+'</span>'+(retry?'<button class="btn btn-secondary btn-sm" id="retry">Retry</button>':'')+'</div>';if(retry)host.querySelector('#retry').onclick=retry};
async function route(){
  if(!S.user)return;
  const r=parse(location.hash);
  if(!r){location.replace('#/dashboard');return}
  if(!allowed(r.name)){location.replace('#/dashboard');return}
  UI.hidePop();MG.tip.hide();
  lastHash=cur?'#'+cur.name:null;
  cur={...r,crumbs:null};const my=++pending;
  /* A fresh container per navigation: a slow response from the previous screen can never paint over this one. */
  const host=document.createElement('div');host.className='route route-'+r.name;MG.$('view').replaceChildren(host);
  const active=navFor(r);document.querySelectorAll('#nav .nav-link').forEach(a=>{const on=a.dataset.nav===active;a.classList.toggle('active',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  buildTopActions();MG.updateChrome();window.scrollTo({top:0});
  try{await V[r.name].render(host,r.params)}catch(e){if(my===pending){console.error(e);errorBanner(host,e,()=>route())}}
}

/* ---------- boot ---------- */
const decode=t=>{try{return JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return null}};
function fatal(title,msg,withRetry){
  MG.$('app').innerHTML='<div class="gate"><div class="gate-card"><div class="logo-plate gate-logo"><img src="assets/img/secl-logo-wide.jpg" alt="Coal India · SECL"></div><h2>'+esc(title)+'</h2><p class="muted">'+esc(msg)+'</p><div class="gate-actions">'+(withRetry?'<button class="btn btn-primary" id="gRetry">'+MG.icon('refresh')+'Try again</button>':'')+'<button class="btn btn-secondary" id="gOut">'+MG.icon('logout')+'Sign out</button></div></div></div>';
  const r=MG.$('gRetry');if(r)r.onclick=()=>location.reload();MG.$('gOut').onclick=MG.logout;
}
async function versionCheck(){
  try{
    const r=await fetch(MG.API+'/api/version',{cache:'no-store'});if(!r.ok)throw 0;const d=await r.json();
    if(d.api_version!==EXPECTED_API)MG.$('banner').innerHTML='<div class="banner warn">'+MG.icon('alert')+'<span><b>Backend rollout pending.</b> The deployed API reports <code>'+esc(d.api_version||'unknown')+'</code> but this portal expects <code>'+EXPECTED_API+'</code>. Some data may be unavailable until the API is updated.</span></div>';
  }catch{/* the data calls below surface connectivity problems with clearer messages */}
}
async function boot(){
  const tok=localStorage.getItem('mg_token'),claims=tok&&decode(tok);
  if(!claims||!(claims.exp*1000>Date.now())){MG.logout();return}
  MG.$('app').innerHTML=MG.loaderHtml('Loading your safety workspace');
  try{S.user=(await MG.api('/api/auth/me')).user}
  catch(e){if(e.status===401){MG.logout();return}fatal('Unable to reach the portal',e.message||'Please check your connection and try again.',true);return}
  if(!MG.ROLE[S.user.role]){fatal('No safety role assigned','Your account ('+(S.user.worker_id||'')+') is not assigned a SECL safety-management role. Ask the system administrator to assign your Mine or Area safety role.',false);return}
  await D.loadOrg();
  buildShell();if(window.MGDemo)MGDemo.mount(MG.$('banner'));else versionCheck();MG.notify.start();MG.circ.start();
  window.addEventListener('hashchange',route);route();
}
document.addEventListener('DOMContentLoaded',boot);
})();
