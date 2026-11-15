/* shared components: incident card + hover panel, KPI card, range control. */
(function(){
const MG=window.MG,esc=MG.esc,UI=MG.ui={};

/* ---------- KPI ---------- */
UI.kpi=({key,label,value,color='#2563eb',foot='',spark,delta,tip,static:st})=>
  '<'+(st?'div':'button type="button"')+' class="kpi'+(st?' static':'')+'" style="--c:'+color+'"'+(key?' data-kpi="'+esc(key)+'"':'')+(tip?' title="'+esc(tip)+'"':'')+'><div class="kpi-top"><span class="dot"></span>'+esc(label)+'</div><div class="kpi-val">'+esc(value)+'</div><div class="kpi-foot"><span>'+(delta||'')+(foot?(delta?' ':'')+esc(foot):'')+'</span>'+(spark||'')+'</div></'+(st?'div':'button')+'>';
/* goodWhen: 'down' means a decrease is an improvement (e.g. incidents) */
UI.delta=(cur,prev,goodWhen='down')=>{
  if(prev===null||prev===undefined)return '';
  if(!prev&&!cur)return '<span class="delta flat">— vs prev.</span>';
  const diff=cur-prev,p=prev?Math.round(Math.abs(diff)/prev*100)+'%':'new';
  if(!diff)return '<span class="delta flat">= vs prev.</span>';
  const up=diff>0,good=(goodWhen==='down')!==up;
  return '<span class="delta '+(up?'up':'down')+'-'+(good?'good':'bad')+'" title="Compared with the previous period of equal length">'+MG.icon(up?'up':'downa')+p+'</span>';
};

/* ---------- incident card ---------- */
UI.card=(r,i=0)=>{
  const st=MG.STATUS[r.status]||{color:'#94a3b8'},pend=MG.data.pendingLabel(r),resp=MG.data.responsible(r);
  return '<article class="inc-card" tabindex="0" role="link" aria-label="Open incident '+esc(r.incident_ref||'')+'" data-id="'+esc(r.id)+'" style="--c:'+st.color+';animation-delay:'+Math.min(i,12)*28+'ms">'
   +'<div class="inc-top"><span class="inc-id">'+esc(r.incident_ref||'Reference pending')+'</span>'+MG.statusPill(r.status)+'</div>'
   +'<h3 class="inc-title">'+esc(r.incident_type||r.category||'Incident')+'</h3>'+(MG.state.user&&r.assignee_id&&r.assignee_id===MG.state.user.id&&r.status!=='closed'?'<div class="you-flag">'+MG.icon('bell')+'Action needed from you</div>':'')
   +'<div class="inc-meta"><div>'+MG.icon('pin')+'<span>'+esc([r.mine_name,r.area_name].filter(Boolean).join(' · ')||r.location_zone||'—')+'</span></div>'
   +'<div>'+MG.icon('layers')+'<span>'+esc(r.category||'—')+(r.discipline?' · '+esc(r.discipline):'')+'</span></div>'
   +'<div>'+MG.icon('calendar')+'<span>'+esc(MG.date(r.date_of_incident||r.created_at))+(r.time_of_incident?' · '+esc(String(r.time_of_incident).slice(0,5)):'')+'</span></div>'
   +'<div>'+MG.icon('user')+'<span>'+esc(resp.text)+'</span></div></div>'
   +'<div class="inc-foot">'+MG.sevHtml(r.severity)+'<span class="pending-flag '+pend.cls+'">'+(pend.cls==='done'?MG.icon('check'):'<span class="pulse"></span>')+esc(pend.text)+'</span></div></article>';
};

/* ---------- hover panel (one shared element, positioned beside the card) ---------- */
let pop,popTimer,hideTimer,popFor=null;
const ensurePop=()=>{if(pop)return pop;pop=document.createElement('div');pop.className='inc-pop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Incident quick look');document.body.append(pop);
  pop.addEventListener('mouseenter',()=>clearTimeout(hideTimer));pop.addEventListener('mouseleave',hidePop);
  pop.addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b){hidePop(true);MG.go('/incidents/'+b.dataset.open)}});return pop};
const hidePop=(now)=>{clearTimeout(popTimer);clearTimeout(hideTimer);const go=()=>{if(pop)pop.classList.remove('on');document.querySelectorAll('.inc-card.pop-open').forEach(c=>c.classList.remove('pop-open'));popFor=null};now===true?go():hideTimer=setTimeout(go,140)};
const popBody=(r,det)=>{
  const hist=det?det.forwarding_history:null,comments=det?det.comments:null,resp=MG.data.responsible(r,hist);
  const events=det?[...(hist||[]).map(h=>({t:h.created_at,x:MG.nice(h.action)+' · '+MG.role(h.from_role)+' → '+MG.role(h.to_role)})),...(comments||[]).map(c=>({t:c.created_at,x:'Remark · '+MG.role(c.context?.role)}))].sort((a,b)=>new Date(b.t)-new Date(a.t))[0]:null;
  const st=MG.STATUS[r.status]||{};
  return '<h4>Quick look</h4><p>'+esc(r.description||'No description recorded.')+'</p>'
   +'<div class="pop-grid"><div><small>Location</small><span>'+esc([r.location_zone,r.location_detail].filter(Boolean).join(' · ')||'—')+'</span></div><div><small>Persons injured</small><span>'+esc(r.persons_injured??0)+'</span></div>'
   +'<div><small>Reported by</small><span>'+esc(r.reporter_name||'—')+'</span></div><div><small>Responsible</small><span>'+esc(resp.text)+'</span></div>'
   +'<div><small>PPE / SOP</small><span>'+esc(MG.nice(r.ppe_worn||'unknown'))+' / '+esc(MG.nice(r.sop_followed||'unknown'))+'</span></div><div><small>Reported</small><span>'+esc(MG.relTime(r.created_at))+'</span></div></div>'
   +(r.immediate_actions?'<div class="small muted" style="margin-bottom:8px"><b style="color:var(--ink-2)">Immediate actions:</b> '+esc(String(r.immediate_actions).slice(0,140))+(String(r.immediate_actions).length>140?'…':'')+'</div>':'')
   +'<div class="pop-last">'+(det?(events?'<b style="color:var(--ink-2)">Last activity</b> · '+esc(events.x)+' · '+esc(MG.relTime(events.t)):'No workflow activity recorded yet.'):'<span class="skeleton" style="height:14px;width:70%"></span>')+'</div>'
   +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><span class="pill" style="--c:'+st.color+';--bg-c:'+st.bg+'">'+esc(st.pending||st.label||'')+'</span><button class="btn btn-accent btn-sm" data-open="'+esc(r.id)+'">Open details '+MG.icon('arrow')+'</button></div>';
};
const showPop=async(card)=>{
  const id=card.dataset.id,r=(MG.state.rows.find(x=>x.id===id))||(UI._extra&&UI._extra.get(id));if(!r)return;
  const p=ensurePop();popFor=id;p.innerHTML=popBody(r,MG.state.detail.get(id));document.querySelectorAll('.inc-card.pop-open').forEach(c=>c.classList.remove('pop-open'));card.classList.add('pop-open');
  const cr=card.getBoundingClientRect(),pw=330,ph=Math.min(p.offsetHeight||320,420);let left=cr.right+12;if(left+pw>innerWidth-12)left=cr.left-pw-12;if(left<12)left=Math.min(Math.max(12,cr.left),innerWidth-pw-12);
  let top=cr.top;if(top+ph>innerHeight-12)top=Math.max(12,innerHeight-ph-12);p.style.left=left+'px';p.style.top=top+'px';p.classList.add('on');
  if(!MG.state.detail.has(id)){try{const d=await MG.data.detail(id);if(popFor===id){p.innerHTML=popBody(r,d)}}catch{if(popFor===id){const l=p.querySelector('.pop-last');if(l)l.textContent='Activity history unavailable.'}}}
};
UI.bindCards=(host,onOpen)=>{
  if(host._cardsBound)return;host._cardsBound=true;
  const open=card=>{hidePop(true);(onOpen||(id=>MG.go('/incidents/'+id)))(card.dataset.id)};
  host.addEventListener('click',e=>{const c=e.target.closest('.inc-card');if(c&&host.contains(c))open(c)});
  host.addEventListener('keydown',e=>{const c=e.target.closest('.inc-card');if(!c)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();open(c)}if(e.key==='Escape')hidePop(true)});
  host.addEventListener('mouseover',e=>{const c=e.target.closest('.inc-card');if(!c||!host.contains(c)||c===popFor&&c.classList.contains('pop-open')||(e.relatedTarget&&c.contains(e.relatedTarget)))return;clearTimeout(hideTimer);clearTimeout(popTimer);popTimer=setTimeout(()=>showPop(c),260)});
  host.addEventListener('mouseout',e=>{const c=e.target.closest('.inc-card');if(c&&!(e.relatedTarget&&(c.contains(e.relatedTarget)||pop&&pop.contains(e.relatedTarget)))){clearTimeout(popTimer);hidePop()}});
  host.addEventListener('focusin',e=>{const c=e.target.closest('.inc-card');if(c&&e.target===c){clearTimeout(popTimer);popTimer=setTimeout(()=>showPop(c),200)}});
  host.addEventListener('focusout',e=>{if(e.target.closest('.inc-card'))hidePop()});
};
UI.hidePop=()=>hidePop(true);
window.addEventListener('scroll',()=>UI.hidePop(),{passive:true});

/* ---------- card feed with "show more" ---------- */
UI.feed=(host,rows,{page=24,empty='No incidents match these filters.',extra}={})=>{
  if(extra){UI._extra=new Map(extra.map(r=>[r.id,r]))}
  if(!rows.length){host.innerHTML=MG.empty('shield','Nothing to show',empty);return}
  let shown=0;host.innerHTML='<div class="feed"></div><div class="more" style="text-align:center;margin-top:16px"></div>';
  const feed=host.querySelector('.feed'),more=host.querySelector('.more');
  const next=()=>{const slice=rows.slice(shown,shown+page);feed.insertAdjacentHTML('beforeend',slice.map((r,i)=>UI.card(r,i)).join(''));shown+=slice.length;more.innerHTML=shown<rows.length?'<button class="btn btn-secondary">Show more ('+(rows.length-shown)+' remaining)</button>':'<span class="small faint">Showing all '+rows.length+' incidents</span>';const b=more.querySelector('button');if(b)b.onclick=next};
  next();UI.bindCards(host);
};

/* ---------- range control ---------- */
UI.rangeControl=(host,onChange)=>{
  const S=MG.state,render=()=>{
    const r=S.range;
    host.innerHTML='<div class="range-pop"><div class="seg" role="group" aria-label="Reporting period">'+MG.data.PRESETS.map(p=>'<button type="button" data-p="'+p[0]+'" class="'+(r.preset===p[0]?'active':'')+'">'+p[1]+'</button>').join('')+'<button type="button" data-p="custom" class="'+(r.preset==='custom'?'active':'')+'">'+MG.icon('calendar')+' Custom</button></div><div class="range-menu hidden"><div class="field"><label>From</label><input type="date" class="input" id="rgFrom"></div><div class="field"><label>To</label><input type="date" class="input" id="rgTo"></div><button class="btn btn-primary btn-sm" id="rgApply">Apply range</button></div></div>';
    const menu=host.querySelector('.range-menu'),b=MG.data.bounds();
    host.querySelector('#rgFrom').value=r.from||MG.isoDay(b.from);host.querySelector('#rgTo').value=r.to||MG.isoDay(b.to);
    host.querySelectorAll('[data-p]').forEach(btn=>btn.onclick=()=>{
      if(btn.dataset.p==='custom'){menu.classList.toggle('hidden');return}
      MG.data.setRange(btn.dataset.p);render();onChange()});
    host.querySelector('#rgApply').onclick=()=>{const f=host.querySelector('#rgFrom').value,t=host.querySelector('#rgTo').value;if(!f||!t||f>t){MG.toast('Choose a valid date range','err');return}MG.data.setRange('custom',f,t);render();onChange()};
  };
  render();return render;
};
})();
