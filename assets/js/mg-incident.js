/* Incident management: feed, details, lifecycle timeline and guided workflows.
   Workflows call existing endpoints only: comments, status (PATCH) and forward (POST). */
(function(){
const MG=window.MG,S=MG.state,D=MG.data,esc=MG.esc,V=MG.views=MG.views||{};

/* ====================================================================== */
/* Incident feed                                                          */
/* ====================================================================== */
const defaults=()=>({q:'',status:'',sev:'',cat:'',type:'',sort:'new',overdue:false});
S.filters=defaults();
const SORTS={new:'Newest first',old:'Oldest first',sev:'Highest severity',attention:'Needs attention'};
const applyFilters=(rows,f,skipStatus)=>{
  const q=f.q.trim().toLowerCase();
  return rows.filter(r=>(!q||[r.incident_ref,r.incident_type,r.category,r.description,r.mine_name,r.area_name,r.location_zone,r.location_detail,r.reporter_name].join(' ').toLowerCase().includes(q))
    &&(!f.sev||r.severity===f.sev)&&(!f.cat||r._cat===f.cat)&&(!f.type||r.incident_type===f.type)&&(skipStatus||!f.status||r.status===f.status)&&(!f.overdue||MG.isOverdue(r)));
};
const sortRows=(rows,k)=>{const a=[...rows];
  if(k==='old')a.sort((x,y)=>x._t-y._t);else if(k==='sev')a.sort((x,y)=>(MG.sevMeta(y.severity).order-MG.sevMeta(x.severity).order)||y._t-x._t);
  else if(k==='attention')a.sort((x,y)=>(MG.isActive(y.status)-MG.isActive(x.status))||(MG.isOverdue(y)-MG.isOverdue(x))||x._t-y._t);else a.sort((x,y)=>y._t-x._t);return a};

V.incidents={
  async render(host,params){
    const q=params.query;
    if(q&&[...q.keys()].length){S.filters={...defaults(),status:q.get('status')||'',sev:q.get('sev')||'',cat:q.get('cat')||'',type:q.get('type')||'',overdue:q.get('overdue')==='1'}}
    host.innerHTML='<div class="toolbar"><span class="skeleton" style="height:40px;width:300px"></span></div><div class="feed">'+MG.skeleton(6,190)+'</div>';
    try{await D.load()}catch(e){host.innerHTML='<div class="banner error">'+MG.icon('alert')+'<span>'+esc(e.message)+'</span><button class="btn btn-secondary btn-sm" id="retry">Retry</button></div>';host.querySelector('#retry').onclick=()=>V.incidents.render(host,params);return}
    const f=S.filters,areas=S.areas,showArea=areas.length>1&&!MG.can.isArea();
    host.innerHTML=(S.truncated?'<div class="banner warn">'+MG.icon('info')+'<span>Showing the first '+MG.num(S.rows.length)+' of '+MG.num(S.total)+' incidents. Narrow the reporting period to see the rest.</span></div>':'')
      +'<div class="toolbar"><div class="search">'+MG.icon('search')+'<input class="input" id="fq" type="search" placeholder="Search reference, type, mine, description…" aria-label="Search incidents" value="'+esc(f.q)+'"></div>'
      +(showArea?'<select class="select" id="fArea" style="width:auto" aria-label="Area"><option value="">All Areas</option>'+areas.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('')+'</select>':'')
      +'<select class="select" id="fMine" style="width:auto;max-width:220px" aria-label="Mine / Project"></select>'
      +'<select class="select" id="fSev" style="width:auto" aria-label="Severity"><option value="">All severity</option>'+MG.SEV_KEYS.map(k=>'<option value="'+k+'">'+MG.SEVERITY[k].label+'</option>').join('')+'</select>'
      +'<select class="select" id="fCat" style="width:auto" aria-label="Category"><option value="">All categories</option>'+MG.CAT_KEYS.map(k=>'<option value="'+k+'">'+MG.CATEGORY[k].label+'</option>').join('')+'</select>'
      +'<select class="select" id="fSort" style="width:auto" aria-label="Sort">'+Object.entries(SORTS).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></div>'
      +'<div class="chips" id="fChips" style="margin-bottom:16px"></div><div id="feedHost"></div>';
    const $=s=>host.querySelector(s);
    const syncMines=()=>{const mines=S.mines.filter(m=>!S.scope.areaId||m.area_id===S.scope.areaId);$('#fMine').innerHTML='<option value="">'+(mines.length===1?'Mine / Project':'All Mines / Projects')+'</option>'+mines.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>').join('');$('#fMine').value=S.scope.mineId||'';$('#fMine').classList.toggle('hidden',S.mines.length<2)};
    if($('#fArea'))$('#fArea').value=S.scope.areaId||'';$('#fSev').value=f.sev;$('#fCat').value=f.cat;$('#fSort').value=f.sort;syncMines();
    const draw=()=>{
      const base=D.scoped(),pre=applyFilters(base,f,true),all=applyFilters(base,f,false),sorted=sortRows(all,f.sort);
      const cnt=MG.countBy(pre,r=>r.status),od=pre.filter(MG.isOverdue).length;
      $('#fChips').innerHTML='<button class="chip '+(!f.status&&!f.overdue?'on':'')+'" data-s="">All <span class="n">'+pre.length+'</span></button>'+MG.STATUS_KEYS.map(k=>'<button class="chip '+(f.status===k?'on':'')+'" data-s="'+k+'"><span class="dot" style="background:'+MG.STATUS[k].color+'"></span>'+MG.STATUS[k].label+' <span class="n">'+(cnt.get(k)||0)+'</span></button>').join('')+'<button class="chip '+(f.overdue?'on':'')+'" data-od="1" title="Active for more than '+MG.OVERDUE_DAYS+' days">'+MG.icon('clock')+' Overdue <span class="n">'+od+'</span></button>';
      $('#fChips').querySelectorAll('.chip').forEach(c=>c.onclick=()=>{if(c.dataset.od){f.overdue=!f.overdue}else{f.status=c.dataset.s;f.overdue=false}draw()});
      if(f.type){$('#fChips').insertAdjacentHTML('beforeend','<button class="chip on" id="clrType" title="Clear incident type filter">Type: '+esc(f.type)+' '+MG.icon('x')+'</button>');$('#clrType').onclick=()=>{f.type='';draw()}}
      MG.ui.feed($('#feedHost'),sorted);
    };
    $('#fq').oninput=MG.debounce(e=>{f.q=e.target.value;draw()},180);
    $('#fSev').onchange=e=>{f.sev=e.target.value;draw()};$('#fCat').onchange=e=>{f.cat=e.target.value;draw()};$('#fSort').onchange=e=>{f.sort=e.target.value;draw()};
    if($('#fArea'))$('#fArea').onchange=e=>{S.scope={areaId:e.target.value||null,mineId:null};syncMines();MG.updateChrome();draw()};
    $('#fMine').onchange=e=>{S.scope.mineId=e.target.value||null;if(S.scope.mineId){const m=S.mineMap.get(S.scope.mineId);if(m&&!MG.can.isArea())S.scope.areaId=m.area_id||S.scope.areaId;}MG.updateChrome();draw()};
    draw();
  }
};

/* ====================================================================== */
/* Lifecycle model (built only from recorded data)                         */
/* ====================================================================== */
const byTime=(a,b)=>new Date(a.created_at)-new Date(b.created_at);
const ACTION_LABEL={FORWARD:'Transferred',ASSIGN:'Action assigned',REASSIGN:'Action reassigned',ESCALATE:'Escalated'};
const stripTag=t=>String(t||'').replace(/^\[(Resolution|Closure)\]\s*/,'');
const isTag=(c,tag)=>String(c.comment_text||'').startsWith('['+tag+']');
const photosOf=inc=>{try{const p=typeof inc.photos==='string'?JSON.parse(inc.photos):inc.photos;return Array.isArray(p)?p.filter(x=>x&&typeof x.data==='string'&&x.data.startsWith('data:image/')):[]}catch{return[]}};
const route=h=>MG.role(h.from_role)+' → '+MG.role(h.to_role);
MG.lifecycle=function(inc,comments,history){
  const s=inc.status,hist=[...(history||[])].sort(byTime),com=[...(comments||[])].sort(byTime);
  const sub=hist.find(h=>h.action==='FORWARD'&&h.to_role==='MINE_MANAGER'&&['MINE_SO_MINING','MINE_SO_EM','HQ_SAFETY_HEAD'].includes(h.from_role));
  const assigns=hist.filter(h=>h.action==='ASSIGN'),escs=hist.filter(h=>h.action==='ESCALATE'),moves=hist.filter(h=>['FORWARD','REASSIGN'].includes(h.action)&&h!==sub);
  const resC=com.filter(c=>isTag(c,'Resolution')),cloC=com.filter(c=>isTag(c,'Closure')),plain=com.filter(c=>!isTag(c,'Resolution')&&!isTag(c,'Closure'));
  const firstAssign=assigns[0]?new Date(assigns[0].created_at):null;
  const before=plain.filter(c=>!firstAssign||new Date(c.created_at)<firstAssign),after=plain.filter(c=>firstAssign&&new Date(c.created_at)>=firstAssign);
  const updates=[...moves.map(h=>({t:h.created_at,who:route(h),text:ACTION_LABEL[h.action]+(h.comments?': '+h.comments:'')})),...after.map(c=>({t:c.created_at,who:MG.role(c.context?.role),text:c.comment_text}))].sort((a,b)=>new Date(a.t)-new Date(b.t));
  const A=MG.isActive(s),later=['resolved','closed'].includes(s);
  const st=(k)=>({
    reported:'done',submitted:'done',
    reviewed:['open','under_review'].includes(s)?'current':'done',
    assigned:assigns.length||['action_assigned','resolved','closed'].includes(s)?'done':(later||s==='escalated'?'skipped':'pending'),
    action:s==='action_assigned'?'current':(updates.length||later?'done':'pending'),
    escalated:s==='escalated'?'current':escs.length?'done':'skipped',
    resolved:inc.resolved_at||later?'done':'pending',
    closed:inc.closed_at||s==='closed'?'done':(s==='resolved'?'current':'pending')
  })[k];
  const mk=(key,title,icon,extra)=>({key,title,icon,state:st(key),events:[],...extra});
  const steps=[
    mk('reported','Incident Reported','file',{at:inc.created_at,who:(inc.reporter_name||'Reporter')+(inc.discipline?' · '+inc.discipline:''),action:'Report filed · '+(inc.category||'Incident')+(inc.incident_type&&inc.incident_type!==inc.category?' · '+inc.incident_type:''),remark:inc.description,attach:photosOf(inc).length,occurred:[inc.date_of_incident,inc.time_of_incident&&String(inc.time_of_incident).slice(0,5)].filter(Boolean).join(' ')}),
    mk('submitted','Submitted for Review','send',{at:sub?sub.created_at:inc.created_at,who:sub?route(sub):'Routed to '+MG.role('MINE_MANAGER'),action:'Forwarded to the Mine Manager for review and closure'}),
    mk('reviewed','Incident Reviewed','eye',{at:null,who:MG.role('MINE_MANAGER'),action:s==='open'?'Awaiting review':s==='under_review'?'Review in progress':'Review completed',remark:before.map(c=>c.comment_text).join('\n\n'),events:before.map(c=>({t:c.created_at,who:MG.role(c.context?.role),text:c.comment_text}))}),
    mk('assigned','Action Assigned','user',{at:assigns[0]?.created_at||null,who:assigns[0]?route(assigns[0]):'',action:assigns.length?'Corrective action assigned'+(assigns.length>1?' ('+assigns.length+' times)':''):'No assignment recorded',remark:assigns.map(h=>h.comments).filter(Boolean).join('\n\n')}),
    mk('action','Action Taken / Updated','activity',{at:updates.length?updates[updates.length-1].t:null,who:updates.length?updates[updates.length-1].who:'',action:updates.length?updates.length+' update'+(updates.length>1?'s':'')+' recorded':(s==='action_assigned'?'Action in progress':'No updates yet'),events:updates}),
    mk('escalated','Incident Escalated','flag',{at:escs[0]?.created_at||null,who:escs.length?route(escs[escs.length-1]):'',action:escs.length?'Escalated to '+[...new Set(escs.map(h=>MG.role(h.to_role)))].join(' → '):'Optional · not escalated',remark:escs.length>1?'':escs.map(h=>h.comments).filter(Boolean).join('\n\n'),events:escs.length>1?escs.map(h=>({t:h.created_at,who:route(h),text:h.comments||'Escalated'})):[]}),
    mk('resolved','Incident Resolved','checkc',{at:inc.resolved_at||null,who:inc.resolved_at||later?MG.role('MINE_MANAGER'):'',action:inc.resolved_at||later?'Marked resolved':'Pending resolution',remark:resC.length?stripTag(resC[resC.length-1].comment_text):''}),
    mk('closed','Incident Closed','lock',{at:inc.closed_at||null,who:inc.closed_at||s==='closed'?MG.role('MINE_MANAGER'):'',action:s==='closed'?'Closed':s==='resolved'?'Awaiting closure':'Pending closure',remark:cloC.length?stripTag(cloC[cloC.length-1].comment_text):''})
  ];
  const cur=steps.find(x=>x.state==='current');if(cur&&MG.isOverdue(inc))cur.state='overdue';
  if(A&&!cur){const p=steps.find(x=>x.state==='pending');if(p&&MG.isOverdue(inc))p.state='overdue'}
  return steps;
};

/* ====================================================================== */
/* Detail view                                                             */
/* ====================================================================== */
const LADDER=[['Safety Officer','file'],['Mine Manager','user'],['Area Safety Officer','shield'],['HQ Safety','flag']];
const rung=r=>r==='HQ_SAFETY_HEAD'?3:r==='AREA_SAFETY_OFFICER'?2:['MINE_MANAGER','LOCAL_SUPERVISOR','LOCAL_ENGINEER'].includes(r)?1:0;
function ladderHtml(inc,resp,hist){
  const closed=inc.status==='closed',cur=closed?-1:rung(resp.role),reached=Math.max(1,cur,...(hist||[]).filter(h=>h.action==='ESCALATE').map(h=>rung(h.to_role)));
  const note=closed?'Closed':reached>1&&cur<reached?'Returned to '+MG.role(resp.role):reached>1?'Escalated to '+LADDER[reached][0]:'Not escalated · with the Mine Manager';
  return '<section class="card ladder-card" aria-label="Reporting and escalation path"><div class="card-h"><div><h3>Reporting &amp; escalation path</h3><p class="sub">'+esc(note)+'</p></div></div><ol class="ladder">'
   +LADDER.map(([l],i)=>'<li class="'+(i===cur?'cur':i<=reached?'done':'')+(i>reached&&!closed?' future':'')+'"><span class="dotl">'+(i===cur?MG.icon(LADDER[i][1]):i<=reached?MG.icon('check'):'')+'</span><b>'+esc(l)+'</b><small>'+(i===cur?'Currently here':i===0?'Reports':i===1?'Reviews &amp; closes':i===2?'Escalation level 1':'Escalation level 2')+'</small></li>').join('')+'</ol></section>';
}
const fact=(l,v,wide)=>'<div class="fact'+(wide?' wide':'')+'"><small>'+esc(l)+'</small><b>'+esc(v===0?'0':v||'—')+'</b></div>';
function stepHtml(x,i){
  const time=x.at?MG.dateTime(x.at):x.state==='pending'||x.state==='skipped'?'':'Time not recorded';
  const od=x.state==='overdue'?'<span class="pill" style="--c:#dc2626;--bg-c:#fee2e2">Overdue · '+MG.duration(MG.ageHours(S._inc)||0)+' open</span>':'';
  const kv=[['Date',x.at?MG.dateTime(x.at):'Not recorded'],x.occurred?['Occurred',x.occurred]:null,['Responsible',x.who||'—'],['Action',x.action||'—'],x.remark?['Remarks','<div class="tl-remark">'+esc(x.remark)+'</div>',1]:null,x.attach?['Attachments',x.attach+' photo'+(x.attach>1?'s':'')+' · see Evidence']:null].filter(Boolean);
  const ev=x.events&&x.events.length?'<div class="tl-kv"><small>Updates</small><div class="log">'+x.events.map(e=>'<div class="log-item"><i></i><div><b>'+esc(e.who||'')+'</b> <time>'+esc(MG.dateTime(e.t))+'</time><p>'+esc(e.text)+'</p></div></div>').join('')+'</div></div>':'';
  return '<div class="tl-item '+x.state+'" id="step-'+x.key+'" data-step="'+x.key+'"><div class="tl-dot">'+(x.state==='done'?MG.icon('check'):MG.icon(x.icon))+'</div><div class="tl-card" tabindex="0" role="button" aria-expanded="false"><div class="tl-top"><span class="tl-title">'+(i+1)+'. '+esc(x.title)+'</span><span style="display:flex;gap:8px;align-items:center">'+od+'<span class="tl-time">'+esc(time||(x.state==='skipped'?'Optional':'Pending'))+'</span></span></div><div class="tl-sum">'+esc([x.who,x.action].filter(Boolean).join(' · '))+'</div><div class="tl-more">'+kv.map(([k,v,raw])=>'<div class="tl-kv"><small>'+esc(k)+'</small><div>'+(raw?v:esc(v))+'</div></div>').join('')+ev+'</div></div></div>';
}
function logItems(det){
  const items=[...(det.forwarding_history||[]).map(h=>({t:h.created_at,c:false,head:ACTION_LABEL[h.action]||MG.nice(h.action),who:route(h),text:h.comments})),
    ...(det.comments||[]).map(c=>({t:c.created_at,c:true,head:isTag(c,'Resolution')?'Resolution note':isTag(c,'Closure')?'Closure note':'Remark',who:(c.author_id===S.user.id?'You · ':'')+MG.role(c.context?.role),text:stripTag(c.comment_text)}))].sort((a,b)=>new Date(b.t)-new Date(a.t));
  return items.length?'<div class="log">'+items.map(i=>'<div class="log-item '+(i.c?'c':'')+'"><i></i><div><b>'+esc(i.head)+'</b> · <span class="muted">'+esc(i.who)+'</span> <time>'+esc(MG.dateTime(i.t))+'</time>'+(i.text?'<p>'+esc(i.text)+'</p>':'')+'</div></div>').join('')+'</div>':'<p class="muted small">No remarks or workflow activity recorded yet.</p>';
}

V.incident={
  async render(host,{id,mine}){
    host.innerHTML='<div class="card">'+MG.skeleton(1,60)+'</div><div class="grid g-wide" style="margin-top:16px"><div class="card">'+MG.skeleton(5,70)+'</div><div class="card">'+MG.skeleton(3,90)+'</div></div>';
    let det;try{det=await D.detail(id,{force:true,mine})}catch(e){host.innerHTML='<div class="banner error">'+MG.icon('alert')+'<span>'+esc(e.message)+'</span><button class="btn btn-secondary btn-sm" id="retry">Retry</button></div>';host.querySelector('#retry').onclick=()=>V.incident.render(host,{id,mine});return}
    const inc=det.incident;S._inc=inc;MG.setCrumbs&&MG.setCrumbs([{label:'Incidents',href:mine?'/my-reports':'/incidents'},{label:inc.incident_ref||'Incident'}],true);
    const steps=MG.lifecycle(inc,det.comments,det.forwarding_history),resp=D.responsible(inc,det.forwarding_history),pend=D.pendingLabel(inc),photos=photosOf(inc),ro=MG.can.isMineSO();
    const mineN=D.mineName(inc.mine_id)||inc.mine_name||'',areaN=D.areaName(inc.area_id)||inc.area_name||'';
    host.innerHTML=
     '<button class="btn btn-ghost btn-sm back" id="back">'+MG.icon('left')+' Back</button>'
    +'<div class="card" style="margin-bottom:16px;border-left:4px solid '+(MG.STATUS[inc.status]?.color||'#94a3b8')+'"><div class="inc-head" style="margin:0"><div><span class="inc-id">'+esc(inc.incident_ref||'Reference pending')+'</span><h2>'+esc(inc.incident_type||inc.category||'Incident')+'</h2><div class="row">'+MG.statusPill(inc.status)+MG.sevHtml(inc.severity)+MG.catTag(inc.category)+(mineN?'<span class="tag">'+MG.icon('pin')+esc([mineN,areaN].filter(Boolean).join(' · '))+'</span>':'')+'<span class="pending-flag '+pend.cls+'">'+(pend.cls==='done'?MG.icon('check'):'<span class="pulse"></span>')+esc(pend.text)+'</span></div><p class="small muted" style="margin-top:10px">Responsible: <b style="color:var(--ink-2)">'+esc(resp.text)+'</b> · Reported '+esc(MG.dateTime(inc.created_at))+' ('+esc(MG.relTime(inc.created_at))+')</p></div><div class="action-bar" id="actions"></div></div></div>'
    +ladderHtml(inc,resp,det.forwarding_history)+'<div class="stepper" id="stepper" aria-label="Incident progress">'+steps.map(x=>'<button type="button" class="sp '+x.state+'" data-go="'+x.key+'">'+esc(x.title.replace('Incident ',''))+'</button>').join('')+'</div>'
    +'<div class="grid g-wide"><section class="card"><div class="card-h"><div><h3>Incident lifecycle</h3><p class="sub">Select a stage to see who acted, when, and what was recorded</p></div></div><div class="tl" id="tl">'+steps.map(stepHtml).join('')+'</div></section>'
    +'<div class="grid" style="align-content:start"><section class="card"><div class="card-h"><div><h3>Report details</h3></div></div><div class="facts">'+[fact('Description',inc.description,1),fact('Immediate actions taken',inc.immediate_actions,1),fact('Category',inc.category),fact('Incident type',inc.incident_type),fact('Discipline',inc.discipline),fact('Severity',MG.sevMeta(inc.severity).label),fact('Date of incident',inc.date_of_incident?MG.date(inc.date_of_incident):''),fact('Time',inc.time_of_incident&&String(inc.time_of_incident).slice(0,5)),fact('Location',inc.location_zone),fact('Level / zone detail',inc.location_detail),fact('Persons injured',inc.persons_injured),fact('Supervisor on duty',inc.supervisor_on_duty),fact('PPE worn',MG.nice(inc.ppe_worn||'')),fact('SOP followed',MG.nice(inc.sop_followed||'')),fact('Witnesses',inc.witnesses,1)].join('')+'</div></section>'
    +'<section class="card"><div class="card-h"><div><h3>Evidence</h3><p class="sub">'+(photos.length?photos.length+' photo'+(photos.length>1?'s':'')+' attached at reporting':'No photos attached')+'</p></div></div>'+(photos.length?'<div class="gallery">'+photos.map((p,i)=>'<button type="button" data-ph="'+i+'" aria-label="Open photo '+(i+1)+'"><img alt="Incident evidence '+(i+1)+'" src="'+p.data+'"></button>').join('')+'</div>':'<p class="muted small">Photos added when the incident was reported appear here.</p>')+'</section>'
    +'<section class="card"><div class="card-h"><div><h3>Activity &amp; remarks</h3><p class="sub">Complete history, preserved for audit</p></div></div>'+(ro?'':'<form id="cf" class="composer"><div class="field"><label for="cmt">'+(MG.can.isHQ()?'Management direction / action request':'Add remark')+'</label><textarea class="textarea" id="cmt" maxlength="10000" required placeholder="'+(MG.can.isHQ()?'Direction or action request…':'Observation, update or instruction…')+'"></textarea></div><div><button class="btn btn-primary btn-sm" type="submit">'+(MG.can.isHQ()?'Send action request':'Post remark')+'</button></div></form><hr style="border:0;border-top:1px solid var(--line);margin:16px 0">')+'<div id="logHost">'+logItems(det)+'</div></section></div></div>';
    const $=s=>host.querySelector(s);
    $('#back').onclick=()=>MG.back(mine?'/my-reports':'/incidents');
    host.querySelectorAll('.tl-card').forEach(c=>{const t=()=>{const it=c.closest('.tl-item'),o=it.classList.toggle('open');c.setAttribute('aria-expanded',o)};c.onclick=t;c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();t()}}});
    const curItem=host.querySelector('.tl-item.current,.tl-item.overdue');if(curItem){curItem.classList.add('open');curItem.querySelector('.tl-card').setAttribute('aria-expanded','true')}
    host.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const it=$('#step-'+b.dataset.go);it.classList.add('open');it.scrollIntoView({behavior:'smooth',block:'center'})});
    host.querySelectorAll('[data-ph]').forEach(b=>b.onclick=()=>MG.lightbox(photos[Number(b.dataset.ph)].data));
    const reload=async()=>{D.invalidate(id);await V.incident.render(host,{id,mine})};
    if($('#cf'))$('#cf').onsubmit=e=>{e.preventDefault();MG.busy(e.submitter,async()=>{await MG.api('/api/safety/incidents/'+inc.id+'/comments',{method:'POST',body:JSON.stringify({comment_text:$('#cmt').value})});MG.toast('Remark added');await reload()})};
    if(!ro)renderActions($('#actions'),inc,det,reload);
  }
};

/* ====================================================================== */
/* Workflow actions                                                        */
/* ====================================================================== */
function renderActions(host,inc,det,reload){
  const hq=MG.can.isHQ();if(!MG.can.manage()&&!hq)return;
  const s=inc.status,can=to=>MG.TRANSITIONS[s].includes(to),mgr=MG.can.isManager(),btns=[];
  if(s==='closed'){host.innerHTML='<span class="tag">'+MG.icon('lock')+' Closed · history is read-only</span>';return}
  if(s==='open')btns.push(['review','eye','Start review','btn-secondary']);
  if(['under_review','action_assigned'].includes(s))btns.push(['assign','user',s==='action_assigned'?'Update / reassign action':'Assign action','btn-accent']);
  btns.push(['transfer','send','Transfer','btn-secondary']);
  if(MG.can.escalate(s))btns.push(['escalate','flag',mgr?'Escalate to ASO':'Escalate to HQ','btn-danger']);
  if(mgr&&['action_assigned','escalated'].includes(s))btns.push(['resolve','checkc','Resolve','btn-primary']);
  if(mgr&&s==='resolved')btns.push(['close','lock','Close incident','btn-primary']);
  if(['action_assigned','escalated','resolved'].includes(s))btns.push(['return','undo','Return to review','btn-ghost']);
  if(hq){btns.length=0;if(MG.isActive(s))btns.push(['transfer','send','Return to Area / Mine','btn-primary'])}
  host.innerHTML=btns.map(([k,i,l,c])=>'<button class="btn '+c+'" data-act="'+k+'">'+MG.icon(i)+esc(l)+'</button>').join('');
  host.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>MG.busy(b,async()=>{
    const k=b.dataset.act;
    if(k==='review')return statusFlow(inc,'under_review','Start review','Mark this incident as under review. You can assign corrective action afterwards.',reload);
    if(k==='return')return statusFlow(inc,'under_review','Return to review','Move this incident back to Under Review for further assessment.',reload);
    if(k==='resolve'||k==='close')return closeFlow(inc,det,k,reload);
    const recs=(await MG.api('/api/safety/recipients?incident_id='+encodeURIComponent(inc.id))).recipients||[];
    forwardFlow(inc,det,k,recs,reload);
  }));
}
const recipientsFor=(recs,action)=>{const R=roles=>recs.filter(r=>roles.includes(r.role));
  if(MG.can.isHQ())return R(['AREA_SAFETY_OFFICER','MINE_MANAGER']);
  if(MG.can.isManager())return action==='ESCALATE'?R(['AREA_SAFETY_OFFICER']):R(['LOCAL_SUPERVISOR','LOCAL_ENGINEER']);
  return action==='ESCALATE'?R(['HQ_SAFETY_HEAD']):R(['MINE_MANAGER','LOCAL_SUPERVISOR','LOCAL_ENGINEER'])};
const sumRows=rows=>'<div class="summary-box">'+rows.map(([k,v])=>'<div><small>'+esc(k)+'</small><b style="text-align:right;max-width:65%;overflow-wrap:anywhere">'+esc(v||'—')+'</b></div>').join('')+'</div>';
const header=inc=>'<div class="summary-box"><div><small>Incident</small><b>'+esc(inc.incident_ref||'')+'</b></div><div><small>Current status</small>'+MG.statusPill(inc.status)+'</div></div>';

/* Two-phase drawer: form → review & confirm → submit */
function twoPhase({title,sub,form,collect,review,confirmLabel,submit,tone='btn-primary'}){
  const ctl=MG.drawer({title,sub,body:'<div class="ph1" style="display:grid;gap:16px">'+form+'</div><div class="ph2 hidden" style="display:grid;gap:16px"></div>',footer:'<button class="btn btn-ghost" data-cancel>Cancel</button><button class="btn btn-primary" data-next>Review</button>'});
  const el=ctl.el,p1=el.querySelector('.ph1'),p2=el.querySelector('.ph2'),foot=ctl.footer;let data=null;
  const phase1=()=>{p1.classList.remove('hidden');p2.classList.add('hidden');foot.innerHTML='<button class="btn btn-ghost" data-cancel>Cancel</button><button class="btn btn-primary" data-next>Review</button>';wire()};
  const wire=()=>{foot.querySelector('[data-cancel]').onclick=ctl.close;
    const nx=foot.querySelector('[data-next]');if(nx)nx.onclick=()=>{const r=collect(el);if(r.error){MG.toast(r.error,'err');return}data=r.data;p1.classList.add('hidden');p2.classList.remove('hidden');p2.innerHTML=review(data);foot.innerHTML='<button class="btn btn-ghost" data-back>Back</button><button class="btn '+tone+'" data-confirm>'+esc(confirmLabel)+'</button>';foot.querySelector('[data-back]').onclick=phase1;foot.querySelector('[data-confirm]').onclick=e=>MG.busy(e.currentTarget,async()=>{await submit(data);ctl.close()})}};
  wire();return ctl;
}
const optList=(name,items)=>'<div class="opt-list">'+items.map((r,i)=>'<label class="opt"><input type="radio" name="'+name+'" value="'+esc(r.id)+'" '+(i===0?'checked':'')+'><span><b>'+esc(r.name)+'</b><br><span class="small muted">'+esc(MG.role(r.role))+(r.worker_id?' · ID '+esc(r.worker_id):'')+'</span></span></label>').join('')+'</div>';
const syncOpts=el=>el.querySelectorAll('.opt').forEach(o=>{const i=o.querySelector('input');const f=()=>el.querySelectorAll('.opt').forEach(x=>x.classList.toggle('sel',x.querySelector('input').checked));i.addEventListener('change',f);f()});

function forwardFlow(inc,det,kind,recs,reload){
  const s=inc.status,resp=D.responsible(inc,det.forwarding_history);
  const cfg={transfer:MG.can.isHQ()?{title:'Return incident to Area / Mine',action:'FORWARD',verb:'Return',ph:'Direction for the receiving officer (optional)…',req:false,tone:'btn-primary'}:{title:'Transfer incident',action:'FORWARD',verb:'Transfer',ph:'Why is this incident being transferred? (optional)',req:false,tone:'btn-primary'},
    assign:{title:s==='action_assigned'?'Update / reassign action':'Assign corrective action',action:s==='action_assigned'?'REASSIGN':'ASSIGN',verb:'Assign',ph:'Describe the corrective action required…',req:false,tone:'btn-accent'},
    escalate:{title:MG.can.isArea()?'Escalate to HQ':'Escalate to Area Safety Officer',action:'ESCALATE',verb:'Escalate',ph:'Reason for escalation (required)…',req:true,tone:'btn-danger'}}[kind];
  const list=recipientsFor(recs,cfg.action);
  if(!list.length){MG.drawer({title:cfg.title,body:header(inc)+'<div class="banner warn">'+MG.icon('info')+'<span>'+(cfg.action==='ESCALATE'&&MG.can.isArea()?'No active HQ Safety user is configured to receive escalations.':'No authorized recipient is available for this action in your current hierarchy.')+'</span></div>'});return}
  const actionPick=kind==='assign'&&s==='action_assigned'?'<div class="field"><label>Action</label><div class="seg" id="actPick"><button type="button" class="active" data-a="REASSIGN">Reassign</button><button type="button" data-a="ASSIGN">Assign again</button></div></div>':'';
  const ctl=twoPhase({title:cfg.title,sub:esc(inc.incident_ref||''),tone:cfg.tone,confirmLabel:'Confirm '+cfg.verb.toLowerCase(),
    form:header(inc)+'<div class="summary-box"><div><small>Current responsible authority</small><b>'+esc(resp.text)+'</b></div></div>'+actionPick+'<div class="field"><label>Destination · authorized recipients</label>'+optList('rcp',list)+'</div><div class="field"><label for="fRem">'+(cfg.req?'Escalation remarks':'Remarks')+'</label><textarea class="textarea" id="fRem" maxlength="5000" placeholder="'+esc(cfg.ph)+'"></textarea></div>',
    collect:el=>{const sel=el.querySelector('input[name=rcp]:checked');const rem=el.querySelector('#fRem').value.trim();if(!sel)return {error:'Select a recipient'};if(cfg.req&&!rem)return {error:'Escalation remarks are required'};const act=el.querySelector('#actPick .active')?.dataset.a||cfg.action;const r=list.find(x=>x.id===sel.value);return {data:{to:r,comments:rem,action:act}}},
    review:d=>'<p class="muted small">Please confirm. This is recorded permanently in the incident history.</p>'+sumRows([['Incident',inc.incident_ref],['Action',ACTION_LABEL[d.action]||d.action],['From',resp.text],['To',d.to.name+' · '+MG.role(d.to.role)],['Remarks',d.comments||'None']]),
    submit:async d=>{await MG.api('/api/safety/incidents/'+inc.id+'/forward',{method:'POST',body:JSON.stringify({to_user_id:d.to.id,action:d.action,comments:d.comments})});MG.toast(cfg.verb+' recorded');await reload()}});
  syncOpts(ctl.el);const ap=ctl.el.querySelector('#actPick');if(ap)ap.querySelectorAll('button').forEach(b=>b.onclick=()=>{ap.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b))});
}

function statusFlow(inc,target,title,blurb,reload){
  twoPhase({title,sub:esc(inc.incident_ref||''),confirmLabel:'Confirm',
    form:header(inc)+'<p class="muted">'+esc(blurb)+'</p><div class="field"><label for="sRem">Remark (optional)</label><textarea class="textarea" id="sRem" maxlength="5000"></textarea></div>',
    collect:el=>({data:{remark:el.querySelector('#sRem').value.trim()}}),
    review:d=>sumRows([['Incident',inc.incident_ref],['Status change',MG.STATUS[inc.status].label+' → '+MG.STATUS[target].label],['Remark',d.remark||'None']]),
    submit:async d=>{await MG.api('/api/safety/incidents/'+inc.id+'/status',{method:'PATCH',body:JSON.stringify({status:target})});if(d.remark){try{await MG.api('/api/safety/incidents/'+inc.id+'/comments',{method:'POST',body:JSON.stringify({comment_text:d.remark})})}catch{MG.toast('Status updated, but the remark could not be saved','err')}}MG.toast('Status updated to '+MG.STATUS[target].label);await reload()}});
}

function closeFlow(inc,det,kind,reload){
  const target=kind==='resolve'?'resolved':'closed',verb=kind==='resolve'?'Resolve':'Close',tag=kind==='resolve'?'Resolution':'Closure';
  const taken=(det.forwarding_history||[]).map(h=>'<div class="log-item"><i></i><div><b>'+esc(ACTION_LABEL[h.action]||h.action)+'</b> · <span class="muted">'+esc(route(h))+'</span> <time>'+esc(MG.dateTime(h.created_at))+'</time>'+(h.comments?'<p>'+esc(h.comments)+'</p>':'')+'</div></div>').join('')||'<p class="muted small">No workflow actions recorded.</p>';
  const prior=(det.comments||[]).find(c=>isTag(c,'Resolution'));const ph=photosOf(inc).length;
  twoPhase({title:verb+' incident',sub:esc(inc.incident_ref||''),confirmLabel:'Confirm '+verb.toLowerCase(),
    form:header(inc)+'<div class="field"><label>Actions taken so far</label><div class="log" style="border:1px solid var(--line);border-radius:12px;padding:4px 12px;max-height:190px;overflow:auto">'+taken+'</div></div>'
      +(kind==='close'&&prior?'<div class="field"><label>Resolution note</label><div class="tl-remark">'+esc(stripTag(prior.comment_text))+'</div></div>':'')
      +'<div class="field"><label for="cMeas">Corrective measures '+(kind==='resolve'?'(required)':'')+'</label><textarea class="textarea" id="cMeas" maxlength="4000" placeholder="Measures implemented to prevent recurrence…"></textarea></div><div class="field"><label for="cRem">Closure remarks (required)</label><textarea class="textarea" id="cRem" maxlength="4000" placeholder="Final observations and conclusion…"></textarea></div>'
      +'<div class="field"><label>Supporting evidence</label><p class="small muted">'+(ph?ph+' photo'+(ph>1?'s':'')+' from the original report remain attached to this incident.':'No photos were attached to the original report.')+' Evidence can only be added when an incident is reported.</p></div>'
      +'<label class="check"><input type="checkbox" id="cOk"><span>I confirm the corrective measures are complete and this incident can be '+(kind==='resolve'?'marked resolved':'closed')+'.</span></label>',
    collect:el=>{const m=el.querySelector('#cMeas').value.trim(),r=el.querySelector('#cRem').value.trim();if(kind==='resolve'&&!m)return {error:'Describe the corrective measures'};if(!r)return {error:'Closure remarks are required'};if(!el.querySelector('#cOk').checked)return {error:'Please tick the confirmation'};return {data:{m,r}}},
    review:d=>'<p class="muted small">Please confirm the '+verb.toLowerCase()+'. This is recorded permanently.</p>'+sumRows([['Incident',inc.incident_ref],['Status change',MG.STATUS[inc.status].label+' → '+MG.STATUS[target].label],['Corrective measures',d.m||'—'],['Remarks',d.r]]),
    tone:'btn-primary',
    submit:async d=>{await MG.api('/api/safety/incidents/'+inc.id+'/status',{method:'PATCH',body:JSON.stringify({status:target})});
      try{await MG.api('/api/safety/incidents/'+inc.id+'/comments',{method:'POST',body:JSON.stringify({comment_text:'['+tag+'] '+(d.m?'Corrective measures: '+d.m+'\n':'')+'Remarks: '+d.r})})}catch{MG.toast('Status updated, but the closure notes could not be saved','err')}
      MG.toast('Incident '+(kind==='resolve'?'resolved':'closed'));await reload()}});
}
})();
