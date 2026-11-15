/* Dashboards for HQ, Area and Mine scopes. All figures are derived from /api/safety/incidents (+ mine analytics for safe days). */
(function(){
const MG=window.MG,S=MG.state,D=MG.data,C=MG.charts,UI=MG.ui,esc=MG.esc,V=MG.views=MG.views||{};
let gran='auto',token=0;

const statusSeries=(rows,buckets)=>MG.STATUS_KEYS.map(k=>({key:k,name:MG.STATUS[k].label,color:MG.STATUS[k].color,values:D.series(rows,buckets,r=>r.status,[k])[k]}));
const needsAttention=rows=>rows.filter(r=>r.status==='escalated'||MG.isOverdue(r)).sort((a,b)=>(b.status==='escalated')-(a.status==='escalated')||a._t-b._t);
const scopeTitle=()=>S.scope.mineId?D.mineName(S.scope.mineId):S.scope.areaId?D.areaName(S.scope.areaId):'Corporate HQ · All Areas & Mines';
const goIncidents=(q)=>MG.go('/incidents?'+(q||'all=1'));

V.dashboard={
  async render(host,params){
    const my=++token,u=S.user;
    /* scope from route */
    if(MG.can.isArea())S.scope={areaId:S.areas[0]?.id||null,mineId:params.mineId||null};
    else if(MG.can.isHQ())S.scope={areaId:params.areaId||(params.mineId?S.mineMap.get(params.mineId)?.area_id:null)||null,mineId:params.mineId||null};
    else S.scope={areaId:null,mineId:S.mines.length===1?S.mines[0].id:(params.mineId||null)};
    MG.updateChrome();
    host.innerHTML='<div class="kpis">'+Array.from({length:6},()=>'<span class="skeleton" style="height:104px"></span>').join('')+'</div><div class="grid g-wide"><div class="card">'+MG.skeleton(1,260)+'</div><div class="card">'+MG.skeleton(1,260)+'</div></div>';
    try{await D.load()}catch(e){if(my!==token)return;host.innerHTML='<div class="banner error">'+MG.icon('alert')+'<span>'+esc(e.message)+'</span><button class="btn btn-secondary btn-sm" id="retry">Retry</button></div>';host.querySelector('#retry').onclick=()=>V.dashboard.render(host,params);return}
    if(my!==token)return;
    const rows=D.scoped(),sm=D.summarize(rows),cr=D.chartRange(rows);
    const g=gran==='auto'?D.granularity(cr.from,cr.to):gran,buckets=D.buckets(cr.from,cr.to,g);
    const level=S.scope.mineId?'mine':S.scope.areaId?'area':'hq';
    const spark=k=>C.spark(D.series(rows,buckets,r=>k==='total'?'total':r.status,[k]).constructor===Object?(k==='total'?buckets.map((_,i)=>MG.sum(MG.STATUS_KEYS.map(s=>D.series(rows,buckets,r=>r.status,[s])[s][i]))):D.series(rows,buckets,r=>r.status,[k])[k]):[],MG.STATUS[k]?.color||'#2563eb');
    const totalSeries=(()=>{const v=buckets.map(()=>0);rows.forEach(r=>{const i=D.bucketIndex(buckets,r._t);if(i>=0)v[i]++});return v})();
    const sp=(k)=>C.spark(k==='total'?totalSeries:D.series(rows,buckets,r=>r.status,[k])[k],k==='total'?'#2563eb':MG.STATUS[k].color);
    const kp=[['total','Total reported',sm.total,'#2563eb','In selected period'],['open','New',sm.by.open,MG.STATUS.open.color,'Awaiting Mine Manager'],['under_review','Under review',sm.by.under_review,MG.STATUS.under_review.color,'Mine Manager review'],['action_assigned','With Safety Officer',sm.by.action_assigned,MG.STATUS.action_assigned.color,'Action required'],['escalated','Escalated',sm.by.escalated,MG.STATUS.escalated.color,'Senior attention'],['closed','Closed',sm.by.closed,MG.STATUS.closed.color,sm.by.resolved+' awaiting closure']];
    host.innerHTML=
      (S.truncated?'<div class="banner warn">'+MG.icon('info')+'<span>Showing the first '+MG.num(S.rows.length)+' of '+MG.num(S.total)+' incidents. Narrow the reporting period for complete figures.</span></div>':'')
     +'<div id="actPanel" style="margin-bottom:16px"></div>'
     +'<div class="kpis" id="kpis">'+(MG.can.isMineSO()?'<div id="safeKpi" class="kpi static" style="--c:#059669"><div class="kpi-top"><span class="dot"></span>Safe days</div><div class="kpi-val">…</div><div class="kpi-foot"><span>Since last incident report</span></div></div>':'')
       +kp.map(([k,l,v,c,f])=>UI.kpi({key:k,label:l,value:MG.num(v),color:c,foot:f,spark:sp(k),delta:k==='total'?'<span data-delta="total"></span>':k==='closed'?'<span data-delta="closed"></span>':''})).join('')+'</div>'
     +'<section class="card" style="margin-bottom:16px"><div class="card-h"><div><h3>Incident timeline</h3><p class="sub">Reports over time, coloured by where each incident stands today · line shows incidents resolved</p></div><div class="tools"><div class="seg" id="gran" role="group" aria-label="Time grouping">'+[['auto','Auto'],['day','Day'],['week','Week'],['month','Month']].map(([k,l])=>'<button type="button" data-g="'+k+'" class="'+(gran===k?'active':'')+'">'+l+'</button>').join('')+'</div></div></div><div class="chart" id="cTimeline"></div></section>'
     +'<div class="grid g-wide" style="margin-bottom:16px"><section class="card"><div class="card-h"><div><h3>'+(level==='hq'?'Area-wise distribution':level==='area'?'Mine-wise distribution':'Where incidents occur')+'</h3><p class="sub">'+(level==='mine'?'By recorded location':'Active vs resolved · select a bar to drill down')+'</p></div></div><div class="chart" id="cDist"></div></section>'
     +'<section class="card"><div class="card-h"><div><h3>Closure performance</h3><p class="sub">Resolved or closed vs reported</p></div></div><div id="cPerf"></div></section></div>'
     +'<div class="grid g3" style="margin-bottom:16px"><section class="card"><div class="card-h"><div><h3>Severity</h3><p class="sub">Recorded severity levels</p></div></div><div class="chart" id="cSev"></div></section>'
     +'<section class="card"><div class="card-h"><div><h3>Category</h3><p class="sub">Report classification</p></div></div><div class="chart" id="cCat"></div></section>'
     +'<section class="card"><div class="card-h"><div><h3>'+(level==='hq'?'Mine-wise distribution':'Status mix')+'</h3><p class="sub">'+(level==='hq'?'Busiest mines · select to drill down':'Current workflow status')+'</p></div></div><div class="chart" id="cMix"></div></section></div>'
     +'<div id="insights"></div>'
     +'<div class="section-title"><div><h2>Needs attention</h2><p class="muted small">Escalated incidents and those active for more than '+MG.OVERDUE_DAYS+' days</p></div><button class="btn btn-secondary btn-sm" id="allAtt">View all '+MG.icon('arrow')+'</button></div><div id="attn"></div>';
    const $=s=>host.querySelector(s);

    /* timeline */
    const draw=()=>{
      const gg=gran==='auto'?D.granularity(cr.from,cr.to):gran,bk=D.buckets(cr.from,cr.to,gg),series=statusSeries(rows,bk),res=D.eventSeries(rows,bk,'resolved_at');
      C.columns($('#cTimeline'),{title:'Incident timeline',labels:bk.map(b=>b.label),series,line:{name:'Resolved',color:'#0f172a',values:res},onSelect:(i,k)=>{if(k)goIncidents('status='+k)},empty:'No incidents were reported in this period.',height:270});
    };
    draw();$('#gran').querySelectorAll('button').forEach(b=>b.onclick=()=>{gran=b.dataset.g;$('#gran').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));draw()});
    $('#kpis').querySelectorAll('[data-kpi]').forEach(b=>b.onclick=()=>goIncidents(b.dataset.kpi==='total'?'':'status='+b.dataset.kpi));

    /* distribution */
    const seg=(rs)=>{const a=rs.filter(r=>MG.isActive(r.status)).length;return [{name:'Active',value:a,color:'#f59e0b'},{name:'Resolved / closed',value:rs.length-a,color:'#10b981'}]};
    if(level==='hq'){
      const ag=D.groupBy(rows,r=>r.area_id,r=>r.area_name);const items=S.areas.map(a=>{const rs=(ag.find(x=>x.key===a.id)||{rows:[]}).rows;return {id:a.id,label:a.name,total:rs.length,segments:seg(rs)}}).sort((a,b)=>b.total-a.total);
      C.hbars($('#cDist'),{items,onSelect:i=>MG.go('/dashboard/area/'+items[i].id),empty:'No incidents recorded.'});
      const mg2=D.groupBy(rows,r=>r.mine_id,r=>r.mine_name).map(x=>({id:x.key,label:x.name,total:x.rows.length,color:'#6366f1',tipRows:[{k:'Incidents',v:String(x.rows.length)},{k:'Active',v:String(x.rows.filter(r=>MG.isActive(r.status)).length)}]})).sort((a,b)=>b.total-a.total).slice(0,10);
      C.hbars($('#cMix'),{items:mg2,onSelect:i=>MG.go('/dashboard/mine/'+mg2[i].id),empty:'No incidents recorded.'});
    }else if(level==='area'){
      const mg2=D.groupBy(rows,r=>r.mine_id,r=>r.mine_name),items=S.mines.filter(m=>m.area_id===S.scope.areaId).map(m=>{const rs=(mg2.find(x=>x.key===m.id)||{rows:[]}).rows;return {id:m.id,label:m.name,total:rs.length,segments:seg(rs)}}).sort((a,b)=>b.total-a.total);
      C.hbars($('#cDist'),{items,onSelect:i=>MG.go('/dashboard/mine/'+items[i].id),empty:'No incidents recorded.'});
      C.donut($('#cMix'),{items:MG.STATUS_KEYS.map(k=>({key:k,label:MG.STATUS[k].label,value:sm.by[k],color:MG.STATUS[k].color})),onSelect:(i,k,el)=>goIncidents('status='+MG.STATUS_KEYS.filter(x=>sm.by[x]>0)[i]),empty:'No incidents recorded.'});
    }else{
      const lz=D.groupBy(rows,r=>String(r.location_zone||'Not recorded'),r=>String(r.location_zone||'Not recorded')).map(x=>({label:x.name,total:x.rows.length,segments:seg(x.rows)})).sort((a,b)=>b.total-a.total).slice(0,10);
      C.hbars($('#cDist'),{items:lz,empty:'No incidents recorded.'});
      C.donut($('#cMix'),{items:MG.STATUS_KEYS.map(k=>({key:k,label:MG.STATUS[k].label,value:sm.by[k],color:MG.STATUS[k].color})),onSelect:i=>goIncidents('status='+MG.STATUS_KEYS.filter(x=>sm.by[x]>0)[i]),empty:'No incidents recorded.'});
    }

    /* severity + category */
    const sevItems=MG.SEV_KEYS.map(k=>({key:k,label:MG.SEVERITY[k].label,value:sm.sev[k],color:MG.SEVERITY[k].color})),other=sm.total-MG.sum(sevItems.map(x=>x.value));if(other>0)sevItems.push({key:'',label:'Not recorded',value:other,color:'#cbd5e1'});
    C.donut($('#cSev'),{items:sevItems,onSelect:(i)=>{const it=sevItems.filter(x=>x.value>0)[i];if(it&&it.key)goIncidents('sev='+it.key)},empty:'No incidents recorded.'});
    const catItems=MG.CAT_KEYS.map(k=>({key:k,label:MG.CATEGORY[k].label,value:sm.cat[k],color:MG.CATEGORY[k].color}));
    C.donut($('#cCat'),{items:catItems,onSelect:i=>{const it=catItems.filter(x=>x.value>0)[i];if(it)goIncidents('cat='+it.key)},empty:'No incidents recorded.'});

    /* performance */
    const bins=[['< 1 day',0,24],['1–3 days',24,72],['3–7 days',72,168],['7–14 days',168,336],['> 14 days',336,Infinity]],rh=rows.map(MG.resolutionHours).filter(h=>h!==null),bc=bins.map(b=>rh.filter(h=>h>=b[1]&&h<b[2]).length);
    $('#cPerf').innerHTML='<div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">'+C.ring(sm.rate??0,100,sm.rate>=70?'#10b981':sm.rate>=40?'#f59e0b':'#ef4444',sm.rate===null?'—':sm.rate+'%','resolved',116)
      +'<div style="display:grid;gap:10px;flex:1;min-width:150px"><div><div class="small muted">Average resolution</div><b style="font-size:19px">'+MG.duration(sm.avgRes)+'</b></div><div><div class="small muted">Median</div><b style="font-size:19px">'+MG.duration(sm.medRes)+'</b></div></div></div>'
      +'<div style="margin:16px 0 6px;display:flex;justify-content:space-between;align-items:center"><span class="lbl">Time to resolve</span><span class="small faint">'+sm.resN+' resolved incidents</span></div><div class="chart" id="cRes"></div>'
      +'<div class="chips" style="margin-top:12px"><button class="chip" id="chOd">'+MG.icon('clock')+' Overdue <span class="n">'+sm.overdue+'</span></button><span class="small faint" style="align-self:center">active &gt; '+MG.OVERDUE_DAYS+' days</span></div>';
    C.hbars($('#cRes'),{items:bins.map((b,i)=>({label:b[0],total:bc[i],color:i<2?'#10b981':i<3?'#f59e0b':'#ef4444'})),empty:'No incidents have been resolved yet.'});
    $('#chOd').onclick=()=>goIncidents('overdue=1');

    MG.insights.mount($('#insights'),rows,{go:goIncidents});

    /* needs attention */
    const att=needsAttention(rows);$('#allAtt').onclick=()=>goIncidents('overdue=1');
    MG.notify.mountPanel($('#actPanel'));MG.notify.fetch().then(()=>{if(my===token)MG.notify.mountPanel(host.querySelector('#actPanel'))});
    if(att.length)UI.feed($('#attn'),att.slice(0,6),{page:6,extra:rows});else $('#attn').innerHTML='<div class="card">'+MG.empty('checkc','All clear','No escalated or overdue incidents in this scope.')+'</div>';
    MG.bindTips(host);

    /* async extras */
    D.previousCounts(S.scope.mineId?{mine_id:S.scope.mineId}:S.scope.areaId&&MG.can.isHQ()?{area_id:S.scope.areaId}:{}).then(p=>{if(my!==token||!p)return;const a=host.querySelector('[data-delta=total]'),b=host.querySelector('[data-delta=closed]');if(a)a.innerHTML=UI.delta(sm.total,p.total,'down');if(b)b.innerHTML=UI.delta(sm.done,p.done,'up')}).catch(()=>{});
    if(MG.can.isMineSO())MG.api('/api/safety/analytics/mine').then(d=>{if(my!==token)return;const el=host.querySelector('#safeKpi');if(el)el.innerHTML='<div class="kpi-top"><span class="dot"></span>Safe days</div><div class="kpi-val">'+(d.safe_days===null?'—':MG.num(d.safe_days))+'</div><div class="kpi-foot"><span>'+(d.last_incident_date?'Since '+esc(MG.date(d.last_incident_date)):'No incident reports recorded')+'</span></div>';el&&el.setAttribute('title',d.safe_days_definition||'')}).catch(()=>{});
  }
};
})();
