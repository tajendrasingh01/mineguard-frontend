/* Analytics workspace. Every figure is computed from live /api/safety/incidents rows (already scoped by the API for the signed-in role).
   Filters narrow what was received; they never widen access. Charts drill down by filtering in place, or open the matching incident list. */
(function(){
const MG=window.MG,S=MG.state,D=MG.data,C=MG.charts,UI=MG.ui,esc=MG.esc,V=MG.views=MG.views||{};
const F={area:'',mine:'',cat:''};let gran='auto',period='month',token=0;
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const BLUE='#2563eb',GREEN='#10b981',AMBER='#f59e0b',RED='#ef4444',SLATE='#0f172a';

/* ---------- helpers ---------- */
const doneAt=r=>r.resolved_at||r.closed_at||(!MG.isActive(r.status)?r.updated_at:null);
const doneT=r=>{const t=new Date(doneAt(r)).getTime();return Number.isFinite(t)?t:null};
const filtered=()=>S.rows.filter(r=>(!F.area||r.area_id===F.area)&&(!F.mine||r.mine_id===F.mine)&&(!F.cat||r._cat===F.cat));
const seg=rs=>{const a=rs.filter(r=>MG.isActive(r.status)).length;return [{name:'Active',value:a,color:AMBER},{name:'Resolved / closed',value:rs.length-a,color:GREEN}]};
const weekday=r=>{const s=String(r.date_of_incident||'').slice(0,10),d=/^\d{4}-\d{2}-\d{2}$/.test(s)?new Date(s+'T00:00:00'):new Date(r.created_at);return (d.getDay()+6)%7};
const hourOf=r=>{const m=/^(\d{1,2}):/.exec(String(r.time_of_incident||''));return m?Math.min(23,Number(m[1])):new Date(r.created_at).getHours()};
const quarters=(from,to)=>{const out=[];let y=from.getFullYear(),q=Math.floor(from.getMonth()/3);while(out.length<40){const start=new Date(y,q*3,1),end=new Date(y,q*3+3,1);if(start>to)break;out.push({start,end,label:'Q'+(q+1)+" '"+String(y).slice(2),full:'Q'+(q+1)+' '+y});q++;if(q>3){q=0;y++}}return out};
const API_CAT={act:'Unsafe Act',condition:'Unsafe Condition',near:'Near Miss',incident:'Incident Reporting'};
const ppDelta=(c,p)=>{if(c==null||p==null)return '';const d=c-p;if(!d)return '<span class="delta flat">= vs prev.</span>';return '<span class="delta '+(d>0?'up-good':'down-bad')+'" title="Percentage points vs the previous period of equal length">'+MG.icon(d>0?'up':'downa')+Math.abs(d)+' pts</span>'};
const goIncidents=q=>{
  S.scope={areaId:F.area||(MG.can.isArea()?S.areas[0]?.id:null)||null,mineId:F.mine||(!MG.can.isHQ()&&!MG.can.isArea()&&S.mines.length===1?S.mines[0].id:null)};
  MG.go('/incidents?'+(q||'all=1'));
};
const card=(id,title,sub,tools,cls)=>'<section class="card '+(cls||'')+'"><div class="card-h"><div><h3>'+title+'</h3><p class="sub">'+sub+'</p></div>'+(tools?'<div class="tools">'+tools+'</div>':'')+'</div><div class="chart" id="'+id+'"></div></section>';

V.analytics={
  async render(host){
    const my=++token;
    host.innerHTML='<div class="kpis">'+MG.skeleton(6,104)+'</div><div class="grid g2">'+MG.skeleton(2,300)+'</div>';
    try{await D.load()}catch(e){if(my!==token)return;host.innerHTML='<div class="banner error">'+MG.icon('alert')+'<span>'+esc(e.message)+'</span><button class="btn btn-secondary btn-sm" id="retry">Retry</button></div>';host.querySelector('#retry').onclick=()=>V.analytics.render(host);return}
    if(my!==token)return;
    /* drop filters that no longer exist for this viewer */
    if(F.area&&!S.areaMap.has(F.area))F.area='';if(F.mine&&!S.mineMap.has(F.mine))F.mine='';
    const showArea=MG.can.isHQ()&&S.areas.length>1,showMine=S.mines.length>1;
    host.innerHTML=(S.truncated?'<div class="banner warn">'+MG.icon('info')+'<span>Analysing the first '+MG.num(S.rows.length)+' of '+MG.num(S.total)+' incidents. Narrow the reporting period for complete figures.</span></div>':'')
     +'<div class="card fbar"><div class="fgroup">'+MG.icon('filter')
     +(showArea?'<select class="select" id="aArea" aria-label="Area"></select>':'')+(showMine?'<select class="select" id="aMine" aria-label="Mine / Project"></select>':'')
     +'<select class="select" id="aCat" aria-label="Category"><option value="">All categories</option>'+MG.CAT_KEYS.map(k=>'<option value="'+k+'">'+MG.CATEGORY[k].label+'</option>').join('')+'</select>'
     +'<button class="btn btn-ghost btn-sm hidden" id="aClear">'+MG.icon('x')+'Clear filters</button></div>'
     +'<div class="fgroup"><span class="range-note">'+MG.icon('calendar')+'<span id="aRange"></span></span><div class="seg" id="aGran" role="group" aria-label="Time grouping">'+[['auto','Auto'],['day','Day'],['week','Week'],['month','Month']].map(([k,l])=>'<button type="button" data-g="'+k+'">'+l+'</button>').join('')+'</div><button class="btn btn-secondary btn-sm" id="aView">View incidents '+MG.icon('arrow')+'</button></div></div>'
     +'<div class="kpis" id="aKpis"></div>'
     +'<div class="section-title"><div><h2>Trends</h2><p class="muted small">How reporting and closure move over time</p></div></div>'
     +'<div class="grid g-wide" style="margin-bottom:16px">'+card('cTrend','Reporting vs resolution','Incidents reported and resolved per period')+card('cBacklog','Open vs closed','Running totals of incidents reported in this period')+'</div>'
     +'<div class="section-title"><div><h2>Comparisons</h2><p class="muted small">Select a bar to focus the workspace on it</p></div></div>'
     +'<div class="grid g2" id="aCompare" style="margin-bottom:16px"></div>'
     +'<div class="section-title"><div><h2>Category &amp; severity</h2></div></div>'
     +'<div class="grid g3" style="margin-bottom:16px">'+card('cCat','Category mix','Select a slice to filter')+card('cSev','Severity','Recorded severity levels')+card('cHeatCS','Category × severity','Select a cell to list incidents')+'</div>'
     +'<div id="aInsights"></div>'
     +'<div class="grid g-wide" style="margin-bottom:16px">'+card('cSevTime','Severity over time','Stacked by recorded severity')+card('cPeriods','Period comparison','Reported vs resolved','<div class="seg" id="aPer" role="group" aria-label="Period">'+[['month','Monthly'],['quarter','Quarterly']].map(([k,l])=>'<button type="button" data-p="'+k+'">'+l+'</button>').join('')+'</div>')+'</div>'
     +'<div class="section-title"><div><h2>Resolution time</h2><p class="muted small">Elapsed time from report to recorded resolution</p></div></div>'
     +'<div class="grid g3" style="margin-bottom:16px">'+card('cResBins','Time to resolve','Distribution of resolved incidents')+card('cResTrend','Average days to resolve','By the period each incident was resolved')+card('cResSlow','Slowest to resolve','Average by mine / project')+'</div>'
     +'<div class="section-title"><div><h2>Pending &amp; overdue</h2><p class="muted small">Active incidents open for more than '+MG.OVERDUE_DAYS+' days are overdue</p></div></div>'
     +'<div class="grid g3" style="margin-bottom:16px">'+card('cStage','Where the backlog sits','Active incidents by workflow stage')+card('cAge','Age of active incidents','Days since reported')+card('cOver','Overdue by mine','Select a bar to open the list')+'</div>'
     +'<div class="section-title"><div><h2>Reporting patterns</h2><p class="muted small">When incidents are reported to occur</p></div></div>'
     +'<section class="card" style="margin-bottom:16px"><div class="card-h"><div><h3>Weekday × hour of day</h3><p class="sub">Darker cells mean more incidents</p></div></div><div class="chart" id="cHeatTime"></div></section>';
    const $=s=>host.querySelector(s);

    /* ----- filters ----- */
    const syncSelects=()=>{
      if($('#aArea')){$('#aArea').innerHTML='<option value="">All Areas</option>'+S.areas.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('');$('#aArea').value=F.area}
      if($('#aMine')){const ms=S.mines.filter(m=>!F.area||m.area_id===F.area);$('#aMine').innerHTML='<option value="">All Mines / Projects</option>'+ms.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>').join('');if(F.mine&&!ms.some(m=>m.id===F.mine))F.mine='';$('#aMine').value=F.mine}
      $('#aCat').value=F.cat;$('#aClear').classList.toggle('hidden',!(F.area||F.mine||F.cat));
      $('#aGran').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.g===gran));
      $('#aPer').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.p===period));
    };
    const apply=()=>{syncSelects();draw()};
    if($('#aArea'))$('#aArea').onchange=e=>{F.area=e.target.value;F.mine='';apply()};
    if($('#aMine'))$('#aMine').onchange=e=>{F.mine=e.target.value;if(F.mine&&MG.can.isHQ()){const m=S.mineMap.get(F.mine);if(m)F.area=m.area_id}apply()};
    $('#aCat').onchange=e=>{F.cat=e.target.value;apply()};
    $('#aClear').onclick=()=>{F.area=F.mine=F.cat='';apply()};
    $('#aGran').querySelectorAll('button').forEach(b=>b.onclick=()=>{gran=b.dataset.g;apply()});
    $('#aPer').querySelectorAll('button').forEach(b=>b.onclick=()=>{period=b.dataset.p;apply()});
    $('#aView').onclick=()=>goIncidents(F.cat?'cat='+F.cat:'');
    $('#aRange').textContent=D.rangeLabel();

    /* ----- paint ----- */
    function draw(){
      const rows=filtered(),sm=D.summarize(rows),cr=D.chartRange(S.rows),g=gran==='auto'?D.granularity(cr.from,cr.to):gran,bk=D.buckets(cr.from,cr.to,g),labels=bk.map(b=>b.label);
      const created=bk.map(()=>0),resolved=bk.map(()=>0);
      rows.forEach(r=>{const i=D.bucketIndex(bk,r._t);if(i>=0)created[i]++;const dt=doneT(r),j=dt==null?-1:D.bucketIndex(bk,dt);if(j>=0)resolved[j]++});
      const active=bk.map(b=>rows.filter(r=>r._t<b.end&&!(doneT(r)!==null&&doneT(r)<b.end)).length);
      const closedRun=bk.map(b=>rows.filter(r=>r._t<b.end&&doneT(r)!==null&&doneT(r)<b.end).length);

      /* KPIs */
      const kp=[
        {key:'total',label:'Reported',value:MG.num(sm.total),color:BLUE,foot:'in selected period',spark:C.spark(created,BLUE),delta:'<span data-d="total"></span>'},
        {key:'rate',label:'Resolution rate',value:sm.rate==null?'—':sm.rate+'%',color:GREEN,foot:MG.num(sm.done)+' resolved / closed',static:true,delta:'<span data-d="rate"></span>'},
        {key:'avg',label:'Avg. resolution',value:MG.duration(sm.avgRes),color:'#7c3aed',foot:'median '+MG.duration(sm.medRes)+' · '+sm.resN+' resolved',static:true},
        {key:'active',label:'Active backlog',value:MG.num(sm.active),color:AMBER,foot:'not yet resolved',spark:C.spark(active,AMBER)},
        {key:'overdue',label:'Overdue',value:MG.num(sm.overdue),color:RED,foot:'active > '+MG.OVERDUE_DAYS+' days'},
        {key:'escalated',label:'Escalated',value:MG.num(sm.by.escalated),color:MG.STATUS.escalated.color,foot:'senior attention'}
      ];
      $('#aKpis').innerHTML=kp.map(k=>UI.kpi(k)).join('');
      $('#aKpis').querySelectorAll('[data-kpi]').forEach(b=>b.onclick=()=>{const k=b.dataset.kpi;goIncidents(k==='total'?(F.cat?'cat='+F.cat:''):k==='overdue'?'overdue=1':k==='escalated'?'status=escalated':k==='active'?'sort=attention&status=':'')});
      const mySeq=my,extra={};if(F.mine)extra.mine_id=F.mine;else if(F.area&&MG.can.isHQ())extra.area_id=F.area;
      if(F.cat&&!API_CAT[F.cat]){/* no comparable previous-period filter */}
      else{if(F.cat)extra.category=API_CAT[F.cat];D.previousCounts(extra).then(p=>{if(mySeq!==token||!p||!$('#aKpis'))return;const a=$('[data-d=total]'),b=$('[data-d=rate]');if(a)a.innerHTML=UI.delta(sm.total,p.total,'down');if(b)b.innerHTML=ppDelta(sm.rate,p.rate)}).catch(()=>{})}

      /* Trends */
      C.lines($('#cTrend'),{title:'Reported vs resolved',labels,series:[{name:'Reported',color:BLUE,values:created},{name:'Resolved',color:GREEN,values:resolved}],empty:'No incidents reported in this selection.',height:260});
      C.lines($('#cBacklog'),{title:'Open vs closed',labels,series:[{name:'Active',color:AMBER,values:active},{name:'Resolved / closed',color:GREEN,values:closedRun}],area:false,empty:'No incidents reported in this selection.',height:260});

      /* Comparisons */
      const cmp=[];
      if(MG.can.isHQ()&&S.areas.length>1&&!F.area)cmp.push(card('cByArea','Area-wise','Active vs resolved · select an Area'));
      if(S.mines.length>1&&!F.mine)cmp.push(card('cByMine','Mine-wise','Busiest mines / projects · select one'));
      cmp.push(card('cByZone','Where incidents occur','By recorded location'));
      $('#aCompare').innerHTML=cmp.join('');
      if($('#cByArea')){
        const ag=D.groupBy(rows,r=>r.area_id,r=>r.area_name),items=S.areas.map(a=>{const rs=(ag.find(x=>x.key===a.id)||{rows:[]}).rows;return {id:a.id,label:a.name,total:rs.length,segments:seg(rs)}}).filter(x=>x.total).sort((a,b)=>b.total-a.total);
        C.hbars($('#cByArea'),{items,onSelect:i=>{F.area=items[i].id;F.mine='';apply()},empty:'No incidents recorded.'});
      }
      if($('#cByMine')){
        const mg=D.groupBy(rows,r=>r.mine_id,r=>r.mine_name).map(x=>({id:x.key,label:x.name,total:x.rows.length,segments:seg(x.rows)})).sort((a,b)=>b.total-a.total).slice(0,12);
        C.hbars($('#cByMine'),{items:mg,onSelect:i=>{F.mine=mg[i].id;const m=S.mineMap.get(F.mine);if(m&&MG.can.isHQ())F.area=m.area_id;apply()},empty:'No incidents recorded.'});
      }
      const zones=D.groupBy(rows,r=>String(r.location_zone||'Not recorded'),r=>String(r.location_zone||'Not recorded')).map(x=>({label:x.name,total:x.rows.length,segments:seg(x.rows)})).sort((a,b)=>b.total-a.total).slice(0,10);
      C.hbars($('#cByZone'),{items:zones,empty:'No incidents recorded.'});

      /* Category / severity */
      const catItems=MG.CAT_KEYS.map(k=>({key:k,label:MG.CATEGORY[k].label,value:sm.cat[k],color:MG.CATEGORY[k].color})),catShown=catItems.filter(x=>x.value>0);
      C.donut($('#cCat'),{items:catItems,onSelect:i=>{F.cat=catShown[i].key;apply()},empty:'No incidents recorded.'});
      const sevItems=MG.SEV_KEYS.map(k=>({key:k,label:MG.SEVERITY[k].label,value:sm.sev[k],color:MG.SEVERITY[k].color})),other=sm.total-MG.sum(sevItems.map(x=>x.value));if(other>0)sevItems.push({key:'',label:'Not recorded',value:other,color:'#cbd5e1'});
      const sevShown=sevItems.filter(x=>x.value>0);
      C.donut($('#cSev'),{items:sevItems,onSelect:i=>{const it=sevShown[i];if(it&&it.key)goIncidents('sev='+it.key+(F.cat?'&cat='+F.cat:''))},empty:'No incidents recorded.'});
      const cats=MG.CAT_KEYS.filter(k=>sm.cat[k]>0);
      C.heat($('#cHeatCS'),{rows:cats.map(k=>MG.CATEGORY[k].label),cols:['None','Near','Minor','Serious','Critical','Fatal'],labelWidth:104,minCell:30,showValues:true,color:'#4f46e5',
        cell:(r,c)=>{const n=rows.filter(x=>x._cat===cats[r]&&x.severity===MG.SEV_KEYS[c]).length;return {value:n,title:MG.CATEGORY[cats[r]].label+' · '+MG.SEVERITY[MG.SEV_KEYS[c]].label,rows:[{k:'Incidents',v:String(n)}]}},
        onSelect:(i,k)=>{const [r,c]=String(k).split(':').map(Number);goIncidents('cat='+cats[r]+'&sev='+MG.SEV_KEYS[c])},empty:'No incidents recorded.'});
      const sevSeries=MG.SEV_KEYS.map(k=>({key:k,name:MG.SEVERITY[k].label,color:MG.SEVERITY[k].color,values:D.series(rows,bk,r=>r.severity,[k])[k]})).filter(s=>MG.sum(s.values)>0);
      C.columns($('#cSevTime'),{title:'Severity over time',labels,series:sevSeries,onSelect:(i,k)=>{if(k)goIncidents('sev='+k+(F.cat?'&cat='+F.cat:''))},empty:'No incidents recorded.',height:250});

      MG.insights.mount($('#aInsights'),rows,{go:q=>goIncidents(q)});

      /* Monthly / quarterly comparison */
      const pb=period==='quarter'?quarters(cr.from,cr.to):D.buckets(cr.from,cr.to,'month'),pc=pb.map(()=>0),pr=pb.map(()=>0);
      rows.forEach(r=>{const i=D.bucketIndex(pb,r._t);if(i>=0)pc[i]++;const dt=doneT(r),j=dt==null?-1:D.bucketIndex(pb,dt);if(j>=0)pr[j]++});
      if(pb.length<2)$('#cPeriods').innerHTML=MG.empty('calendar','Not enough history','Choose a longer reporting period (90D or more) to compare '+(period==='quarter'?'quarters':'months')+'.');
      else C.columns($('#cPeriods'),{title:'Period comparison',labels:pb.map(b=>b.label),series:[{key:'rep',name:'Reported',color:BLUE,values:pc},{key:'res',name:'Resolved',color:GREEN,values:pr}],stacked:false,empty:'No incidents recorded.',height:250});

      /* Resolution */
      const bins=[['< 1 day',0,24],['1–3 days',24,72],['3–7 days',72,168],['7–14 days',168,336],['> 14 days',336,Infinity]],rh=rows.map(MG.resolutionHours).filter(h=>h!==null);
      C.hbars($('#cResBins'),{items:bins.map((b,i)=>({label:b[0],total:rh.filter(h=>h>=b[1]&&h<b[2]).length,color:i<2?GREEN:i<3?AMBER:RED})),empty:'No incidents have been resolved yet.'});
      const rs=bk.map(()=>[]);rows.forEach(r=>{const h=MG.resolutionHours(r),dt=doneT(r);if(h===null||dt==null)return;const i=D.bucketIndex(bk,dt);if(i>=0)rs[i].push(h)});
      C.lines($('#cResTrend'),{title:'Average days to resolve',labels,series:[{name:'Avg days',color:'#7c3aed',values:rs.map(a=>a.length?Math.round(MG.avg(a)/24*10)/10:0)}],empty:'No incidents have been resolved yet.',height:200});
      const slow=D.groupBy(rows.filter(r=>MG.resolutionHours(r)!==null),r=>r.mine_id,r=>r.mine_name).map(x=>{const h=MG.avg(x.rows.map(MG.resolutionHours));return {label:x.name,total:h,display:MG.duration(h),color:h>336?RED:h>168?AMBER:GREEN,tipRows:[{k:'Average',v:MG.duration(h)},{k:'Resolved',v:String(x.rows.length)}]}}).sort((a,b)=>b.total-a.total).slice(0,8);
      C.hbars($('#cResSlow'),{items:slow,fmt:v=>MG.duration(v),empty:'No incidents have been resolved yet.'});

      /* Pending & overdue */
      const act=rows.filter(r=>MG.isActive(r.status)),stages=MG.STATUS_KEYS.filter(k=>k!=='closed'),stageVals=stages.map(k=>rows.filter(r=>r.status===k).length);
      if(!MG.sum(stageVals))$('#cStage').innerHTML=MG.empty('checkc','Nothing pending','No incidents in this selection.');
      else C.pipeline($('#cStage'),{total:MG.sum(stageVals),steps:stages.map((k,i)=>({key:k,label:MG.STATUS[k].short,value:stageVals[i],color:MG.STATUS[k].color})),onSelect:(i,k)=>goIncidents('status='+k)});
      const ages=[['0–3 days',0,3],['3–7 days',3,7],['7–14 days',7,14],['14–30 days',14,30],['30+ days',30,Infinity]];
      C.hbars($('#cAge'),{items:ages.map((a,i)=>({label:a[0],total:act.filter(r=>{const d=(MG.ageHours(r)||0)/24;return d>=a[1]&&d<a[2]}).length,color:a[1]>=MG.OVERDUE_DAYS?RED:a[1]>=3?AMBER:GREEN})),empty:'No active incidents.'});
      const od=D.groupBy(rows.filter(MG.isOverdue),r=>r.mine_id,r=>r.mine_name).map(x=>({id:x.key,label:x.name,total:x.rows.length,color:RED})).sort((a,b)=>b.total-a.total).slice(0,8);
      C.hbars($('#cOver'),{items:od,onSelect:S.mines.length>1?i=>{F.mine=od[i].id;goIncidents('overdue=1')}:undefined,empty:'No overdue incidents — nice.'});

      /* Reporting patterns */
      const grid=DAYS.map(()=>Array(24).fill(0));rows.forEach(r=>{grid[weekday(r)][hourOf(r)]++});
      C.heat($('#cHeatTime'),{rows:DAYS,cols:Array.from({length:24},(_,h)=>String(h).padStart(2,'0')),colEvery:3,labelWidth:44,minCell:22,color:'#0d9488',legend:'incidents per hour slot',
        cell:(r,c)=>({value:grid[r][c],title:DAYS[r]+' · '+String(c).padStart(2,'0')+':00–'+String((c+1)%24).padStart(2,'0')+':00',rows:[{k:'Incidents',v:String(grid[r][c])}]}),empty:'No incidents recorded.'});
      MG.bindTips(host);
    }
    apply();
  }
};
})();
