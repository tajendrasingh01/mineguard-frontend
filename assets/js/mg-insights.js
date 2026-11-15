/* Incident-pattern insights shared by the dashboards and Analytics:
   – which categories / types occur most often
   – which categories / types take longest to close
   – the highest-severity incidents still open
   Everything is computed from the incident rows the API already scoped to the viewer. */
(function(){
const MG=window.MG,C=MG.charts,esc=MG.esc;
let mode='closed';/* 'closed' = resolved/closed incidents only; 'all' = also count age of still-open ones */
const GREEN='#10b981',AMBER='#f59e0b',RED='#ef4444';
const typeOf=r=>String(r.incident_type||r.category||'Unspecified').trim()||'Unspecified';
const catKey=r=>r._cat||'other';
const catLabel=k=>(MG.CATEGORY[k]||{label:'Other'}).label;
const catColor=k=>(MG.CATEGORY[k]||{color:'#94a3b8'}).color;
const doneHours=r=>{const t=r.resolved_at||r.closed_at;const h=t?MG.hoursBetween(r.created_at,t):null;return h!==null&&h>=0?h:null};
const elapsed=r=>{const d=doneHours(r);return d!==null?d:(mode==='all'&&MG.isActive(r.status)?MG.ageHours(r):null)};
const tone=h=>h>336?RED:h>168?AMBER:GREEN;/* >14 days red, >7 days amber */
const group=(rows,keyFn)=>{const m=new Map();rows.forEach(r=>{const k=keyFn(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r)});return [...m].map(([key,rs])=>({key,rows:rs}))};
const slow=(rows,keyFn,labelFn,limit)=>group(rows,keyFn).map(g=>{
  const hs=g.rows.map(elapsed).filter(h=>h!==null);if(!hs.length)return null;
  const avg=MG.avg(hs),closed=g.rows.filter(r=>doneHours(r)!==null).length,open=g.rows.filter(r=>MG.isActive(r.status)).length;
  return {key:g.key,label:labelFn(g),total:avg,color:tone(avg),tipRows:[{k:'Average',v:MG.duration(avg)},{k:'Longest',v:MG.duration(Math.max(...hs))},{k:'Closed',v:String(closed)},{k:'Still open',v:String(open)}]};
}).filter(Boolean).sort((a,b)=>b.total-a.total).slice(0,limit);

const card=(id,title,sub,tools)=>'<section class="card"><div class="card-h"><div><h3>'+title+'</h3><p class="sub">'+sub+'</p></div>'+(tools?'<div class="tools">'+tools+'</div>':'')+'</div><div class="chart" id="'+id+'"></div></section>';

MG.insights={
  mount(host,rows,{go}){
    const draw=()=>{
      host.innerHTML='<div class="section-title"><div><h2>Incident patterns</h2><p class="muted small">What happens most, what takes longest to close, and what is most severe</p></div>'
       +'<div class="seg" id="inMode" role="group" aria-label="Closure time basis"><button type="button" data-m="closed" class="'+(mode==='closed'?'active':'')+'">Closed only</button><button type="button" data-m="all" class="'+(mode==='all'?'active':'')+'">Include still open</button></div></div>'
       +'<div class="grid g-wide" style="margin-bottom:16px">'+card('inFreq','Most frequent incident types','Coloured by category · select a bar to list incidents')+card('inCat','Slowest categories to close','Average time from report to resolution')+'</div>'
       +'<div class="grid g-wide" style="margin-bottom:16px">'+card('inType','Slowest incident types to close','Average time from report to resolution · select a bar to list incidents')+'<section class="card"><div class="card-h"><div><h3>Severity watchlist</h3><p class="sub">Most severe incidents still active</p></div></div><div id="inWatch"></div></section></div>';
      const $=s=>host.querySelector(s);
      host.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;draw()});

      /* frequency by type, stacked by category */
      const freq=group(rows,typeOf).map(g=>({key:g.key,label:g.key,total:g.rows.length,segments:group(g.rows,catKey).map(c=>({name:catLabel(c.key),value:c.rows.length,color:catColor(c.key)})).sort((a,b)=>b.value-a.value)})).sort((a,b)=>b.total-a.total).slice(0,10);
      C.hbars($('#inFreq'),{items:freq,onSelect:i=>go('type='+encodeURIComponent(freq[i].key)),empty:'No incidents recorded.'});
      const used=[...new Set(rows.map(catKey))].filter(k=>rows.some(r=>catKey(r)===k));
      if(freq.length)$('#inFreq').insertAdjacentHTML('beforeend','<div class="legend" style="margin-top:10px">'+used.map(k=>'<span><i style="background:'+catColor(k)+'"></i>'+esc(catLabel(k))+'</span>').join('')+'</div>');

      /* closure time by category and by type */
      const note=mode==='closed'?'No incidents have been resolved yet.':'No incidents to measure.';
      const byCat=slow(rows,catKey,g=>catLabel(g.key),8);
      C.hbars($('#inCat'),{items:byCat,fmt:v=>MG.duration(v),onSelect:i=>go('cat='+byCat[i].key),empty:note});
      const byType=slow(rows,typeOf,g=>g.key,8);
      C.hbars($('#inType'),{items:byType,fmt:v=>MG.duration(v),onSelect:i=>go('type='+encodeURIComponent(byType[i].key)),empty:note});
      if(byCat.length||byType.length)$('#inCat').insertAdjacentHTML('beforeend','<div class="legend" style="margin-top:10px"><span><i style="background:'+GREEN+'"></i>≤ 7 days</span><span><i style="background:'+AMBER+'"></i>7–14 days</span><span><i style="background:'+RED+'"></i>&gt; 14 days</span></div>');

      /* severity watchlist */
      const act=rows.filter(r=>MG.isActive(r.status)).sort((a,b)=>(MG.sevMeta(b.severity).order-MG.sevMeta(a.severity).order)||((MG.ageHours(b)||0)-(MG.ageHours(a)||0))).slice(0,6);
      $('#inWatch').innerHTML=act.length?'<div class="watch">'+act.map(r=>'<button type="button" class="watch-row" data-id="'+esc(r.id)+'" style="--c:'+MG.sevMeta(r.severity).color+'"><span class="w-sev">'+MG.sevHtml(r.severity)+'</span><span class="w-main"><b>'+esc(typeOf(r))+'</b><small>'+esc([r.incident_ref,r.mine_name].filter(Boolean).join(' · '))+' · open '+esc(MG.duration(MG.ageHours(r)||0))+'</small></span><span class="w-st">'+MG.statusPill(r.status)+'</span></button>').join('')+'</div>'
        :MG.empty('checkc','No active incidents','Nothing is waiting in this selection.');
      host.querySelectorAll('.watch-row').forEach(b=>b.onclick=()=>MG.go('/incidents/'+b.dataset.id));
      MG.bindTips(host);
    };
    draw();
  }
};
})();
