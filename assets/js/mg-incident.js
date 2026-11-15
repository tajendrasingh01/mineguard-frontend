/* Incident management: feed, details, lifecycle timeline and guided workflows.
   Workflow actions call POST /api/safety/incidents/:id/workflow; the API enforces who may do what. */
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
const KIND_HEAD={report_submitted:'Reported · sent to Mine Manager',review_to_so:'Reviewed · sent to Safety Officer',action_taken:'Action taken · returned to Mine Manager',escalation_request:'Escalation requested by Safety Officer',escalation:'Escalated by Mine Manager',recommendation:'Recommendation given',closure:'Closed by Mine Manager'};
const kindOf=h=>h&&h.context&&h.context.kind||null;
const lvl=l=>l==='HQ'?'HQ':l==='ASO'?'the Area Safety Officer (ASO)':'a senior authority';
function evText(h){
  const c=h.context||{},k=kindOf(h),p=[];
  if(k==='review_to_so'){if(c.remarks)p.push('Remarks: '+c.remarks);if(c.recommendations)p.push('Recommendations: '+c.recommendations)}
  else if(k==='action_taken')p.push('Action taken: '+(c.actions||h.comments||''));
  else if(k==='escalation_request')p.push('Requested escalation to '+lvl(c.level)+'. Justification: '+(c.justification||h.comments||''));
  else if(k==='escalation')p.push('Escalated to '+lvl(c.level)+'. Remarks: '+(c.remarks||h.comments||''));
  else if(k==='recommendation')p.push('Recommendations: '+(c.recommendations||h.comments||''));
  else if(k==='closure')p.push('Closing remarks: '+(c.remarks||h.comments||''));
  else if(k==='report_submitted')p.push('Submitted for Mine Manager review');
  else if(h.comments)p.push(h.comments);
  return p.join('\n');
}
const headOf=h=>KIND_HEAD[kindOf(h)]||ACTION_LABEL[h.action]||MG.nice(h.action);
const photosOf=inc=>{try{const p=typeof inc.photos==='string'?JSON.parse(inc.photos):inc.photos;return Array.isArray(p)?p.filter(x=>x&&typeof x.data==='string'&&x.data.startsWith('data:image/')):[]}catch{return[]}};
const route=h=>MG.role(h.from_role)+' → '+MG.role(h.to_role);
const lastKind=(det,...k)=>[...(det.forwarding_history||[])].sort(byTime).reverse().find(h=>k.includes(kindOf(h)));
MG.lifecycle=function(inc,comments,history){
  const s=inc.status,stage=MG.stageOf(inc),hist=[...(history||[])].sort(byTime);
  const K=(...k)=>hist.filter(h=>k.includes(kindOf(h)));
  const sub=K('report_submitted')[0]||hist.find(h=>!kindOf(h)&&h.action==='FORWARD'&&h.to_role==='MINE_MANAGER');
  const reviews=K('review_to_so'),acts=K('action_taken','escalation_request'),escs=K('escalation','recommendation'),clos=K('closure');
  const ev=hs=>hs.map(h=>({t:h.created_at,who:route(h),text:evText(h)}));
  const last=hs=>hs.length?hs[hs.length-1]:null;
  const legacy=hist.filter(h=>!kindOf(h)&&h!==sub);
  const reviewCur=['reported','manager_review','recommended','escalation_requested'].includes(stage);
  const state={
    reported:'done',submitted:'done',
    review:reviewCur?'current':(reviews.length||['with_so','awaiting_closure','closed'].includes(stage)?'done':'pending'),
    action:stage==='with_so'?'current':(acts.length?'done':(s==='closed'?'skipped':'pending')),
    escalation:['with_aso','with_hq'].includes(stage)?'current':(escs.length?'done':'skipped'),
    closure:stage==='closed'?'done':stage==='awaiting_closure'?'current':'pending'
  };
  const mk=(key,title,short,icon,extra)=>({key,title,short,icon,state:state[key],events:[],...extra});
  const steps=[
    mk('reported','Incident Reported','Reported','file',{at:inc.created_at,who:(inc.reporter_name||'Safety Officer')+(inc.discipline?' · '+inc.discipline:''),action:'Report filed · '+(inc.category||'Incident')+(inc.incident_type&&inc.incident_type!==inc.category?' · '+inc.incident_type:''),remark:inc.description,attach:photosOf(inc).length,occurred:[inc.date_of_incident,inc.time_of_incident&&String(inc.time_of_incident).slice(0,5)].filter(Boolean).join(' ')}),
    mk('submitted','Sent to Mine Manager','Sent','send',{at:sub?sub.created_at:inc.created_at,who:sub?route(sub):'Routed to '+MG.role('MINE_MANAGER'),action:'Appeared in the Mine Manager\'s dashboard with a new-incident notification'}),
    mk('review','Mine Manager Review','MM review','eye',{at:last(reviews)?last(reviews).created_at:null,who:MG.role('MINE_MANAGER'),action:reviewCur?(stage==='escalation_requested'?'Decide on the Safety Officer\'s escalation request':stage==='recommended'?'Act on the ASO / HQ recommendation':'Awaiting review, remarks and recommendations'):reviews.length?'Remarks and recommendations sent to the Safety Officer'+(reviews.length>1?' ('+reviews.length+' rounds)':''):'Pending',remark:last(reviews)?evText(last(reviews)):'',events:reviews.length>1?ev(reviews):[]}),
    mk('action','Safety Officer Action','SO action','activity',{at:last(acts)?last(acts).created_at:null,who:last(acts)?route(last(acts)):MG.role(inc.discipline==='Electrical & Mechanical'?'MINE_SO_EM':'MINE_SO_MINING'),action:stage==='with_so'?'Action required: record action taken, or request escalation':acts.length?headOf(last(acts)):(s==='closed'?'Not required':'Pending Mine Manager review'),remark:last(acts)?evText(last(acts)):'',events:acts.length>1?ev(acts):[]}),
    mk('escalation','Escalation (if required)','Escalation','flag',{at:escs.length?escs[0].created_at:null,who:escs.length?route(last(escs)):'',action:['with_aso','with_hq'].includes(stage)?'With '+(stage==='with_hq'?'HQ':'the Area Safety Officer')+' for recommendation':escs.length?'ASO / HQ involvement recorded':'Optional · only the Mine Manager can escalate',events:ev([...escs,...K('escalation_request')].sort(byTime))}),
    mk('closure','Final Review & Closure','Closure','lock',{at:inc.closed_at||null,who:MG.role('MINE_MANAGER'),action:s==='closed'?'Closed by the Mine Manager':stage==='awaiting_closure'?'Awaiting final review and closure':'Only the Mine Manager can close an incident',remark:last(clos)?evText(last(clos)):''})
  ];
  if(legacy.length)steps[2].events=[...steps[2].events,...ev(legacy)];
  const cur=steps.find(x=>x.state==='current');if(cur&&MG.isOverdue(inc))cur.state='overdue';
  return steps;
};

/* ====================================================================== */
/* Detail view                                                             */
/* ====================================================================== */
const LADDER=[['Safety Officer','file','Reports & takes action'],['Mine Manager','user','Reviews, escalates & closes'],['Area Safety Officer','shield','Recommends'],['HQ Safety','flag','Recommends']];
const rung=r=>r==='HQ_SAFETY_HEAD'?3:r==='AREA_SAFETY_OFFICER'?2:r==='MINE_MANAGER'?1:0;
function ladderHtml(inc,resp,hist){
  const closed=inc.status==='closed',cur=closed?-1:rung(resp.role),esc2=(hist||[]).filter(h=>kindOf(h)==='escalation').map(h=>rung(h.to_role)),reached=Math.max(1,cur,...esc2);
  const st=MG.stageOf(inc),note=closed?'Closed by the Mine Manager':reached>1&&cur===1?'Recommendation stage · back with the Mine Manager':reached>1&&cur>1?'Escalated by the Mine Manager to '+LADDER[cur][0]:st==='with_so'?'With the Safety Officer for action':'Not escalated · with the Mine Manager';
  return '<section class="card ladder-card" aria-label="Reporting and escalation path"><div class="card-h"><div><h3>Reporting &amp; escalation path</h3><p class="sub">'+esc(note)+'</p></div></div><ol class="ladder">'
   +LADDER.map(([l,ic,role],i)=>'<li class="'+(i===cur?'cur':i<=reached?'done':'')+(i>reached&&!closed?' future':'')+'"><span class="dotl">'+(i===cur?MG.icon(ic):i<=reached?MG.icon('check'):'')+'</span><b>'+esc(l)+'</b><small>'+(i===cur?'Currently here':role)+'</small></li>').join('')+'</ol></section>';
}
/* What the viewer needs to know before acting: the latest instruction or request addressed to them. */
function contextBanner(inc,det){
  const u=S.user,st=MG.stageOf(inc);if(inc.status==='closed')return '';
  const box=(title,h)=>h?'<div class="banner info wf-note">'+MG.icon('info')+'<div><b>'+esc(title)+'</b><p>'+esc(evText(h)).replace(/\n/g,'<br>')+'</p><small>'+esc(route(h))+' · '+esc(MG.dateTime(h.created_at))+'</small></div></div>':'';
  if(MG.can.isMineSO()&&st==='with_so'&&inc.assignee_id===u.id)return box('Mine Manager\'s remarks & recommendations — your action is required',lastKind(det,'review_to_so'));
  if(MG.can.isManager()){
    if(st==='escalation_requested')return box('The Safety Officer has requested escalation',lastKind(det,'escalation_request'));
    if(st==='awaiting_closure')return box('Action taken by the Safety Officer — final review and closure pending',lastKind(det,'action_taken'));
    if(st==='recommended')return box('Recommendation received',lastKind(det,'recommendation'));
  }
  if((MG.can.isArea()||MG.can.isHQ())&&inc.status==='escalated'&&inc.assignee_id===u.id)return box('Escalated to you by the Mine Manager — please give your recommendation',lastKind(det,'escalation'));
  return '';
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
  const items=[...(det.forwarding_history||[]).map(h=>({t:h.created_at,c:false,head:headOf(h),who:route(h),text:evText(h)})),
    ...(det.comments||[]).map(c=>({t:c.created_at,c:true,head:'Remark',who:(c.author_id===S.user.id?'You · ':'')+MG.role(c.context?.role),text:String(c.comment_text||'').replace(/^\[(Resolution|Closure)\]\s*/,'')}))].sort((a,b)=>new Date(b.t)-new Date(a.t));
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
    +contextBanner(inc,det)+ladderHtml(inc,resp,det.forwarding_history)+'<div class="stepper" id="stepper" aria-label="Incident progress">'+steps.map(x=>'<button type="button" class="sp '+x.state+'" data-go="'+x.key+'">'+esc(x.short||x.title)+'</button>').join('')+'</div>'
    +'<div class="grid g-wide"><section class="card"><div class="card-h"><div><h3>Incident lifecycle</h3><p class="sub">Select a stage to see who acted, when, and what was recorded</p></div></div><div class="tl" id="tl">'+steps.map(stepHtml).join('')+'</div></section>'
    +'<div class="grid" style="align-content:start"><section class="card"><div class="card-h"><div><h3>Report details</h3></div></div><div class="facts">'+[fact('Description',inc.description,1),fact('Immediate actions taken',inc.immediate_actions,1),fact('Category',inc.category),fact('Incident type',inc.incident_type),fact('Discipline',inc.discipline),fact('Severity',MG.sevMeta(inc.severity).label),fact('Date of incident',inc.date_of_incident?MG.date(inc.date_of_incident):''),fact('Time',inc.time_of_incident&&String(inc.time_of_incident).slice(0,5)),fact('Location',inc.location_zone),fact('Level / zone detail',inc.location_detail),fact('Persons injured',inc.persons_injured),fact('Supervisor on duty',inc.supervisor_on_duty),fact('PPE worn',MG.nice(inc.ppe_worn||'')),fact('SOP followed',MG.nice(inc.sop_followed||'')),fact('Witnesses',inc.witnesses,1)].join('')+'</div></section>'
    +'<section class="card"><div class="card-h"><div><h3>Evidence</h3><p class="sub">'+(photos.length?photos.length+' photo'+(photos.length>1?'s':'')+' attached at reporting':'No photos attached')+'</p></div></div>'+(photos.length?'<div class="gallery">'+photos.map((p,i)=>'<button type="button" data-ph="'+i+'" aria-label="Open photo '+(i+1)+'"><img alt="Incident evidence '+(i+1)+'" src="'+p.data+'"></button>').join('')+'</div>':'<p class="muted small">Photos added when the incident was reported appear here.</p>')+'</section>'
    +'<section class="card"><div class="card-h"><div><h3>Activity &amp; remarks</h3><p class="sub">Complete history, preserved for audit</p></div></div>'+(ro?'':'<form id="cf" class="composer"><div class="field"><label for="cmt">'+'Add remark'+'</label><textarea class="textarea" id="cmt" maxlength="10000" required placeholder="'+'Observation or update…'+'"></textarea></div><div><button class="btn btn-primary btn-sm" type="submit">'+'Post remark'+'</button></div></form><hr style="border:0;border-top:1px solid var(--line);margin:16px 0">')+'<div id="logHost">'+logItems(det)+'</div></section></div></div>';
    const $=s=>host.querySelector(s);
    $('#back').onclick=()=>MG.back(mine?'/my-reports':'/incidents');
    host.querySelectorAll('.tl-card').forEach(c=>{const t=()=>{const it=c.closest('.tl-item'),o=it.classList.toggle('open');c.setAttribute('aria-expanded',o)};c.onclick=t;c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();t()}}});
    const curItem=host.querySelector('.tl-item.current,.tl-item.overdue');if(curItem){curItem.classList.add('open');curItem.querySelector('.tl-card').setAttribute('aria-expanded','true')}
    host.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const it=$('#step-'+b.dataset.go);it.classList.add('open');it.scrollIntoView({behavior:'smooth',block:'center'})});
    host.querySelectorAll('[data-ph]').forEach(b=>b.onclick=()=>MG.lightbox(photos[Number(b.dataset.ph)].data));
    const reload=async()=>{D.invalidate(id);if(MG.notify)MG.notify.refresh();await V.incident.render(host,{id,mine})};
    if($('#cf'))$('#cf').onsubmit=e=>{e.preventDefault();MG.busy(e.submitter,async()=>{await MG.api('/api/safety/incidents/'+inc.id+'/comments',{method:'POST',body:JSON.stringify({comment_text:$('#cmt').value})});MG.toast('Remark added');await reload()})};
    renderActions($('#actions'),inc,det,reload);
  }
};

/* ====================================================================== */
/* Workflow actions (who may do what is enforced by the API)               */
/* ====================================================================== */
const sumRows=rows=>'<div class="summary-box">'+rows.map(([k,v])=>'<div><small>'+esc(k)+'</small><b style="text-align:right;max-width:65%;overflow-wrap:anywhere">'+esc(v||'—')+'</b></div>').join('')+'</div>';
const header=inc=>'<div class="summary-box"><div><small>Incident</small><b>'+esc(inc.incident_ref||'')+'</b></div><div><small>Current stage</small><b>'+esc((MG.STAGE[MG.stageOf(inc)]||{}).label||MG.STATUS[inc.status].label)+'</b></div></div>';
function renderActions(host,inc,det,reload){
  const u=S.user,role=u.role,s=inc.status,st=MG.stageOf(inc),mine=inc.assignee_id===u.id,btns=[],resp=D.responsible(inc,det.forwarding_history);
  if(s==='closed'){host.innerHTML='<span class="tag">'+MG.icon('lock')+' Closed by the Mine Manager · history is read-only</span>';return}
  if(role==='MINE_MANAGER'){
    if(s==='open'||s==='under_review'){btns.push(['review','eye','Review & send to Safety Officer','btn-primary']);btns.push(['escalate','flag','Escalate to ASO / HQ','btn-danger'])}
    else if(s==='resolved'){btns.push(['close','lock','Final review & close','btn-primary']);btns.push(['rework','undo','Send back to Safety Officer','btn-secondary'])}
  }else if(MG.can.isMineSO()&&s==='action_assigned'&&mine){
    btns.push(['taken','checkc','Action taken / Issue resolved','btn-primary']);btns.push(['reqesc','flag','Request escalation','btn-danger']);
  }else if((MG.can.isArea()||MG.can.isHQ())&&s==='escalated'&&mine){
    btns.push(['recommend','send','Give recommendation','btn-primary']);
  }
  if(!btns.length){host.innerHTML='<span class="tag">'+MG.icon('clock')+' Waiting for '+esc(resp.text)+'</span>';return}
  host.innerHTML=btns.map(([k,i,l,c])=>'<button class="btn '+c+'" data-act="'+k+'">'+MG.icon(i)+esc(l)+'</button>').join('');
  const F={
    review:{step:'REVIEW',title:'Review & send to Safety Officer',blurb:'Record your remarks and recommendations. The incident goes back to the Safety Officer for action.',fields:[['remarks','Remarks','Your review of the incident…'],['recommendations','Recommendations','What should the Safety Officer do?']],confirm:'Send to Safety Officer',done:'Sent to the Safety Officer with your remarks and recommendations'},
    rework:{step:'REVIEW',title:'Send back to Safety Officer',blurb:'The recorded action is not sufficient. Explain what is still needed.',fields:[['remarks','Remarks','Why is this being sent back?'],['recommendations','Recommendations','What further action is required?']],confirm:'Send back',done:'Sent back to the Safety Officer'},
    escalate:{step:'ESCALATE',title:'Escalate incident',blurb:'Only the Mine Manager can escalate. The ASO / HQ will give recommendations and return it to you; you keep final closure.',level:true,fields:[['remarks','Escalation remarks','Why does this need ASO / HQ intervention?']],confirm:'Confirm escalation',tone:'btn-danger',done:'Incident escalated'},
    taken:{step:'ACTION_TAKEN',title:'Action taken / Issue resolved',blurb:'Record what was done. It returns to the Mine Manager for final review and closure.',fields:[['actions','Action taken','Describe the actions you took…']],confirm:'Submit to Mine Manager',done:'Submitted to the Mine Manager for final review and closure'},
    reqesc:{step:'REQUEST_ESCALATION',title:'Request escalation',blurb:'Only the Mine Manager can escalate. Your request and justification go to the Mine Manager, who decides.',level:true,fields:[['justification','Justification','Why does this need further intervention?']],confirm:'Send request',tone:'btn-danger',done:'Escalation request sent to the Mine Manager'},
    recommend:{step:'RECOMMEND',title:'Give recommendation',blurb:'Your recommendations go back to the Mine Manager, who decides next steps and closes the incident.',fields:[['recommendations','Recommendations','Your recommendations…']],confirm:'Send to Mine Manager',done:'Recommendation sent to the Mine Manager'}
  };
  host.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{if(b.dataset.act==='close')closeFlow(inc,det,reload);else wfFlow(inc,det,F[b.dataset.act],reload)});
}

/* Two-phase drawer: form → review & confirm → submit */
function twoPhase({title,sub,form,collect,review,confirmLabel,submit,tone='btn-primary'}){
  const ctl=MG.drawer({title,sub,body:'<div class="ph1" style="display:grid;gap:16px">'+form+'</div><div class="ph2 hidden" style="display:grid;gap:16px"></div>',footer:'<button class="btn btn-ghost" data-cancel>Cancel</button><button class="btn btn-primary" data-next>Review</button>'});
  const el=ctl.el,p1=el.querySelector('.ph1'),p2=el.querySelector('.ph2'),foot=ctl.footer;let data=null;
  const phase1=()=>{p1.classList.remove('hidden');p2.classList.add('hidden');foot.innerHTML='<button class="btn btn-ghost" data-cancel>Cancel</button><button class="btn btn-primary" data-next>Review</button>';wire()};
  const wire=()=>{foot.querySelector('[data-cancel]').onclick=ctl.close;
    const nx=foot.querySelector('[data-next]');if(nx)nx.onclick=()=>{const r=collect(el);if(r.error){MG.toast(r.error,'err');return}data=r.data;p1.classList.add('hidden');p2.classList.remove('hidden');p2.innerHTML=review(data);foot.innerHTML='<button class="btn btn-ghost" data-back>Back</button><button class="btn '+tone+'" data-confirm>'+esc(confirmLabel)+'</button>';foot.querySelector('[data-back]').onclick=phase1;foot.querySelector('[data-confirm]').onclick=e=>MG.busy(e.currentTarget,async()=>{await submit(data);ctl.close()})}};
  wire();return ctl;
}
const post=(inc,body)=>MG.api('/api/safety/incidents/'+inc.id+'/workflow',{method:'POST',body:JSON.stringify(body)});

function wfFlow(inc,det,cfg,reload){
  const req=lastKind(det,'escalation_request'),pre=cfg.step==='ESCALATE'&&req?req.context.level:null;
  const lv=cfg.level?'<div class="field"><label>Escalate to</label><div class="seg" id="lvPick"><button type="button" data-l="ASO" class="'+(pre==='ASO'?'active':'')+'">Area Safety Officer (ASO)</button><button type="button" data-l="HQ" class="'+(pre==='HQ'?'active':'')+'">HQ</button></div>'+(pre?'<span class="hint">The Safety Officer asked for '+(pre==='HQ'?'HQ':'the ASO')+'. You can choose differently.</span>':'')+'</div>':'';
  const ctl=twoPhase({title:cfg.title,sub:esc(inc.incident_ref||''),tone:cfg.tone||'btn-primary',confirmLabel:cfg.confirm,
    form:header(inc)+(cfg.blurb?'<p class="muted">'+esc(cfg.blurb)+'</p>':'')+lv+cfg.fields.map(([id,l,ph])=>'<div class="field"><label for="wf_'+id+'">'+esc(l)+' (required)</label><textarea class="textarea" id="wf_'+id+'" maxlength="4000" placeholder="'+esc(ph)+'"></textarea></div>').join(''),
    collect:el=>{const d={};for(const [id,l] of cfg.fields){d[id]=el.querySelector('#wf_'+id).value.trim();if(!d[id])return {error:l+' is required'}}
      if(cfg.level){d.level=el.querySelector('#lvPick .active')?.dataset.l;if(!d.level)return {error:'Choose ASO or HQ'}}return {data:d}},
    review:d=>'<p class="muted small">Please confirm. This is recorded permanently in the incident history.</p>'+sumRows([['Incident',inc.incident_ref],...(d.level?[['Escalate to',d.level==='HQ'?'HQ':'Area Safety Officer (ASO)']]:[]),...cfg.fields.map(([id,l])=>[l,d[id]])]),
    submit:async d=>{await post(inc,{step:cfg.step,...d});MG.toast(cfg.done);await reload()}});
  const lp=ctl.el.querySelector('#lvPick');if(lp)lp.querySelectorAll('button').forEach(b=>b.onclick=()=>lp.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b)));
}

function closeFlow(inc,det,reload){
  const taken=lastKind(det,'action_taken'),trail=(det.forwarding_history||[]).filter(h=>kindOf(h)).map(h=>'<div class="log-item"><i></i><div><b>'+esc(headOf(h))+'</b> · <span class="muted">'+esc(route(h))+'</span> <time>'+esc(MG.dateTime(h.created_at))+'</time>'+(evText(h)?'<p>'+esc(evText(h))+'</p>':'')+'</div></div>').join('')||'<p class="muted small">No workflow actions recorded.</p>';
  twoPhase({title:'Final review & close',sub:esc(inc.incident_ref||''),confirmLabel:'Close incident',
    form:header(inc)+'<div class="field"><label>Action and review trail</label><div class="log" style="border:1px solid var(--line);border-radius:12px;padding:4px 12px;max-height:210px;overflow:auto">'+trail+'</div></div>'
      +'<div class="field"><label for="wf_remarks">Closing remarks (required)</label><textarea class="textarea" id="wf_remarks" maxlength="4000" placeholder="Final observations and conclusion…"></textarea></div>'
      +'<label class="check"><input type="checkbox" id="cOk"><span>I have reviewed the action taken'+(taken?'':' and recommendations')+' and confirm this incident can be closed. Closure is final.</span></label>',
    collect:el=>{const r=el.querySelector('#wf_remarks').value.trim();if(!r)return {error:'Closing remarks are required'};if(!el.querySelector('#cOk').checked)return {error:'Please tick the confirmation'};return {data:{remarks:r}}},
    review:d=>'<p class="muted small">Closure is recorded permanently and cannot be undone.</p>'+sumRows([['Incident',inc.incident_ref],['Status change',MG.STATUS[inc.status].label+' → Closed'],['Closing remarks',d.remarks]]),
    submit:async d=>{await post(inc,{step:'CLOSE',remarks:d.remarks});MG.toast('Incident closed');await reload()}});
}
})();
