/* name=assets/js/premium-ui.js
   Purpose: small, non-invasive presentation helpers. This file intentionally avoids touching routes, API, or app logic. */
(function(){
  if(window.__premiumUIInstalled) return;
  window.__premiumUIInstalled = true;

  // Toggle a collapsed class for sidebar - purely presentational
  document.addEventListener('click', function(e){
    const t = e.target;
    if(t.matches('[data-ui-toggle="sidebar"]') || t.closest('[data-ui-toggle="sidebar"]')){
      document.documentElement.classList.toggle('sidebar-collapsed');
    }
  }, {passive:true});

  // Add hover lift to elements with .card (already styled via CSS) - small perf-friendly tweak
  // No changes to data or events used by app logic.
  // Active nav highlight based on data-route attribute (non-invasive)
  try{
    const items = document.querySelectorAll('.nav-item[data-route]');
    const current = window.location.pathname || '';
    items.forEach(it=>{
      const route = it.getAttribute('data-route');
      if(route && current.indexOf(route) !== -1){
        it.classList.add('active');
      }
    });
  }catch(e){ /* swallow on error */ }

})();