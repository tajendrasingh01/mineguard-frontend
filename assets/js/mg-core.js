/* MineGuard core: config, API client, constants, helpers, overlays.
   Authorization is enforced by the backend. Permission helpers here only decide which controls to show. */
(function(){
const MG=window.MG=window.MG||{};
const PROD_FRONTEND_HOSTS=new Set(['mineguard-frontend.vercel.app','mineguard-frontend-tajendrasingh01s-projects.vercel.app','mineguard-frontend-git-main-tajendrasingh01s-projects.vercel.app']);
MG.API=window.MINEGUARD_API_BASE||(PROD_FRONTEND_HOSTS.has(location.hostname)?'https://mineguard-api.onrender.com':'https://mineguard-test-api.onrender.com');
MG.NCPH_MINE_ID='7bb6efc1-77b7-4a5e-9dc5-dc9596dc7c3e';
MG.OVERDUE_DAYS=7;
MG.state={user:null,areas:[],mines:[],areaMap:new Map(),mineMap:new Map(),range:{preset:'12m',from:'',to:''},rows:[],total:0,truncated:false,loadedKey:null,scope:{areaId:null,mineId:null},detail:new Map()};

/* ---------- small helpers ---------- */
MG.$=(id)=>document.getElementById(id);
MG.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
MG.nice=s=>String(s||'').replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const esc=MG.esc;
MG.sum=a=>a.reduce((x,y)=>x+y,0);
MG.avg=a=>a.length?MG.sum(a)/a.length:null;
MG.median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
MG.countBy=(rows,fn)=>{const m=new Map();rows.forEach(r=>{const k=fn(r);m.set(k,(m.get(k)||0)+1)});return m};
MG.pct=(a,b)=>b?Math.round(a/b*100):0;
MG.num=n=>Number(n||0).toLocaleString('en-IN');
const DF=new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'});
const DTF=new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
MG.date=v=>{const d=new Date(v);return v&&!Number.isNaN(d.getTime())?DF.format(d):'—'};
MG.dateTime=v=>{const d=new Date(v);return v&&!Number.isNaN(d.getTime())?DTF.format(d):'—'};
MG.relTime=v=>{const t=new Date(v).getTime();if(!Number.isFinite(t))return '—';const s=Math.max(0,(Date.now()-t)/1000);if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';if(s<86400*14)return Math.floor(s/86400)+'d ago';if(s<86400*60)return Math.floor(s/604800)+'w ago';return MG.date(v)};
MG.hoursBetween=(a,b)=>{const x=new Date(a).getTime(),y=new Date(b).getTime();return Number.isFinite(x)&&Number.isFinite(y)&&y>=x?(y-x)/3600000:null};
MG.duration=h=>{if(h===null||h===undefined||!Number.isFinite(h))return '—';if(h<1)return Math.max(1,Math.round(h*60))+'m';if(h<24)return Math.round(h)+'h';const d=h/24;return d<60?(d<10?d.toFixed(1):Math.round(d))+'d':(d/30).toFixed(1)+'mo'};
MG.isoDay=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};

/* ---------- constants mirrored from backend policy (display only) ---------- */
MG.STATUS={
  open:{label:'Open',short:'Open',color:'#d97706',bg:'#fef3c7',order:0,pending:'Awaiting review'},
  under_review:{label:'Under Review',short:'Review',color:'#2563eb',bg:'#dbeafe',order:1,pending:'Action to be assigned'},
  action_assigned:{label:'Action Assigned',short:'Action',color:'#7c3aed',bg:'#ede9fe',order:2,pending:'Action in progress'},
  escalated:{label:'Escalated',short:'Escalated',color:'#dc2626',bg:'#fee2e2',order:3,pending:'Awaiting senior decision'},
  resolved:{label:'Resolved',short:'Resolved',color:'#059669',bg:'#d1fae5',order:4,pending:'Awaiting closure'},
  closed:{label:'Closed',short:'Closed',color:'#64748b',bg:'#e2e8f0',order:5,pending:''}
};
MG.STATUS_KEYS=Object.keys(MG.STATUS);
MG.TRANSITIONS={open:['under_review','escalated'],under_review:['action_assigned','escalated'],action_assigned:['under_review','resolved','escalated'],escalated:['under_review','action_assigned','resolved'],resolved:['closed','under_review'],closed:[]};
MG.SEVERITY={
  none:{label:'None',color:'#94a3b8',bars:1,order:0},nearMiss:{label:'Near miss',color:'#0ea5e9',bars:1,order:1},
  minor:{label:'Minor',color:'#ca8a04',bars:2,order:2},serious:{label:'Serious',color:'#ea580c',bars:3,order:3},
  critical:{label:'Critical',color:'#dc2626',bars:4,order:4},fatality:{label:'Fatality',color:'#7f1d1d',bars:5,order:5}
};
MG.SEV_KEYS=Object.keys(MG.SEVERITY);
MG.sevMeta=v=>MG.SEVERITY[v]||{label:v?MG.nice(v):'Not recorded',color:'#94a3b8',bars:0,order:-1};
MG.catKey=v=>{v=String(v||'').toLowerCase();return v.includes('near miss')?'near':v.includes('unsafe condition')?'condition':v.includes('unsafe act')||v.includes('unsafe practice')?'act':v.includes('incident reporting')?'incident':'other'};
MG.CATEGORY={act:{label:'Unsafe Act',color:'#db2777'},condition:{label:'Unsafe Condition',color:'#0d9488'},near:{label:'Near Miss',color:'#0284c7'},incident:{label:'Incident Reporting',color:'#4f46e5'},other:{label:'Other',color:'#94a3b8'}};
MG.CAT_KEYS=Object.keys(MG.CATEGORY);
MG.ROLE={MINE_SO_MINING:'Mine Safety Officer (Mining)',MINE_SO_EM:'Mine Safety Officer (E&M)',MINE_MANAGER:'Mine Manager',LOCAL_SUPERVISOR:'Local Supervisor',LOCAL_ENGINEER:'Local Engineer',AREA_SAFETY_OFFICER:'Area Safety Officer',HQ_SAFETY_HEAD:'HQ Safety Head'};
MG.role=r=>MG.ROLE[r]||(r?MG.nice(String(r).toLowerCase()):'—');
MG.isActive=s=>!['resolved','closed'].includes(s);
MG.ageHours=i=>MG.hoursBetween(i.created_at,new Date());
MG.isOverdue=i=>MG.isActive(i.status)&&(MG.ageHours(i)||0)>MG.OVERDUE_DAYS*24;
MG.resolutionHours=i=>MG.isActive(i.status)||!i.resolved_at?null:MG.hoursBetween(i.created_at,i.resolved_at);
MG.statusPill=s=>{const m=MG.STATUS[s]||{label:MG.nice(s),color:'#475569',bg:'#e2e8f0'};return '<span class="pill" style="--c:'+m.color+';--bg-c:'+m.bg+'"><span class="dot"></span>'+esc(m.label)+'</span>'};
MG.sevHtml=v=>{const m=MG.sevMeta(v);return '<span class="sev" style="--c:'+m.color+'"><i>'+[1,2,3,4,5].map(n=>'<s class="'+(n<=m.bars?'on':'')+'"></s>').join('')+'</i>'+esc(m.label)+'</span>'};
MG.catTag=v=>{const m=MG.CATEGORY[MG.catKey(v)];return '<span class="tag"><span class="dot" style="width:7px;height:7px;border-radius:50%;background:'+m.color+'"></span>'+esc(v||m.label)+'</span>'};
MG.tint=(hex,a)=>{const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')'};

/* ---------- permissions (UI hints only) ---------- */
const U=()=>MG.state.user||{};
MG.can={
  isHQ:()=>U().role==='HQ_SAFETY_HEAD',isArea:()=>U().role==='AREA_SAFETY_OFFICER',isMineSO:()=>['MINE_SO_MINING','MINE_SO_EM'].includes(U().role),
  isManager:()=>U().role==='MINE_MANAGER',isLocal:()=>['LOCAL_SUPERVISOR','LOCAL_ENGINEER'].includes(U().role),
  manage:()=>['MINE_MANAGER','AREA_SAFETY_OFFICER'].includes(U().role),resolveClose:()=>U().role==='MINE_MANAGER',
  report:()=>['MINE_SO_MINING','MINE_SO_EM','HQ_SAFETY_HEAD'].includes(U().role),
  viewNCPHSops:()=>['MINE_SO_MINING','MINE_SO_EM','MINE_MANAGER'].includes(U().role)&&U().assigned_mine_id===MG.NCPH_MINE_ID
};

/* ---------- icons ---------- */
const P={
 dashboard:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 chart:'<path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',file:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
 book:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5"/>',
 search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',
 right:'<path d="m9 18 6-6-6-6"/>',down:'<path d="m6 9 6 6 6-6"/>',left:'<path d="m15 18-6-6 6-6"/>',
 clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 alert:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',checkc:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3"/>',
 upright:'<path d="M7 17 17 7M7 7h10v10"/>',arrow:'<path d="M5 12h14M12 5l7 7-7 7"/>',up:'<path d="m5 12 7-7 7 7M12 19V5"/>',downa:'<path d="m19 12-7 7-7-7M12 5v14"/>',
 send:'<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
 calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
 users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 camera:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
 msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
 filter:'<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',trend:'<path d="m23 6-9.5 9.5-5-5L1 18M17 6h6v6"/>',
 layers:'<path d="m12 2 10 5-10 5L2 7zM2 17l10 5 10-5M2 12l10 5 10-5"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
 eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
 activity:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',ext:'<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
 hard:'<path d="M2 18h20M4 18v-2a8 8 0 0 1 16 0v2M12 8V4M9 18v-4h6v4"/>',target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
 mapf:'<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
 undo:'<path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8"/>',menu:'<path d="M3 12h18M3 6h18M3 18h18"/>'
};
MG.icon=(n,extra='')=>'<svg class="ic '+extra+'" viewBox="0 0 24 24" aria-hidden="true">'+(P[n]||'')+'</svg>';

/* ---------- API ---------- */
MG.logout=()=>{localStorage.removeItem('mg_token');location.href='index.html'};
MG.api=async(path,opt={})=>{
  const r=await fetch(MG.API+path,{...opt,headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('mg_token'),...opt.headers}});
  const d=await r.json().catch(()=>({error:'Invalid response'}));
  if(!r.ok){const e=new Error(d.error||'Request failed');e.status=r.status;throw e}
  return d;
};

/* ---------- toast ---------- */
MG.toast=(msg,type='ok',action)=>{
  const wrap=MG.$('toasts');if(!wrap)return;const el=document.createElement('div');el.className='toast '+type;el.setAttribute('role',type==='err'?'alert':'status');
  el.innerHTML=MG.icon(type==='err'?'alert':'checkc')+'<span>'+esc(msg)+'</span>'+(action?'<button class="btn btn-ghost btn-sm" style="color:#fff">'+esc(action.label)+'</button>':'');
  if(action)el.querySelector('button').onclick=action.fn;wrap.append(el);
  setTimeout(()=>{el.style.transition='opacity .25s,transform .25s';el.style.opacity='0';el.style.transform='translateY(8px)';setTimeout(()=>el.remove(),260)},type==='err'?8000:4500);
};
MG.fail=e=>{console.error(e);MG.toast(e&&e.message||'Something went wrong','err',e&&e.status===401?{label:'Sign in',fn:MG.logout}:null)};
MG.busy=async(btn,fn)=>{if(btn.classList.contains('loading'))return;btn.classList.add('loading');const prev=btn.disabled;btn.disabled=true;try{return await fn()}catch(e){MG.fail(e)}finally{btn.classList.remove('loading');btn.disabled=prev}};

/* ---------- tooltip (delegated, data-tip holds escaped HTML built by chart code) ---------- */
const tip=document.createElement('div');tip.className='mg-tip';tip.setAttribute('role','tooltip');document.addEventListener('DOMContentLoaded',()=>document.body.append(tip));
const place=(x,y)=>{const w=tip.offsetWidth,h=tip.offsetHeight;let l=x+14,t=y+14;if(l+w>innerWidth-8)l=x-w-14;if(t+h>innerHeight-8)t=y-h-14;tip.style.left=Math.max(8,l)+'px';tip.style.top=Math.max(8,t)+'px'};
MG.tip={
  show(html,x,y){tip.innerHTML=html;tip.classList.add('on');place(x,y)},move:place,hide(){tip.classList.remove('on')},
  html(title,rows){return '<b>'+esc(title)+'</b>'+(rows||[]).map(r=>'<div class="t-row"><span>'+(r.c?'<i style="background:'+r.c+'"></i>':'')+esc(r.k)+'</span><b>'+esc(r.v)+'</b></div>').join('')}
};
MG.bindTips=root=>{
  if(root._tips)return;root._tips=true;
  root.addEventListener('mouseover',e=>{const t=e.target.closest('[data-tip]');if(t&&root.contains(t))MG.tip.show(t.dataset.tip,e.clientX,e.clientY)});
  root.addEventListener('mousemove',e=>{if(tip.classList.contains('on')&&e.target.closest('[data-tip]'))MG.tip.move(e.clientX,e.clientY)});
  root.addEventListener('mouseout',e=>{if(e.target.closest('[data-tip]')&&!(e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest('[data-tip]')))MG.tip.hide()});
  root.addEventListener('focusin',e=>{const t=e.target.closest('[data-tip]');if(t){const r=t.getBoundingClientRect();MG.tip.show(t.dataset.tip,r.left+r.width/2,r.top)}});
  root.addEventListener('focusout',()=>MG.tip.hide());
  root.addEventListener('mouseleave',()=>MG.tip.hide());
};

/* ---------- drawer / lightbox ---------- */
MG.drawer=({title,sub='',body='',footer='',onClose})=>{
  const back=document.createElement('div');back.className='backdrop';const el=document.createElement('aside');el.className='drawer';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',title);
  el.innerHTML='<div class="drawer-h"><div><h3>'+esc(title)+'</h3>'+(sub?'<p class="muted small" style="margin-top:3px">'+sub+'</p>':'')+'</div><button class="btn btn-ghost btn-icon" data-x aria-label="Close">'+MG.icon('x')+'</button></div><div class="drawer-b"></div><div class="drawer-f"></div>';
  const b=el.querySelector('.drawer-b'),f=el.querySelector('.drawer-f');
  const put=(host,c)=>{if(typeof c==='string')host.innerHTML=c;else{host.innerHTML='';host.append(c)}};put(b,body);put(f,footer);if(!footer)f.classList.add('hidden');
  document.body.append(back,el);document.body.style.overflow='hidden';requestAnimationFrame(()=>{back.classList.add('on');el.classList.add('on');const first=el.querySelector('textarea,select,input,button.btn-primary');first&&first.focus({preventScroll:true})});
  const ctl={el,body:b,footer:f,set(c){put(b,c)},setFooter(c){put(f,c);f.classList.toggle('hidden',!c)},close(){document.removeEventListener('keydown',key);back.classList.remove('on');el.classList.remove('on');document.body.style.overflow='';setTimeout(()=>{back.remove();el.remove()},320);onClose&&onClose()}};
  const key=e=>{if(e.key==='Escape')ctl.close()};document.addEventListener('keydown',key);back.onclick=ctl.close;el.querySelector('[data-x]').onclick=ctl.close;return ctl;
};
MG.lightbox=src=>{const el=document.createElement('div');el.className='lightbox';el.innerHTML='<img alt="Incident evidence" src="'+src+'">';const close=()=>{el.remove();document.removeEventListener('keydown',k)};const k=e=>{if(e.key==='Escape')close()};el.onclick=close;document.addEventListener('keydown',k);document.body.append(el)};
MG.skeleton=(n=3,h=88)=>Array.from({length:n},()=>'<span class="skeleton" style="height:'+h+'px"></span>').join('');
MG.empty=(icon,title,sub='')=>'<div class="empty">'+MG.icon(icon)+'<b>'+esc(title)+'</b><span>'+esc(sub)+'</span></div>';
MG.debounce=(fn,ms=200)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};
})();
