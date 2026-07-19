(function(){
  'use strict';
  const api = window.HOME31_API;
  const config = api.config;
  const el = {};
  const state = {
    user:null,data:null,route:'dashboard',dashboardYear:'all',dashboardRecordType:'all',dashboardPillar:'all',dashboardFit:'all',dashboardRisk:'all',dashboardView:'all',dashboardQuarter:'all',dashboardQuadrant:'all',dashboardQuality:'all',governanceYear:'all',governanceSearch:'',governanceView:'all',filters:{year:null,department:'all',search:'',status:'all'},projectView:'list',timelineScale:'year',timelineAnchor:null,adminTab:'users',adminUserFilters:{search:'',department:'all',role:'all',status:'all'},compareFrom:2026,compareTo:2027
  };
  const navItems = [
    {id:'dashboard',label:'Command Center',roles:'all'},
    {id:'portfolio',label:'Portfolio',roles:'all'},
    {id:'initiatives',label:'Initiatives',roles:'all'},
    {id:'governance',label:'Value & Governance',roles:'all'},
    {id:'projects',label:'Projects',roles:'all'},
    {id:'comparison',label:'AMP Comparison',roles:'all'},
    {id:'reports',label:'Reports',roles:'all'},
    {id:'admin',label:'Administration',roles:['SUPER_ADMIN','ADMIN','DEPARTMENT_ADMIN']}
  ];

  document.addEventListener('DOMContentLoaded',init);

  async function init(){
    ['login-screen','login-form','login-email','login-password','login-alert','mode-copy','app-shell','main-nav','page-root','user-menu','user-menu-button','user-avatar','user-name','user-role','quick-add','mobile-menu','modal-layer','modal-title','modal-eyebrow','modal-content','modal-close','toast','csv-file','footer-mode'].forEach(id=>el[toCamel(id)]=document.getElementById(id));
    el.modeCopy.textContent = api.isLive() ? 'Sign in securely to access the HOME31 Enterprise Portfolio Management platform.' : 'Demo mode is active. Data is stored only in this browser.';
    el.footerMode.textContent = api.isLive() ? 'Supabase live mode' : 'Demo mode · local browser data';
    bindStaticEvents();
    const current = await api.getCurrentUser();
    if(current){ await enterApp(current); } else showLogin();
  }

  function toCamel(value){ return value.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()); }
  function bindStaticEvents(){
    el.loginForm.addEventListener('submit',handleLogin);
    el.userMenuButton.addEventListener('click',()=>el.userMenu.classList.toggle('hidden'));
    document.addEventListener('click',event=>{ if(!el.userMenu.contains(event.target) && !el.userMenuButton.contains(event.target)) el.userMenu.classList.add('hidden'); });
    document.getElementById('logout-action').addEventListener('click',logout);
    document.getElementById('change-password-action').addEventListener('click',()=>openPasswordModal(false));
    el.userMenu.addEventListener('click',event=>{
      const button=event.target.closest('[data-route]');
      if(!button)return;
      el.userMenu.classList.add('hidden');
      navigate(button.dataset.route);
    });
    el.quickAdd.addEventListener('click',quickAdd);
    el.mobileMenu.addEventListener('click',()=>el.mainNav.classList.toggle('open'));
    el.modalClose.addEventListener('click',()=>closeModal(false,'close-button'));
    el.modalLayer.addEventListener('click',event=>{
      if(event.target!==el.modalLayer)return;
      if(el.modalContent.querySelector('#initiative-form')){
        const status=document.getElementById('initiative-draft-status');
        if(status)status.textContent='Form protected. Use the ✕ button to close this initiative form.';
        return;
      }
      closeModal(false,'backdrop');
    });
    document.addEventListener('keydown',event=>{
      if(event.key!=='Escape')return;
      if(el.modalContent.querySelector('#initiative-form')){
        event.preventDefault();
        const status=document.getElementById('initiative-draft-status');
        if(status)status.textContent='Escape is disabled for this form. Use the ✕ button to close.';
        return;
      }
      closeModal(false,'escape');
    });
    el.mainNav.addEventListener('click',event=>{ const button=event.target.closest('[data-route]'); if(button) navigate(button.dataset.route); });
    el.pageRoot.addEventListener('click',handlePageClick);
    el.pageRoot.addEventListener('change',handlePageChange);
    el.pageRoot.addEventListener('input',handlePageInput);
    el.csvFile.addEventListener('change',handleCsvImport);
    window.addEventListener('hashchange',()=>{
      const route=location.hash.replace('#/','');
      if(!route||route===state.route)return;
      if(!allowedRoute(route)){location.hash='#/dashboard';return;}
      state.route=route;
      render();
    });
  }

  async function handleLogin(event){
    event.preventDefault();
    setLoginError('');
    const submit=el.loginForm.querySelector('button[type="submit"]'); submit.disabled=true; submit.textContent='Signing in…';
    try{ const user=await api.signIn(el.loginEmail.value.trim(),el.loginPassword.value); await enterApp(user); }
    catch(error){ setLoginError(error.message || 'Sign-in failed.'); }
    finally{ submit.disabled=false; submit.textContent='Sign in'; }
  }
  function setLoginError(message){ el.loginAlert.textContent=message; el.loginAlert.classList.toggle('hidden',!message); }
  function showLogin(){ el.loginScreen.classList.remove('hidden');el.appShell.classList.add('hidden');el.loginPassword.focus(); }
  async function enterApp(user){
    state.user=user;
    el.loginScreen.classList.add('hidden');el.appShell.classList.remove('hidden');
    el.userName.textContent=user.name;el.userRole.textContent=user.roleLabel;el.userAvatar.textContent=initials(user.name);
    state.data=await loadWithSpinner();
    if(!state.data)return;
    state.filters.year=resolveInitialPortfolioYear(state.data);
    state.dashboardYear='all';
    state.compareTo=state.filters.year;state.compareFrom=state.filters.year-1;
    renderNav();
    const hashRoute=location.hash.replace('#/','');state.route=allowedRoute(hashRoute||'dashboard')?hashRoute||'dashboard':'dashboard';
    render();
    if(user.mustChangePassword) openPasswordModal(true);
  }
  async function loadWithSpinner(){
    el.pageRoot.innerHTML='<div class="loading"><div><div class="spinner"></div><span>Loading HOME31 data…</span></div></div>';
    try{return await api.loadData(state.user);}
    catch(error){
      el.pageRoot.innerHTML=`<section class="card panel" style="max-width:760px;margin:60px auto"><div class="alert danger"><strong>HOME31 could not load the portfolio data.</strong><br>${escapeHtml(error.message||'Unknown data-loading error.')}</div><button class="btn primary" data-action="retry-data-load">Retry data loading</button></section>`;
      toast(error.message||'Unable to load HOME31 data.','error');
      return null;
    }
  }
  async function refreshData(){ state.data=await api.loadData(state.user);render(); }
  function allowedRoute(route){
    if(route==='profile')return !!state.user;
    const item=navItems.find(n=>n.id===route);
    return !!item && (item.roles==='all'||item.roles.includes(state.user.role));
  }
  function renderNav(){
    el.mainNav.innerHTML=navItems.filter(n=>n.roles==='all'||n.roles.includes(state.user.role)).map(n=>`<button data-route="${n.id}" class="${n.id===state.route?'active':''}">${n.label}</button>`).join('');
  }
  function navigate(route){ if(!allowedRoute(route))return;state.route=route;location.hash='#/'+route;el.mainNav.classList.remove('open');render();el.pageRoot.focus(); }
  async function logout(){ await api.signOut();state.user=null;state.data=null;el.userMenu.classList.add('hidden');showLogin();toast('You have signed out.','success'); }

  function render(){
    if(!state.data)return;
    renderNav();
    const renderers={dashboard:renderDashboard,portfolio:renderPortfolio,initiatives:renderInitiatives,governance:renderGovernance,projects:renderProjects,comparison:renderComparison,reports:renderReports,admin:renderAdmin,profile:renderProfile};
    el.pageRoot.innerHTML=(renderers[state.route]||renderDashboard)();
    document.title='HOME31 · '+(state.route==='profile'?'My Profile':(navItems.find(n=>n.id===state.route)?.label||'Dashboard'));
  }

  function pageHeader(eyebrow,title,description,actions){ return `<div class="page-header"><div class="page-title"><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="header-actions">${actions||''}</div></div>`; }
  function kpi(label,value,meta,icon,klass){return `<div class="card kpi-card"><div class="kpi-top"><span class="kpi-label">${escapeHtml(label)}</span><span class="kpi-icon">${icon}</span></div><div class="kpi-value ${klass||''}">${value}</div><div class="kpi-meta">${meta}</div></div>`;}
  function yearOptions(selected){
    const labels=new Map((state.data.reportingYears||[]).map(y=>[Number(y.year),y.label||('AMP '+y.year)]));
    const years=[...new Set([...(state.data.reportingYears||[]).map(y=>Number(y.year)),...(state.data.initiatives||[]).map(i=>Number(i.year)),...(state.data.projects||[]).map(p=>Number(p.year))].filter(Number.isFinite))].sort((a,b)=>b-a);
    return years.map(year=>`<option value="${year}" ${Number(selected)===year?'selected':''}>${escapeHtml(labels.get(year)||('AMP '+year))}</option>`).join('');
  }
  function departmentOptions(selected,includeAll){return `${includeAll?'<option value="all">All departments</option>':''}${state.data.departments.filter(d=>d.active!==false).map(d=>`<option value="${d.id}" ${selected===d.id?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}`;}
  function statusBadge(value){const map={APPROVED:'green',COMPLETED:'green',ACTIVE:'green',ON_TRACK:'green',UPCOMING:'blue',IN_PROGRESS:'blue',SUBMITTED:'blue',UNDER_REVIEW:'amber',IN_REVIEW:'amber',AT_RISK:'amber',FROZEN:'amber',DELAYED:'red',REVOKED:'red',REJECTED:'red',ARCHIVED:'gray',DRAFT:'gray',WATCH:'amber',STABLE:'green',CRITICAL:'red',DECISION_REQUIRED:'amber',NOT_ASSESSED:'gray',PROVISIONAL:'amber',PENDING_FINANCE_REVIEW:'amber',VALIDATED:'green',NOT_APPLICABLE:'gray',REWORK_REQUIRED:'red',READY_FOR_DECISION:'green',CONDITIONALLY_READY:'amber',MORE_INFORMATION_REQUIRED:'amber',NOT_READY:'red',NOT_MEASURED:'gray',ACHIEVED:'green',OFF_TRACK:'red',SUGGESTED:'amber',CONFIRMED:'green',RETURNED:'amber',NEW:'teal',CARRY_FORWARD:'blue',EVOLUTION:'green',REPEAT:'amber',CRITICAL:'red',HIGH:'amber',MEDIUM:'blue',LOW:'green'};return `<span class="badge ${map[value]||'gray'}">${escapeHtml(pretty(value))}</span>`;}
  function renderGlobalFilters(){return `<div class="toolbar-group"><select data-filter="year">${yearOptions(state.filters.year)}</select><select data-filter="department">${departmentOptions(state.filters.department,true)}</select></div>`;}
  function dashboardYearOptions(selected){return `<option value="all" ${selected==='all'?'selected':''}>All years</option>${yearOptions(selected)}`;}
  function dashboardScopeLabel(){return state.dashboardYear==='all'?'All years':('AMP '+state.dashboardYear);}

  function resolveInitialPortfolioYear(data){
    const initiativeYears=(data.initiatives||[]).filter(i=>!i.archived&&Number.isFinite(Number(i.year))).map(i=>Number(i.year));
    const active=data.reportingYears.find(y=>y.active);
    if(active&&initiativeYears.includes(Number(active.year)))return Number(active.year);
    if(initiativeYears.length)return Math.max(...initiativeYears);
    const latest=data.reportingYears.slice().sort((a,b)=>Number(b.year)-Number(a.year))[0];
    return latest?Number(latest.year):new Date().getFullYear();
  }
  function availableDeliveryYears(){
    return [...new Set([...(state.data.initiatives||[]).filter(i=>!i.archived).map(i=>Number(i.year)),...(state.data.projects||[]).map(p=>Number(p.year))].filter(Number.isFinite))].sort((a,b)=>b-a);
  }

  function scopedInitiatives(){return state.data.initiatives.filter(i=>!i.archived && Number(i.year)===Number(state.filters.year) && (state.filters.department==='all'||i.departmentId===state.filters.department));}
  function scopedProjects(){return state.data.projects.filter(p=>Number(p.year)===Number(state.filters.year)&&(state.filters.department==='all'||p.departmentId===state.filters.department));}
  function dashboardScopedInitiatives(){
    return state.data.initiatives.filter(i=>{
      if(i.archived)return false;
      const d=i.formData||{};
      if(state.dashboardYear!=='all'&&Number(i.year)!==Number(state.dashboardYear))return false;
      if(state.filters.department!=='all'&&i.departmentId!==state.filters.department)return false;
      if(state.dashboardPillar!=='all'&&(d.strategicPillarId||i.strategicPillarId)!==state.dashboardPillar)return false;
      if(state.dashboardFit!=='all'&&(d.home31FitDecision||'Derived automatically')!==state.dashboardFit)return false;
      if(state.dashboardRisk!=='all'&&String(d.overallRiskLevel||displayRisk(i.priority)).toUpperCase()!==state.dashboardRisk)return false;
      return true;
    });
  }
  function dashboardScopedProjects(){
    const allowed=dashboardScopedInitiatives(),ids=new Set(allowed.map(i=>i.id));
    return state.data.projects.filter(p=>ids.has(p.initiativeId)&&(state.dashboardYear==='all'||Number(p.year)===Number(state.dashboardYear))&&(state.filters.department==='all'||p.departmentId===state.filters.department));
  }
  function evidenceLabel(score){return score>=80?'Decision-ready':score>=70?'Acceptable':score>0?'More evidence required':'Not assessed';}
  function isPending(value){return ['','Not submitted','Pending HR review','Clarification required','To be confirmed','New - Pending ICT review','Not Assessed'].includes(String(value||''));}
  function phase3(item){return item?.phase3||{};}
  function governedCba(item){const p=phase3(item),value=numberOrNull(p.governedCbaRatio);return value!==null?value:numberOrNull(item?.formData?.cbaRatio);}
  function cbaStatus(item){const p=phase3(item);return p.cbaValidationStatus||((governedCba(item)!==null)?'PROVISIONAL':'NOT_ASSESSED');}
  function financeValue(item,key,fallback){const value=numberOrNull(phase3(item)?.[key]);return value!==null?value:Number(fallback||0);}
  function benefitActual(item){const p=phase3(item);if(p.actualValueNumeric!==null&&p.actualValueNumeric!==undefined)return `${p.actualValueNumeric}${p.actualValueUnit?' '+p.actualValueUnit:''}`;return p.actualValueText||'Not recorded';}
  function benefitStatus(item){return phase3(item).benefitStatus||'NOT_MEASURED';}
  function readinessStatus(item){return phase3(item).decisionReadinessStatus||'MORE_INFORMATION_REQUIRED';}
  function readinessScore(item){const v=numberOrNull(phase3(item).decisionReadinessScore);return v;}
  function phase3Installed(){return !!state.data?.capabilities?.phase3||!api.isLive();}
  function initiativeDecisionItems(item){
    const d=item.formData||{},p=phase3(item),decisions=[];
    const approved=numberOrNull(d.approvedBudget??item.approvedBudget),cba=governedCba(item),score=evidenceScore(d);
    if(approved===null||approved<=0)decisions.push('Approved Budget required');
    if(approved>0&&cba===null)decisions.push('CBA assessment required');
    if(cba!==null&&['NOT_ASSESSED','PROVISIONAL','PENDING_FINANCE_REVIEW','REWORK_REQUIRED'].includes(cbaStatus(item)))decisions.push(cbaStatus(item)==='REWORK_REQUIRED'?'CBA rework required':'CBA governance review');
    if((d.home31FitDecision||'')==='Needs Validation'||!String(d.home31FitDecision||'').trim())decisions.push('HOME31 fit validation');
    if(d.hrCollaborationRequirement==='Required'&&isPending(d.hrReviewStatus))decisions.push('HR review decision');
    if(d.hrReviewStatus==='Clarification required')decisions.push('HR clarification');
    if(d.systemType&&d.systemType!=='Non System'&&['N/A','None','New - Pending ICT review',''].includes(d.ictClassification||''))decisions.push('ICT classification');
    if(score<70)decisions.push('Evidence closure');
    if(approved>0&&!String(d.financeRemarks||'').trim()&&!p.financeReportingDate)decisions.push('Finance confirmation');
    if(item.status!=='DRAFT'&&!p.decisionReadinessStatus)decisions.push('Decision-readiness assessment');
    if(['MORE_INFORMATION_REQUIRED','NOT_READY'].includes(p.decisionReadinessStatus))decisions.push(pretty(p.decisionReadinessStatus));
    return [...new Set(decisions)];
  }
  function initiativeDeliveryHealth(item){
    const d=item.formData||{},status=d.deliveryStatus||displayStatus(item.status),risk=d.overallRiskLevel||displayRisk(item.priority),readiness=Number(d.readiness||0),score=evidenceScore(d),target=d.targetDate||item.targetDate,next=d.nextAction||'';
    if(status==='Completed'||item.status==='COMPLETED')return 'COMPLETED';
    if(target){const end=new Date(String(target).length===10?target+'T23:59:59':target);if(!isNaN(end)&&end<new Date())return 'CRITICAL';}
    if(status==='At Risk'||['High','Extreme'].includes(risk)||readiness<50||d.hrReviewStatus==='Not supported')return 'CRITICAL';
    const dueSoon=target&&daysUntil(target)>=0&&daysUntil(target)<=30;
    if(readiness<70||score<70||dueSoon||!String(next).trim()||isPending(d.hrReviewStatus)||(d.systemType&&d.systemType!=='Non System'&&isPending(d.ictClassification)))return 'WATCH';
    return 'ON_TRACK';
  }
  function buildDeliveryItems(sourceInitiatives,sourceProjects){
    const initiatives=sourceInitiatives.map(i=>{
      const d=i.formData||{},pillar=state.data.strategicPillars?.find(p=>p.id===(d.strategicPillarId||i.strategicPillarId));
      return {
        id:i.id,initiativeId:i.id,cycleId:i.cycleId,sourceType:'INITIATIVE',code:i.code,title:i.title,
        owner:d.projectOwnerName||i.owner||'Unassigned',ownerId:i.ownerId,departmentId:i.departmentId,departmentName:i.departmentName,year:i.year,
        status:coreStatus(d.deliveryStatus||displayStatus(i.status)),health:initiativeDeliveryHealth(i),progress:Number(d.progress??i.progress??0),readiness:Number(d.readiness||0),
        risk:d.overallRiskLevel||displayRisk(i.priority),startDate:d.startDate||i.startDate||'',targetDate:d.targetDate||i.targetDate||'',budget:Number(d.approvedBudget??i.approvedBudget??0),spent:Number(i.utilisedBudget||0),
        description:d.projectDescription||i.description||'',nextAction:d.nextAction||'',initiativeTitle:i.title,formData:d,cba:governedCba(i),cbaValidationStatus:cbaStatus(i),benefitStatus:benefitStatus(i),benefitActual:benefitActual(i),decisionReadinessStatus:phase3(i).decisionReadinessStatus||'',decisionReadinessScore:readinessScore(i),managementTreatment:phase3(i).managementTreatment||'',financeReportingDate:phase3(i).financeReportingDate||'',evidence:evidenceScore(d),
        hrReview:d.hrReviewStatus||'Not submitted',ictReview:d.ictClassification||'Not assessed',pillarId:d.strategicPillarId||i.strategicPillarId,pillarName:pillar?.name||i.strategicPillarName||'Not assigned',
        home31Fit:d.home31FitDecision||'Derived automatically',priorityStatus:d.priorityStatus||'Not Assessed',decisions:initiativeDecisionItems(i),rolesAffected:Number(d.rolesAffected||0)
      };
    });
    const projects=sourceProjects.map(p=>{
      const initiative=state.data.initiatives.find(i=>i.id===p.initiativeId),d=initiative?.formData||{},parent=initiatives.find(i=>i.initiativeId===p.initiativeId);
      return Object.assign({},p,{sourceType:'PROJECT',readiness:Number(d.readiness||0),risk:d.overallRiskLevel||'',nextAction:d.nextAction||'',initiativeTitle:p.initiativeTitle||initiative?.title||initiativeTitle(p.initiativeId),cba:governedCba(initiative),cbaValidationStatus:cbaStatus(initiative),benefitStatus:benefitStatus(initiative),benefitActual:benefitActual(initiative),decisionReadinessStatus:phase3(initiative).decisionReadinessStatus||'',decisionReadinessScore:readinessScore(initiative),managementTreatment:phase3(initiative).managementTreatment||'',financeReportingDate:phase3(initiative).financeReportingDate||'',evidence:evidenceScore(d),hrReview:d.hrReviewStatus||'Not submitted',ictReview:d.ictClassification||'Not assessed',pillarId:d.strategicPillarId||initiative?.strategicPillarId,pillarName:parent?.pillarName||initiative?.strategicPillarName||'Not assigned',home31Fit:d.home31FitDecision||'Derived automatically',priorityStatus:d.priorityStatus||'Not Assessed',decisions:parent?.decisions||[],rolesAffected:Number(d.rolesAffected||0),health:projectCommandHealth(p,parent)});
    });
    return initiatives.concat(projects).sort((a,b)=>Number(b.year)-Number(a.year)||String(a.sourceType).localeCompare(String(b.sourceType))||String(a.title).localeCompare(String(b.title)));
  }
  function projectCommandHealth(project,parent){
    if(project.status==='COMPLETED')return 'COMPLETED';
    if(project.health==='DELAYED')return 'CRITICAL';
    if(project.health==='AT_RISK')return 'WATCH';
    if(parent?.health==='CRITICAL')return 'WATCH';
    return 'ON_TRACK';
  }
  function scopedDeliveryItems(){return buildDeliveryItems(scopedInitiatives(),scopedProjects());}
  function dashboardDeliveryItems(){
    let items=buildDeliveryItems(dashboardScopedInitiatives(),dashboardScopedProjects());
    if(state.dashboardRecordType==='initiatives')items=items.filter(i=>i.sourceType==='INITIATIVE');
    if(state.dashboardRecordType==='projects')items=items.filter(i=>i.sourceType==='PROJECT');
    return items;
  }
  function dashboardQuadrantForInitiative(item){
    const benefit=initiativeBenefitScore(item),complexity=initiativeComplexityScore(item);
    if(benefit===null||complexity===null)return 'unassessed';
    if(benefit>=3&&complexity<3)return 'quick-wins';
    if(benefit>=3&&complexity>=3)return 'strategic-investments';
    if(benefit<3&&complexity>=3)return 'reconsider';
    return 'fill-ins';
  }
  function dashboardQualityMatches(item,key){
    if(key==='ownership')return !String(item.owner||'').trim()||item.owner==='Unassigned';
    if(key==='budget')return !(Number(item.budget||0)>0);
    if(key==='target')return !item.targetDate;
    if(key==='cba')return item.cba===null;
    if(key==='evidence')return Number(item.evidence||0)<70;
    if(key==='next-action')return !String(item.nextAction||'').trim();
    if(key==='hr')return !item.hrReview||['Not submitted','Not assessed','Not Assessed'].includes(item.hrReview);
    if(key==='ict')return !item.ictReview||['Not assessed','Not Assessed','N/A','None'].includes(item.ictReview);
    return true;
  }
  function dashboardViewItems(items){
    let visible=items.slice();
    if(state.dashboardView==='critical')visible=visible.filter(i=>i.health==='CRITICAL');
    else if(state.dashboardView==='risk')visible=visible.filter(i=>['CRITICAL','WATCH'].includes(i.health));
    else if(state.dashboardView==='watch')visible=visible.filter(i=>i.health==='WATCH');
    else if(state.dashboardView==='overdue')visible=visible.filter(i=>isOverdue(i));
    else if(state.dashboardView==='decisions')visible=visible.filter(i=>i.decisions?.length);
    else if(state.dashboardView==='missing')visible=visible.filter(i=>!i.targetDate||!i.nextAction||!i.owner||i.evidence<70);
    else if(state.dashboardView==='high-cba')visible=visible.filter(i=>i.cba!==null&&i.cba>=1);
    else if(state.dashboardView==='low-cba')visible=visible.filter(i=>i.cba!==null&&i.cba<1);
    if(state.dashboardQuarter!=='all')visible=visible.filter(i=>quarterOf(i.startDate)===Number(state.dashboardQuarter)||quarterOf(i.targetDate)===Number(state.dashboardQuarter));
    if(state.dashboardQuadrant!=='all')visible=visible.filter(i=>{const initiative=state.data.initiatives.find(x=>x.id===i.initiativeId);return initiative&&dashboardQuadrantForInitiative(initiative)===state.dashboardQuadrant;});
    if(state.dashboardQuality!=='all')visible=visible.filter(i=>dashboardQualityMatches(i,state.dashboardQuality));
    return visible;
  }
  function dashboardActiveFilterBanner(items){
    const chips=[];
    if(state.dashboardView!=='all')chips.push(pretty(state.dashboardView));
    if(state.dashboardQuarter!=='all')chips.push('Q'+state.dashboardQuarter);
    if(state.dashboardQuadrant!=='all')chips.push(pretty(state.dashboardQuadrant));
    if(state.dashboardQuality!=='all')chips.push('Missing '+pretty(state.dashboardQuality));
    if(state.dashboardPillar!=='all'){const p=state.data.strategicPillars.find(x=>x.id===state.dashboardPillar);if(p)chips.push(p.name);}
    if(state.filters.department!=='all')chips.push(departmentName(state.filters.department));
    if(!chips.length)return '';
    return `<section class="dashboard-active-filter"><div><span>Current interactive view</span><strong>${chips.map(escapeHtml).join(' · ')}</strong><small>${dashboardViewItems(items).length} matching delivery records</small></div><button class="btn outline compact" data-action="dashboard-clear-interactions">Clear chart selections</button></section>`;
  }
  function budgetTotals(items){return items.reduce((a,i)=>{a.requested+=Number(i.requestedBudget||0);a.approved+=Number(i.approvedBudget||0);a.committed+=financeValue(i,'committedAmount',i.committedBudget);a.utilised+=financeValue(i,'utilisedAmount',i.utilisedBudget);return a;},{requested:0,approved:0,committed:0,utilised:0});}
  function numberOrNull(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
  function daysUntil(value){if(!value)return null;const today=new Date();today.setHours(0,0,0,0);const date=new Date(String(value).length===10?value+'T00:00:00':value);if(isNaN(date))return null;return Math.ceil((date-today)/86400000);}
  function isOverdue(item){const days=daysUntil(item.targetDate);return days!==null&&days<0&&item.status!=='COMPLETED'&&item.health!=='COMPLETED';}
  function commandStatusLabel(health){return health==='CRITICAL'?'Critical':health==='WATCH'?'Watch':health==='COMPLETED'?'Completed':'On Track';}
  function managementClass(health){return health==='CRITICAL'?'critical':health==='WATCH'?'watch':health==='COMPLETED'?'completed':'stable';}
  function cbaStats(initiatives){
    const assessed=initiatives.map(i=>({i,value:governedCba(i),budget:Number(i.formData?.approvedBudget??i.approvedBudget??0)})).filter(x=>x.value!==null);
    const weightedBase=assessed.filter(x=>x.budget>0),weightedDen=weightedBase.reduce((s,x)=>s+x.budget,0);
    const average=weightedDen?weightedBase.reduce((s,x)=>s+x.value*x.budget,0)/weightedDen:(assessed.length?assessed.reduce((s,x)=>s+x.value,0)/assessed.length:null);
    return {assessed:assessed.length,missing:initiatives.length-assessed.length,average,positive:assessed.filter(x=>x.value>=1).length,validated:initiatives.filter(i=>cbaStatus(i)==='VALIDATED').length,pending:initiatives.filter(i=>['PROVISIONAL','PENDING_FINANCE_REVIEW','REWORK_REQUIRED'].includes(cbaStatus(i))).length};
  }
  function budgetJourney(initiatives){
    const stages=[['Initial estimate','initialEstimatedCost'],['Post-challenge','postChallengeEstimatedCost'],['Proposed budget','proposedBudget'],['Approved budget','approvedBudget']];
    return stages.map(([label,key])=>{const values=initiatives.map(i=>numberOrNull(i.formData?.[key]??(key==='initialEstimatedCost'?i.requestedBudget:key==='approvedBudget'?i.approvedBudget:null))).filter(v=>v!==null);return {label,value:values.reduce((s,v)=>s+v,0),coverage:values.length,total:initiatives.length};});
  }
  function renderBudgetJourneyCard(initiatives){
    const stages=budgetJourney(initiatives);
    const stageClass=['initial','challenge','retreat','approved'];
    const stageHelp=[
      'Original estimated requirement before challenge and prioritisation.',
      'Recorded amount after the formal challenge review.',
      'Amount proposed for management approval.',
      'Official portfolio cost basis used by HOME31.'
    ];
    const comparable=initiatives.map(i=>{
      const initial=numberOrNull(i.formData?.initialEstimatedCost??i.requestedBudget);
      const approved=numberOrNull(i.formData?.approvedBudget??i.approvedBudget);
      return initial!==null&&approved!==null?{initial,approved}:null;
    }).filter(Boolean);
    const completeJourneyCount=initiatives.filter(i=>[
      numberOrNull(i.formData?.initialEstimatedCost??i.requestedBudget),
      numberOrNull(i.formData?.postChallengeEstimatedCost),
      numberOrNull(i.formData?.proposedBudget),
      numberOrNull(i.formData?.approvedBudget??i.approvedBudget)
    ].every(v=>v!==null)).length;
    const comparableInitial=comparable.reduce((s,r)=>s+r.initial,0);
    const comparableApproved=comparable.reduce((s,r)=>s+r.approved,0);
    const savings=comparableInitial-comparableApproved;
    const savingsPct=comparableInitial?Math.round((savings/comparableInitial)*1000)/10:null;
    const missing=stages.reduce((s,r)=>s+(r.total-r.coverage),0);
    const savingsLabel=!comparable.length?'Not comparable':money(savings);
    const savingsMeta=!comparable.length?'No records contain both Initial Estimate and Approved Budget':`${savingsPct>=0?'Reduction':'Increase'} of ${Math.abs(savingsPct).toFixed(1)}% from Initial Estimate to Approved Budget`;
    const stageShort=['Original requirement','After challenge review','Submitted for approval','Official cost basis'];
    return `<article class="budget-journey-card card has-tooltip" data-tooltip="Exact recorded portfolio amounts for each budget stage. Missing entries are reported as missing and are never converted to RM 0."><div class="budget-journey-header"><div><span class="eyebrow">Budget journey</span><h2>Estimate to approval</h2></div><div class="budget-journey-saving ${savings<0?'negative':''}"><small>${savings<0?'Budget increase':'Estimate-to-approval reduction'}</small><strong>${savingsLabel}</strong><span>${escapeHtml(savingsMeta)}</span></div></div><div class="budget-journey-stages">${stages.map((r,idx)=>`<div class="budget-journey-stage ${stageClass[idx]} has-tooltip" data-tooltip="${escapeAttr(r.label+': '+(r.coverage?money(r.value):'Not recorded')+'. '+stageHelp[idx]+' Coverage: '+r.coverage+' of '+r.total+' initiative cycles; '+(r.total-r.coverage)+' missing.')}"><span>${escapeHtml(r.label)}</span><strong>${r.coverage?money(r.value):'Not recorded'}</strong><small class="budget-journey-stage-help">${stageShort[idx]}</small><small class="budget-journey-stage-coverage">${r.coverage} of ${r.total} recorded${r.total-r.coverage?` · ${r.total-r.coverage} missing`:''}</small></div>`).join('')}</div><div class="budget-journey-footer"><span><b>${comparable.length}</b> Initial vs Approved comparable</span><span><b>${completeJourneyCount}</b> complete four-stage</span><span><b>${missing}</b> missing stage values</span></div></article>`;
  }
  function dashboardFitOptions(){const values=[...new Set((state.data.initiatives||[]).map(i=>i.formData?.home31FitDecision||'Derived automatically'))].sort();return `<option value="all">All HOME31 fit</option>${values.map(v=>`<option value="${escapeAttr(v)}" ${state.dashboardFit===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}`;}
  function renderDashboardFilters(){
    return `<div class="command-filter-grid"><label><span>Dashboard year</span><select data-dashboard-year>${dashboardYearOptions(state.dashboardYear)}</select></label><label><span>Department</span><select data-filter="department">${departmentOptions(state.filters.department,true)}</select></label><label><span>Record type</span><select data-dashboard-filter="recordType"><option value="all" ${state.dashboardRecordType==='all'?'selected':''}>Initiatives + Projects</option><option value="initiatives" ${state.dashboardRecordType==='initiatives'?'selected':''}>Initiatives only</option><option value="projects" ${state.dashboardRecordType==='projects'?'selected':''}>Linked projects only</option></select></label><label><span>Strategic pillar</span><select data-dashboard-filter="pillar"><option value="all">All pillars</option>${(state.data.strategicPillars||[]).map(p=>`<option value="${p.id}" ${state.dashboardPillar===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select></label><label><span>HOME31 fit</span><select data-dashboard-filter="fit">${dashboardFitOptions()}</select></label><label><span>Risk</span><select data-dashboard-filter="risk"><option value="all">All risk</option>${['LOW','MEDIUM','HIGH','EXTREME'].map(r=>`<option value="${r}" ${state.dashboardRisk===r?'selected':''}>${pretty(r)}</option>`).join('')}</select></label><button class="btn outline compact" data-action="dashboard-reset">Reset</button><button class="btn outline compact" data-action="print">Print</button></div>`;
  }
  function commandTooltip(label,meta){
    const help={
      'Approved Budget':'Total official Approved Budget for all initiative cycles in the current Command Center filters.',
      'Active Delivery':'Number of initiatives and linked projects that are not completed in the selected scope.',
      'On Track':'Delivery records progressing within the current schedule, readiness and risk controls.',
      'At Risk':'Delivery records classified as Watch or Critical and requiring management follow-up.',
      'Overdue':'Incomplete delivery records whose target date has already passed.',
      'Decisions Required':'Initiatives with unresolved management, CBA, Finance, HR, ICT, HOME31-fit or evidence decisions.'
    };
    return help[label]||meta||label;
  }
  function commandKpi(label,value,meta,icon,view,klass){return `<button class="command-kpi has-tooltip ${klass||''} ${state.dashboardView===view?'active':''}" data-tooltip="${escapeAttr(commandTooltip(label,meta))}" aria-label="${escapeAttr(label+': '+String(value).replace(/<[^>]*>/g,''))}" data-action="dashboard-view" data-view="${view}"><span class="command-kpi-top"><b>${escapeHtml(label)}</b><i>${icon}</i></span><strong>${value}</strong><small>${meta}</small></button>`;}
  function executiveInsight(initiatives,items,totals,decisions){
    const critical=items.filter(i=>i.health==='CRITICAL').length,watch=items.filter(i=>i.health==='WATCH').length,overdue=items.filter(isOverdue).length,cba=cbaStats(initiatives),largest=initiatives.slice().sort((a,b)=>Number(b.approvedBudget||0)-Number(a.approvedBudget||0))[0];
    if(!items.length)return 'No delivery records match the current Command Center scope. Adjust the filters or create an initiative record.';
    const parts=[`${items.length} delivery records are visible across ${initiatives.length} initiative cycles and ${items.filter(i=>i.sourceType==='PROJECT').length} linked projects.`,`${money(totals.approved)} is recorded as Approved Budget.`];
    if(critical||watch)parts.push(`${critical} critical and ${watch} watch records require attention${overdue?`, including ${overdue} overdue`:''}.`);else parts.push('No critical or watch delivery records are currently identified.');
    if(decisions.length)parts.push(`${decisions.length} initiatives have unresolved management or functional decisions.`);
    if(cba.missing)parts.push(`${cba.missing} initiatives do not yet have a CBA ratio.`);
    if(largest)parts.push(`${largest.title} is the largest approved investment in the current scope.`);
    return parts.join(' ');
  }
  function renderAttentionLanes(items){
    const lanes=[['Critical','critical',items.filter(i=>i.health==='CRITICAL')],['Watchlist','watch',items.filter(i=>i.health==='WATCH')],['Stable / completed','stable',items.filter(i=>['ON_TRACK','COMPLETED'].includes(i.health))]];
    return `<section class="command-section"><div class="command-section-heading"><div><span class="eyebrow">Management attention</span><h2>Act on exceptions first</h2><p>Delivery records are grouped using saved status, dates, risk, readiness, evidence and functional-review information.</p></div></div><div class="attention-lanes">${lanes.map(([label,klass,rows])=>`<article class="attention-lane ${klass}"><header><div><span>${label}</span><strong>${rows.length}</strong></div><small>${klass==='critical'?'Immediate intervention':klass==='watch'?'Clarification or follow-up':'Progressing within current controls'}</small></header><div>${rows.slice(0,5).map(i=>`<button data-action="${i.sourceType==='INITIATIVE'?'view-initiative':'view-project'}" data-id="${i.sourceType==='INITIATIVE'?i.initiativeId:i.id}" class="attention-record"><span><b>${escapeHtml(i.title)}</b><small>AMP ${i.year} · ${escapeHtml(i.departmentName||departmentName(i.departmentId))}</small></span><em>${escapeHtml(i.decisions?.[0]||i.nextAction||commandStatusLabel(i.health))}</em></button>`).join('')||'<div class="command-empty">No records in this lane.</div>'}</div></article>`).join('')}</div></section>`;
  }

  function chartSummary(text,tone){
    return `<div class="chart-summary ${tone||'neutral'}"><span>What this means</span><p>${escapeHtml(text)}</p></div>`;
  }
  function initiativeBenefitScore(item){
    const d=item.formData||{};
    const direct=numberOrNull(d.expectedBenefitScore??d.benefitScore??d.strategicValueScore);
    if(direct!==null)return Math.max(1,Math.min(5,direct));
    const cba=governedCba(item);
    if(cba!==null)return Math.max(1,Math.min(5,1+cba));
    const readiness=numberOrNull(d.readiness);
    return readiness!==null?Math.max(1,Math.min(5,readiness/20)):null;
  }
  function initiativeComplexityScore(item){
    const d=item.formData||{};
    const direct=numberOrNull(d.deliveryComplexityScore??d.complexityScore??d.implementationComplexity);
    if(direct!==null)return Math.max(1,Math.min(5,direct));
    let score=1;
    if(Number(d.rolesAffected||0)>=20)score+=1;
    if(d.systemType&&d.systemType!=='Non System')score+=1;
    if(['High','Extreme'].includes(d.overallRiskLevel||displayRisk(item.priority)))score+=1;
    if(d.hrCollaborationRequirement==='Required')score+=1;
    return Math.max(1,Math.min(5,score));
  }
  function renderCostBenefitComplexityMatrix(initiatives){
    const rows=initiatives.map(i=>({i,benefit:initiativeBenefitScore(i),complexity:initiativeComplexityScore(i),budget:Number(i.formData?.approvedBudget??i.approvedBudget??0),health:initiativeDeliveryHealth(i)})).filter(x=>x.benefit!==null&&x.complexity!==null);
    if(!rows.length)return '<div class="command-empty chart-empty"><strong>No prioritisation points available</strong>Add benefit and complexity information to populate this matrix.</div>'+chartSummary('No initiatives can be compared yet because benefit or complexity information is missing.','warning');
    const w=760,h=360,pad=54,maxBudget=Math.max(...rows.map(x=>x.budget),1);
    const x=v=>pad+((v-1)/4)*(w-pad*2),y=v=>h-pad-((v-1)/4)*(h-pad*2);
    const grid=[1,2,3,4,5].map(v=>`<line x1="${x(v)}" y1="${pad}" x2="${x(v)}" y2="${h-pad}" class="matrix-grid"/><line x1="${pad}" y1="${y(v)}" x2="${w-pad}" y2="${y(v)}" class="matrix-grid"/>`).join('');
    const points=rows.map(r=>{const cx=x(r.complexity),cy=y(r.benefit),radius=Math.max(8,Math.min(22,8+Math.sqrt(r.budget/maxBudget)*14));return `<g class="matrix-point interactive ${managementClass(r.health)}" data-action="view-initiative" data-id="${r.i.id}" tabindex="0"><circle cx="${cx}" cy="${cy}" r="${radius}"><title>${escapeHtml(r.i.title)} · Benefit ${r.benefit.toFixed(1)}/5 · Complexity ${r.complexity.toFixed(1)}/5 · ${money(r.budget)}</title></circle>${rows.length<=12?`<text x="${cx+radius+5}" y="${cy+3}">${escapeHtml(shortText(r.i.title,18))}</text>`:''}</g>`}).join('');
    const quick=rows.filter(r=>r.benefit>=3&&r.complexity<3).length,strategic=rows.filter(r=>r.benefit>=3&&r.complexity>=3).length,reconsider=rows.filter(r=>r.benefit<3&&r.complexity>=3).length;
    const summary=quick?`${quick} quick-win initiative${quick===1?' is':'s are'} positioned for priority delivery. ${strategic} strategic investment${strategic===1?' requires':'s require'} stronger governance due to higher complexity.`:strategic?`${strategic} initiative${strategic===1?' is':'s are'} concentrated in the high-benefit, high-complexity area and should be governed closely.`:reconsider?`${reconsider} initiative${reconsider===1?' has':'s have'} relatively high complexity compared with expected benefit and may need scope review.`:'The current portfolio is concentrated in lower-complexity delivery.';
    return `<div class="matrix-quadrant-controls">${[['quick-wins','Quick Wins',quick],['strategic-investments','Strategic Investments',strategic],['fill-ins','Fill-ins',rows.filter(r=>r.benefit<3&&r.complexity<3).length],['reconsider','Reconsider',reconsider]].map(([id,label,count])=>`<button data-action="dashboard-quadrant" data-quadrant="${id}" class="${state.dashboardQuadrant===id?'active':''}"><span>${label}</span><strong>${count}</strong></button>`).join('')}</div><div class="matrix-wrap"><svg class="cba-matrix" viewBox="0 0 ${w} ${h}" role="img" aria-label="Cost benefit complexity matrix">${grid}<line x1="${x(3)}" y1="${pad}" x2="${x(3)}" y2="${h-pad}" class="matrix-threshold"/><line x1="${pad}" y1="${y(3)}" x2="${w-pad}" y2="${y(3)}" class="matrix-threshold"/><text x="${pad+10}" y="${pad+18}" class="quadrant-label">Quick Wins</text><text x="${w-pad-10}" y="${pad+18}" text-anchor="end" class="quadrant-label">Strategic Investments</text><text x="${pad+10}" y="${h-pad-10}" class="quadrant-label">Fill-ins</text><text x="${w-pad-10}" y="${h-pad-10}" text-anchor="end" class="quadrant-label">Reconsider</text><text x="${w/2}" y="${h-10}" class="axis-label">Delivery Complexity</text><text transform="translate(16 ${h/2}) rotate(-90)" class="axis-label">Expected Benefit</text>${points}</svg><div class="matrix-legend"><span class="stable">On Track</span><span class="watch">Watch</span><span class="critical">Critical</span><small>Bubble size represents Approved Budget. Scores use saved values where available and derived indicators otherwise.</small></div></div>${chartSummary(summary,quick||strategic?'positive':'neutral')}`;
  }
  function quarterOf(dateValue){const d=new Date(String(dateValue||'').length===10?dateValue+'T00:00:00':dateValue);return isNaN(d)?null:Math.floor(d.getMonth()/3)+1;}
  function renderQuarterlyDeliveryLoad(items){
    const quarters=[1,2,3,4].map(q=>({quarter:'Q'+q,active:0,completions:0,overdue:0,budget:0}));
    items.forEach(i=>{const startQ=quarterOf(i.startDate),targetQ=quarterOf(i.targetDate);if(startQ)quarters[startQ-1].active++;if(targetQ){quarters[targetQ-1].completions++;quarters[targetQ-1].budget+=Number(i.budget||0);if(isOverdue(i))quarters[targetQ-1].overdue++;}});
    const max=Math.max(1,...quarters.map(q=>q.active+q.completions+q.overdue));
    const bars=quarters.map(q=>{const total=q.active+q.completions+q.overdue;return `<button class="quarter-column has-tooltip ${state.dashboardQuarter===String(q.quarter.slice(1))?'active':''}" data-action="dashboard-quarter" data-quarter="${q.quarter.slice(1)}" data-tooltip="${escapeAttr(`${q.quarter}: ${q.active} planned starts, ${q.completions} target completions, ${q.overdue} overdue carry-forward, ${money(q.budget)} budget tied to target completions.`)}"><div class="quarter-stack" style="height:${Math.max(10,total/max*190)}px"><i class="quarter-active" style="flex:${q.active||0}"></i><i class="quarter-complete" style="flex:${q.completions||0}"></i><i class="quarter-overdue" style="flex:${q.overdue||0}"></i></div><strong>${q.quarter}</strong><small>${total} load items</small></button>`}).join('');
    const peak=quarters.slice().sort((a,b)=>(b.active+b.completions+b.overdue)-(a.active+a.completions+a.overdue))[0],totalLoad=quarters.reduce((s,q)=>s+q.active+q.completions+q.overdue,0),peakLoad=peak.active+peak.completions+peak.overdue;
    const summary=totalLoad?`${peak.quarter} has the highest delivery concentration with ${peakLoad} scheduled load item${peakLoad===1?'':'s'}. ${peak.overdue?peak.overdue+' overdue item'+(peak.overdue===1?' is':'s are')+' included and require follow-up.':'No overdue carry-forward is concentrated in this quarter.'}`:'No dated delivery activity is available for quarterly analysis.';
    return `<div class="quarterly-load-chart"><div class="quarter-columns">${bars}</div><div class="quarter-legend"><span class="active">Planned start</span><span class="complete">Target completion</span><span class="overdue">Overdue carry-forward</span></div></div>${chartSummary(summary,peak.overdue?'warning':'positive')}`;
  }

  function renderCbaMatrix(initiatives){
    const rows=initiatives.map(i=>{const d=i.formData||{},cba=governedCba(i),budget=numberOrNull(d.approvedBudget??i.approvedBudget);return {i,d,cba,budget,health:initiativeDeliveryHealth(i)};}).filter(x=>x.cba!==null&&x.budget!==null);
    if(!rows.length)return '<div class="command-empty chart-empty"><strong>No CBA points available</strong>Enter CBA Ratio and Approved Budget to populate the matrix.</div>';
    const maxBudget=Math.max(...rows.map(x=>x.budget),1),maxCba=Math.max(...rows.map(x=>x.cba),1.5),w=760,h=320,pad=48;
    const grid=[0,.25,.5,.75,1].map(t=>`<line x1="${pad}" y1="${pad+(h-pad*2)*t}" x2="${w-pad}" y2="${pad+(h-pad*2)*t}" class="matrix-grid"/>`).join('');
    const points=rows.map((x,index)=>{const cx=pad+(x.budget/maxBudget)*(w-pad*2),cy=h-pad-(x.cba/maxCba)*(h-pad*2),r=Math.max(7,Math.min(18,7+Math.sqrt(Number(x.d.rolesAffected||0))*1.6));return `<g class="matrix-point ${managementClass(x.health)}"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}"><title>${escapeHtml(x.i.title)} · ${money(x.budget)} · CBA ${x.cba.toFixed(2)}</title></circle>${rows.length<=10?`<text x="${(cx+r+4).toFixed(1)}" y="${(cy+3).toFixed(1)}">${escapeHtml(shortText(x.i.title,20))}</text>`:''}</g>`;}).join('');
    const y1=h-pad-(1/maxCba)*(h-pad*2);
    return `<div class="matrix-wrap"><svg class="cba-matrix" viewBox="0 0 ${w} ${h}" role="img" aria-label="Approved Budget versus CBA ratio">${grid}<line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="matrix-axis"/><line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" class="matrix-axis"/><line x1="${pad}" y1="${y1.toFixed(1)}" x2="${w-pad}" y2="${y1.toFixed(1)}" class="matrix-threshold"/><text x="${w/2}" y="${h-8}" class="axis-label">Approved Budget</text><text transform="translate(14 ${h/2}) rotate(-90)" class="axis-label">CBA Ratio</text><text x="${w-pad-4}" y="${(y1-6).toFixed(1)}" text-anchor="end" class="threshold-label">CBA 1.0 reference</text>${points}</svg><div class="matrix-legend"><span class="stable">On track</span><span class="watch">Watch</span><span class="critical">Critical</span><small>Bubble size reflects estimated roles affected where recorded. CBA 1.0 is shown as a reference, not an approved HOME31 decision threshold.</small></div></div>`;
  }
  function shortText(value,max){const text=String(value||'');return text.length>max?text.slice(0,max-1)+'…':text;}
  function renderBudgetJourney(initiatives){
    const stages=budgetJourney(initiatives),max=Math.max(...stages.map(s=>s.value),1);
    return `<div class="budget-journey">${stages.map((s,index)=>`<div class="budget-stage"><div class="budget-stage-label"><span>${escapeHtml(s.label)}</span><small>${s.coverage}/${s.total} records</small></div><div class="budget-stage-track"><i style="width:${s.value?Math.max(4,s.value/max*100):0}%"></i></div><strong>${s.coverage?money(s.value):'Not recorded'}</strong>${index<stages.length-1?'<b class="budget-arrow">→</b>':''}</div>`).join('')}</div>`;
  }
  function renderFunctionalAssurance(initiatives){
    const hr=initiatives.filter(i=>i.formData?.hrCollaborationRequirement==='Required'),hrPending=hr.filter(i=>isPending(i.formData?.hrReviewStatus)).length;
    const ict=initiatives.filter(i=>i.formData?.systemType&&i.formData.systemType!=='Non System'),ictPending=ict.filter(i=>['','N/A','None','New - Pending ICT review'].includes(i.formData?.ictClassification||'')).length;
    const financeMissing=initiatives.filter(i=>Number(i.formData?.approvedBudget??i.approvedBudget??0)>0&&!phase3(i).financeReportingDate&&!String(i.formData?.financeRemarks||'').trim()).length;
    const evidenceAvg=initiatives.length?Math.round(initiatives.reduce((s,i)=>s+evidenceScore(i.formData||{}),0)/initiatives.length):0;
    return `<div class="assurance-grid"><article><span>HR & Change</span><strong>${hrPending}</strong><small>${hr.length} require collaboration · pending review</small></article><article><span>ICT & Architecture</span><strong>${ictPending}</strong><small>${ict.length} system initiatives · pending classification</small></article><article><span>Finance</span><strong>${financeMissing}</strong><small>Approved records without a Finance update or remarks</small></article><article><span>Evidence</span><strong>${evidenceAvg}%</strong><small>Average evidence completeness</small></article></div>`;
  }
  function renderBenefitsRealisation(initiatives){
    const rows=initiatives.filter(i=>{const d=i.formData||{},p=phase3(i);return d.valueMeasure||d.baselineValue||d.targetValue||p.benefitStatus;}).slice().sort((a,b)=>String(a.title).localeCompare(String(b.title)));
    return `<section class="card table-card command-table-panel"><div class="table-header"><div><strong>Benefits realisation</strong><span class="dashboard-table-note">Baseline and target from the initiative form, with governed actual measurements from Phase 3.</span></div><span class="muted">${rows.length} value cases</span></div><div class="table-wrap"><table><thead><tr><th>Initiative</th><th>Year</th><th>Value measure</th><th>Baseline</th><th>Target</th><th>Actual achieved</th><th>Benefit status</th><th>Measurement date</th><th>Next measurement</th><th>Action</th></tr></thead><tbody>${rows.length?rows.map(i=>{const d=i.formData||{},p=phase3(i);return `<tr><td><strong>${escapeHtml(i.title)}</strong></td><td>AMP ${i.year}</td><td>${escapeHtml(d.valueMeasure||'Not recorded')}</td><td>${escapeHtml(d.baselineValue||'Not recorded')}</td><td>${escapeHtml(d.targetValue||'Not recorded')}</td><td>${escapeHtml(benefitActual(i))}</td><td>${statusBadge(benefitStatus(i))}</td><td>${formatDate(p.latestBenefitMeasurementDate)}</td><td>${formatDate(p.nextMeasurementDate)}</td><td><button class="action-button" data-action="manage-phase3" data-id="${i.id}" data-tab="benefits">Manage</button></td></tr>`;}).join(''):'<tr><td colspan="10"><div class="empty-state compact"><strong>No benefits measures recorded</strong>Add a value measure, baseline and target in Step 3.</div></td></tr>'}</tbody></table></div></section>`;
  }
  function renderHome31Fit(initiatives){
    const groups=new Map();initiatives.forEach(i=>{const key=i.formData?.home31FitDecision||'Derived automatically';groups.set(key,(groups.get(key)||0)+1);});
    const rows=[...groups.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count),max=Math.max(...rows.map(r=>r.count),1);
    return rows.length?`<div class="fit-bars">${rows.map(r=>`<div class="has-tooltip" data-tooltip="${escapeAttr(r.name+': '+r.count+' initiative'+(r.count===1?'':'s'))}"><span>${escapeHtml(r.name)}</span><div class="bar-track"><i class="bar-fill" style="width:${r.count/max*100}%"></i></div><strong>${r.count}</strong></div>`).join('')}</div>`:'<div class="command-empty chart-empty">No HOME31 fit classification is available.</div>';
  }
  function renderRiskExposure(initiatives,items){
    const high=initiatives.filter(i=>['High','Extreme'].includes(i.formData?.overallRiskLevel||displayRisk(i.priority))),atRiskIds=new Set(items.filter(i=>['CRITICAL','WATCH'].includes(i.health)).map(i=>i.initiativeId));
    const exposed=initiatives.filter(i=>atRiskIds.has(i.id)).reduce((s,i)=>s+Number(i.formData?.approvedBudget??i.approvedBudget??0),0),lowReadiness=initiatives.filter(i=>Number(i.formData?.readiness||0)<70).length,missingAction=initiatives.filter(i=>!String(i.formData?.nextAction||'').trim()).length;
    return `<div class="risk-exposure-grid"><article><span>High / Extreme risk</span><strong>${high.length}</strong><small>Initiative-level risk rating</small></article><article><span>Budget exposed</span><strong>${money(exposed)}</strong><small>Approved Budget in Critical or Watch delivery</small></article><article><span>Readiness below 70%</span><strong>${lowReadiness}</strong><small>Corrective action required</small></article><article><span>Next action missing</span><strong>${missingAction}</strong><small>Immediate follow-up not recorded</small></article></div>`;
  }

  function renderDecisionQueue(initiatives){
    const rows=initiatives.map(i=>({i,decisions:initiativeDecisionItems(i)})).filter(x=>x.decisions.length).sort((a,b)=>b.decisions.length-a.decisions.length);
    return `<section class="card table-card command-table-panel"><div class="table-header"><div><strong>Decisions required queue</strong><span class="dashboard-table-note">Unresolved management, CBA, Finance, HR, ICT, strategic-fit and evidence matters.</span></div><span class="badge ${rows.length?'amber':'green'}">${rows.length} initiatives</span></div><div class="table-wrap"><table><thead><tr><th>Initiative</th><th>Year</th><th>Department</th><th>Decision required</th><th>Owner</th><th>Target</th><th>Action</th></tr></thead><tbody>${rows.length?rows.map(({i,decisions})=>`<tr><td><strong>${escapeHtml(i.title)}</strong><br><span class="muted">${escapeHtml(i.code)}</span></td><td>AMP ${i.year}</td><td>${escapeHtml(i.departmentName||departmentName(i.departmentId))}</td><td>${decisions.map(d=>`<span class="decision-chip">${escapeHtml(d)}</span>`).join('')}</td><td>${escapeHtml(i.formData?.projectOwnerName||i.owner||'Unassigned')}</td><td>${formatDate(i.formData?.targetDate||i.targetDate)}</td><td><button class="action-button" data-action="manage-phase3" data-id="${i.id}" data-tab="readiness">Manage</button></td></tr>`).join(''):'<tr><td colspan="7"><div class="empty-state compact"><strong>No unresolved decision items</strong>The selected records meet the current automated checks.</div></td></tr>'}</tbody></table></div></section>`;
  }
  function renderDepartmentMatrix(initiatives,items){
    const rows=state.data.departments.map(d=>{const ii=initiatives.filter(i=>i.departmentId===d.id),dd=items.filter(i=>i.departmentId===d.id);if(!ii.length&&!dd.length)return null;const budget=ii.reduce((s,i)=>s+Number(i.approvedBudget||0),0),progress=dd.length?Math.round(dd.reduce((s,i)=>s+Number(i.progress||0),0)/dd.length):0,readiness=ii.length?Math.round(ii.reduce((s,i)=>s+Number(i.formData?.readiness||0),0)/ii.length):0,risk=dd.filter(i=>['CRITICAL','WATCH'].includes(i.health)).length,decisions=ii.filter(i=>initiativeDecisionItems(i).length).length;return {d,delivery:dd.length,budget,progress,readiness,risk,decisions};}).filter(Boolean).sort((a,b)=>b.budget-a.budget);
    return `<section class="card table-card command-table-panel"><div class="table-header"><div><strong>Department performance matrix</strong><span class="dashboard-table-note">Budget, execution, readiness, attention and decision position by department.</span></div><span class="muted">${rows.length} departments</span></div><div class="table-wrap"><table><thead><tr><th>Department</th><th>Delivery records</th><th class="amount">Approved Budget</th><th>Average progress</th><th>Average readiness</th><th>Attention</th><th>Decisions</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${escapeHtml(r.d.name)}</strong><br><span class="muted">${escapeHtml(r.d.code)}</span></td><td>${r.delivery}</td><td class="amount">${money(r.budget)}</td><td>${progressMini(r.progress)}</td><td>${progressMini(r.readiness)}</td><td>${r.risk?`<span class="badge amber">${r.risk}</span>`:'<span class="badge green">0</span>'}</td><td>${r.decisions?`<span class="badge amber">${r.decisions}</span>`:'<span class="badge green">0</span>'}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function progressMini(value){return `<div class="progress-cell"><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Number(value||0))}%"></div></div>${Number(value||0)}%</div>`;}
  function renderAmpTrend(initiatives){
    const years=[...new Set(initiatives.map(i=>Number(i.year)))].sort((a,b)=>a-b),rows=years.map(year=>{const list=initiatives.filter(i=>Number(i.year)===year);return {year,count:list.length,budget:list.reduce((s,i)=>s+Number(i.approvedBudget||0),0)};});
    if(!rows.length)return '<div class="command-empty chart-empty">No annual records are available.</div>';
    const w=680,h=270,pad=42,max=Math.max(...rows.map(r=>r.budget),1),step=rows.length>1?(w-pad*2)/(rows.length-1):0;
    const pts=rows.map((r,index)=>({x:rows.length>1?pad+index*step:w/2,y:h-pad-(r.budget/max)*(h-pad*2),...r})),poly=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const grid=[0,.25,.5,.75,1].map(t=>`<line x1="${pad}" y1="${pad+(h-pad*2)*t}" x2="${w-pad}" y2="${pad+(h-pad*2)*t}" class="matrix-grid"/>`).join('');
    const first=rows[0],last=rows[rows.length-1],change=first&&last?last.budget-first.budget:0;
    const summary=rows.length===1?`AMP ${last.year} contains ${last.count} initiative${last.count===1?'':'s'} with ${money(last.budget)} Approved Budget.`:`Approved Budget ${change>0?'increased by '+money(change):change<0?'decreased by '+money(Math.abs(change)):'remained unchanged'} from AMP ${first.year} to AMP ${last.year}.`;
    return `<div class="amp-line-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Approved Budget by AMP year">${grid}<line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="matrix-axis"/><polyline points="${poly}" class="amp-line"/>${pts.map(p=>`<g class="amp-point"><circle cx="${p.x}" cy="${p.y}" r="6"><title>AMP ${p.year}: ${money(p.budget)}, ${p.count} initiatives</title></circle><text x="${p.x}" y="${h-18}" text-anchor="middle">${p.year}</text><text x="${p.x}" y="${Math.max(15,p.y-12)}" text-anchor="middle">${moneyShort(p.budget)}</text></g>`).join('')}</svg><div class="amp-trend-summary">${rows.map(r=>`<span><b>AMP ${r.year}</b>${r.count} initiatives</span>`).join('')}</div></div>${chartSummary(summary,change>0?'positive':'neutral')}`;
  }
  function renderStrategicAlignment(initiatives){
    const rows=(state.data.strategicPillars||[]).map(p=>{const list=initiatives.filter(i=>(i.formData?.strategicPillarId||i.strategicPillarId)===p.id);return {id:p.id,name:p.name,count:list.length,budget:list.reduce((s,i)=>s+Number(i.approvedBudget||0),0)};}).filter(r=>r.count).sort((a,b)=>b.count-a.count),max=Math.max(...rows.map(r=>r.count),1);
    if(!rows.length)return '<div class="command-empty chart-empty">No strategic-pillar alignment is available.</div>'+chartSummary('No initiatives are currently mapped to a strategic pillar.','warning');
    const leader=rows.slice().sort((a,b)=>b.budget-a.budget)[0],totalBudget=rows.reduce((s,r)=>s+r.budget,0),share=totalBudget?Math.round(leader.budget/totalBudget*100):0;
    return `<div class="strategic-bars">${rows.map(r=>`<button class="strategic-bar-button has-tooltip ${state.dashboardPillar===r.id?'active':''}" data-action="dashboard-pillar" data-pillar="${r.id}" data-tooltip="${escapeAttr(r.name+': '+r.count+' initiative'+(r.count===1?'':'s')+', '+money(r.budget)+' Approved Budget')}"><span>${escapeHtml(r.name)}</span><div class="bar-track"><i class="bar-fill" style="width:${r.count/max*100}%"></i></div><strong>${r.count} · ${moneyShort(r.budget)}</strong></button>`).join('')}</div>${chartSummary(`${leader.name} has the largest allocation at ${money(leader.budget)}, representing ${share}% of mapped Approved Budget.`,'neutral')}`;
  }
  function renderDataQuality(initiatives){
    const total=initiatives.length||1,percentOf=fn=>Math.round(initiatives.filter(fn).length/total*100),evidenceAvg=initiatives.length?Math.round(initiatives.reduce((s,i)=>s+evidenceScore(i.formData||{}),0)/initiatives.length):0;
    const metrics=[['ownership','Ownership',percentOf(i=>String(i.formData?.projectOwnerName||i.owner||'').trim())],['budget','Approved Budget',percentOf(i=>numberOrNull(i.formData?.approvedBudget??i.approvedBudget)!==null)],['target','Target date',percentOf(i=>!!(i.formData?.targetDate||i.targetDate))],['cba','CBA',percentOf(i=>governedCba(i)!==null)],['evidence','Evidence',evidenceAvg],['next-action','Next action',percentOf(i=>String(i.formData?.nextAction||'').trim())],['hr','HR assessment',percentOf(i=>!!i.formData?.hrReviewStatus)],['ict','ICT assessment',percentOf(i=>!!i.formData?.ictClassification)]];
    return `<div class="quality-grid">${metrics.map(([key,label,value])=>`<button class="quality-action has-tooltip ${state.dashboardQuality===key?'active':''}" data-action="dashboard-quality" data-quality="${key}" data-tooltip="${escapeAttr(label+' completeness across initiative records in the current scope: '+value+'%')}"><span>${escapeHtml(label)}</span><strong>${value}%</strong><div class="bar-track"><i class="bar-fill" style="width:${value}%"></i></div></button>`).join('')}</div>`;
  }
  function renderDashboardDeliveryRegister(items){
    const visible=dashboardViewItems(items),scope=dashboardScopeLabel(),emptyLabel=state.dashboardYear==='all'?'No delivery records are available':'No delivery records for AMP '+state.dashboardYear;
    const tabs=[['all','All delivery'],['critical','Critical'],['watch','Watchlist'],['overdue','Overdue'],['decisions','Decisions required'],['missing','Missing information'],['high-cba','CBA ≥ 1.0'],['low-cba','CBA < 1.0']];
    return `<section class="card table-card dashboard-delivery-register"><div class="table-header command-register-heading"><div><strong>Complete delivery register · ${scope}</strong><span class="dashboard-table-note">Every visible initiative and linked project. Quick views filter this register without changing the Command Center scope.</span></div><div class="header-actions"><span class="muted">${visible.length} of ${items.length}</span><button class="action-button" data-route="projects">Project Management</button></div></div><div class="register-tabs">${tabs.map(([id,label])=>`<button data-action="dashboard-view" data-view="${id}" class="${state.dashboardView===id?'active':''}">${label}</button>`).join('')}</div><div class="table-wrap"><table class="dashboard-delivery-table"><thead><tr><th>Year</th><th>Delivery record</th><th>Type</th><th>Parent initiative</th><th>Owner</th><th>Department</th><th>Pillar</th><th>HOME31 fit</th><th>Status</th><th>Health</th><th>Target</th><th>Progress</th><th>Readiness</th><th>Risk</th><th>Budget</th><th>CBA</th><th>HR</th><th>ICT</th><th>Evidence</th><th>Next action</th><th>Action</th></tr></thead><tbody>${visible.length?visible.map(item=>{const initiativeRecord=item.sourceType==='INITIATIVE',action=initiativeRecord?'view-initiative':'view-project',actionId=initiativeRecord?item.initiativeId:item.id;return `<tr><td><strong>AMP ${escapeHtml(item.year)}</strong></td><td><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(item.code||'Pending code')}</span></td><td>${statusBadge(item.sourceType)}</td><td>${initiativeRecord?'<span class="muted">Enterprise initiative</span>':escapeHtml(item.initiativeTitle||initiativeTitle(item.initiativeId))}</td><td>${escapeHtml(item.owner||'Unassigned')}</td><td>${escapeHtml(item.departmentName||departmentName(item.departmentId))}</td><td>${escapeHtml(item.pillarName||'Not assigned')}</td><td>${escapeHtml(item.home31Fit||'Derived automatically')}</td><td>${statusBadge(item.status||'DRAFT')}</td><td>${statusBadge(item.health||'ON_TRACK')}</td><td>${formatDate(item.targetDate)}</td><td>${progressMini(item.progress)}</td><td>${Number(item.readiness||0)}%</td><td>${item.risk?statusBadge(String(item.risk).toUpperCase()==='EXTREME'?'CRITICAL':String(item.risk).toUpperCase()):'<span class="muted">Not recorded</span>'}</td><td class="amount">${Number(item.budget||0)>0?money(item.budget):'<span class="muted">Not recorded</span>'}</td><td>${item.cba===null?'<span class="muted">Not assessed</span>':item.cba.toFixed(2)}</td><td>${escapeHtml(item.hrReview||'Not submitted')}</td><td>${escapeHtml(item.ictReview||'Not assessed')}</td><td><span class="badge ${item.evidence>=70?'green':'amber'}">${item.evidence}%</span></td><td><span class="next-action-cell">${escapeHtml(item.nextAction||'Not recorded')}</span></td><td><button class="action-button" data-action="${action}" data-id="${actionId}">View</button></td></tr>`;}).join(''):`<tr><td colspan="21"><div class="empty-state"><strong>${emptyLabel}</strong>Adjust the scope or quick management view.</div></td></tr>`}</tbody></table></div></section>`;
  }
  function renderPortfolioHealthChart(items){
    const counts={ON_TRACK:items.filter(i=>i.health==='ON_TRACK').length,WATCH:items.filter(i=>i.health==='WATCH').length,CRITICAL:items.filter(i=>i.health==='CRITICAL').length,COMPLETED:items.filter(i=>i.health==='COMPLETED').length};
    const total=Math.max(1,items.length),values=[counts.ON_TRACK,counts.WATCH,counts.CRITICAL,counts.COMPLETED],labels=['On Track','Watch','Critical','Completed'],views=['all','watch','critical','all'];
    let cursor=0;const colours=['var(--green-600)','var(--amber-600)','var(--red-600)','var(--blue-600)'];
    const stops=values.map((v,index)=>{const from=cursor/total*360;cursor+=v;const to=cursor/total*360;return `${colours[index]} ${from}deg ${to}deg`;}).join(',');
    const healthy=items.length?Math.round((counts.ON_TRACK+counts.COMPLETED)/items.length*100):0;
    const summary=items.length?`${healthy}% of delivery records are healthy. ${counts.WATCH+counts.CRITICAL} record${counts.WATCH+counts.CRITICAL===1?' requires':'s require'} management attention.`:'No delivery records are available for health analysis.';
    return `<div class="executive-donut-layout"><div class="executive-donut has-tooltip" data-tooltip="${escapeAttr(`${healthy}% of delivery records are On Track or Completed. Hover the legend for category counts.`)}" style="--donut:${stops||'var(--line) 0deg 360deg'}"><div><strong>${healthy}%</strong><span>Healthy</span></div></div><div class="executive-chart-legend">${labels.map((label,index)=>`<button class="has-tooltip" data-tooltip="${escapeAttr(`${values[index]} of ${items.length} delivery records are classified as ${label}.`)}" data-action="dashboard-view" data-view="${views[index]}"><i class="legend-dot ${['stable','watch','critical','completed'][index]}"></i><span>${label}</span><strong>${values[index]}</strong></button>`).join('')}</div></div>${chartSummary(summary,counts.CRITICAL?'warning':healthy>=70?'positive':'neutral')}`;
  }
  function renderInvestmentPositionChart(initiatives){
    const totals=budgetTotals(initiatives),forecast=initiatives.reduce((s,i)=>s+financeValue(i,'forecastAtCompletion',i.forecastBudget||i.approvedBudget),0),remaining=Math.max(0,totals.approved-totals.utilised);
    const rows=[['Requested',totals.requested,'Total budget requested before approval.'],['Approved',totals.approved,'Official Approved Budget and HOME31 portfolio cost basis.'],['Committed',totals.committed,'Approved Budget already contractually or operationally committed.'],['Utilised',totals.utilised,'Actual budget utilised to date.'],['Forecast',forecast,'Latest forecast at completion, or Approved Budget where no forecast is recorded.'],['Remaining',remaining,'Approved Budget less utilised amount.']];
    const max=Math.max(1,...rows.map(r=>r[1]));
    const utilisation=totals.approved?Math.round(totals.utilised/totals.approved*100):0,variance=forecast-totals.approved;
    const summary=totals.approved?`${utilisation}% of Approved Budget has been utilised. ${variance>0?'Forecast exceeds Approved Budget by '+money(variance)+'.':variance<0?'Forecast is '+money(Math.abs(variance))+' below Approved Budget.':'Forecast currently matches Approved Budget.'}`:'No Approved Budget is available for investment analysis.';
    return `<div class="investment-position-chart">${rows.map(([label,value,tip])=>`<div class="investment-row has-tooltip" data-tooltip="${escapeAttr(tip+' Current value: '+money(value))}"><span>${label}</span><div class="investment-track"><i style="width:${value?Math.max(3,value/max*100):0}%"></i></div><strong>${moneyShort(value)}</strong></div>`).join('')}</div>${chartSummary(summary,variance>0?'warning':utilisation>90?'warning':'neutral')}`;
  }
  function renderManagementAttentionTable(items){
    const rows=items.map(i=>{const issues=[];if(i.health==='CRITICAL')issues.push('Critical delivery condition');if(i.health==='WATCH')issues.push('Watchlist follow-up');if(isOverdue(i))issues.push('Target date overdue');(i.decisions||[]).slice(0,2).forEach(d=>issues.push(d));if(!i.nextAction)issues.push('Next action missing');return {i,issues:[...new Set(issues)]};}).filter(x=>x.issues.length).sort((a,b)=>{const rank={CRITICAL:3,WATCH:2,ON_TRACK:1,COMPLETED:0};return rank[b.i.health]-rank[a.i.health]||b.issues.length-a.issues.length;}).slice(0,12);
    return `<section class="card table-card executive-attention-table"><div class="table-header"><div><strong>Management attention</strong><span class="dashboard-table-note">Priority issues requiring executive, functional or delivery follow-up.</span></div><span class="badge ${rows.length?'amber':'green'}">${rows.length} records</span></div><div class="table-wrap"><table><thead><tr><th>Priority</th><th>Initiative / Project</th><th>Issue</th><th>Owner</th><th class="amount">Budget exposed</th><th>Due date</th><th>Required action</th></tr></thead><tbody>${rows.length?rows.map(({i,issues})=>`<tr class="has-tooltip" data-tooltip="${escapeAttr(`${i.title}: ${issues.join('; ')}`)}"><td>${statusBadge(i.health)}</td><td><strong>${escapeHtml(i.title)}</strong><br><span class="muted">${escapeHtml(i.code||'Pending code')} · AMP ${i.year}</span></td><td>${issues.map(x=>`<span class="decision-chip">${escapeHtml(x)}</span>`).join('')}</td><td>${escapeHtml(i.owner||'Unassigned')}</td><td class="amount">${money(i.budget||0)}</td><td>${formatDate(i.targetDate)}</td><td><button class="action-button" data-action="${i.sourceType==='INITIATIVE'?'view-initiative':'view-project'}" data-id="${i.sourceType==='INITIATIVE'?i.initiativeId:i.id}">${escapeHtml(i.nextAction||'Open record')}</button></td></tr>`).join(''):'<tr><td colspan="7"><div class="empty-state compact"><strong>No management exceptions</strong>All visible delivery records are within the current automated controls.</div></td></tr>'}</tbody></table></div></section>`;
  }
  function renderGovernanceSummary(initiatives){
    const total=initiatives.length||1,cba=cbaStats(initiatives),metrics=[['CBA coverage',cba.assessed,initiatives.length,'Recorded governed or provisional CBA ratio.'],['CBA validated',cba.validated,initiatives.length,'CBA reviews with VALIDATED status.'],['Benefits measured',initiatives.filter(i=>phase3(i).latestBenefitMeasurementDate).length,initiatives.length,'Initiatives with an actual benefit measurement date.'],['Finance updated',initiatives.filter(i=>phase3(i).financeReportingDate).length,initiatives.length,'Initiatives with a current Finance reporting date.'],['Ready for decision',initiatives.filter(i=>phase3(i).decisionReadinessStatus==='READY_FOR_DECISION').length,initiatives.length,'Initiatives assessed as Ready for Decision.']];
    return `<div class="governance-summary-grid">${metrics.map(([label,value,den,tip])=>{const pct=den?Math.round(value/den*100):0;return `<article class="has-tooltip" data-tooltip="${escapeAttr(tip+' '+value+' of '+den+' records.')}"><div class="mini-ring" style="--pct:${pct}"><span>${pct}%</span></div><div><strong>${escapeHtml(label)}</strong><small>${value} of ${den} initiative cycles</small></div></article>`;}).join('')}</div>`;
  }
  function renderExecutiveDeliveryRegister(items){
    const visible=dashboardViewItems(items);
    return `<section class="card table-card executive-delivery-register"><div class="table-header"><div><strong>Executive delivery register</strong><span class="dashboard-table-note">A focused management view. Open the record for full CBA, HR, ICT, evidence and benefits details.</span></div><div class="header-actions"><span class="muted">${visible.length} of ${items.length}</span><button class="action-button" data-route="projects">Open Project Management</button></div></div><div class="register-tabs">${[['all','All'],['critical','Critical'],['watch','Watch'],['overdue','Overdue'],['decisions','Decisions'],['missing','Missing information']].map(([id,label])=>`<button data-action="dashboard-view" data-view="${id}" class="${state.dashboardView===id?'active':''}">${label}</button>`).join('')}</div><div class="table-wrap"><table><thead><tr><th>Year</th><th>Delivery record</th><th>Owner</th><th>Department</th><th>Health</th><th>Progress</th><th>Target</th><th class="amount">Approved Budget</th><th>Decision / next action</th><th>Action</th></tr></thead><tbody>${visible.length?visible.map(i=>`<tr class="has-tooltip" data-tooltip="${escapeAttr(`${i.title}: ${commandStatusLabel(i.health)}, ${i.progress||0}% progress, target ${formatDate(i.targetDate)}.`)}"><td>AMP ${i.year}</td><td><strong>${escapeHtml(i.title)}</strong><br><span class="muted">${escapeHtml(i.code||'Pending code')} · ${pretty(i.sourceType)}</span></td><td>${escapeHtml(i.owner||'Unassigned')}</td><td>${escapeHtml(i.departmentName||departmentName(i.departmentId))}</td><td>${statusBadge(i.health)}</td><td>${progressMini(i.progress)}</td><td>${formatDate(i.targetDate)}</td><td class="amount">${money(i.budget||0)}</td><td><span class="next-action-cell">${escapeHtml(i.decisions?.[0]||i.nextAction||'No immediate action recorded')}</span></td><td><button class="action-button" data-action="${i.sourceType==='INITIATIVE'?'view-initiative':'view-project'}" data-id="${i.sourceType==='INITIATIVE'?i.initiativeId:i.id}">View</button></td></tr>`).join(''):'<tr><td colspan="10"><div class="empty-state"><strong>No records match this view</strong>Adjust the filters or management-view tabs.</div></td></tr>'}</tbody></table></div></section>`;
  }
  function renderDashboard(){
    const initiatives=dashboardScopedInitiatives(),linkedProjects=dashboardScopedProjects(),deliveryItems=dashboardDeliveryItems(),totals=budgetTotals(initiatives),scope=dashboardScopeLabel(),decisions=initiatives.filter(i=>initiativeDecisionItems(i).length);
    const onTrack=deliveryItems.filter(i=>i.health==='ON_TRACK').length,watch=deliveryItems.filter(i=>i.health==='WATCH').length,critical=deliveryItems.filter(i=>i.health==='CRITICAL').length,overdue=deliveryItems.filter(isOverdue).length,completed=deliveryItems.filter(i=>i.health==='COMPLETED').length;
    const atRiskBudget=initiatives.filter(i=>deliveryItems.some(d=>d.initiativeId===i.id&&['CRITICAL','WATCH'].includes(d.health))).reduce((s,i)=>s+Number(i.approvedBudget||0),0),healthyPct=deliveryItems.length?Math.round((onTrack+completed)/deliveryItems.length*100):0;
    const phase3Notice=phase3Installed()?'':`<div class="alert danger command-phase3-warning"><strong>Phase 3 governance data is not connected.</strong> Run migration 004 before using benefits, governed CBA, Finance updates and decision readiness.</div>`;
    return phase3Notice+`<section class="command-hero executive-command-hero"><div><span class="command-kicker">HOME31 · ENTERPRISE COMMAND CENTER</span><h1>Executive Portfolio Command Center</h1><p>Enterprise portfolio performance, investment control and management attention in one decision-focused view.</p><div class="command-data-basis">${scope} · ${initiatives.length} initiative cycles · ${linkedProjects.length} linked projects · ${state.filters.department==='all'?'All departments':departmentName(state.filters.department)}</div></div><div>${renderDashboardFilters()}</div></section>`+
      `<div class="command-kpi-grid executive-kpis operational-kpis">${commandKpi('Approved Budget',money(totals.approved),'Official portfolio cost basis','RM','all','featured')}${commandKpi('Active Delivery',deliveryItems.filter(i=>i.health!=='COMPLETED').length,initiatives.length+' initiatives · '+linkedProjects.length+' projects','▶','all')}${commandKpi('Portfolio Health',healthyPct+'%',onTrack+' on track · '+completed+' completed','✓','all','positive')}${commandKpi('Budget at Risk',money(atRiskBudget),critical+' critical · '+watch+' watch','!','risk','warning')}${commandKpi('Overdue Delivery',overdue,'Past target date and incomplete','⏱','overdue','danger')}${commandKpi('Decisions Required',decisions.length,'Management or functional action pending','?','decisions','priority')}</div>`+
      renderBudgetJourneyCard(initiatives)+
      `<section class="executive-insight-card"><div><span class="eyebrow">Executive insight</span><h2>Portfolio position and immediate management meaning</h2><p>${escapeHtml(executiveInsight(initiatives,deliveryItems,totals,decisions))}</p></div><div class="insight-actions"><button class="btn danger compact" data-action="dashboard-view" data-view="critical">Critical records</button><button class="btn secondary compact" data-action="dashboard-view" data-view="decisions">Pending decisions</button><button class="btn outline compact" data-route="portfolio">Enterprise portfolio</button></div></section>`+
      renderManagementAttentionTable(deliveryItems)+
      `<section class="command-section"><div class="command-section-heading"><div><span class="eyebrow">Portfolio performance</span><h2>Delivery health and investment position</h2><p>Hover each visual element for its definition and current values.</p></div></div><div class="command-two-column executive-chart-grid"><article class="card panel"><div class="panel-header"><div><h2>Portfolio health</h2><p>Distribution of delivery records by management health.</p></div></div>${renderPortfolioHealthChart(deliveryItems)}</article><article class="card panel"><div class="panel-header"><div><h2>Investment position</h2><p>Requested, approved, committed, utilised, forecast and remaining budget.</p></div></div>${renderInvestmentPositionChart(initiatives)}</article></div></section>`+
      `<section class="command-section"><div class="command-section-heading"><div><span class="eyebrow">Strategic allocation</span><h2>Investment concentration and annual movement</h2></div></div><div class="command-two-column executive-chart-grid"><article class="card panel"><div class="panel-header"><div><h2>Approved Budget by Strategic Pillar</h2><p>Count and investment concentration across HOME31 priorities.</p></div></div>${renderStrategicAlignment(initiatives)}</article><article class="card panel"><div class="panel-header"><div><h2>AMP Portfolio Trend</h2><p>Approved Budget and initiative count by reporting year.</p></div></div>${renderAmpTrend(initiatives)}</article></div></section>`+
      `<section class="command-section"><div class="command-section-heading"><div><span class="eyebrow">Prioritisation & capacity</span><h2>Value, complexity and quarterly delivery pressure</h2><p>Use these views to identify priority initiatives and periods of concentrated delivery activity.</p></div></div><div class="command-two-column executive-chart-grid"><article class="card panel"><div class="panel-header"><div><h2>Cost–Benefit–Complexity Matrix</h2><p>Expected benefit against delivery complexity, with Approved Budget represented by bubble size.</p></div></div>${renderCostBenefitComplexityMatrix(initiatives)}</article><article class="card panel"><div class="panel-header"><div><h2>Quarterly Delivery Load</h2><p>Planned starts, target completions and overdue carry-forward by quarter.</p></div></div>${renderQuarterlyDeliveryLoad(deliveryItems)}</article></div></section>`+
      renderDepartmentMatrix(initiatives,deliveryItems)+
      `<section class="command-section"><div class="command-section-heading"><div><span class="eyebrow">Value & governance</span><h2>Governance coverage and decision assurance</h2><p>Compact coverage indicators with full records available in Value & Governance.</p></div><button class="btn outline compact" data-route="governance">Open Value & Governance</button></div>${renderGovernanceSummary(initiatives)}</section>`+
      `<section class="card panel command-quality-panel"><div class="panel-header"><div><h2>Data Quality Assurance</h2><p>Completeness across core decision and delivery information.</p></div></div>${renderDataQuality(initiatives)}</section>`+
      dashboardActiveFilterBanner(deliveryItems)+renderExecutiveDeliveryRegister(deliveryItems);
  }

  function renderDepartmentBudgetBars(items){
    const rows=state.data.departments.map(d=>{const list=items.filter(i=>i.departmentId===d.id),approved=list.reduce((s,i)=>s+Number(i.approvedBudget||0),0),utilised=list.reduce((s,i)=>s+Number(i.utilisedBudget||0),0);return {name:d.name,approved,utilised};}).filter(r=>r.approved>0).sort((a,b)=>b.approved-a.approved);
    const max=Math.max(1,...rows.map(r=>r.approved));
    return rows.length?rows.map(r=>`<div class="budget-line"><span>${escapeHtml(r.name)}</span><div class="bar-track" title="${money(r.approved)}"><div class="bar-fill" style="width:${Math.max(2,r.approved/max*100)}%"></div></div><strong>${moneyShort(r.approved)}</strong></div>`).join(''):'<div class="empty-state">No approved budget for this selection.</div>';
  }

  function renderPortfolio(){
    const initiatives=scopedInitiatives(),totals=budgetTotals(initiatives);
    const rows=state.data.departments.map(d=>{const list=initiatives.filter(i=>i.departmentId===d.id),t=budgetTotals(list),projectCount=scopedProjects().filter(p=>p.departmentId===d.id).length;return {d,list,t,projectCount};}).filter(r=>r.list.length).sort((a,b)=>b.t.approved-a.t.approved);
    return pageHeader('Enterprise investment view','Portfolio','Review department investment, utilisation and delivery concentration.',renderGlobalFilters()+`<button class="btn primary compact" data-route="initiatives">Open register</button>`)+
      `<div class="summary-strip"><div><small>Requested</small><strong>${money(totals.requested)}</strong></div><div><small>Approved</small><strong>${money(totals.approved)}</strong></div><div><small>Committed</small><strong>${money(totals.committed)}</strong></div><div><small>Utilised</small><strong>${money(totals.utilised)}</strong></div><div><small>Available</small><strong>${money(Math.max(0,totals.approved-totals.utilised))}</strong></div></div>`+
      `<section class="card table-card"><div class="table-header"><strong>Department portfolio summary</strong><span class="muted">${rows.length} departments</span></div><div class="table-wrap"><table><thead><tr><th>Department</th><th>Initiatives</th><th>Projects</th><th class="amount">Approved Budget</th><th class="amount">Utilised</th><th>Utilisation</th><th>Attention</th></tr></thead><tbody>${rows.map(r=>{const utilisation=r.t.approved?r.t.utilised/r.t.approved:0;const attention=scopedProjects().filter(p=>p.departmentId===r.d.id&&['AT_RISK','DELAYED'].includes(p.health)).length;return `<tr><td><strong>${escapeHtml(r.d.name)}</strong><br><span class="muted">${escapeHtml(r.d.code)}</span></td><td>${r.list.length}</td><td>${r.projectCount}</td><td class="amount">${money(r.t.approved)}</td><td class="amount">${money(r.t.utilised)}</td><td><div class="progress-cell"><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,utilisation*100)}%"></div></div>${percent(utilisation)}</div></td><td>${attention?statusBadge(attention+' AT RISK'):statusBadge('ON_TRACK')}</td></tr>`;}).join('')}</tbody></table></div></section>`;
  }

  function renderInitiatives(){
    const initiativeStatuses=['all','DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','RETURNED','REJECTED','COMPLETED'];if(!initiativeStatuses.includes(state.filters.status))state.filters.status='all';
    const canEdit=!['AUDITOR'].includes(state.user.role);let items=scopedInitiatives();const q=state.filters.search.toLowerCase();if(q)items=items.filter(i=>[i.code,i.title,i.owner,departmentName(i.departmentId)].join(' ').toLowerCase().includes(q));if(state.filters.status!=='all')items=items.filter(i=>i.status===state.filters.status);
    return pageHeader('Annual AMP register','Initiatives','Manage permanent initiatives and their annual planning cycles, owners, classifications and official budgets.',`${canEdit?'<button class="btn outline compact" data-action="import-initiatives">Import CSV</button><button class="btn primary compact" data-action="new-initiative">＋ Create Initiative</button>':''}`)+
      `<div class="toolbar"><div class="toolbar-group"><input data-filter="search" placeholder="Search initiative, code or owner" value="${escapeAttr(state.filters.search)}"><select data-filter="year">${yearOptions(state.filters.year)}</select><select data-filter="department">${departmentOptions(state.filters.department,true)}</select><select data-filter="status"><option value="all">All statuses</option>${['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','RETURNED','REJECTED','COMPLETED'].map(s=>`<option value="${s}" ${state.filters.status===s?'selected':''}>${pretty(s)}</option>`).join('')}</select></div><div class="toolbar-group"><button class="btn outline compact" data-action="export-initiatives">Export CSV</button></div></div>`+
      `<section class="card table-card"><div class="table-header"><strong>Enterprise Initiative Register</strong><span class="muted">${items.length} records</span></div><div class="table-wrap"><table><thead><tr><th>Initiative</th><th>Owner</th><th>Department</th><th>Classification</th><th>Status</th><th class="amount">Approved Budget</th><th>Progress</th><th>Actions</th></tr></thead><tbody>${items.length?items.map(i=>`<tr><td><strong>${escapeHtml(i.title)}</strong><br><span class="muted">${escapeHtml(i.code)}</span></td><td>${escapeHtml(i.owner||'Unassigned')}</td><td>${escapeHtml(departmentName(i.departmentId))}</td><td>${statusBadge(i.classification)}</td><td>${statusBadge(i.status)}</td><td class="amount">${money(i.approvedBudget)}</td><td><div class="progress-cell"><div class="bar-track"><div class="bar-fill" style="width:${Number(i.progress||0)}%"></div></div>${Number(i.progress||0)}%</div></td><td><div class="row-actions"><button class="action-button" data-action="view-initiative" data-id="${i.id}">View</button>${canEdit?`<button class="action-button" data-action="edit-initiative" data-id="${i.id}">Edit</button><button class="action-button" data-action="archive-initiative" data-id="${i.id}">Archive</button>${state.user.role==='SUPER_ADMIN'?`<button class="action-button delete-action" data-action="delete-initiative" data-id="${i.id}">Delete</button>`:''}`:''}</div></td></tr>`).join(''):'<tr><td colspan="8"><div class="empty-state"><strong>No initiatives found</strong>Adjust the filters or create a new initiative.</div></td></tr>'}</tbody></table></div></section>`;
  }

  function governanceInitiatives(){
    let items=(state.data.initiatives||[]).filter(i=>!i.archived&&(state.governanceYear==='all'||Number(i.year)===Number(state.governanceYear))&&(state.filters.department==='all'||i.departmentId===state.filters.department));
    const q=state.governanceSearch.trim().toLowerCase();if(q)items=items.filter(i=>[i.code,i.title,i.owner,i.departmentName].join(' ').toLowerCase().includes(q));
    if(state.governanceView==='cba')items=items.filter(i=>['NOT_ASSESSED','PROVISIONAL','PENDING_FINANCE_REVIEW','REWORK_REQUIRED'].includes(cbaStatus(i)));
    if(state.governanceView==='benefits')items=items.filter(i=>benefitStatus(i)==='NOT_MEASURED'||!phase3(i).latestBenefitMeasurementDate);
    if(state.governanceView==='finance')items=items.filter(i=>!phase3(i).financeReportingDate);
    if(state.governanceView==='readiness')items=items.filter(i=>!phase3(i).decisionReadinessStatus||['MORE_INFORMATION_REQUIRED','NOT_READY'].includes(phase3(i).decisionReadinessStatus));
    return items.sort((a,b)=>Number(b.year)-Number(a.year)||String(a.title).localeCompare(String(b.title)));
  }
  function canManagePhase3(){return state.user.role!=='AUDITOR';}
  function renderGovernance(){
    const all=(state.data.initiatives||[]).filter(i=>!i.archived),items=governanceInitiatives(),cbaValidated=all.filter(i=>cbaStatus(i)==='VALIDATED').length,benefitsMeasured=all.filter(i=>phase3(i).latestBenefitMeasurementDate).length,financeCurrent=all.filter(i=>phase3(i).financeReportingDate).length,ready=all.filter(i=>phase3(i).decisionReadinessStatus==='READY_FOR_DECISION').length;
    const phaseWarning=phase3Installed()?'':`<div class="alert danger"><strong>Phase 3 overview is unavailable.</strong><br>The database view could not be read through Supabase REST.${state.data.capabilities?.phase3Error?`<br><code>${escapeHtml(state.data.capabilities.phase3Error)}</code>`:''}<br>Run the V7.1 connection repair, then sign out and refresh.</div>`;
    const readinessWarning=phase3Installed()&&state.data.capabilities?.readiness===false?`<div class="alert warning"><strong>Decision-readiness configuration is unavailable.</strong>${state.data.capabilities?.readinessError?`<br><code>${escapeHtml(state.data.capabilities.readinessError)}</code>`:''}</div>`:'';
    return pageHeader('Benefits, CBA, finance and decision assurance','Value & Governance','Maintain actual benefits, governed CBA reviews, Finance execution updates, AMP continuity and decision-readiness assessments.',`<button class="btn outline compact" data-route="dashboard">Open Command Center</button>`)+phaseWarning+readinessWarning+
      `<div class="grid kpi-grid governance-kpis" style="grid-template-columns:repeat(4,1fr)">${kpi('CBA validated',cbaValidated,all.length+' initiative cycles','◈')}${kpi('Benefits measured',benefitsMeasured,'Actual results recorded','◎')}${kpi('Finance updated',financeCurrent,'Latest execution position','RM')}${kpi('Ready for decision',ready,'Governed readiness outcome','✓')}</div>`+
      `<div class="toolbar governance-toolbar"><div class="toolbar-group"><input data-governance-search placeholder="Search initiative, code or owner" value="${escapeAttr(state.governanceSearch)}"><select data-governance-year><option value="all" ${state.governanceYear==='all'?'selected':''}>All years</option>${yearOptions(state.governanceYear)}</select><select data-filter="department">${departmentOptions(state.filters.department,true)}</select><select data-governance-view><option value="all" ${state.governanceView==='all'?'selected':''}>All governance records</option><option value="cba" ${state.governanceView==='cba'?'selected':''}>CBA action required</option><option value="benefits" ${state.governanceView==='benefits'?'selected':''}>Benefits not measured</option><option value="finance" ${state.governanceView==='finance'?'selected':''}>Finance update missing</option><option value="readiness" ${state.governanceView==='readiness'?'selected':''}>Readiness action required</option></select></div><span class="muted">${items.length} records</span></div>`+
      `<section class="card table-card governance-register"><div class="table-header"><div><strong>Value & Governance Register</strong><span class="dashboard-table-note">Latest governed position for each accessible annual initiative cycle.</span></div></div><div class="table-wrap"><table><thead><tr><th>Year</th><th>Initiative</th><th>Department</th><th>Approved Budget</th><th>CBA ratio</th><th>CBA status</th><th>Benefit actual</th><th>Benefit status</th><th>Finance reporting</th><th>Committed</th><th>Utilised</th><th>Forecast</th><th>Decision score</th><th>Decision status</th><th>Action</th></tr></thead><tbody>${items.length?items.map(i=>{const p=phase3(i),score=readinessScore(i);return `<tr><td><strong>AMP ${i.year}</strong></td><td><strong>${escapeHtml(i.title)}</strong><br><span class="muted">${escapeHtml(i.code)}</span></td><td>${escapeHtml(i.departmentName||departmentName(i.departmentId))}</td><td class="amount">${money(i.approvedBudget)}</td><td>${governedCba(i)===null?'<span class="muted">Not assessed</span>':governedCba(i).toFixed(2)}</td><td>${statusBadge(cbaStatus(i))}</td><td>${escapeHtml(benefitActual(i))}</td><td>${statusBadge(benefitStatus(i))}</td><td>${formatDate(p.financeReportingDate)}</td><td class="amount">${p.committedAmount===null||p.committedAmount===undefined?'<span class="muted">Not recorded</span>':money(p.committedAmount)}</td><td class="amount">${p.utilisedAmount===null||p.utilisedAmount===undefined?'<span class="muted">Not recorded</span>':money(p.utilisedAmount)}</td><td class="amount">${p.forecastAtCompletion===null||p.forecastAtCompletion===undefined?'<span class="muted">Not recorded</span>':money(p.forecastAtCompletion)}</td><td>${score===null?'<span class="muted">Not assessed</span>':score.toFixed(1)+'%'}</td><td>${p.decisionReadinessStatus?statusBadge(p.decisionReadinessStatus):'<span class="muted">Not assessed</span>'}</td><td>${canManagePhase3()?`<button class="action-button" data-action="manage-phase3" data-id="${i.id}">Manage</button>`:`<button class="action-button" data-action="view-initiative" data-id="${i.id}">View</button>`}</td></tr>`;}).join(''):'<tr><td colspan="15"><div class="empty-state"><strong>No governance records match the filters</strong>Adjust the year, department, or action view.</div></td></tr>'}</tbody></table></div></section>`+
      renderContinuityRegister();
  }
  function renderContinuityRegister(){
    const links=state.data.continuityLinks||[];
    return `<section class="card table-card governance-continuity"><div class="table-header"><div><strong>AMP continuity register</strong><span class="dashboard-table-note">Confirmed and suggested links between annual initiative cycles.</span></div><span class="muted">${links.length} links</span></div><div class="table-wrap"><table><thead><tr><th>Previous cycle</th><th>Current cycle</th><th>Continuity type</th><th>Confidence</th><th>Budget movement</th><th>CBA movement</th><th>Management status</th><th>Scope explanation</th></tr></thead><tbody>${links.length?links.map(l=>{const prev=state.data.initiatives.find(i=>i.cycleId===l.previousCycleId),cur=state.data.initiatives.find(i=>i.cycleId===l.currentCycleId);return `<tr><td>${prev?`<strong>${escapeHtml(prev.title)}</strong><br><span class="muted">AMP ${prev.year}</span>`:'Not applicable'}</td><td>${cur?`<strong>${escapeHtml(cur.title)}</strong><br><span class="muted">AMP ${cur.year}</span>`:'Not applicable'}</td><td>${statusBadge(l.continuityType)}</td><td>${l.matchConfidence===null?'Not recorded':l.matchConfidence.toFixed(0)+'%'}</td><td class="amount">${l.approvedBudgetMovement===null?'Not recorded':money(l.approvedBudgetMovement)}</td><td>${l.cbaRatioMovement===null?'Not recorded':Number(l.cbaRatioMovement).toFixed(2)}</td><td>${statusBadge(l.managementStatus)}</td><td>${escapeHtml(l.scopeChangeExplanation||'Not recorded')}</td></tr>`;}).join(''):'<tr><td colspan="8"><div class="empty-state compact"><strong>No continuity links recorded</strong>Use Manage on an initiative to create or confirm an AMP relationship.</div></td></tr>'}</tbody></table></div></section>`;
  }

  function projectHealthKey(item){
    const raw=String(item?.health||item?.status||'').toUpperCase();
    if(raw==='AT_RISK')return 'WATCH';
    if(raw==='DELAYED')return 'CRITICAL';
    if(raw==='COMPLETED')return 'COMPLETED';
    return ['ON_TRACK','WATCH','CRITICAL'].includes(raw)?raw:'ON_TRACK';
  }
  function projectScheduleState(item){
    if(projectHealthKey(item)==='COMPLETED'||item.status==='COMPLETED')return {label:'Completed',klass:'completed'};
    if(!item.startDate||!item.targetDate)return {label:'Dates required',klass:'missing'};
    const days=daysUntil(item.targetDate);
    if(days===null)return {label:'Check schedule',klass:'missing'};
    if(days<0)return {label:`${Math.abs(days)} day${Math.abs(days)===1?'':'s'} overdue`,klass:'overdue'};
    if(days===0)return {label:'Due today',klass:'due'};
    if(days<=30)return {label:`Due in ${days} day${days===1?'':'s'}`,klass:'due'};
    return {label:'On schedule',klass:'planned'};
  }
  function projectHealthFilterButton(label,value,count,meta,icon,klass){
    return `<button class="project-kpi ${klass||''} ${state.filters.status===value?'active':''}" data-action="project-health-filter" data-status="${value}"><span class="project-kpi-icon">${icon}</span><span><small>${escapeHtml(label)}</small><strong>${count}</strong><em>${escapeHtml(meta)}</em></span></button>`;
  }
  function renderProjects(){
    const projectStatuses=['all','ON_TRACK','WATCH','CRITICAL','COMPLETED'];if(!projectStatuses.includes(state.filters.status))state.filters.status='all';
    const canEdit=!['AUDITOR'].includes(state.user.role);
    let baseItems=scopedDeliveryItems();
    const q=state.filters.search.toLowerCase();
    if(q)baseItems=baseItems.filter(p=>[p.code,p.title,p.owner,p.initiativeTitle,p.nextAction,p.departmentName].join(' ').toLowerCase().includes(q));
    const initiativeCount=baseItems.filter(p=>p.sourceType==='INITIATIVE').length,projectCount=baseItems.filter(p=>p.sourceType==='PROJECT').length;
    const onTrack=baseItems.filter(p=>projectHealthKey(p)==='ON_TRACK').length,watch=baseItems.filter(p=>projectHealthKey(p)==='WATCH').length,critical=baseItems.filter(p=>projectHealthKey(p)==='CRITICAL').length,completed=baseItems.filter(p=>projectHealthKey(p)==='COMPLETED').length;
    const overdue=baseItems.filter(isOverdue).length,dueSoon=baseItems.filter(p=>{const d=daysUntil(p.targetDate);return d!==null&&d>=0&&d<=30&&projectHealthKey(p)!=='COMPLETED';}).length,missingDates=baseItems.filter(p=>!p.startDate||!p.targetDate).length;
    const avgProgress=baseItems.length?Math.round(baseItems.reduce((s,p)=>s+Number(p.progress||0),0)/baseItems.length):0,avgReadiness=baseItems.length?Math.round(baseItems.reduce((s,p)=>s+Number(p.readiness||0),0)/baseItems.length):0;
    let items=baseItems;
    if(state.filters.status!=='all')items=items.filter(p=>projectHealthKey(p)===state.filters.status||p.status===state.filters.status);
    const years=availableDeliveryYears(),otherYears=years.filter(y=>Number(y)!==Number(state.filters.year));
    const yearHelp=!items.length&&otherYears.length?`<div class="delivery-year-help"><div><strong>No delivery records are stored for AMP ${state.filters.year}.</strong><span>Choose a year containing saved initiatives:</span></div><div class="delivery-year-actions">${otherYears.map(y=>`<button class="action-button" data-action="project-year-shortcut" data-year="${y}">AMP ${y}</button>`).join('')}</div></div>`:'';
    const attentionText=!baseItems.length?'No delivery records match the current year and department.':critical?`${critical} critical delivery record${critical===1?' requires':'s require'} immediate management attention.`:watch?`${watch} delivery record${watch===1?' is':'s are'} on the watchlist and should be followed up.`:'The selected delivery portfolio has no critical or watch records.';
    return `<section class="project-command-hero"><div class="project-hero-copy"><span class="eyebrow light">Delivery execution</span><h1>Project Management</h1><p>Control initiative delivery and linked projects through one clear operational view of ownership, schedule, progress, readiness and next action.</p><div class="project-scope-row"><span>AMP ${state.filters.year}</span><span>${state.filters.department==='all'?'All departments':escapeHtml(departmentName(state.filters.department))}</span><span>${initiativeCount} initiatives</span><span>${projectCount} linked projects</span></div></div><div class="project-hero-actions"><button class="btn project-export" data-action="export-projects">Export CSV</button>${canEdit?'<button class="btn primary" data-action="new-project">＋ Create Linked Project</button>':''}</div></section>`+
      `<div class="project-kpi-grid">${projectHealthFilterButton('All delivery','all',baseItems.length,completed+' completed','▦','total')}${projectHealthFilterButton('On track','ON_TRACK',onTrack,'Progressing within plan','✓','positive')}${projectHealthFilterButton('Watchlist','WATCH',watch,'Follow-up required','◷','warning')}${projectHealthFilterButton('Critical','CRITICAL',critical,overdue+' overdue','!','danger')}<article class="project-kpi static"><span class="project-kpi-icon">↗</span><span><small>Average progress</small><strong>${avgProgress}%</strong><em>${avgReadiness}% average readiness</em></span></article><article class="project-kpi static"><span class="project-kpi-icon">◫</span><span><small>Schedule control</small><strong>${dueSoon}</strong><em>${missingDates} records missing dates</em></span></article></div>`+
      `<section class="card project-control-bar"><div class="project-filter-grid"><label><span>Search delivery</span><input data-filter="search" placeholder="Title, code, owner or next action" value="${escapeAttr(state.filters.search)}"></label><label><span>Reporting year</span><select data-filter="year">${yearOptions(state.filters.year)}</select></label><label class="department"><span>Department</span><select data-filter="department">${departmentOptions(state.filters.department,true)}</select></label><label><span>Delivery health</span><select data-filter="status"><option value="all" ${state.filters.status==='all'?'selected':''}>All health states</option><option value="ON_TRACK" ${state.filters.status==='ON_TRACK'?'selected':''}>On Track</option><option value="WATCH" ${state.filters.status==='WATCH'?'selected':''}>Watchlist</option><option value="CRITICAL" ${state.filters.status==='CRITICAL'?'selected':''}>Critical</option><option value="COMPLETED" ${state.filters.status==='COMPLETED'?'selected':''}>Completed</option></select></label></div><div class="project-control-actions"><div class="project-view-switch"><button data-action="project-view" data-view="list" class="${state.projectView==='list'?'active':''}">☷ Register</button><button data-action="project-view" data-view="timeline" class="${state.projectView==='timeline'?'active':''}">↔ Timeline</button></div><button class="btn outline compact" data-action="project-reset">Reset</button></div></section>`+
      `<section class="project-insight-bar ${critical?'critical':watch?'watch':'stable'}"><div><span class="project-insight-dot"></span><div><strong>${escapeHtml(attentionText)}</strong><small>${overdue} overdue · ${dueSoon} due within 30 days · ${missingDates} missing complete dates · ${items.length} visible records</small></div></div><span class="project-data-note">Initiatives appear automatically; linked projects provide additional execution detail.</span></section>`+yearHelp+
      (state.projectView==='timeline'?renderTimeline(items):renderProjectTable(items,canEdit));
  }
  function renderProjectTable(items,canEdit){
    return `<section class="card table-card project-register"><div class="table-header project-register-header"><div><strong>Delivery control register</strong><span class="dashboard-table-note">A concise operational view of accountability, schedule position and management action.</span></div><span class="project-record-count">${items.length} record${items.length===1?'':'s'}</span></div><div class="table-wrap"><table class="project-delivery-table"><thead><tr><th>Delivery record</th><th>Owner & department</th><th>Schedule</th><th>Progress</th><th>Readiness</th><th>Risk & health</th><th>Next management action</th><th>Actions</th></tr></thead><tbody>${items.length?items.map(p=>{const initiativeRecord=p.sourceType==='INITIATIVE',viewAction=initiativeRecord?'view-initiative':'view-project',editAction=initiativeRecord?'edit-initiative':'edit-project',actionId=initiativeRecord?p.initiativeId:p.id,health=projectHealthKey(p),schedule=projectScheduleState(p);return `<tr class="project-row ${health.toLowerCase()}"><td><div class="delivery-identity"><span class="delivery-symbol ${initiativeRecord?'initiative':'project'}">${initiativeRecord?'I':'P'}</span><div><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(p.code||'Pending code')} · ${pretty(p.sourceType)}</small>${initiativeRecord?'<em>Enterprise initiative</em>':`<em>Parent: ${escapeHtml(p.initiativeTitle||initiativeTitle(p.initiativeId))}</em>`}</div></div></td><td><div class="owner-stack"><strong>${escapeHtml(p.owner||'Unassigned')}</strong><span>${escapeHtml(p.departmentName||departmentName(p.departmentId))}</span></div></td><td><div class="schedule-stack"><strong>${formatDate(p.startDate)} <span>→</span> ${formatDate(p.targetDate)}</strong><span class="schedule-pill ${schedule.klass}">${escapeHtml(schedule.label)}</span></div></td><td>${deliveryMeter(Number(p.progress||0),'progress')}</td><td>${deliveryMeter(Number(p.readiness||0),'readiness')}</td><td><div class="health-stack">${statusBadge(health)}${p.risk?`<small>${pretty(String(p.risk).toUpperCase()==='EXTREME'?'CRITICAL':String(p.risk).toUpperCase())} risk</small>`:'<small>Risk not recorded</small>'}</div></td><td><div class="next-action-box"><strong>${escapeHtml(p.nextAction||'Next action not recorded')}</strong><small>${p.targetDate?'Target '+formatDate(p.targetDate):'Schedule dates required'}</small></div></td><td><div class="project-row-actions"><button class="action-button primary-action" data-action="${viewAction}" data-id="${actionId}">View</button>${canEdit?`<button class="action-button" data-action="${editAction}" data-id="${actionId}">Edit</button>`:''}</div></td></tr>`;}).join(''):'<tr><td colspan="8"><div class="empty-state"><strong>No delivery records found</strong>Adjust the filters or create an initiative delivery record.</div></td></tr>'}</tbody></table></div></section>`;
  }
  function deliveryMeter(value,type){
    const safe=Math.max(0,Math.min(100,Number(value||0))),tone=safe>=75?'strong':safe>=50?'medium':'low';
    return `<div class="delivery-meter ${type}"><div><span>${type==='readiness'?'Ready':'Complete'}</span><strong>${safe}%</strong></div><div class="delivery-meter-track"><i class="${tone}" style="width:${safe}%"></i></div></div>`;
  }
  function timelineDate(value){const d=new Date(value+'T00:00:00');return isNaN(d)?null:d;}
  function startOfWeek(date){const d=new Date(date);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(0,0,0,0);return d;}
  function addDays(date,days){const d=new Date(date);d.setDate(d.getDate()+days);return d;}
  function timelineAnchorDate(){
    const year=Number(state.filters.year),now=new Date();
    if(!state.timelineAnchor){state.timelineAnchor=(now.getFullYear()===year?now:new Date(year,0,1)).toISOString().slice(0,10);}
    let d=new Date(state.timelineAnchor+'T00:00:00');
    if(isNaN(d)||d.getFullYear()!==year)d=new Date(year,0,1);
    return d;
  }
  function timelinePeriod(){
    const scale=state.timelineScale||'year',year=Number(state.filters.year),anchor=timelineAnchorDate();
    if(scale==='week'){
      const start=startOfWeek(anchor),end=addDays(start,7),cells=Array.from({length:7},(_,i)=>{const d=addDays(start,i);return{label:d.toLocaleDateString('en-MY',{weekday:'short'}),sub:d.toLocaleDateString('en-MY',{day:'numeric',month:'short'}),start:d,end:addDays(d,1)}});
      return {scale,start,end,cells,title:`Week of ${start.toLocaleDateString('en-MY',{day:'numeric',month:'long',year:'numeric'})}`};
    }
    if(scale==='month'){
      const start=new Date(year,anchor.getMonth(),1),end=new Date(year,anchor.getMonth()+1,1),days=Math.round((end-start)/86400000),cells=Array.from({length:days},(_,i)=>{const d=addDays(start,i);return{label:String(i+1),sub:d.toLocaleDateString('en-MY',{weekday:'short'}),start:d,end:addDays(d,1)}});
      return {scale,start,end,cells,title:start.toLocaleDateString('en-MY',{month:'long',year:'numeric'})};
    }
    const start=new Date(year,0,1),end=new Date(year+1,0,1),cells=Array.from({length:12},(_,i)=>({label:new Date(year,i,1).toLocaleDateString('en-MY',{month:'short'}),sub:'',start:new Date(year,i,1),end:new Date(year,i+1,1)}));
    return {scale:'year',start,end,cells,title:`AMP ${year}`};
  }
  function renderTimeline(items){
    const period=timelinePeriod(),scheduled=items.filter(p=>p.startDate&&p.targetDate),unscheduled=items.filter(p=>!p.startDate||!p.targetDate),overdue=scheduled.filter(isOverdue).length;
    const visible=scheduled.filter(p=>{const start=timelineDate(p.startDate),end=timelineDate(p.targetDate);return start&&end&&end>=period.start&&start<period.end;});
    const totalMs=Math.max(1,period.end-period.start),gridCols=period.cells.length;
    const rows=visible.map(p=>{const start=timelineDate(p.startDate),end=addDays(timelineDate(p.targetDate),1),health=projectHealthKey(p),clipStart=new Date(Math.max(start,period.start)),clipEnd=new Date(Math.min(end,period.end)),left=(clipStart-period.start)/totalMs*100,width=Math.max(.8,(clipEnd-clipStart)/totalMs*100);return `<div class="timeline-flex-row"><div class="timeline-record-label"><strong>${escapeHtml(p.title)}</strong><small>${pretty(p.sourceType)} · ${escapeHtml(p.owner||'Unassigned')}</small><em>${formatDate(p.startDate)} → ${formatDate(p.targetDate)}</em></div><div class="timeline-flex-track" style="--timeline-columns:${gridCols}">${period.cells.map(()=>'<i></i>').join('')}<span class="timeline-flex-bar ${health.toLowerCase()}" style="left:${left}%;width:${width}%" title="${formatDate(p.startDate)} to ${formatDate(p.targetDate)} · ${commandStatusLabel(health)}"><b>${Number(p.progress||0)}%</b></span></div></div>`;}).join('');
    return `<section class="card panel timeline-card-modern"><div class="project-timeline-heading"><div><span class="eyebrow">Delivery schedule</span><h2>${escapeHtml(period.title)} timeline</h2><p>Switch between weekly, monthly and annual planning views using the same saved delivery dates.</p></div><div class="timeline-summary"><span><b>${visible.length}</b> visible</span><span class="danger"><b>${overdue}</b> overdue</span><span class="warning"><b>${unscheduled.length}</b> dates required</span></div></div><div class="timeline-toolbar"><div class="timeline-scale-switch"><button data-action="project-timeline-scale" data-scale="week" class="${period.scale==='week'?'active':''}">Week</button><button data-action="project-timeline-scale" data-scale="month" class="${period.scale==='month'?'active':''}">Month</button><button data-action="project-timeline-scale" data-scale="year" class="${period.scale==='year'?'active':''}">Year</button></div><div class="timeline-period-nav"><button data-action="project-timeline-nav" data-direction="prev" aria-label="Previous period">‹</button><strong>${escapeHtml(period.title)}</strong><button data-action="project-timeline-nav" data-direction="next" aria-label="Next period">›</button><button data-action="project-timeline-today">Today</button></div></div><div class="timeline-legend"><span class="on-track">On track</span><span class="watch">Watch</span><span class="critical">Critical</span><span class="completed">Completed</span></div><div class="timeline-flex-scroll"><div class="timeline-flex-grid" style="--timeline-columns:${gridCols}"><div class="timeline-flex-head"><div>Delivery record</div><div class="timeline-flex-cells">${period.cells.map(c=>`<span><b>${escapeHtml(c.label)}</b>${c.sub?`<small>${escapeHtml(c.sub)}</small>`:''}</span>`).join('')}</div></div>${rows||'<div class="empty-state">No scheduled delivery records fall within this period.</div>'}</div></div>${unscheduled.length?`<div class="unscheduled-delivery modern"><strong>Schedule dates required</strong>${unscheduled.map(p=>`<span>${escapeHtml(p.title)} · ${pretty(p.sourceType)}</span>`).join('')}</div>`:''}</section>`;
  }

  function renderComparison(){
    const years=state.data.reportingYears.map(y=>Number(y.year)).sort(),from=Number(state.compareFrom),to=Number(state.compareTo);const oldItems=state.data.initiatives.filter(i=>!i.archived&&Number(i.year)===from),newItems=state.data.initiatives.filter(i=>!i.archived&&Number(i.year)===to);const oldTotal=budgetTotals(oldItems).approved,newTotal=budgetTotals(newItems).approved,diff=newTotal-oldTotal,growth=oldTotal?diff/oldTotal:0;const types=['CARRY_FORWARD','EVOLUTION','REPEAT','NEW'];const max=Math.max(1,...types.flatMap(t=>[oldItems.filter(i=>i.classification===t).length,newItems.filter(i=>i.classification===t).length]));
    return pageHeader('Year-on-year intelligence','AMP Comparison','Compare portfolio classification and approved-budget movement between annual planning cycles.',`<select data-compare="from">${years.map(y=>`<option value="${y}" ${y===from?'selected':''}>AMP ${y}</option>`).join('')}</select><span class="muted">versus</span><select data-compare="to">${years.map(y=>`<option value="${y}" ${y===to?'selected':''}>AMP ${y}</option>`).join('')}</select>`)+
      `<div class="summary-strip"><div><small>AMP ${from} approved</small><strong>${money(oldTotal)}</strong></div><div><small>AMP ${to} approved</small><strong>${money(newTotal)}</strong></div><div><small>Net movement</small><strong class="${diff>=0?'positive':'negative'}">${diff>=0?'+':''}${money(diff)}</strong></div><div><small>Portfolio growth</small><strong>${growth>=0?'+':''}${percent(growth)}</strong></div><div><small>Initiative movement</small><strong>${newItems.length-oldItems.length>=0?'+':''}${newItems.length-oldItems.length}</strong></div></div>`+
      `<div class="grid two-col"><section class="card panel"><div class="panel-header"><div><h2>Classification movement</h2><p>Number of initiatives by annual type</p></div></div><div class="comparison-bars">${types.map(t=>{const a=oldItems.filter(i=>i.classification===t).length,b=newItems.filter(i=>i.classification===t).length;return `<div class="comparison-row"><strong>${pretty(t)}</strong><div class="compare-track" title="AMP ${from}: ${a}"><div class="compare-old" style="width:${a/max*100}%"></div></div><div class="compare-track" title="AMP ${to}: ${b}"><div class="compare-new" style="width:${b/max*100}%"></div></div><span>${a} → ${b}</span></div>`;}).join('')}</div></section><section class="card panel"><div class="panel-header"><div><h2>Largest budget movements</h2><p>Matched by initiative title</p></div></div><div class="status-list">${comparisonMovements(oldItems,newItems).slice(0,6).map(m=>`<div class="status-item"><div><strong>${escapeHtml(m.title)}</strong><small>${money(m.old)} → ${money(m.current)}</small></div><span class="badge ${m.diff>=0?'green':'red'}">${m.old?((m.diff/m.old*100)>=0?'+':'')+Math.round(m.diff/m.old*100)+'%':'New'}</span></div>`).join('')||'<div class="empty-state">No comparable records.</div>'}</div></section></div>`;
  }
  function comparisonMovements(oldItems,newItems){const map=new Map(oldItems.map(i=>[i.title.toLowerCase(),i]));return newItems.map(i=>{const old=map.get(i.title.toLowerCase());return{title:i.title,old:old?Number(old.approvedBudget||0):0,current:Number(i.approvedBudget||0),diff:Number(i.approvedBudget||0)-(old?Number(old.approvedBudget||0):0)};}).sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff));}

  function renderReports(){return pageHeader('Management information','Reports & Exports','Generate consistent executive and operational outputs from the current HOME31 data.',`<button class="btn outline compact" data-action="print">Print current view</button>`)+`<div class="grid three-col">${reportCard('📊','Executive Portfolio Summary','KPIs, approved budget, utilisation, delivery health and strategic attention.','export-executive')}${reportCard('📋','Initiative Register','Full initiative register with owners, classifications, status and budget.','export-initiatives')}${reportCard('🗓','Project Delivery Report','Project schedule, progress, accountable owner and delivery health.','export-projects')}${reportCard('↔','AMP Comparison','Year-on-year initiative and budget movement.','export-comparison')}${reportCard('🏢','Department Portfolio','Department totals and utilisation profile.','export-departments')}${reportCard('🧾','Audit Activity','Administrative and operational activity history.','export-audit')}</div>`;}
  function reportCard(icon,title,text,action){return `<section class="card report-card"><span class="report-icon">${icon}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p><button class="btn secondary compact" data-action="${action}">Export CSV</button></section>`;}

  function renderAdmin(){
    const tabs=['users','departments','years','audit'];const labels={users:'Users',departments:'Departments',years:'Reporting Years',audit:'Audit Log'};
    return pageHeader('Controlled administration','Administration','Manage access, organisational structures, dynamic reporting years and activity records.',state.adminTab==='users'?'<button class="btn outline compact" data-action="download-user-template">Download CSV Template</button><button class="btn outline compact" data-action="import-users">Import Users</button><button class="btn primary compact" data-action="new-user">＋ Create User</button>':state.adminTab==='departments'?'<button class="btn primary compact" data-action="new-department">＋ Department</button>':state.adminTab==='years'?'<button class="btn primary compact" data-action="new-year">＋ Reporting Year</button>':'')+
      `<div class="tabs">${tabs.map(t=>`<button data-action="admin-tab" data-tab="${t}" class="${state.adminTab===t?'active':''}">${labels[t]}</button>`).join('')}</div>${state.adminTab==='users'?renderUsersAdmin():state.adminTab==='departments'?renderDepartmentsAdmin():state.adminTab==='years'?renderYearsAdmin():renderAuditAdmin()}`;
  }
  function renderUsersAdmin(){
    const f=state.adminUserFilters||{search:'',department:'all',role:'all',status:'all'};
    const q=String(f.search||'').trim().toLowerCase();
    let users=(state.data.users||[]).filter(u=>(!q||[u.name,u.email,api.roleLabel(u.role),departmentName(u.departmentId)].join(' ').toLowerCase().includes(q))&&(f.department==='all'||u.departmentId===f.department)&&(f.role==='all'||u.role===f.role)&&(f.status==='all'||u.status===f.status));
    const all=state.data.users||[],unassigned=all.filter(u=>!u.departmentId).length,pending=all.filter(u=>u.mustChangePassword).length;
    const currentDirectory=all.find(u=>u.id===state.user.id),identityMismatch=currentDirectory&&(currentDirectory.role!==state.user.role||String(currentDirectory.departmentId||'')!==String(state.user.departmentId||''));
    const warning=identityMismatch?`<div class="alert danger admin-identity-warning"><strong>Access profile mismatch detected.</strong><br>The signed-in session reports ${escapeHtml(state.user.roleLabel)} / ${escapeHtml(state.user.departmentName||'Unassigned')}, while the directory reports ${escapeHtml(api.roleLabel(currentDirectory.role))} / ${escapeHtml(departmentName(currentDirectory.departmentId))}. Reconcile the profile, role assignment and department membership in Supabase.</div>`:'';
    return warning+`<div class="grid kpi-grid admin-user-kpis" style="grid-template-columns:repeat(6,1fr)">${kpi('Active users',all.filter(u=>u.status==='ACTIVE').length,'Authorised accounts','●')}${kpi('Frozen',all.filter(u=>u.status==='FROZEN').length,'Temporary restriction','❄','warning')}${kpi('Revoked',all.filter(u=>u.status==='REVOKED').length,'Access removed','×','negative')}${kpi('Pending first login',pending,'Password change required','⌛')}${kpi('Unassigned',unassigned,'Department required','!','warning')}${kpi('Departments',state.data.departments.filter(d=>d.active!==false).length,'Active organisational units','⌂')}</div>`+
      `<div class="toolbar admin-user-toolbar"><div class="toolbar-group"><input data-admin-user-filter="search" placeholder="Search name, email, role or department" value="${escapeAttr(f.search)}"><select data-admin-user-filter="department">${departmentOptions(f.department,true)}</select><select data-admin-user-filter="role"><option value="all">All roles</option>${['SUPER_ADMIN','ADMIN','DEPARTMENT_ADMIN','DEPARTMENT_HEAD','PORTFOLIO_ADMIN','FINANCE_REVIEWER','AUDITOR','END_USER'].map(r=>`<option value="${r}" ${f.role===r?'selected':''}>${escapeHtml(api.roleLabel(r))}</option>`).join('')}</select><select data-admin-user-filter="status"><option value="all">All statuses</option>${['ACTIVE','FROZEN','REVOKED'].map(v=>`<option value="${v}" ${f.status===v?'selected':''}>${pretty(v)}</option>`).join('')}</select></div><button class="btn outline compact" data-action="reset-user-filters">Reset</button></div>`+
      `<section class="card table-card"><div class="table-header"><div><strong>User accounts</strong><span class="dashboard-table-note">Identity, access scope and first-login controls.</span></div><span class="muted">${users.length} of ${all.length} records</span></div><div class="table-wrap"><table><thead><tr><th>User</th><th>Department</th><th>Role</th><th>Status</th><th>First login</th><th>Last login</th><th>Attention</th><th>Actions</th></tr></thead><tbody>${users.length?users.map(u=>{const issues=[];if(!u.departmentId)issues.push('Department missing');if(u.id===state.user.id&&identityMismatch)issues.push('Profile mismatch');if(u.mustChangePassword)issues.push('First login pending');return `<tr><td><strong>${escapeHtml(u.name)}</strong><br><span class="muted">${escapeHtml(u.email)}</span></td><td>${u.departmentId?escapeHtml(departmentName(u.departmentId)):'<span class="badge amber">Unassigned</span>'}</td><td>${escapeHtml(api.roleLabel(u.role))}</td><td>${statusBadge(u.status)}</td><td>${u.mustChangePassword?statusBadge('REQUIRED'):statusBadge('COMPLETED')}</td><td>${u.lastLogin?formatDateTime(u.lastLogin):'<span class="muted">Not yet signed in</span>'}</td><td>${issues.length?issues.map(x=>`<span class="decision-chip">${escapeHtml(x)}</span>`).join(''):'<span class="badge green">Clear</span>'}</td><td><button class="action-button" data-action="manage-user" data-id="${u.id}">Manage</button></td></tr>`;}).join(''):'<tr><td colspan="8"><div class="empty-state"><strong>No users match the filters</strong>Adjust the search or access filters.</div></td></tr>'}</tbody></table></div></section>`;
  }
  function renderDepartmentsAdmin(){return `<section class="card table-card"><div class="table-header"><strong>Departments</strong><span class="muted">Dynamic access scope</span></div><div class="table-wrap"><table><thead><tr><th>Code</th><th>Department</th><th>Status</th><th>Users</th><th>Initiatives</th><th>Actions</th></tr></thead><tbody>${state.data.departments.map(d=>`<tr><td><strong>${escapeHtml(d.code)}</strong></td><td>${escapeHtml(d.name)}</td><td>${statusBadge(d.active===false?'INACTIVE':'ACTIVE')}</td><td>${state.data.users.filter(u=>u.departmentId===d.id).length}</td><td>${state.data.initiatives.filter(i=>i.departmentId===d.id&&!i.archived).length}</td><td><button class="action-button" data-action="edit-department" data-id="${d.id}">Edit</button></td></tr>`).join('')}</tbody></table></div></section>`;}
  function renderYearsAdmin(){return `<section class="card table-card"><div class="table-header"><strong>Reporting years</strong><span class="muted">No years are hard-coded in the application</span></div><div class="table-wrap"><table><thead><tr><th>Year</th><th>Label</th><th>Active planning year</th><th>Initiatives</th><th>Projects</th><th>Actions</th></tr></thead><tbody>${state.data.reportingYears.slice().sort((a,b)=>b.year-a.year).map(y=>`<tr><td><strong>${y.year}</strong></td><td>${escapeHtml(y.label)}</td><td>${y.active?statusBadge('ACTIVE'):statusBadge('INACTIVE')}</td><td>${state.data.initiatives.filter(i=>Number(i.year)===Number(y.year)&&!i.archived).length}</td><td>${state.data.projects.filter(p=>Number(p.year)===Number(y.year)).length}</td><td><button class="action-button" data-action="edit-year" data-id="${y.id}">Edit</button></td></tr>`).join('')}</tbody></table></div></section>`;}
  function renderAuditAdmin(){const canDelete=state.user.role==='SUPER_ADMIN',count=(state.data.audit||[]).length;return `<section class="card table-card"><div class="table-header"><div><strong>Audit activity</strong><span class="dashboard-table-note">${count} records loaded</span></div><div class="header-actions"><button class="btn outline compact" data-action="export-audit">Export CSV</button>${canDelete?`<button class="btn danger compact" data-action="delete-audit" ${count?'':'disabled'}>Delete Audit Logs</button>`:''}</div></div><div class="table-wrap"><table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>${(state.data.audit||[]).map(a=>`<tr><td>${formatDateTime(a.time)}</td><td>${escapeHtml(a.user)}</td><td>${statusBadge(a.action)}</td><td>${escapeHtml(a.entity)}</td><td>${escapeHtml(a.details||'')}</td></tr>`).join('')||'<tr><td colspan="5"><div class="empty-state">No audit records loaded.</div></td></tr>'}</tbody></table></div></section>`;}

  function renderProfile(){const u=state.user;return pageHeader('Account & access','My Profile','Review your HOME31 identity, department scope and account controls.',`<button class="btn primary compact" data-action="change-password">Change password</button>`)+`<section class="card profile-card"><div class="profile-summary"><div class="profile-avatar">${initials(u.name)}</div><h2>${escapeHtml(u.name)}</h2><p>${escapeHtml(u.roleLabel)}</p><div class="metric-mini"><div><strong>${scopedInitiatives().length}</strong><small>Initiatives</small></div><div><strong>${scopedProjects().length}</strong><small>Projects</small></div><div><strong>${state.filters.year}</strong><small>Active year</small></div></div></div><div class="profile-details"><div class="detail-box"><small>Email address</small><strong>${escapeHtml(u.email)}</strong></div><div class="detail-box"><small>Department</small><strong>${escapeHtml(u.departmentName||departmentName(u.departmentId))}</strong></div><div class="detail-box"><small>Role</small><strong>${escapeHtml(u.roleLabel)}</strong></div><div class="detail-box"><small>Account status</small><strong>${statusBadge(u.status||'ACTIVE')}</strong></div><div class="detail-box"><small>Data mode</small><strong>${api.isLive()?'Supabase live':'Local demo'}</strong></div><div class="detail-box"><small>First-login password change</small><strong>${u.mustChangePassword?'Required':'Completed'}</strong></div></div></section>`;}

  async function handlePageClick(event){
    const route=event.target.closest('[data-route]');if(route){navigate(route.dataset.route);return;}
    const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action,id=button.dataset.id;
    try{
      if(action==='dashboard-reset'){state.dashboardYear='all';state.dashboardRecordType='all';state.dashboardPillar='all';state.dashboardFit='all';state.dashboardRisk='all';state.dashboardView='all';state.dashboardQuarter='all';state.dashboardQuadrant='all';state.dashboardQuality='all';state.filters.department='all';render();}
      else if(action==='dashboard-view'){state.dashboardView=button.dataset.view||'all';const register=document.querySelector('.dashboard-delivery-register');render();setTimeout(()=>document.querySelector('.dashboard-delivery-register')?.scrollIntoView({behavior:'smooth',block:'start'}),20);}
      else if(action==='dashboard-quarter'){state.dashboardQuarter=state.dashboardQuarter===button.dataset.quarter?'all':button.dataset.quarter;render();setTimeout(()=>document.querySelector('.executive-delivery-register')?.scrollIntoView({behavior:'smooth',block:'start'}),20);}
      else if(action==='dashboard-quadrant'){state.dashboardQuadrant=state.dashboardQuadrant===button.dataset.quadrant?'all':button.dataset.quadrant;render();setTimeout(()=>document.querySelector('.executive-delivery-register')?.scrollIntoView({behavior:'smooth',block:'start'}),20);}
      else if(action==='dashboard-quality'){state.dashboardQuality=state.dashboardQuality===button.dataset.quality?'all':button.dataset.quality;render();setTimeout(()=>document.querySelector('.executive-delivery-register')?.scrollIntoView({behavior:'smooth',block:'start'}),20);}
      else if(action==='dashboard-pillar'){state.dashboardPillar=state.dashboardPillar===button.dataset.pillar?'all':button.dataset.pillar;render();setTimeout(()=>document.querySelector('.executive-delivery-register')?.scrollIntoView({behavior:'smooth',block:'start'}),20);}
      else if(action==='dashboard-clear-interactions'){state.dashboardView='all';state.dashboardQuarter='all';state.dashboardQuadrant='all';state.dashboardQuality='all';render();}
      else if(action==='retry-data-load'){state.data=await loadWithSpinner();if(state.data){const active=state.data.reportingYears.find(y=>y.active)||state.data.reportingYears.slice().sort((a,b)=>b.year-a.year)[0];state.filters.year=active?active.year:new Date().getFullYear();state.dashboardYear='all';render();}}
      else if(action==='new-initiative')openInitiativeModal();
      else if(action==='edit-initiative')openInitiativeModal(state.data.initiatives.find(i=>i.id===id));
      else if(action==='view-initiative')openInitiativeView(state.data.initiatives.find(i=>i.id===id));
      else if(action==='manage-phase3')await openPhase3Modal(state.data.initiatives.find(i=>i.id===id),button.dataset.tab||'benefits');
      else if(action==='archive-initiative')await archiveInitiative(id);
      else if(action==='delete-initiative')await deleteInitiative(id);
      else if(action==='new-project')openProjectModal();
      else if(action==='edit-project')openProjectModal(state.data.projects.find(p=>p.id===id));
      else if(action==='view-project')openProjectView(state.data.projects.find(p=>p.id===id));
      else if(action==='project-view'){state.projectView=button.dataset.view;render();}
      else if(action==='project-timeline-scale'){state.timelineScale=button.dataset.scale||'year';render();}
      else if(action==='project-timeline-nav'){const d=timelineAnchorDate(),dir=button.dataset.direction==='prev'?-1:1;if(state.timelineScale==='week')d.setDate(d.getDate()+dir*7);else if(state.timelineScale==='month')d.setMonth(d.getMonth()+dir);else d.setFullYear(d.getFullYear()+dir);state.timelineAnchor=d.toISOString().slice(0,10);if(state.timelineScale==='year')state.filters.year=d.getFullYear();render();}
      else if(action==='project-timeline-today'){const now=new Date();state.timelineAnchor=now.toISOString().slice(0,10);state.filters.year=now.getFullYear();render();}
      else if(action==='project-health-filter'){state.filters.status=button.dataset.status||'all';render();}
      else if(action==='project-reset'){state.filters.search='';state.filters.department='all';state.filters.status='all';state.timelineScale='year';state.timelineAnchor=null;render();}
      else if(action==='project-year-shortcut'){state.filters.year=Number(button.dataset.year);state.filters.search='';state.filters.status='all';state.timelineAnchor=null;render();}
      else if(action==='new-user')openUserModal();
      else if(action==='import-users')openUserImportModal();
      else if(action==='download-user-template')downloadUserTemplate();
      else if(action==='reset-user-filters'){state.adminUserFilters={search:'',department:'all',role:'all',status:'all'};render();}
      else if(action==='manage-user')openManageUser(state.data.users.find(u=>u.id===id));
      else if(action==='new-department')openDepartmentModal();
      else if(action==='edit-department')openDepartmentModal(state.data.departments.find(d=>d.id===id));
      else if(action==='new-year')openYearModal();
      else if(action==='edit-year')openYearModal(state.data.reportingYears.find(y=>y.id===id));
      else if(action==='admin-tab'){state.adminTab=button.dataset.tab;render();}
      else if(action==='delete-audit')await deleteAuditLogs();
      else if(action==='change-password')openPasswordModal(false);
      else if(action==='print')window.print();
      else if(action==='import-initiatives')openInitiativeImportModal();
      else if(action.startsWith('export-'))exportReport(action.replace('export-',''));
    }catch(error){toast(error.message||'Action failed.','error');}
  }
  async function deleteAuditLogs(){
    const count=(state.data.audit||[]).length;
    if(!count){toast('There are no audit logs to delete.','error');return;}
    const confirmed=window.confirm(`Permanently delete all ${count} audit log records?

This will also delete them from the database and cannot be undone. Export the CSV first if you need a copy.`);
    if(!confirmed)return;
    const button=el.pageRoot.querySelector('[data-action="delete-audit"]');
    if(button){button.disabled=true;button.textContent='Deleting…';}
    try{
      const result=await api.deleteAllAuditLogs(state.user);
      state.data=await api.loadData(state.user);
      const remaining=(state.data.audit||[]).length;
      if(remaining)throw new Error(`${remaining} audit records remain in the database.`);
      render();
      toast(`${Number(result?.deleted??count)} audit log records were permanently deleted.`, 'success');
    }catch(error){
      if(button){button.disabled=false;button.textContent='Delete Audit Logs';}
      throw error;
    }
  }

  function handlePageChange(event){
    if(event.target.hasAttribute('data-admin-user-filter')){const key=event.target.dataset.adminUserFilter;state.adminUserFilters[key]=event.target.value;render();return;}
    if(event.target.hasAttribute('data-dashboard-year')){state.dashboardYear=event.target.value==='all'?'all':Number(event.target.value);state.dashboardView='all';state.dashboardQuarter='all';state.dashboardQuadrant='all';state.dashboardQuality='all';render();return;}
    if(event.target.hasAttribute('data-dashboard-filter')){const key=event.target.dataset.dashboardFilter,value=event.target.value;if(key==='recordType')state.dashboardRecordType=value;else if(key==='pillar')state.dashboardPillar=value;else if(key==='fit')state.dashboardFit=value;else if(key==='risk')state.dashboardRisk=value;state.dashboardView='all';state.dashboardQuarter='all';state.dashboardQuadrant='all';state.dashboardQuality='all';render();return;}
    if(event.target.hasAttribute('data-governance-year')){state.governanceYear=event.target.value==='all'?'all':Number(event.target.value);render();return;}
    if(event.target.hasAttribute('data-governance-view')){state.governanceView=event.target.value;render();return;}
    const filter=event.target.dataset.filter;if(filter){state.filters[filter]=filter==='year'?Number(event.target.value):event.target.value;render();return;}
    const compare=event.target.dataset.compare;if(compare){if(compare==='from')state.compareFrom=Number(event.target.value);else state.compareTo=Number(event.target.value);render();}
  }
  function handlePageInput(event){if(event.target.dataset.adminUserFilter==='search'){state.adminUserFilters.search=event.target.value;clearTimeout(handlePageInput.adminUserTimer);handlePageInput.adminUserTimer=setTimeout(render,120);return;}if(event.target.hasAttribute('data-governance-search')){state.governanceSearch=event.target.value;clearTimeout(handlePageInput.governanceTimer);handlePageInput.governanceTimer=setTimeout(render,120);return;}const filter=event.target.dataset.filter;if(filter==='search'){state.filters.search=event.target.value;clearTimeout(handlePageInput.timer);handlePageInput.timer=setTimeout(render,120);}}
  function quickAdd(){ if(state.route==='governance'){const first=governanceInitiatives()[0]||state.data.initiatives.find(i=>!i.archived);if(first)openPhase3Modal(first,'benefits');else toast('Create an initiative first.','error');}else if(state.route==='projects')openProjectModal();else if(state.route==='admin'&&['SUPER_ADMIN','ADMIN','DEPARTMENT_ADMIN'].includes(state.user.role))openUserModal();else openInitiativeModal(); }

  function openModal(title,eyebrow,html){
    el.modalLayer.querySelector('.modal-card').className='modal-card';
    el.modalTitle.textContent=title;el.modalEyebrow.textContent=eyebrow||'HOME31';el.modalContent.innerHTML=html;el.modalLayer.classList.remove('hidden');setTimeout(()=>el.modalContent.querySelector('input,select,textarea,button')?.focus(),30);
  }
  function closeModal(force,source){
    const forced=force===true;
    const initiativeForm=el.modalContent.querySelector('#initiative-form');
    if(initiativeForm && !forced && source!=='close-button')return;
    if(!forced && initiativeForm && initiativeForm.dataset.dirty==='true'){
      if(!confirm('Close the initiative form? Your protected local draft will remain available on this device.')) return;
    }
    el.modalLayer.classList.add('hidden');el.modalContent.innerHTML='';
  }
  const HOME31_FORM_VERSION='V7.9.4.9';
  const HOME31_FORM_STEPS=['Profile','Strategy & ICT','Value & Plan','Finance','HR & Change','Evidence','Review'];
  const EVIDENCE_KEYS=['evidenceProblem','evidenceBaseline','evidenceBusinessCase','evidenceFinancial','evidenceRisk','evidenceImplementation','evidenceHr','evidenceIct','evidenceStakeholder','evidenceChallenge'];

  function formOptions(values,selected,placeholder){
    return (placeholder!==undefined?`<option value="">${escapeHtml(placeholder)}</option>`:'')+values.map(value=>`<option value="${escapeAttr(value)}" ${String(selected??'')===String(value)?'selected':''}>${escapeHtml(value)}</option>`).join('');
  }
  function coreCategory(category){return ({'New Initiative':'NEW','Carry Forward Initiative':'CARRY_FORWARD','Business as usual':'REPEAT'})[category]||'NEW';}
  function displayCategory(core){return ({NEW:'New Initiative',CARRY_FORWARD:'Carry Forward Initiative',REPEAT:'Business as usual',EVOLUTION:'Carry Forward Initiative'})[core]||'New Initiative';}
  function coreStatus(status){return ({Planning:'DRAFT','In Progress':'APPROVED','At Risk':'UNDER_REVIEW','On Hold':'RETURNED',Completed:'COMPLETED'})[status]||'DRAFT';}
  function displayStatus(core){return ({DRAFT:'Planning',SUBMITTED:'Planning',UNDER_REVIEW:'At Risk',APPROVED:'In Progress',RETURNED:'On Hold',REJECTED:'On Hold',COMPLETED:'Completed'})[core]||'Planning';}
  function coreRisk(risk){return ({Low:'LOW',Medium:'MEDIUM',High:'HIGH',Extreme:'CRITICAL'})[risk]||'MEDIUM';}
  function displayRisk(core){return ({LOW:'Low',MEDIUM:'Medium',HIGH:'High',CRITICAL:'Extreme'})[core]||'Medium';}
  function draftKey(item){return 'home31-v7949-initiative-draft-'+state.user.id+'-'+(item.cycleId||item.id||'new');}
  function collectInitiativeForm(form){
    const data=Object.fromEntries(new FormData(form).entries());
    data.newRolesRequired=form.elements.newRolesRequired.checked;
    data.redeploymentRequired=form.elements.redeploymentRequired.checked;
    data.declaration=form.elements.declaration.checked;
    ['rolesAffected','progress','readiness'].forEach(key=>data[key]=Number(data[key]||0));
    ['cbaRatio','initialEstimatedCost','postChallengeEstimatedCost','proposedBudget','approvedBudget'].forEach(key=>data[key]=data[key]===''?null:Number(data[key]));
    return data;
  }
  function applyInitiativeFormData(form,data){
    Object.entries(data||{}).forEach(([key,value])=>{
      const field=form.elements.namedItem(key);if(!field)return;
      if(field instanceof RadioNodeList){Array.from(field).forEach(x=>{if(x.type==='checkbox')x.checked=Boolean(value);});return;}
      if(field.type==='checkbox')field.checked=Boolean(value);else field.value=value??'';
    });
  }
  function evidenceScore(data){
    const resolved=EVIDENCE_KEYS.filter(key=>['Available','Not applicable'].includes(data[key])).length;
    return Math.round(resolved/EVIDENCE_KEYS.length*100);
  }
  function formCompletion(data){
    const keys=['createdById','sourceReference','year','initiativeName','projectDescription','departmentId','category','managementPriority','priorityStatus','executiveSponsor','projectOwnerName','deliveryLead','startDate','targetDate','deliveryStatus','overallRiskLevel','strategicPillarId','home31FitDecision','strategicThrust','strategicPriorityArea','systemType','ictClassification','ictRemarks','problemStatement','expectedOutcome','valueMeasure','baselineValue','targetValue','measurementFrequency','valueOwner','cbaRatio','progress','readiness','actionPlan','nextAction','initialEstimatedCost','postChallengeEstimatedCost','proposedBudget','approvedBudget','postChallengeRemarks','financeRemarks','generalRemarks','hrCollaborationRequirement','peopleImpactLevel','affectedGroups','rolesAffected','hrOwner','newRolesRequired','redeploymentRequired','orgDesignImpact','capabilityGap','trainingRequired','trainingPlanStatus','changeManagementRequired','changePlanStatus','communicationPlanStatus','hrReviewStatus','hrComments',...EVIDENCE_KEYS,'evidenceReference','evidenceNotes'];
    const completed=keys.filter(key=>typeof data[key]==='boolean'||data[key]===0||(data[key]!==null&&data[key]!==undefined&&String(data[key]).trim()!=='')).length;
    return Math.round(completed/keys.length*100);
  }
  function updateInitiativeFormSummary(form){
    const data=collectInitiativeForm(form),completion=formCompletion(data),evidence=evidenceScore(data);
    const completionText=document.getElementById('initiative-form-completion');if(completionText)completionText.textContent=completion+'%';
    const completionBar=document.getElementById('initiative-form-completion-bar');if(completionBar)completionBar.style.width=completion+'%';
    const evidenceText=document.getElementById('initiative-evidence-score');if(evidenceText)evidenceText.textContent=evidence+'%';
    const evidenceBar=document.getElementById('initiative-evidence-bar');if(evidenceBar)evidenceBar.style.width=evidence+'%';
    const budget=document.getElementById('initiative-budget-summary');if(budget){
      budget.innerHTML=`<div><small>Initial estimate</small><strong>${money(data.initialEstimatedCost)}</strong></div><div><small>Post challenge</small><strong>${money(data.postChallengeEstimatedCost)}</strong></div><div><small>Retreat proposal</small><strong>${money(data.proposedBudget)}</strong></div><div><small>Approved Budget</small><strong>${money(data.approvedBudget)}</strong></div>`;
    }
    const review=document.getElementById('initiative-review-summary');if(review){
      const pillar=state.data.strategicPillars?.find(p=>p.id===data.strategicPillarId)?.name||'Not selected';
      review.innerHTML=`<div class="review-grid"><article><small>Initiative</small><strong>${escapeHtml(data.initiativeName||'Not provided')}</strong><span>${escapeHtml(departmentName(data.departmentId))} · AMP ${escapeHtml(data.year)}</span></article><article><small>Accountability</small><strong>${escapeHtml(data.projectOwnerName||'Not provided')}</strong><span>Sponsor: ${escapeHtml(data.executiveSponsor||'Not provided')}</span></article><article><small>HOME31 alignment</small><strong>${escapeHtml(pillar)}</strong><span>${escapeHtml(data.home31FitDecision||'Derived automatically')}</span></article><article><small>Approved Budget</small><strong>${money(data.approvedBudget)}</strong><span>Evidence completeness: ${evidence}%</span></article><article><small>HR & Change</small><strong>${escapeHtml(data.hrCollaborationRequirement||'Not assessed')}</strong><span>${escapeHtml(data.hrReviewStatus||'Not submitted')}</span></article><article><small>Delivery</small><strong>${escapeHtml(data.deliveryStatus||'Planning')}</strong><span>${Number(data.progress||0)}% progress · ${Number(data.readiness||0)}% readiness</span></article></div>`;
    }
  }
  function setInitiativeStep(form,next,validate){
    const current=Number(form.dataset.step||1);
    if(validate&&next>current){
      const panel=form.querySelector(`[data-step-panel="${current}"]`);const invalid=Array.from(panel.querySelectorAll('[required]')).find(field=>!field.checkValidity());
      if(invalid){invalid.reportValidity();invalid.focus();return;}
    }
    next=Math.max(1,Math.min(HOME31_FORM_STEPS.length,next));form.dataset.step=String(next);
    form.querySelectorAll('[data-step-panel]').forEach(panel=>panel.classList.toggle('active',Number(panel.dataset.stepPanel)===next));
    form.querySelectorAll('[data-form-step]').forEach(button=>button.classList.toggle('active',Number(button.dataset.formStep)===next));
    document.getElementById('initiative-previous-step').classList.toggle('hidden',next===1);
    document.getElementById('initiative-next-step').classList.toggle('hidden',next===HOME31_FORM_STEPS.length);
    document.getElementById('save-initiative-button').classList.toggle('hidden',next!==HOME31_FORM_STEPS.length);
    document.getElementById('initiative-current-step-label').textContent=`Step ${next} of ${HOME31_FORM_STEPS.length} · ${HOME31_FORM_STEPS[next-1]}`;
    updateInitiativeFormSummary(form);el.modalContent.scrollTo({top:0,behavior:'smooth'});
  }

  function openInitiativeModal(item){
    item=item||{};
    const existing=Object.assign({},item.formData||{}),isAdmin=['SUPER_ADMIN','ADMIN'].includes(state.user.role);
    const defaultDept=item.departmentId||(state.filters.department==='all'?(state.user.departmentId||state.data.departments[0]?.id):state.filters.department);
    const defaults={
      createdById:item.ownerId||state.user.id,sourceReference:'',year:item.year||state.filters.year,initiativeName:item.title||'',projectDescription:item.description||'',departmentId:defaultDept,
      category:displayCategory(item.classification),managementPriority:'High',priorityStatus:'Not Assessed',executiveSponsor:'',projectOwnerName:item.owner||state.user.name,deliveryLead:'',startDate:item.startDate||'',targetDate:item.targetDate||'',deliveryStatus:displayStatus(item.status),overallRiskLevel:displayRisk(item.priority),
      strategicPillarId:item.strategicPillarId||state.data.strategicPillars?.[0]?.id||'',home31FitDecision:'',strategicThrust:'Operational Excellence',strategicPriorityArea:'Improving Productivity, Efficiency and Delivery of Service (PEDS)',systemType:'Non System',ictClassification:'N/A',ictRemarks:'',
      problemStatement:'',expectedOutcome:'',valueMeasure:'',baselineValue:'',targetValue:'',measurementFrequency:'Quarterly',valueOwner:'',cbaRatio:null,progress:Number(item.progress||0),readiness:50,actionPlan:'',nextAction:'',
      initialEstimatedCost:Number(item.requestedBudget||0)||null,postChallengeEstimatedCost:null,proposedBudget:Number(item.forecastBudget||0)||null,approvedBudget:Number(item.approvedBudget||0)||null,postChallengeRemarks:'',financeRemarks:'',generalRemarks:'',
      hrCollaborationRequirement:'Not required',peopleImpactLevel:'Medium',affectedGroups:'',rolesAffected:0,hrOwner:'',newRolesRequired:false,redeploymentRequired:false,orgDesignImpact:'',capabilityGap:'',trainingRequired:'To be assessed',trainingPlanStatus:'Not started',changeManagementRequired:'Yes',changePlanStatus:'Not started',communicationPlanStatus:'Not started',hrReviewStatus:'Not submitted',hrComments:'',
      evidenceProblem:'Not available',evidenceBaseline:'Not available',evidenceBusinessCase:'Not available',evidenceFinancial:'Not available',evidenceRisk:'Not available',evidenceImplementation:'Not available',evidenceHr:'Not available',evidenceIct:'Not available',evidenceStakeholder:'Not available',evidenceChallenge:'Not available',evidenceReference:'',evidenceNotes:'',declaration:false
    };
    const d=Object.assign(defaults,existing);
    const scopedDepartments=isAdmin?state.data.departments.filter(x=>x.active!==false):state.data.departments.filter(x=>x.id===state.user.departmentId);
    const createdByHtml=isAdmin?`<label class="field span-2"><span>Record account / submitter</span><select id="initiative-created-by" name="createdById">${state.data.users.map(u=>`<option value="${u.id}" ${u.id===d.createdById?'selected':''}>${escapeHtml(u.name)} · ${escapeHtml(u.email)}</option>`).join('')}</select><small>Controls the account associated with this record. It remains separate from Project Owner Name.</small></label>`:`<input id="initiative-created-by" name="createdById" type="hidden" value="${escapeAttr(state.user.id)}"><div class="alert info span-2">Record account / submitter: <strong>${escapeHtml(state.user.name)}</strong></div>`;
    const evidenceOptions=['Not available','In progress','Available','Not applicable'];
    openModal(item.id?'Edit Initiative':'Create Initiative','Comprehensive HOME31 Record',`<form id="initiative-form" class="initiative-comprehensive-form" data-step="1" data-dirty="false"><input id="initiative-id" name="initiativeId" type="hidden" value="${escapeAttr(item.id||'')}"><input id="initiative-code" name="initiativeCode" type="hidden" value="${escapeAttr(item.code||'')}">
      <div class="initiative-draft-bar"><div><strong>Draft protection is on</strong><span id="initiative-draft-status">Changes are automatically protected on this device.</span></div><div><button id="initiative-save-draft" class="btn outline compact" type="button">Save draft now</button><button id="initiative-clear-draft" class="btn secondary compact" type="button">Discard draft</button></div></div><div id="initiative-draft-recovery" class="alert info hidden"></div>
      <div class="initiative-stepper">${HOME31_FORM_STEPS.map((label,index)=>`<button type="button" data-form-step="${index+1}" class="${index===0?'active':''}"><span>${index+1}</span>${escapeHtml(label)}</button>`).join('')}</div>
      <div class="form-completion"><div><span>Form completion</span><strong id="initiative-form-completion">0%</strong></div><div class="bar-track"><span id="initiative-form-completion-bar" class="bar-fill" style="width:0%"></span></div></div>
      <section class="initiative-form-step active" data-step-panel="1"><div class="form-section-heading"><span class="eyebrow">Step 1</span><h3>Initiative Profile, Classification & Ownership</h3><p>Core register fields and clear delivery accountability.</p></div><div class="form-grid">${createdByHtml}
        <label class="field"><span>Legacy / source reference no.</span><input id="initiative-source-reference" name="sourceReference" value="${escapeAttr(d.sourceReference)}"></label><label class="field"><span>Implementation year *</span><select id="initiative-year" name="year" required>${yearOptions(d.year)}</select></label>
        <label class="field span-2"><span>Initiative name *</span><input id="initiative-name" name="initiativeName" maxlength="150" required value="${escapeAttr(d.initiativeName)}"></label><label class="field span-2"><span>Project description *</span><textarea id="initiative-project-description" name="projectDescription" required>${escapeHtml(d.projectDescription)}</textarea></label>
        <label class="field"><span>Lead department *</span><select id="initiative-department" name="departmentId" required>${scopedDepartments.map(x=>`<option value="${x.id}" ${x.id===d.departmentId?'selected':''}>${escapeHtml(x.name)}</option>`).join('')}</select></label><label class="field"><span>Initiative category *</span><select id="initiative-category" name="category" required>${formOptions(['New Initiative','Carry Forward Initiative','Business as usual'],d.category)}</select></label>
        <label class="field"><span>Management priority</span><select id="initiative-priority" name="managementPriority">${formOptions(['Strategic','High','Medium','Operational'],d.managementPriority)}</select></label><label class="field"><span>Priority status *</span><select id="initiative-priority-status" name="priorityStatus" required>${formOptions(['Not Assessed','Watchlist / Under Review','Recommended','Dept Monitoring','Strategic Priority'],d.priorityStatus)}</select></label>
        <label class="field"><span>Executive sponsor *</span><input id="initiative-executive-sponsor" name="executiveSponsor" required value="${escapeAttr(d.executiveSponsor)}"></label><label class="field"><span>Project owner name *</span><input id="initiative-owner" name="projectOwnerName" required value="${escapeAttr(d.projectOwnerName)}"><small>Shown in the Enterprise Initiative Register.</small></label>
        <label class="field"><span>Delivery lead *</span><input id="initiative-delivery-lead" name="deliveryLead" required value="${escapeAttr(d.deliveryLead)}"></label><label class="field"><span>Start date</span><input id="initiative-start-date" name="startDate" type="date" value="${escapeAttr(d.startDate)}"></label><label class="field"><span>Target completion date</span><input id="initiative-target-date" name="targetDate" type="date" value="${escapeAttr(d.targetDate)}"></label>
        <label class="field"><span>Status</span><select id="initiative-status" name="deliveryStatus">${formOptions(['Planning','In Progress','At Risk','On Hold','Completed'],d.deliveryStatus)}</select></label><label class="field"><span>Overall risk level</span><select id="initiative-risk" name="overallRiskLevel">${formOptions(['Low','Medium','High','Extreme'],d.overallRiskLevel)}</select></label>
      </div></section>
      <section class="initiative-form-step" data-step-panel="2"><div class="form-section-heading"><span class="eyebrow">Step 2</span><h3>Strategic Alignment, System Type & ICT Assessment</h3><p>HOME31 alignment and technology assessment.</p></div><div class="form-grid">
        <label class="field span-2"><span>HOME31 strategic pillar *</span><select id="initiative-pillar" name="strategicPillarId" required>${(state.data.strategicPillars||[]).map(p=>`<option value="${p.id}" ${p.id===d.strategicPillarId?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select></label><label class="field span-2"><span>HOME31 fit decision</span><select id="initiative-home31-fit-override" name="home31FitDecision">${formOptions(['Core Initiative','Enabler','Supporting Activity','BAU · Supporting Enhancement','Duplicate / Consolidate','Policy Review','Needs Validation'],d.home31FitDecision,'Derived automatically')}</select></label>
        <label class="field"><span>Strategic thrust *</span><select id="initiative-strategic-thrust" name="strategicThrust" required>${formOptions(['Operational Excellence','Technology','Financial Sustainability','Human Capital','Good Governance'],d.strategicThrust)}</select></label><label class="field"><span>Strategic priority area *</span><select id="initiative-strategic-priority-area" name="strategicPriorityArea" required>${formOptions(['Improving Productivity, Efficiency and Delivery of Service (PEDS)','Building Holistic Customer Experience and Brand','Developing New Capabilities','Ensuring Financial Sustainability','Other / To be confirmed'],d.strategicPriorityArea)}</select></label>
        <label class="field"><span>System type *</span><select id="initiative-system-type" name="systemType" required>${formOptions(['Non System','System by ICT','System Outsource','LMS Enhancement','Other / Hybrid'],d.systemType)}</select></label><label class="field"><span>ICT classification *</span><select id="initiative-ict-classification" name="ictClassification" required>${formOptions(['N/A','None','Low','Medium','High','New - Pending ICT review'],d.ictClassification)}</select></label><label class="field span-2"><span>ICT remarks, dependencies or architecture considerations</span><textarea id="initiative-ict-remarks" name="ictRemarks">${escapeHtml(d.ictRemarks)}</textarea></label>
      </div></section>
      <section class="initiative-form-step" data-step-panel="3"><div class="form-section-heading"><span class="eyebrow">Step 3</span><h3>Business Need, Value Measure & Action Plan</h3><p>Reason for investment, measurable value and dated actions.</p></div><div class="form-grid">
        <label class="field span-2"><span>Problem or opportunity statement *</span><textarea id="initiative-problem" name="problemStatement" required>${escapeHtml(d.problemStatement)}</textarea></label><label class="field span-2"><span>Expected enterprise outcome *</span><textarea id="initiative-outcome" name="expectedOutcome" required>${escapeHtml(d.expectedOutcome)}</textarea></label><label class="field span-2"><span>Value measure *</span><input id="initiative-value-measure" name="valueMeasure" required value="${escapeAttr(d.valueMeasure)}"></label>
        <label class="field"><span>Baseline value</span><input id="initiative-value-baseline" name="baselineValue" value="${escapeAttr(d.baselineValue)}"></label><label class="field"><span>Target value *</span><input id="initiative-value-target" name="targetValue" required value="${escapeAttr(d.targetValue)}"></label><label class="field"><span>Measurement frequency</span><select id="initiative-value-frequency" name="measurementFrequency">${formOptions(['Monthly','Quarterly','Half-yearly','Annually','At milestone'],d.measurementFrequency)}</select></label><label class="field"><span>Value measure owner</span><input id="initiative-value-owner" name="valueOwner" value="${escapeAttr(d.valueOwner)}"></label>
        <label class="field"><span>CBA ratio</span><input id="initiative-cba-ratio" name="cbaRatio" type="number" min="0" step="0.01" value="${d.cbaRatio??''}"></label><label class="field"><span>Progress (%)</span><input id="initiative-progress" name="progress" type="number" min="0" max="100" value="${Number(d.progress||0)}"></label><label class="field"><span>Readiness (%)</span><input id="initiative-readiness" name="readiness" type="number" min="0" max="100" value="${Number(d.readiness||0)}"></label>
        <label class="field span-2"><span>Action plan and milestone dates *</span><textarea id="initiative-action-plan" name="actionPlan" rows="6" required>${escapeHtml(d.actionPlan)}</textarea></label><label class="field span-2"><span>Immediate next action or milestone</span><textarea id="initiative-next-action" name="nextAction">${escapeHtml(d.nextAction)}</textarea></label>
      </div></section>
      <section class="initiative-form-step" data-step-panel="4"><div class="form-section-heading"><span class="eyebrow">Step 4</span><h3>Financial Assessment & Challenge-Session Decisions</h3><p>Exact values are retained; Approved Budget remains the official portfolio cost basis.</p></div><div class="form-grid">
        <label class="field"><span>Initial estimated cost (RM)</span><input id="initiative-estimated-cost" name="initialEstimatedCost" type="number" min="0" step="0.01" value="${d.initialEstimatedCost??''}"></label><label class="field"><span>Estimated cost post challenge (RM)</span><input id="initiative-estimated-cost-post-challenge" name="postChallengeEstimatedCost" type="number" min="0" step="0.01" value="${d.postChallengeEstimatedCost??''}"></label><label class="field"><span>Proposed budget post retreat (RM)</span><input id="initiative-proposed-budget" name="proposedBudget" type="number" min="0" step="0.01" value="${d.proposedBudget??''}"></label><label class="field"><span>Approved budget (RM)</span><input id="initiative-approved-budget" name="approvedBudget" type="number" min="0" step="0.01" value="${d.approvedBudget??''}"></label>
        <label class="field span-2"><span>Remarks from post-challenge session</span><textarea id="initiative-post-challenge-remarks" name="postChallengeRemarks">${escapeHtml(d.postChallengeRemarks)}</textarea></label><label class="field span-2"><span>Remarks from Finance on approved budget</span><textarea id="initiative-finance-remarks" name="financeRemarks">${escapeHtml(d.financeRemarks)}</textarea></label><label class="field span-2"><span>General remarks / data-quality note</span><textarea id="initiative-general-remarks" name="generalRemarks">${escapeHtml(d.generalRemarks)}</textarea></label>
      </div><div id="initiative-budget-summary" class="budget-summary"></div></section>
      <section class="initiative-form-step" data-step-panel="5"><div class="form-section-heading"><span class="eyebrow">Step 5</span><h3>Detailed HR, Workforce & Change Impact</h3><p>People implications are assessed early and retained with the annual record.</p></div><div class="form-grid">
        <label class="field"><span>HR collaboration requirement *</span><select id="initiative-hr" name="hrCollaborationRequirement" required>${formOptions(['Not required','Required','To be confirmed'],d.hrCollaborationRequirement)}</select></label><label class="field"><span>People impact level</span><select id="initiative-people-impact" name="peopleImpactLevel">${formOptions(['None','Low','Medium','High','Enterprise-wide'],d.peopleImpactLevel)}</select></label><label class="field span-2"><span>Affected workforce groups / departments</span><textarea id="initiative-affected-groups" name="affectedGroups">${escapeHtml(d.affectedGroups)}</textarea></label>
        <label class="field"><span>Estimated roles affected</span><input id="initiative-roles-affected" name="rolesAffected" type="number" min="0" value="${Number(d.rolesAffected||0)}"></label><label class="field"><span>HR owner / focal person</span><input id="initiative-hr-owner" name="hrOwner" value="${escapeAttr(d.hrOwner)}"></label><label class="checkbox initiative-checkbox"><input id="initiative-new-roles-required" name="newRolesRequired" type="checkbox" ${d.newRolesRequired?'checked':''}><span>New roles or positions are required</span></label><label class="checkbox initiative-checkbox"><input id="initiative-redeployment-required" name="redeploymentRequired" type="checkbox" ${d.redeploymentRequired?'checked':''}><span>Workforce redeployment is required</span></label>
        <label class="field span-2"><span>Organisation design impact</span><textarea id="initiative-org-design-impact" name="orgDesignImpact">${escapeHtml(d.orgDesignImpact)}</textarea></label><label class="field span-2"><span>Capability or competency gaps</span><textarea id="initiative-capability-gap" name="capabilityGap">${escapeHtml(d.capabilityGap)}</textarea></label>
        <label class="field"><span>Training required</span><select id="initiative-training-required" name="trainingRequired">${formOptions(['No','Yes','To be assessed'],d.trainingRequired)}</select></label><label class="field"><span>Training plan status</span><select id="initiative-training-plan-status" name="trainingPlanStatus">${formOptions(['Not required','Not started','In development','Approved','In implementation','Completed'],d.trainingPlanStatus)}</select></label><label class="field"><span>Change management required</span><select id="initiative-change-required" name="changeManagementRequired">${formOptions(['No','Yes','To be assessed'],d.changeManagementRequired)}</select></label><label class="field"><span>Change plan status</span><select id="initiative-change-plan-status" name="changePlanStatus">${formOptions(['Not started','In development','Approved','In implementation','Completed','Not required'],d.changePlanStatus)}</select></label><label class="field"><span>Communication plan status</span><select id="initiative-communication-plan-status" name="communicationPlanStatus">${formOptions(['Not started','In development','Approved','In implementation','Completed','Not required'],d.communicationPlanStatus)}</select></label><label class="field"><span>HR review status</span><select id="initiative-hr-review-status" name="hrReviewStatus">${formOptions(['Not submitted','Pending HR review','Clarification required','Conditionally supported','Supported','Not supported','Not required'],d.hrReviewStatus)}</select></label><label class="field span-2"><span>HR comments, conditions or required actions</span><textarea id="initiative-hr-comments" name="hrComments">${escapeHtml(d.hrComments)}</textarea></label>
      </div></section>
      <section class="initiative-form-step" data-step-panel="6"><div class="form-section-heading"><span class="eyebrow">Step 6</span><h3>Supporting Evidence Check</h3><p>Records whether management claims can be supported during review.</p></div><div class="evidence-summary"><div><span>Evidence completeness</span><strong id="initiative-evidence-score">0%</strong></div><div class="bar-track"><span id="initiative-evidence-bar" class="bar-fill" style="width:0%"></span></div></div><div class="evidence-grid">
        ${[['evidence-problem','evidenceProblem','Problem / demand evidence *'],['evidence-baseline','evidenceBaseline','Baseline validated *'],['evidence-business-case','evidenceBusinessCase','Business case / concept paper'],['evidence-financial','evidenceFinancial','Financial assessment / CBA'],['evidence-risk','evidenceRisk','Risk assessment'],['evidence-implementation','evidenceImplementation','Implementation / milestone plan'],['evidence-hr','evidenceHr','HR / workforce impact assessment'],['evidence-ict','evidenceIct','ICT assessment / architecture input'],['evidence-stakeholder','evidenceStakeholder','Stakeholder endorsement / consultation'],['evidence-challenge','evidenceChallenge','Challenge-session / decision evidence']].map(([id,name,label],index)=>`<label class="evidence-item"><span>${label}</span><select id="${id}" name="${name}" ${index<2?'required':''}>${formOptions(evidenceOptions,d[name])}</select></label>`).join('')}
        </div><div class="form-grid evidence-notes"><label class="field span-2"><span>Evidence reference, repository link or document location</span><textarea id="initiative-evidence-reference" name="evidenceReference">${escapeHtml(d.evidenceReference)}</textarea></label><label class="field span-2"><span>Evidence gaps and planned closure actions</span><textarea id="initiative-evidence-notes" name="evidenceNotes">${escapeHtml(d.evidenceNotes)}</textarea></label></div></section>
      <section class="initiative-form-step" data-step-panel="7"><div class="form-section-heading"><span class="eyebrow">Step 7</span><h3>Management Review Summary</h3><p>Review ownership, HOME31 alignment, ICT, value, finance, HR and evidence before saving.</p></div><div id="initiative-review-summary" class="review-summary"></div><label class="declaration"><input id="initiative-declaration" name="declaration" type="checkbox" required ${d.declaration?'checked':''}><span>I confirm that the ownership, financial figures, ICT and HR assessments, value target and evidence status recorded here are accurate to the best of my knowledge.</span></label></section>
      <div class="modal-actions form-navigation"><button id="initiative-previous-step" class="btn secondary hidden" type="button">Previous</button><span id="initiative-current-step-label" class="initiative-current-step">Step 1 of 7 · Profile</span><span class="navigation-spacer"></span><button id="cancel-initiative-modal" class="btn outline" type="button">Save Draft</button><button id="initiative-next-step" class="btn secondary" type="button">Next</button><button id="save-initiative-button" class="btn primary hidden" type="submit">Save Initiative</button></div>
    </form>`);
    el.modalLayer.querySelector('.modal-card').classList.add('comprehensive-modal');
    const form=document.getElementById('initiative-form'),key=draftKey(item);let autosaveTimer;
    const saveDraft=()=>{try{localStorage.setItem(key,JSON.stringify({savedAt:new Date().toISOString(),data:collectInitiativeForm(form)}));document.getElementById('initiative-draft-status').textContent='Draft protected at '+new Date().toLocaleTimeString();}catch(e){document.getElementById('initiative-draft-status').textContent='Browser draft storage is unavailable.';}};
    const saved=(()=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch(e){return null;}})();
    if(saved?.data){const recovery=document.getElementById('initiative-draft-recovery');recovery.classList.remove('hidden');recovery.innerHTML=`<strong>Unfinished draft found.</strong> Saved ${formatDateTime(saved.savedAt)}. <button id="restore-initiative-draft" class="action-button" type="button">Restore</button> <button id="discard-initiative-draft" class="action-button" type="button">Discard</button>`;document.getElementById('restore-initiative-draft').onclick=()=>{applyInitiativeFormData(form,saved.data);form.dataset.dirty='true';recovery.classList.add('hidden');updateInitiativeFormSummary(form);};document.getElementById('discard-initiative-draft').onclick=()=>{localStorage.removeItem(key);recovery.classList.add('hidden');};}
    form.addEventListener('input',()=>{form.dataset.dirty='true';clearTimeout(autosaveTimer);autosaveTimer=setTimeout(saveDraft,500);updateInitiativeFormSummary(form);});form.addEventListener('change',()=>{form.dataset.dirty='true';clearTimeout(autosaveTimer);autosaveTimer=setTimeout(saveDraft,250);updateInitiativeFormSummary(form);});
    form.querySelectorAll('[data-form-step]').forEach(button=>button.addEventListener('click',()=>setInitiativeStep(form,Number(button.dataset.formStep),Number(button.dataset.formStep)>Number(form.dataset.step))));
    document.getElementById('initiative-previous-step').onclick=()=>setInitiativeStep(form,Number(form.dataset.step)-1,false);document.getElementById('initiative-next-step').onclick=()=>setInitiativeStep(form,Number(form.dataset.step)+1,true);document.getElementById('initiative-save-draft').onclick=()=>{saveDraft();toast('Initiative draft protected on this device.','success');};document.getElementById('initiative-clear-draft').onclick=()=>{localStorage.removeItem(key);toast('Saved local draft discarded.','success');};document.getElementById('cancel-initiative-modal').onclick=()=>{saveDraft();toast('Initiative draft protected. The form will remain open until you click ✕.','success');};
    updateInitiativeFormSummary(form);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!form.reportValidity())return;const f=collectInitiativeForm(form);
      if(f.targetDate&&f.startDate&&f.targetDate<f.startDate)throw new Error('Target completion date cannot be before the start date.');
      if(f.hrCollaborationRequirement==='Required'&&(!String(f.hrOwner||'').trim()||!String(f.affectedGroups||'').trim()))throw new Error('HR owner and affected workforce groups are required when HR collaboration is required.');
      if(f.hrReviewStatus==='Conditionally supported'&&!String(f.hrComments||'').trim())throw new Error('HR conditions or required actions must be recorded for conditional support.');
      const year=Number(f.year),yearRecord=state.data.reportingYears.find(y=>Number(y.year)===year),dept=state.data.departments.find(x=>x.id===f.departmentId),code=item.code||f.initiativeCode||('AMP'+String(year).slice(-2)+'-'+(dept?.code||'GEN')+'-'+Date.now().toString().slice(-6));
      const record=Object.assign({},item,{code,title:f.initiativeName.trim(),description:f.projectDescription.trim(),owner:f.projectOwnerName.trim(),ownerId:f.createdById||state.user.id,departmentId:f.departmentId,year,reportingYearId:yearRecord?.id,classification:coreCategory(f.category),status:coreStatus(f.deliveryStatus),requestedBudget:Number(f.initialEstimatedCost||0),approvedBudget:Number(f.approvedBudget||0),committedBudget:Number(item.committedBudget||0),utilisedBudget:Number(item.utilisedBudget||0),forecastBudget:Number(f.proposedBudget??f.postChallengeEstimatedCost??f.approvedBudget??0),startDate:f.startDate,targetDate:f.targetDate,progress:Number(f.progress||0),priority:coreRisk(f.overallRiskLevel),strategicPillarId:f.strategicPillarId,formData:f});
      await withSubmit(form,()=>api.saveInitiative(record,state.user,{defaultPortfolioId:state.data.portfolios?.[0]?.id,defaultStrategicPillarId:state.data.strategicPillars?.[0]?.id}));
      state.filters.year=year;
      state.filters.department='all';
      state.filters.search='';
      state.filters.status='all';
      localStorage.removeItem(key);form.dataset.dirty='false';closeModal(true);await refreshData();toast('Comprehensive initiative saved. Project Management is now showing AMP '+year+'.','success');
    });
  }

  function openInitiativeView(item){
    if(!item)return;const d=item.formData||{},p=phase3(item),pillar=state.data.strategicPillars?.find(x=>x.id===(d.strategicPillarId||item.strategicPillarId))?.name||item.strategicPillarName||'Not assigned',score=readinessScore(item);
    openModal(item.title,'Comprehensive Initiative Detail',`<div class="summary-strip"><div><small>Approved Budget</small><strong>${money(d.approvedBudget??item.approvedBudget)}</strong></div><div><small>Governed CBA</small><strong>${governedCba(item)===null?'Not assessed':governedCba(item).toFixed(2)}</strong></div><div><small>Benefit status</small><strong>${pretty(benefitStatus(item))}</strong></div><div><small>Decision readiness</small><strong>${score===null?'Not assessed':score.toFixed(1)+'%'}</strong></div><div><small>Year</small><strong>${item.year}</strong></div></div><div class="initiative-view-actions"><button class="btn primary compact" data-action="manage-phase3" data-id="${item.id}">Manage Value & Governance</button><button class="btn outline compact" data-action="edit-initiative" data-id="${item.id}">Edit Initiative</button></div><div class="detail-sections">
      <section><h3>Profile & ownership</h3><div class="profile-details"><div class="detail-box"><small>Code</small><strong>${escapeHtml(item.code)}</strong></div><div class="detail-box"><small>Project owner</small><strong>${escapeHtml(d.projectOwnerName||item.owner||'Unassigned')}</strong></div><div class="detail-box"><small>Executive sponsor</small><strong>${escapeHtml(d.executiveSponsor||'Not provided')}</strong></div><div class="detail-box"><small>Delivery lead</small><strong>${escapeHtml(d.deliveryLead||'Not provided')}</strong></div><div class="detail-box"><small>Department</small><strong>${escapeHtml(departmentName(item.departmentId))}</strong></div><div class="detail-box"><small>Category</small><strong>${escapeHtml(d.category||pretty(item.classification))}</strong></div></div></section>
      <section><h3>Strategy & ICT</h3><div class="profile-details"><div class="detail-box"><small>HOME31 pillar</small><strong>${escapeHtml(pillar)}</strong></div><div class="detail-box"><small>HOME31 fit</small><strong>${escapeHtml(d.home31FitDecision||'Derived automatically')}</strong></div><div class="detail-box"><small>Strategic thrust</small><strong>${escapeHtml(d.strategicThrust||'Not provided')}</strong></div><div class="detail-box"><small>System type</small><strong>${escapeHtml(d.systemType||'Not provided')}</strong></div><div class="detail-box"><small>ICT classification</small><strong>${escapeHtml(d.ictClassification||'Not provided')}</strong></div><div class="detail-box"><small>Overall risk</small><strong>${escapeHtml(d.overallRiskLevel||pretty(item.priority||'MEDIUM'))}</strong></div></div></section>
      <section><h3>Value & governance</h3><div class="profile-details"><div class="detail-box"><small>CBA status</small><strong>${pretty(cbaStatus(item))}</strong></div><div class="detail-box"><small>Management treatment</small><strong>${escapeHtml(p.managementTreatment?pretty(p.managementTreatment):'Not recorded')}</strong></div><div class="detail-box"><small>Actual benefit</small><strong>${escapeHtml(benefitActual(item))}</strong></div><div class="detail-box"><small>Benefit measurement date</small><strong>${formatDate(p.latestBenefitMeasurementDate)}</strong></div><div class="detail-box"><small>Latest Finance update</small><strong>${formatDate(p.financeReportingDate)}</strong></div><div class="detail-box"><small>Decision status</small><strong>${p.decisionReadinessStatus?pretty(p.decisionReadinessStatus):'Not assessed'}</strong></div></div></section>
      <section><h3>Value, HR & evidence</h3><div class="profile-details"><div class="detail-box"><small>Value measure</small><strong>${escapeHtml(d.valueMeasure||'Not provided')}</strong></div><div class="detail-box"><small>Target</small><strong>${escapeHtml(d.targetValue||'Not provided')}</strong></div><div class="detail-box"><small>HR collaboration</small><strong>${escapeHtml(d.hrCollaborationRequirement||'Not assessed')}</strong></div><div class="detail-box"><small>HR review</small><strong>${escapeHtml(d.hrReviewStatus||'Not submitted')}</strong></div><div class="detail-box"><small>People impact</small><strong>${escapeHtml(d.peopleImpactLevel||'Not assessed')}</strong></div><div class="detail-box"><small>Evidence reference</small><strong>${escapeHtml(d.evidenceReference||'Not provided')}</strong></div></div></section>
      <section><h3>Business description</h3><div class="detail-box"><small>Project description</small><strong>${escapeHtml(d.projectDescription||item.description||'No description')}</strong></div><div class="detail-box" style="margin-top:10px"><small>Expected enterprise outcome</small><strong>${escapeHtml(d.expectedOutcome||'Not provided')}</strong></div></section>
    </div>`);el.modalLayer.querySelector('.modal-card').classList.add('comprehensive-modal');
    el.modalContent.querySelector('[data-action="manage-phase3"]')?.addEventListener('click',async()=>{closeModal(true);await openPhase3Modal(item,'benefits');});
    el.modalContent.querySelector('[data-action="edit-initiative"]')?.addEventListener('click',()=>{closeModal(true);openInitiativeModal(item);});
  }

  async function archiveInitiative(id){const item=state.data.initiatives.find(i=>i.id===id);if(!item)return;if(!confirm('Archive “'+item.title+'”? The record will remain in audit history.'))return;await api.archiveInitiative(id,state.user,item.cycleId);await refreshData();toast('Initiative archived.','success');}
  async function deleteInitiative(id){
    if(state.user.role!=='SUPER_ADMIN'){toast('Only the Super Administrator can permanently delete an initiative.','error');return;}
    const item=state.data.initiatives.find(i=>i.id===id);if(!item)return;
    const linkedProjects=(state.data.projects||[]).filter(p=>p.initiativeId===id).length;
    const message='Permanently delete “'+item.title+'” ('+(item.code||'no code')+')?'+(linkedProjects?' This will also remove '+linkedProjects+' linked project record'+(linkedProjects===1?'':'s')+' and related governance data.':' This will also remove related governance data.')+'\n\nType DELETE to continue.';
    const confirmation=prompt(message,'');
    if(confirmation!=='DELETE'){if(confirmation!==null)toast('Deletion cancelled. Type DELETE exactly to confirm.','error');return;}
    await api.deleteInitiative(id,state.user,item.cycleId);
    await refreshData();
    toast('Initiative permanently deleted.','success');
  }

  function todayIso(){return new Date().toISOString().slice(0,10);}
  function phase3TabButton(tab,label,active){return `<button type="button" class="${active===tab?'active':''}" data-phase3-tab="${tab}">${label}</button>`;}
  function initiativeCycleOptions(selected,current,mode){
    let list=(state.data.initiatives||[]).filter(i=>!i.archived&&i.cycleId&&i.cycleId!==current.cycleId);
    if(mode==='previous')list=list.filter(i=>Number(i.year)<Number(current.year));
    if(mode==='current')list=list.filter(i=>Number(i.year)>Number(current.year));
    return `<option value="">Not applicable</option>${list.sort((a,b)=>Number(b.year)-Number(a.year)).map(i=>`<option value="${i.cycleId}" ${selected===i.cycleId?'selected':''}>AMP ${i.year} · ${escapeHtml(i.title)}</option>`).join('')}`;
  }
  function readinessAutoScores(item){
    const d=item.formData||{},p=phase3(item),e=evidenceScore(d),hasOwner=!!String(d.projectOwnerName||item.owner||'').trim(),hasPlan=!!String(d.actionPlan||'').trim()&&!!(d.targetDate||item.targetDate),risk=['Low','Medium'].includes(d.overallRiskLevel||displayRisk(item.priority));
    return {STRATEGIC_ALIGNMENT:(d.strategicPillarId||item.strategicPillarId)&&d.home31FitDecision?100:50,OWNERSHIP:hasOwner&&d.executiveSponsor&&d.deliveryLead?100:hasOwner?65:20,VALUE_CBA:governedCba(item)!==null?(cbaStatus(item)==='VALIDATED'?100:75):25,FINANCE:numberOrNull(d.approvedBudget??item.approvedBudget)!==null?(p.financeReportingDate?100:75):25,DELIVERY_PLAN:hasPlan?100:(d.actionPlan||d.targetDate?60:20),RISK:risk?100:['High'].includes(d.overallRiskLevel)?50:20,HR_CHANGE:d.hrCollaborationRequirement==='Not required'||['Supported','Not required'].includes(d.hrReviewStatus)?100:d.hrReviewStatus?60:30,ICT:d.systemType==='Non System'||!d.systemType?100:!['N/A','None','New - Pending ICT review',''].includes(d.ictClassification||'')?100:35,EVIDENCE:e};
  }
  function readinessStatusFromScore(score){return score>=80?'READY_FOR_DECISION':score>=65?'CONDITIONALLY_READY':score>=45?'MORE_INFORMATION_REQUIRED':'NOT_READY';}
  function renderPhase3History(history){
    const recent=(rows,render,empty)=>rows.length?rows.slice(0,5).map(render).join(''):`<div class="phase3-history-empty">${empty}</div>`;
    return `<aside class="phase3-history"><h3>Governance history</h3><section><strong>Benefits</strong>${recent(history.benefits,x=>`<div><span>${formatDate(x.measurementDate)} · ${pretty(x.benefitStatus)}</span><small>${escapeHtml(x.actualValueText||((x.actualValueNumeric??'')+(x.actualValueUnit?' '+x.actualValueUnit:''))||'No actual value')}</small></div>`,'No measurements')}</section><section><strong>CBA reviews</strong>${recent(history.cbaReviews,x=>`<div><span>${formatDate(x.reviewDate)} · ${pretty(x.validationStatus)}</span><small>${x.cbaRatio===null?'No ratio':Number(x.cbaRatio).toFixed(2)}${x.managementTreatment?' · '+pretty(x.managementTreatment):''}</small></div>`,'No CBA reviews')}</section><section><strong>Finance updates</strong>${recent(history.financeUpdates,x=>`<div><span>${formatDate(x.reportingDate)}</span><small>Committed ${x.committedAmount===null?'—':money(x.committedAmount)} · Utilised ${x.utilisedAmount===null?'—':money(x.utilisedAmount)}</small></div>`,'No Finance updates')}</section><section><strong>Decision readiness</strong>${recent(history.readinessAssessments,x=>`<div><span>${formatDate(x.assessmentDate)} · ${pretty(x.readinessStatus)}</span><small>${Number(x.readinessScore).toFixed(1)}%</small></div>`,'No assessments')}</section></aside>`;
  }
  async function openPhase3Modal(item,initialTab){
    if(!item||!item.cycleId){toast('This initiative does not have a resolved annual cycle.','error');return;}
    const history=await api.loadPhase3History(item.cycleId),p=phase3(item),tab=initialTab||'benefits',models=state.data.decisionReadinessModels||[],model=models.find(m=>m.isDefault)||models[0],weights=(state.data.decisionReadinessWeights||[]).filter(w=>!model||w.modelId===model.id).sort((a,b)=>a.displayOrder-b.displayOrder),scores=readinessAutoScores(item),currentScores=p.decisionReadinessDimensionScores||scores;
    const totalWeight=weights.reduce((s,w)=>s+Number(w.weightPercentage||0),0)||100,weighted=weights.reduce((s,w)=>s+Number(currentScores[w.dimensionCode]??scores[w.dimensionCode]??0)*Number(w.weightPercentage||0),0)/totalWeight;
    openModal(item.title,'Phase 3 · Value & Governance',`<div class="phase3-shell"><div class="phase3-main"><div class="phase3-context"><span>AMP ${item.year}</span><strong>${escapeHtml(item.code)}</strong><small>${escapeHtml(item.departmentName||departmentName(item.departmentId))}</small></div><nav class="phase3-tabs">${phase3TabButton('benefits','Benefits',tab)}${phase3TabButton('cba','CBA Review',tab)}${phase3TabButton('finance','Finance',tab)}${phase3TabButton('readiness','Decision Readiness',tab)}${phase3TabButton('continuity','AMP Continuity',tab)}</nav>
      <section class="phase3-panel ${tab==='benefits'?'active':''}" data-phase3-panel="benefits"><form id="phase3-benefit-form"><div class="form-grid"><label class="field"><span>Measurement date *</span><input name="measurementDate" type="date" required value="${escapeAttr(p.latestBenefitMeasurementDate||todayIso())}"></label><label class="field"><span>Benefit status *</span><select name="benefitStatus">${['NOT_MEASURED','ON_TRACK','AT_RISK','OFF_TRACK','ACHIEVED','NOT_APPLICABLE'].map(x=>`<option value="${x}" ${benefitStatus(item)===x?'selected':''}>${pretty(x)}</option>`).join('')}</select></label><label class="field"><span>Actual value (text)</span><input name="actualValueText" value="${escapeAttr(p.actualValueText||'')}" placeholder="Example: 8 working days"></label><label class="field"><span>Actual value (numeric)</span><input name="actualValueNumeric" type="number" step="0.0001" value="${p.actualValueNumeric??''}"></label><label class="field"><span>Unit</span><input name="actualValueUnit" value="${escapeAttr(p.actualValueUnit||'')}" placeholder="days, %, RM"></label><label class="field"><span>Next measurement date</span><input name="nextMeasurementDate" type="date" value="${escapeAttr(p.nextMeasurementDate||'')}"></label><label class="field span-2"><span>Commentary</span><textarea name="commentary">${escapeHtml(p.benefitCommentary||'')}</textarea></label></div><div class="modal-actions"><button class="btn primary" type="submit">Save Benefit Measurement</button></div></form></section>
      <section class="phase3-panel ${tab==='cba'?'active':''}" data-phase3-panel="cba"><form id="phase3-cba-form"><div class="form-grid"><label class="field"><span>Review date *</span><input name="reviewDate" type="date" required value="${escapeAttr(p.cbaReviewDate||todayIso())}"></label><label class="field"><span>CBA ratio</span><input name="cbaRatio" type="number" min="0" step="0.0001" value="${governedCba(item)??''}"></label><label class="field"><span>Validation status *</span><select name="validationStatus">${['NOT_ASSESSED','PROVISIONAL','PENDING_FINANCE_REVIEW','VALIDATED','NOT_APPLICABLE','REWORK_REQUIRED'].map(x=>`<option value="${x}" ${cbaStatus(item)===x?'selected':''}>${pretty(x)}</option>`).join('')}</select></label><label class="field"><span>Management treatment</span><select name="managementTreatment"><option value="">Not recorded</option>${['PROCEED','PROCEED_WITH_CONDITIONS','MANAGEMENT_DECISION_REQUIRED','REASSESS_VALUE_CASE','MORE_EVIDENCE_REQUIRED','DEFER','STOP_OR_CONSOLIDATE'].map(x=>`<option value="${x}" ${p.managementTreatment===x?'selected':''}>${pretty(x)}</option>`).join('')}</select></label><label class="field span-2"><span>Methodology / reference</span><textarea name="methodologyReference">${escapeHtml(p.cbaMethodologyReference||'')}</textarea></label><label class="field span-2"><span>Finance review comments</span><textarea name="financeReviewComments">${escapeHtml(p.cbaFinanceReviewComments||'')}</textarea></label></div><div class="alert info">A Validated CBA is stamped with the current user and time. The 1.0 ratio remains a reference, not an automatic approval threshold.</div><div class="modal-actions"><button class="btn primary" type="submit">Save CBA Review</button></div></form></section>
      <section class="phase3-panel ${tab==='finance'?'active':''}" data-phase3-panel="finance"><form id="phase3-finance-form"><div class="form-grid"><label class="field"><span>Finance reporting date *</span><input name="reportingDate" type="date" required value="${escapeAttr(p.financeReportingDate||todayIso())}"></label><label class="field"><span>Committed amount (RM)</span><input name="committedAmount" type="number" min="0" step="0.01" value="${p.committedAmount??''}"></label><label class="field"><span>Utilised amount (RM)</span><input name="utilisedAmount" type="number" min="0" step="0.01" value="${p.utilisedAmount??''}"></label><label class="field"><span>Forecast at completion (RM)</span><input name="forecastAtCompletion" type="number" min="0" step="0.01" value="${p.forecastAtCompletion??''}"></label><label class="field span-2"><span>Variance commentary</span><textarea name="varianceCommentary">${escapeHtml(p.varianceCommentary||'')}</textarea></label></div><div class="governance-budget-reference"><span>Approved Budget</span><strong>${money(item.approvedBudget)}</strong><small>Official portfolio cost basis</small></div><div class="modal-actions"><button class="btn primary" type="submit">Save Finance Update</button></div></form></section>
      <section class="phase3-panel ${tab==='readiness'?'active':''}" data-phase3-panel="readiness"><form id="phase3-readiness-form"><input type="hidden" name="modelId" value="${escapeAttr(model?.id||'')}"><div class="readiness-model-heading"><div><strong>${escapeHtml(model?.name||'No active model')}</strong><small>${weights.length} weighted dimensions · total ${totalWeight}%</small></div><output id="phase3-readiness-total">${weighted.toFixed(1)}%</output></div><div class="readiness-dimensions">${weights.map(w=>`<label><span><b>${escapeHtml(w.dimensionLabel)}</b><small>${w.weightPercentage}% weight</small></span><input name="dimension_${w.dimensionCode}" data-readiness-dimension="${w.dimensionCode}" data-weight="${w.weightPercentage}" type="number" min="0" max="100" step="1" value="${Number(currentScores[w.dimensionCode]??scores[w.dimensionCode]??0)}"></label>`).join('')}</div><div class="form-grid"><label class="field"><span>Assessment date</span><input name="assessmentDate" type="date" value="${escapeAttr(p.readinessAssessmentDate||todayIso())}"></label><label class="field"><span>Readiness status</span><select name="readinessStatus" id="phase3-readiness-status">${['READY_FOR_DECISION','CONDITIONALLY_READY','MORE_INFORMATION_REQUIRED','NOT_READY'].map(x=>`<option value="${x}" ${readinessStatusFromScore(weighted)===x?'selected':''}>${pretty(x)}</option>`).join('')}</select></label><label class="field span-2"><span>Assessment notes</span><textarea name="assessmentNotes">${escapeHtml(p.decisionReadinessNotes||'')}</textarea></label></div><div class="modal-actions"><button class="btn primary" type="submit" ${model?'':'disabled'}>Save Decision Readiness</button></div></form></section>
      <section class="phase3-panel ${tab==='continuity'?'active':''}" data-phase3-panel="continuity"><form id="phase3-continuity-form"><div class="form-grid"><label class="field"><span>Previous AMP cycle</span><select name="previousCycleId">${initiativeCycleOptions('',item,'previous')}</select></label><label class="field"><span>Current AMP cycle</span><select name="currentCycleId"><option value="${item.cycleId}" selected>AMP ${item.year} · ${escapeHtml(item.title)}</option>${initiativeCycleOptions('',item,'current')}</select></label><label class="field"><span>Continuity type *</span><select name="continuityType">${['DIRECT_CARRY_FORWARD','REPEAT','EVOLUTION','EXPANDED_CONTINUATION','RECURRING_ANNUAL_ACTIVITY','NEW_OR_UNMATCHED','NO_CONTINUATION'].map(x=>`<option value="${x}">${pretty(x)}</option>`).join('')}</select></label><label class="field"><span>Match confidence (%)</span><input name="matchConfidence" type="number" min="0" max="100" step="0.01"></label><label class="field"><span>Match method</span><input name="matchMethod" placeholder="Source reference, title, management confirmation"></label><label class="field"><span>Management status</span><select name="managementStatus">${['SUGGESTED','CONFIRMED','REJECTED'].map(x=>`<option value="${x}">${pretty(x)}</option>`).join('')}</select></label><label class="field span-2"><span>Scope-change explanation</span><textarea name="scopeChangeExplanation"></textarea></label></div><div class="alert info">Budget and CBA movement are calculated from the selected annual records when both cycles are available.</div><div class="modal-actions"><button class="btn primary" type="submit">Save Continuity Link</button></div></form></section>
    </div>${renderPhase3History(history)}</div>`);
    el.modalLayer.querySelector('.modal-card').classList.add('phase3-modal');bindPhase3Modal(item,history);
  }
  function bindPhase3Modal(item,history){
    bindModalClose();
    el.modalContent.querySelectorAll('[data-phase3-tab]').forEach(button=>button.addEventListener('click',()=>{el.modalContent.querySelectorAll('[data-phase3-tab]').forEach(x=>x.classList.toggle('active',x===button));el.modalContent.querySelectorAll('[data-phase3-panel]').forEach(x=>x.classList.toggle('active',x.dataset.phase3Panel===button.dataset.phase3Tab));}));
    const readinessInputs=[...el.modalContent.querySelectorAll('[data-readiness-dimension]')],readinessOutput=document.getElementById('phase3-readiness-total'),readinessStatusSelect=document.getElementById('phase3-readiness-status');
    function recalc(){const weight=readinessInputs.reduce((s,x)=>s+Number(x.dataset.weight||0),0)||100,total=readinessInputs.reduce((s,x)=>s+Number(x.value||0)*Number(x.dataset.weight||0),0)/weight;if(readinessOutput)readinessOutput.value=total.toFixed(1)+'%';if(readinessStatusSelect)readinessStatusSelect.value=readinessStatusFromScore(total);return total;}readinessInputs.forEach(x=>x.addEventListener('input',recalc));
    document.getElementById('phase3-benefit-form').addEventListener('submit',async event=>{event.preventDefault();const f=formObject(event.target),actualNumeric=numberOrNull(f.actualValueNumeric);if(!['NOT_MEASURED','NOT_APPLICABLE'].includes(f.benefitStatus)&&!f.actualValueText.trim()&&actualNumeric===null)throw new Error('Enter an actual benefit value or choose Not Measured / Not Applicable.');await withSubmit(event.target,()=>api.saveBenefitMeasurement({id:null,initiativeCycleId:item.cycleId,measurementDate:f.measurementDate,actualValueText:f.actualValueText.trim(),actualValueNumeric:actualNumeric,actualValueUnit:f.actualValueUnit.trim(),benefitStatus:f.benefitStatus,commentary:f.commentary.trim(),nextMeasurementDate:f.nextMeasurementDate||null},state.user));closeModal(true);await refreshData();toast('Benefit measurement saved.','success');});
    document.getElementById('phase3-cba-form').addEventListener('submit',async event=>{event.preventDefault();const f=formObject(event.target),ratio=numberOrNull(f.cbaRatio);if(f.validationStatus==='VALIDATED'&&ratio===null)throw new Error('A validated CBA requires a ratio.');await withSubmit(event.target,()=>api.saveCbaReview({initiativeCycleId:item.cycleId,reviewDate:f.reviewDate,cbaRatio:ratio,validationStatus:f.validationStatus,methodologyReference:f.methodologyReference.trim(),financeReviewComments:f.financeReviewComments.trim(),managementTreatment:f.managementTreatment||null},state.user));closeModal(true);await refreshData();toast('CBA review saved.','success');});
    document.getElementById('phase3-finance-form').addEventListener('submit',async event=>{event.preventDefault();const f=formObject(event.target),record={id:null,initiativeCycleId:item.cycleId,reportingDate:f.reportingDate,committedAmount:numberOrNull(f.committedAmount),utilisedAmount:numberOrNull(f.utilisedAmount),forecastAtCompletion:numberOrNull(f.forecastAtCompletion),varianceCommentary:f.varianceCommentary.trim()};if(record.utilisedAmount!==null&&record.committedAmount!==null&&record.utilisedAmount>record.committedAmount&&!record.varianceCommentary)throw new Error('Explain why utilised amount exceeds committed amount.');await withSubmit(event.target,()=>api.saveFinanceUpdate(record,state.user));closeModal(true);await refreshData();toast('Finance update saved.','success');});
    document.getElementById('phase3-readiness-form').addEventListener('submit',async event=>{event.preventDefault();const f=formObject(event.target),dimensionScores={};readinessInputs.forEach(x=>dimensionScores[x.dataset.readinessDimension]=Number(x.value||0));const score=recalc();if(!f.modelId)throw new Error('No active decision-readiness model is available.');await withSubmit(event.target,()=>api.saveDecisionReadinessAssessment({initiativeCycleId:item.cycleId,modelId:f.modelId,assessmentDate:f.assessmentDate,readinessScore:Number(score.toFixed(2)),readinessStatus:f.readinessStatus,dimensionScores,assessmentNotes:f.assessmentNotes.trim()},state.user));closeModal(true);await refreshData();toast('Decision-readiness assessment saved.','success');});
    document.getElementById('phase3-continuity-form').addEventListener('submit',async event=>{event.preventDefault();const f=formObject(event.target),prev=state.data.initiatives.find(i=>i.cycleId===f.previousCycleId),cur=state.data.initiatives.find(i=>i.cycleId===f.currentCycleId),type=f.continuityType;if(type==='NEW_OR_UNMATCHED'&&!f.currentCycleId)throw new Error('Choose a current cycle.');if(type==='NO_CONTINUATION'&&!f.previousCycleId)throw new Error('Choose a previous cycle.');if(!['NEW_OR_UNMATCHED','NO_CONTINUATION'].includes(type)&&(!f.previousCycleId||!f.currentCycleId))throw new Error('Choose both previous and current cycles.');const budgetMovement=prev&&cur?Number(cur.approvedBudget||0)-Number(prev.approvedBudget||0):null,prevCba=prev?governedCba(prev):null,curCba=cur?governedCba(cur):null,cbaMovement=prevCba!==null&&curCba!==null?curCba-prevCba:null;await withSubmit(event.target,()=>api.saveContinuityLink({id:null,previousCycleId:f.previousCycleId||null,currentCycleId:f.currentCycleId||null,continuityType:type,matchConfidence:numberOrNull(f.matchConfidence),matchMethod:f.matchMethod.trim(),approvedBudgetMovement:budgetMovement,cbaRatioMovement:cbaMovement,scopeChangeExplanation:f.scopeChangeExplanation.trim(),managementStatus:f.managementStatus},state.user));closeModal(true);await refreshData();toast('AMP continuity link saved.','success');});
  }

  function openProjectModal(item){
    const initiatives=scopedInitiatives();if(!initiatives.length){toast('Create an initiative for this year first.','error');return;}
    item=item||{initiativeId:initiatives[0].id,owner:state.user.name,ownerId:state.user.id,year:state.filters.year,status:'IN_PROGRESS',health:'ON_TRACK',progress:0,startDate:'',targetDate:'',budget:0,spent:0,description:''};
    openModal(item.id?'Edit Project':'Create Project','Project Management',`<form id="project-form"><div class="form-grid"><label class="field"><span>Project code</span><input name="code" value="${escapeAttr(item.code||'')}" placeholder="Generated if blank"></label><label class="field"><span>Initiative</span><select name="initiativeId">${initiatives.map(i=>`<option value="${i.id}" ${item.initiativeId===i.id?'selected':''}>${escapeHtml(i.title)}</option>`).join('')}</select></label><label class="field span-2"><span>Project title</span><input name="title" required value="${escapeAttr(item.title||'')}"></label><label class="field"><span>Project owner</span><input name="owner" required value="${escapeAttr(item.owner||state.user.name)}"></label><label class="field"><span>Delivery health</span><select name="health">${['ON_TRACK','AT_RISK','DELAYED'].map(x=>`<option value="${x}" ${item.health===x?'selected':''}>${pretty(x)}</option>`).join('')}</select></label><label class="field"><span>Status</span><select name="status">${['NOT_STARTED','IN_PROGRESS','AT_RISK','DELAYED','COMPLETED','ON_HOLD','CANCELLED'].map(x=>`<option value="${x}" ${item.status===x?'selected':''}>${pretty(x)}</option>`).join('')}</select></label><label class="field"><span>Progress (%)</span><input name="progress" type="number" min="0" max="100" value="${Number(item.progress||0)}"></label><label class="field"><span>Planned start</span><input name="startDate" type="date" value="${escapeAttr(item.startDate||'')}"></label><label class="field"><span>Planned end</span><input name="targetDate" type="date" value="${escapeAttr(item.targetDate||'')}"></label><label class="field"><span>Project budget (RM)</span><input name="budget" type="number" min="0" step="0.01" value="${Number(item.budget||0)}"></label><label class="field"><span>Spent (RM)</span><input name="spent" type="number" min="0" step="0.01" value="${Number(item.spent||0)}"></label><label class="field span-2"><span>Description</span><textarea name="description">${escapeHtml(item.description||'')}</textarea></label></div><div class="modal-actions"><button type="button" class="btn secondary" data-modal-close>Cancel</button><button class="btn primary" type="submit">Save Project</button></div></form>`);
    bindModalClose();document.getElementById('project-form').addEventListener('submit',async event=>{event.preventDefault();const f=formObject(event.target),initiative=state.data.initiatives.find(i=>i.id===f.initiativeId);const record=Object.assign({},item,{code:f.code.trim(),title:f.title.trim(),initiativeId:f.initiativeId,owner:f.owner.trim(),ownerId:item.ownerId||state.user.id,departmentId:initiative.departmentId,year:initiative.year,status:f.status,health:f.health,progress:Number(f.progress||0),startDate:f.startDate,targetDate:f.targetDate,budget:Number(f.budget||0),spent:Number(f.spent||0),description:f.description.trim()});if(record.targetDate&&record.startDate&&record.targetDate<record.startDate)throw new Error('Planned end date cannot be before the start date.');await withSubmit(event.target,()=>api.saveProject(record,state.user,{initiatives:state.data.initiatives}));closeModal();await refreshData();toast('Project saved.','success');});
  }
  function openProjectView(item){if(!item)return;const milestones=state.data.milestones.filter(m=>m.projectId===item.id),risks=state.data.risks.filter(r=>r.projectId===item.id);openModal(item.title,'Project Detail',`<div class="summary-strip"><div><small>Progress</small><strong>${Number(item.progress||0)}%</strong></div><div><small>Health</small><strong>${pretty(item.health)}</strong></div><div><small>Budget</small><strong>${money(item.budget)}</strong></div><div><small>Spent</small><strong>${money(item.spent)}</strong></div><div><small>Target</small><strong>${formatDate(item.targetDate)}</strong></div></div><div class="grid two-col"><section><h3>Project information</h3><div class="profile-details"><div class="detail-box"><small>Code</small><strong>${escapeHtml(item.code)}</strong></div><div class="detail-box"><small>Owner</small><strong>${escapeHtml(item.owner)}</strong></div><div class="detail-box"><small>Initiative</small><strong>${escapeHtml(initiativeTitle(item.initiativeId))}</strong></div><div class="detail-box"><small>Dates</small><strong>${formatDate(item.startDate)} – ${formatDate(item.targetDate)}</strong></div></div></section><section><h3>Milestones & risks</h3><div class="status-list">${milestones.map(m=>`<div class="status-item"><div><strong>${escapeHtml(m.title)}</strong><small>${formatDate(m.date)}</small></div>${statusBadge(m.status)}</div>`).join('')||'<div class="muted">No milestones.</div>'}${risks.map(r=>`<div class="status-item"><div><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.mitigation)}</small></div>${statusBadge(r.rating)}</div>`).join('')}</div></section></div>`);}

  function openUserModal(){
    const allowedRoles=state.user.role==='SUPER_ADMIN'?['END_USER','DEPARTMENT_HEAD','DEPARTMENT_ADMIN','PORTFOLIO_ADMIN','FINANCE_REVIEWER','AUDITOR','ADMIN','SUPER_ADMIN']:['END_USER','DEPARTMENT_HEAD','DEPARTMENT_ADMIN','PORTFOLIO_ADMIN','AUDITOR'];
    openModal('Create User','Access Administration',`<form id="user-form"><div class="admin-modal-intro"><strong>Create an individual HOME31 account</strong><span>Assign the correct role and department before issuing the temporary password.</span></div><div class="form-grid"><label class="field"><span>Full name</span><input name="name" autocomplete="name" required></label><label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label><label class="field"><span>Department</span><select name="departmentId" required><option value="">Choose department</option>${departmentOptions(state.user.departmentId,false)}</select></label><label class="field"><span>Role</span><select name="role" required>${allowedRoles.map(x=>`<option value="${x}">${api.roleLabel(x)}</option>`).join('')}</select></label><label class="field span-2"><span>Temporary password</span><input name="password" type="text" minlength="10" required value="Home31!Temp"><small>Minimum 10 characters. The user must change it on first login.</small></label></div><div class="alert info">The account is created as Active and first-login password change is enforced.</div><div class="modal-actions"><button type="button" class="btn secondary" data-modal-close>Cancel</button><button class="btn primary" type="submit">Create User</button></div></form>`);
    bindModalClose();
    document.getElementById('user-form').addEventListener('submit',async event=>{event.preventDefault();const f=formObject(event.target);await withSubmit(event.target,()=>api.saveUser({name:f.name.trim(),email:f.email.trim(),departmentId:f.departmentId,role:f.role,password:f.password},state.user));closeModal();await refreshData();toast('User created.','success');});
  }
  function downloadUserTemplate(){
    const rows=[['full_name','email','department_code','role','temporary_password'],['Example User','user@example.com','ICT','END_USER','Home31!Temp']];
    downloadCsv('home31-user-import-template.csv',rows);
  }
  function openUserImportModal(){
    openModal('Import Users','Access Administration',`<div class="admin-modal-intro"><strong>Bulk-create HOME31 accounts</strong><span>Use the official template. Records are validated before each account is created.</span></div><div class="import-dropzone"><input id="user-import-file" type="file" accept=".csv,text/csv"><strong>Select a CSV file</strong><small>Required: full_name, email, department_code, role, temporary_password</small></div><div id="user-import-preview" class="import-preview"><div class="empty-state compact">No file selected.</div></div><div class="modal-actions"><button class="btn outline" type="button" data-action-local="template">Download Template</button><button class="btn secondary" type="button" data-modal-close>Cancel</button><button id="confirm-user-import" class="btn primary" type="button" disabled>Import Users</button></div>`);
    bindModalClose();
    const input=document.getElementById('user-import-file'),preview=document.getElementById('user-import-preview'),confirmButton=document.getElementById('confirm-user-import');let validRows=[];
    el.modalContent.querySelector('[data-action-local="template"]').addEventListener('click',downloadUserTemplate);
    input.addEventListener('change',()=>{const file=input.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const rows=parseCsv(String(reader.result));if(rows.length<2)throw new Error('The CSV file contains no user rows.');const headers=rows[0].map(x=>x.trim().toLowerCase()),required=['full_name','email','department_code','role','temporary_password'];required.forEach(h=>{if(!headers.includes(h))throw new Error('Missing required column: '+h);});validRows=rows.slice(1).filter(r=>r.some(v=>v.trim())).map((values,index)=>{const obj={};headers.forEach((h,i)=>obj[h]=String(values[i]||'').trim());const dept=state.data.departments.find(d=>d.code.toLowerCase()===obj.department_code.toLowerCase());const allowed=['SUPER_ADMIN','ADMIN','DEPARTMENT_ADMIN','DEPARTMENT_HEAD','PORTFOLIO_ADMIN','FINANCE_REVIEWER','AUDITOR','END_USER'];const errors=[];if(!obj.full_name)errors.push('Full name missing');if(!/^\S+@\S+\.\S+$/.test(obj.email))errors.push('Invalid email');if(!dept)errors.push('Unknown department '+obj.department_code);if(!allowed.includes(obj.role.toUpperCase()))errors.push('Invalid role');if(obj.temporary_password.length<10)errors.push('Password too short');return {line:index+2,name:obj.full_name,email:obj.email,departmentId:dept?.id,departmentCode:obj.department_code,role:obj.role.toUpperCase(),password:obj.temporary_password,errors};});const errors=validRows.reduce((n,r)=>n+r.errors.length,0);preview.innerHTML=`<div class="import-summary ${errors?'has-errors':''}"><strong>${validRows.length} records detected</strong><span>${errors?errors+' validation issues must be corrected.':'All rows passed validation.'}</span></div><div class="table-wrap"><table class="import-table"><thead><tr><th>Line</th><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Validation</th></tr></thead><tbody>${validRows.slice(0,50).map(r=>`<tr><td>${r.line}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.email)}</td><td>${escapeHtml(r.departmentCode)}</td><td>${escapeHtml(api.roleLabel(r.role))}</td><td>${r.errors.length?`<span class="badge red">${escapeHtml(r.errors.join('; '))}</span>`:'<span class="badge green">Ready</span>'}</td></tr>`).join('')}</tbody></table></div>`;confirmButton.disabled=!!errors||!validRows.length;}catch(error){validRows=[];confirmButton.disabled=true;preview.innerHTML=`<div class="alert danger">${escapeHtml(error.message)}</div>`;}};reader.readAsText(file);});
    confirmButton.addEventListener('click',async()=>{if(!validRows.length)return;confirmButton.disabled=true;confirmButton.textContent='Importing…';try{for(const row of validRows)await api.saveUser({name:row.name,email:row.email,departmentId:row.departmentId,role:row.role,password:row.password},state.user);closeModal();await refreshData();toast(validRows.length+' users imported.','success');}catch(error){confirmButton.disabled=false;confirmButton.textContent='Import Users';toast(error.message||'User import failed.','error');}});
  }
  function openManageUser(user){
    if(!user)return;

    const isSuperAdmin=state.user.role==='SUPER_ADMIN';
    const allowedRoles=['END_USER','DEPARTMENT_HEAD','DEPARTMENT_ADMIN','PORTFOLIO_ADMIN','FINANCE_REVIEWER','AUDITOR','ADMIN','SUPER_ADMIN'];

    if(!isSuperAdmin){
      openModal('Manage User','Access Administration',`<div class="profile-details"><div class="detail-box"><small>Name</small><strong>${escapeHtml(user.name)}</strong></div><div class="detail-box"><small>Email</small><strong>${escapeHtml(user.email)}</strong></div><div class="detail-box"><small>Department</small><strong>${user.departmentId?escapeHtml(departmentName(user.departmentId)):'Unassigned'}</strong></div><div class="detail-box"><small>Role</small><strong>${escapeHtml(api.roleLabel(user.role))}</strong></div><div class="detail-box"><small>Status</small><strong>${statusBadge(user.status)}</strong></div></div><div class="modal-actions" style="justify-content:flex-start"><button class="btn outline" data-user-status="ACTIVE">Reactivate</button><button class="btn secondary" data-user-status="FROZEN">Freeze</button><button class="btn danger" data-user-status="REVOKED">Revoke access</button></div>`);
    }else{
      openModal('Edit User','Super Administrator',`<form id="manage-user-form"><div class="admin-modal-intro"><strong>Edit HOME31 user access</strong><span>Super Administrators may update the user's identity, department and assigned role.</span></div><div class="form-grid"><label class="field"><span>Full name</span><input name="name" required value="${escapeAttr(user.name||'')}"></label><label class="field"><span>Email</span><input name="email" type="email" required value="${escapeAttr(user.email||'')}"></label><label class="field"><span>Department</span><select name="departmentId" required><option value="">Choose department</option>${departmentOptions(user.departmentId,false)}</select></label><label class="field"><span>Role</span><select name="role" required>${allowedRoles.map(role=>`<option value="${role}" ${user.role===role?'selected':''}>${escapeHtml(api.roleLabel(role))}</option>`).join('')}</select></label></div><div class="alert info">Changes are applied to Supabase Authentication and the HOME31 profile and role records.</div><div class="modal-actions"><button type="button" class="btn secondary" data-modal-close>Cancel</button><button class="btn primary" type="submit">Save Changes</button></div></form><div class="modal-actions admin-account-actions" style="justify-content:flex-start;border-top:1px solid var(--line);padding-top:16px"><button class="btn primary" type="button" data-reset-user-password>Reset Password</button><button class="btn outline" data-user-status="ACTIVE">Reactivate</button><button class="btn secondary" data-user-status="FROZEN">Freeze</button><button class="btn danger" data-user-status="REVOKED">Revoke access</button></div>`);
      bindModalClose();

      document.getElementById('manage-user-form').addEventListener('submit',async event=>{
        event.preventDefault();
        const f=formObject(event.target);
        await withSubmit(event.target,()=>api.updateUser({
          id:user.id,
          name:f.name.trim(),
          email:f.email.trim(),
          departmentId:f.departmentId,
          role:f.role
        },state.user));

        if(user.id===state.user.id){
          state.user=await api.getCurrentUser();
          el.userName.textContent=state.user.name;
          el.userRole.textContent=state.user.roleLabel;
          el.userAvatar.textContent=initials(state.user.name);
        }

        closeModal();
        await refreshData();
        toast('User details updated.','success');
      });

      const resetButton=el.modalContent.querySelector('[data-reset-user-password]');
      if(resetButton)resetButton.addEventListener('click',()=>openAdminPasswordResetModal(user));
    }

    el.modalContent.querySelectorAll('[data-user-status]').forEach(button=>button.addEventListener('click',async()=>{
      await api.updateUserStatus(user.id,button.dataset.userStatus,state.user);
      closeModal();
      await refreshData();
      toast('Account status updated.','success');
    }));
  }
  function generateTemporaryPassword(){
    const upper='ABCDEFGHJKLMNPQRSTUVWXYZ',lower='abcdefghijkmnopqrstuvwxyz',digits='23456789',symbols='!@#$%';
    const pick=chars=>chars[Math.floor(Math.random()*chars.length)],all=upper+lower+digits+symbols;
    const chars=[pick(upper),pick(lower),pick(digits),pick(symbols)];
    while(chars.length<14)chars.push(pick(all));
    for(let i=chars.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[chars[i],chars[j]]=[chars[j],chars[i]];}
    return chars.join('');
  }
  function openAdminPasswordResetModal(user){
    if(!user||state.user.role!=='SUPER_ADMIN')return;
    const generated=generateTemporaryPassword();
    openModal('Reset User Password','Super Administrator',`<form id="admin-password-reset-form"><div class="admin-modal-intro"><strong>Issue a temporary password</strong><span>Reset the password for ${escapeHtml(user.name||user.email)}. The previous password is never displayed and will stop working immediately.</span></div><div class="alert warning"><strong>Share securely.</strong> The temporary password is visible only in this form and should not be sent through an open or shared channel.</div><label class="field"><span>Temporary password</span><div class="password-reset-input-row"><input id="admin-temp-password" name="password" type="text" minlength="10" required autocomplete="new-password" value="${escapeAttr(generated)}"><button class="btn outline compact" type="button" data-generate-temp-password>Generate</button></div><small>Minimum 10 characters. Use a unique value for every reset.</small></label><label class="field"><span>Confirm temporary password</span><input name="confirm" type="text" minlength="10" required autocomplete="new-password" value="${escapeAttr(generated)}"></label><label class="checkbox password-reset-force"><input name="mustChangePassword" type="checkbox" checked> Require the user to change this password at the next login</label><div class="password-reset-user-summary"><div><small>User</small><strong>${escapeHtml(user.name||'Unnamed user')}</strong></div><div><small>Email</small><strong>${escapeHtml(user.email||'Not recorded')}</strong></div></div><div class="modal-actions"><button type="button" class="btn secondary" data-modal-close>Cancel</button><button class="btn primary" type="submit">Reset Password</button></div></form>`);
    bindModalClose();
    const form=document.getElementById('admin-password-reset-form'),passwordInput=document.getElementById('admin-temp-password');
    form.querySelector('[data-generate-temp-password]').addEventListener('click',()=>{const value=generateTemporaryPassword();passwordInput.value=value;form.elements.confirm.value=value;passwordInput.focus();passwordInput.select();});
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const f=formObject(form),password=String(f.password||''),confirm=String(f.confirm||'');
      if(password.length<10)throw new Error('Use at least 10 characters for the temporary password.');
      if(password!==confirm)throw new Error('The temporary passwords do not match.');
      await withSubmit(form,()=>api.resetUserPassword({userId:user.id,temporaryPassword:password,mustChangePassword:form.elements.mustChangePassword.checked},state.user));
      closeModal();
      await refreshData();
      toast('Temporary password issued. The user must change it at next login.','success');
    });
  }

  function openDepartmentModal(item){item=item||{code:'',name:'',active:true};openModal(item.id?'Edit Department':'Create Department','Organisation',`<form id="department-form"><div class="form-grid"><label class="field"><span>Department code</span><input name="code" required value="${escapeAttr(item.code)}"></label><label class="field"><span>Department name</span><input name="name" required value="${escapeAttr(item.name)}"></label><label class="checkbox span-2"><input name="active" type="checkbox" ${item.active!==false?'checked':''}> Active department</label></div><div class="modal-actions"><button type="button" class="btn secondary" data-modal-close>Cancel</button><button class="btn primary" type="submit">Save Department</button></div></form>`);bindModalClose();document.getElementById('department-form').addEventListener('submit',async event=>{event.preventDefault();const f=formObject(event.target);await withSubmit(event.target,()=>api.saveDepartment(Object.assign({},item,{code:f.code.trim().toUpperCase(),name:f.name.trim(),active:event.target.elements.active.checked}),state.user));closeModal();await refreshData();toast('Department saved.','success');});}
  function openYearModal(item){item=item||{year:new Date().getFullYear()+1,label:'',active:false};openModal(item.id?'Edit Reporting Year':'Create Reporting Year','Annual Planning',`<form id="year-form"><div class="form-grid"><label class="field"><span>Year</span><input name="year" type="number" min="2020" max="2100" required value="${item.year}"></label><label class="field"><span>Label</span><input name="label" required value="${escapeAttr(item.label||('AMP '+item.year))}"></label><label class="checkbox span-2"><input name="active" type="checkbox" ${item.active?'checked':''}> Set as active planning year</label></div><div class="modal-actions"><button type="button" class="btn secondary" data-modal-close>Cancel</button><button class="btn primary" type="submit">Save Year</button></div></form>`);bindModalClose();document.getElementById('year-form').addEventListener('submit',async event=>{event.preventDefault();const f=formObject(event.target);await withSubmit(event.target,()=>api.saveYear(Object.assign({},item,{year:Number(f.year),label:f.label.trim(),active:event.target.elements.active.checked}),state.user));closeModal();await refreshData();toast('Reporting year saved.','success');});}
  function openPasswordModal(forced){openModal(forced?'Set a new password':'Change Password',forced?'First Login Security':'Account Security',`<form id="password-form"><div class="alert ${forced?'info':'success'}">${forced?'You must replace the temporary password before using HOME31.':'Use a strong password with at least 10 characters.'}</div><label class="field"><span>New password</span><input name="password" type="password" minlength="10" required autocomplete="new-password"></label><label class="field"><span>Confirm password</span><input name="confirm" type="password" minlength="10" required autocomplete="new-password"></label><div class="modal-actions">${forced?'':'<button type="button" class="btn secondary" data-modal-close>Cancel</button>'}<button class="btn primary" type="submit">Update Password</button></div></form>`);if(!forced)bindModalClose();else el.modalClose.classList.add('hidden');document.getElementById('password-form').addEventListener('submit',async event=>{event.preventDefault();const f=formObject(event.target);if(f.password!==f.confirm)throw new Error('The passwords do not match.');state.user=await withSubmit(event.target,()=>api.changePassword(state.user,f.password));el.modalClose.classList.remove('hidden');closeModal();el.userRole.textContent=state.user.roleLabel;toast('Password updated.','success');});}
  function bindModalClose(){el.modalClose.classList.remove('hidden');el.modalContent.querySelectorAll('[data-modal-close]').forEach(b=>b.addEventListener('click',()=>closeModal(false,'action-button')));}
  async function withSubmit(form,fn){const button=form.querySelector('button[type="submit"]'),old=button?.textContent;if(button){button.disabled=true;button.textContent='Saving…';}try{return await fn();}catch(error){toast(error.message||'Unable to save.','error');throw error;}finally{if(button){button.disabled=false;button.textContent=old;}}}
  function formObject(form){return Object.fromEntries(new FormData(form).entries());}

  const initiativeImportState={rows:[],validRows:[],fileName:''};
  function normaliseImportHeader(value){return String(value||'').replace(/^\ufeff/,'').trim().toLowerCase().replace(/[\s-]+/g,'_');}
  function normaliseKey(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');}
  function initiativeDuplicateKey(record){return [Number(record.year),record.departmentId,normaliseKey(record.title)].join('|');}
  function cleanInitiativeCodePart(value,fallback){const clean=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);return clean||fallback;}
  function isYearOnlyInitiativeCode(value,year){const compact=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return compact===String(year)||compact===('AMP'+String(year))||compact===('AMP'+String(year).slice(-2));}
  function isValidInitiativeCode(value,year,departmentCode){const code=String(value||'').trim().toUpperCase(),yy=String(year).slice(-2),dept=cleanInitiativeCodePart(departmentCode,'GEN');return !isYearOnlyInitiativeCode(code,year)&&new RegExp('^AMP'+yy+'-'+dept+'-[0-9]{6}$').test(code);}
  function generateInitiativeCode(year,departmentCode,reservedCodes,seed){const yy=String(year).slice(-2),dept=cleanInitiativeCodePart(departmentCode,'GEN'),base=String(Date.now()+Number(seed||0)).slice(-6);let serial=Number(base);for(let tries=0;tries<1000000;tries++){const code='AMP'+yy+'-'+dept+'-'+String(serial).padStart(6,'0').slice(-6);if(!reservedCodes.has(normaliseKey(code))){reservedCodes.add(normaliseKey(code));return code;}serial=(serial+1)%1000000;}throw new Error('HOME31 could not generate a unique initiative code.');}
  function isValidIsoDate(value){if(!value)return true;return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(new Date(value+'T00:00:00'));}
  function openInitiativeImportModal(){
    initiativeImportState.rows=[];initiativeImportState.validRows=[];initiativeImportState.fileName='';
    openModal('Import Initiatives','Annual AMP Register',`<div class="admin-modal-intro"><strong>Validate before importing</strong><span>HOME31 checks required fields, reference data, numeric values, dates and duplicates before any record is saved.</span></div><div class="import-dropzone"><input id="initiative-import-file" type="file" accept=".csv,text/csv"><strong>Select an initiative CSV file</strong><small>Nothing is imported until the validation preview is reviewed and confirmed.</small></div><div id="initiative-import-preview" class="import-preview"><div class="empty-state compact">No file selected.</div></div><div class="modal-actions"><button class="btn outline" type="button" id="download-initiative-template">Download Template</button><button class="btn secondary" type="button" data-modal-close>Cancel</button><button id="confirm-initiative-import" class="btn primary" type="button" disabled>Import Valid Rows</button></div>`);
    bindModalClose();
    document.getElementById('initiative-import-file').addEventListener('change',handleCsvImport);
    document.getElementById('download-initiative-template').addEventListener('click',downloadInitiativeTemplate);
    document.getElementById('confirm-initiative-import').addEventListener('click',confirmInitiativeImport);
  }
  function downloadInitiativeTemplate(){
    downloadCsv('home31-initiative-import-template.csv',[
      ['code','title','owner','department_code','year','classification','status','requested_budget','approved_budget','committed_budget','utilised_budget','progress','priority','start_date','target_date','description'],
      ['','Example Initiative','Owner Name',state.data.departments[0]?.code||'CPS',state.filters.year||new Date().getFullYear(),'NEW','DRAFT','100000','80000','0','0','0','MEDIUM','2027-01-01','2027-12-31','Example only — remove before import']
    ]);
  }
  function validateInitiativeImport(text,fileName){
    const parsed=parseCsv(text).filter(row=>row.some(v=>String(v).trim()));
    if(parsed.length<2)throw new Error('The CSV file contains no data rows.');
    const headers=parsed[0].map(normaliseImportHeader),required=['title','owner','department_code','year','classification','approved_budget'];
    const missing=required.filter(h=>!headers.includes(h));if(missing.length)throw new Error('Missing required column'+(missing.length>1?'s':'')+': '+missing.join(', '));
    const existingCodes=new Set(state.data.initiatives.filter(i=>!i.archived&&i.code).map(i=>normaliseKey(i.code)));
    const existingKeys=new Set(state.data.initiatives.filter(i=>!i.archived).map(i=>initiativeDuplicateKey(i)));
    const fileCodes=new Set(),fileKeys=new Set(),validClassifications=new Set(['NEW','CARRY_FORWARD','EVOLUTION','REPEAT']),validStatuses=new Set(['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','RETURNED','REJECTED','COMPLETED']),validPriorities=new Set(['LOW','MEDIUM','HIGH','CRITICAL','EXTREME']);
    const rows=[];
    parsed.slice(1).forEach((values,index)=>{
      const obj={};headers.forEach((h,i)=>obj[h]=String(values[i]??'').trim());
      const errors=[],warnings=[],dept=state.data.departments.find(d=>normaliseKey(d.code)===normaliseKey(obj.department_code)),year=Number(obj.year),reportingYear=state.data.reportingYears.find(y=>Number(y.year)===year);
      const classification=(obj.classification||'NEW').toUpperCase().replace(/[- ]/g,'_'),status=(obj.status||'DRAFT').toUpperCase().replace(/[- ]/g,'_'),priority=(obj.priority||'MEDIUM').toUpperCase().replace(/[- ]/g,'_');
      const numberFields=['requested_budget','approved_budget','committed_budget','utilised_budget','progress'];
      if(!obj.title)errors.push('Title is required');if(!obj.owner)errors.push('Owner is required');if(!dept)errors.push('Unknown department code');if(!Number.isInteger(year))errors.push('Year must be a whole number');else if(!reportingYear)errors.push('Reporting year is not configured');
      if(!validClassifications.has(classification))errors.push('Invalid classification');if(!validStatuses.has(status))errors.push('Invalid status');if(!validPriorities.has(priority))errors.push('Invalid priority');
      numberFields.forEach(k=>{if(obj[k]!==''&&!Number.isFinite(Number(obj[k])))errors.push(k+' must be numeric');});
      const approved=Number(obj.approved_budget||0),progress=Number(obj.progress||0),committed=Number(obj.committed_budget||0),utilised=Number(obj.utilised_budget||0);
      if(approved<0)errors.push('Approved budget cannot be negative');if(progress<0||progress>100)errors.push('Progress must be between 0 and 100');if(committed<0||utilised<0)errors.push('Budget values cannot be negative');if(utilised>approved&&approved>=0)warnings.push('Utilised budget exceeds Approved Budget');
      if(!isValidIsoDate(obj.start_date))errors.push('Start date must use YYYY-MM-DD');if(!isValidIsoDate(obj.target_date))errors.push('Target date must use YYYY-MM-DD');if(obj.start_date&&obj.target_date&&obj.start_date>obj.target_date)errors.push('Target date is before start date');
      const reservedCodes=new Set([...existingCodes,...fileCodes]);
      let generatedCode=false,initiativeCode=String(obj.code||'').trim().toUpperCase();
      if(dept&&Number.isInteger(year)){
        if(!initiativeCode||isYearOnlyInitiativeCode(initiativeCode,year)){initiativeCode=generateInitiativeCode(year,dept.code,reservedCodes,index+1);generatedCode=true;warnings.push('A valid HOME31 initiative code was generated automatically');}
        else if(!isValidInitiativeCode(initiativeCode,year,dept.code))errors.push('Code must follow AMP'+String(year).slice(-2)+'-'+cleanInitiativeCodePart(dept.code,'GEN')+'-######');
      }
      const record={code:initiativeCode,title:obj.title,owner:obj.owner,ownerId:state.user.id,departmentId:dept?.id||'',year,reportingYearId:reportingYear?.id||'',classification,status,requestedBudget:Number(obj.requested_budget||obj.approved_budget||0),approvedBudget:approved,committedBudget:committed,utilisedBudget:utilised,progress,priority,startDate:obj.start_date||'',targetDate:obj.target_date||'',description:obj.description||'',formData:{projectOwnerName:obj.owner,projectDescription:obj.description||'',approvedBudget:approved,progress:progress,startDate:obj.start_date||'',targetDate:obj.target_date||''}};
      const codeKey=normaliseKey(record.code),duplicateKey=dept&&Number.isInteger(year)?initiativeDuplicateKey(record):'';
      if(codeKey&&!generatedCode&&(existingCodes.has(codeKey)||fileCodes.has(codeKey)))errors.push(existingCodes.has(codeKey)?'Duplicate code already exists':'Duplicate code within this file');
      if(duplicateKey&&(existingKeys.has(duplicateKey)||fileKeys.has(duplicateKey)))errors.push(existingKeys.has(duplicateKey)?'Same title, department and year already exists':'Duplicate title, department and year within this file');
      if(codeKey)fileCodes.add(codeKey);if(duplicateKey)fileKeys.add(duplicateKey);
      rows.push({rowNumber:index+2,obj,record,errors:[...new Set(errors)],warnings:[...new Set(warnings)]});
    });
    initiativeImportState.rows=rows;initiativeImportState.validRows=rows.filter(r=>!r.errors.length);initiativeImportState.fileName=fileName;
    return rows;
  }
  function renderInitiativeImportPreview(rows){
    const preview=document.getElementById('initiative-import-preview'),valid=rows.filter(r=>!r.errors.length),invalid=rows.filter(r=>r.errors.length),warnings=rows.filter(r=>r.warnings.length);
    preview.innerHTML=`<div class="import-summary ${invalid.length?'has-errors':''}"><strong>${valid.length} valid · ${invalid.length} blocked · ${warnings.length} warning</strong><span>${escapeHtml(initiativeImportState.fileName)} · ${rows.length} data rows checked</span></div><div class="table-wrap"><table class="import-table initiative-import-table"><thead><tr><th>Row</th><th>Initiative</th><th>Department</th><th>Year</th><th>Approved Budget</th><th>Result</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.rowNumber}</td><td><strong>${escapeHtml(r.record.title||'Missing title')}</strong><br><span class="muted">${escapeHtml(r.record.code||'Invalid code')}</span></td><td>${escapeHtml(r.obj.department_code||'—')}</td><td>${escapeHtml(r.obj.year||'—')}</td><td class="amount">${Number.isFinite(r.record.approvedBudget)?money(r.record.approvedBudget):'—'}</td><td>${r.errors.length?`<span class="badge red">Blocked</span><small class="import-row-message">${escapeHtml(r.errors.join('; '))}</small>`:`<span class="badge green">Ready</span>${r.warnings.length?`<small class="import-row-message warning-text">${escapeHtml(r.warnings.join('; '))}</small>`:''}`}</td></tr>`).join('')}</tbody></table></div>${invalid.length?'<div class="alert danger import-block-note"><strong>Blocked rows will not be imported.</strong> Correct the file and validate it again to include them.</div>':''}`;
    const confirm=document.getElementById('confirm-initiative-import');confirm.disabled=!valid.length;confirm.textContent=valid.length?`Import ${valid.length} Valid Row${valid.length===1?'':'s'}`:'Import Valid Rows';
  }
  function handleCsvImport(event){
    const file=event.target.files[0];if(!file)return;const reader=new FileReader();
    reader.onload=()=>{try{renderInitiativeImportPreview(validateInitiativeImport(String(reader.result),file.name));}catch(error){initiativeImportState.rows=[];initiativeImportState.validRows=[];document.getElementById('initiative-import-preview').innerHTML=`<div class="alert danger"><strong>Validation could not be completed.</strong><br>${escapeHtml(error.message)}</div>`;document.getElementById('confirm-initiative-import').disabled=true;}};
    reader.onerror=()=>toast('The CSV file could not be read.','error');reader.readAsText(file);
  }
  async function confirmInitiativeImport(){
    const button=document.getElementById('confirm-initiative-import'),rows=initiativeImportState.validRows;if(!rows.length)return;
    button.disabled=true;button.textContent='Rechecking…';
    try{
      state.data=await api.loadData(state.user);
      const currentCodes=new Set(state.data.initiatives.filter(i=>!i.archived&&i.code).map(i=>normaliseKey(i.code))),currentKeys=new Set(state.data.initiatives.filter(i=>!i.archived).map(i=>initiativeDuplicateKey(i)));
      const titleConflicts=rows.filter(r=>currentKeys.has(initiativeDuplicateKey(r.record)));
      if(titleConflicts.length)throw new Error(`${titleConflicts.length} row${titleConflicts.length===1?'':'s'} became duplicate after validation. Re-select the file to refresh the preview.`);
      rows.forEach((r,index)=>{if(currentCodes.has(normaliseKey(r.record.code))){const dept=state.data.departments.find(d=>d.id===r.record.departmentId);r.record.code=generateInitiativeCode(r.record.year,dept?.code||'GEN',currentCodes,index+1);}});
      let imported=0;button.textContent=`Importing 0 of ${rows.length}…`;
      for(const row of rows){
        const dept=state.data.departments.find(d=>d.id===row.record.departmentId);
        if(!row.record.code||isYearOnlyInitiativeCode(row.record.code,row.record.year)){row.record.code=generateInitiativeCode(row.record.year,dept?.code||'GEN',currentCodes,imported+1);}
        await api.saveInitiative(row.record,state.user,{defaultPortfolioId:state.data.portfolios?.[0]?.id,defaultStrategicPillarId:state.data.strategicPillars?.[0]?.id,departmentCode:dept?.code||'GEN'});
        imported++;button.textContent=`Importing ${imported} of ${rows.length}…`;
      }
      closeModal();await refreshData();toast(`${imported} initiative${imported===1?'':'s'} imported successfully.`,'success');
    }catch(error){button.disabled=false;button.textContent=`Import ${rows.length} Valid Row${rows.length===1?'':'s'}`;toast(error.message||'Import failed.','error');}
  }
  function parseCsv(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],next=text[i+1];if(c==='"'&&quoted&&next==='"'){field+='"';i++;}else if(c==='"'){quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(field);rows.push(row);row=[];field='';}else field+=c;}if(quoted)throw new Error('The CSV contains an unclosed quoted field.');if(field||row.length){row.push(field);rows.push(row);}return rows;}

  function exportReport(type){
    let rows=[],name='home31-'+type+'-'+new Date().toISOString().slice(0,10)+'.csv';
    if(type==='initiatives'){
      const source=state.data.initiatives.filter(i=>!i.archived&&(state.filters.year?Number(i.year)===Number(state.filters.year):true)&&(state.filters.department==='all'||i.departmentId===state.filters.department)&&(state.filters.status==='all'||i.status===state.filters.status));
      rows=[['Code','Title','Project Owner','Department Code','Department','Year','Classification','Status','Requested Budget','Approved Budget','Committed Budget','Utilised Budget','Progress','Priority','Start Date','Target Date','Description'],...source.map(i=>{const d=i.formData||{},dept=state.data.departments.find(x=>x.id===i.departmentId);return[i.code,i.title,d.projectOwnerName||i.owner,dept?.code||'',dept?.name||i.departmentName||'',i.year,i.classification,i.status,i.requestedBudget,i.approvedBudget,i.committedBudget,i.utilisedBudget,d.progress??i.progress,i.priority,i.startDate,i.targetDate,d.projectDescription||i.description||''];})];
    }else if(type==='projects')rows=[['Code','Delivery Record','Type','Parent Initiative','Owner','Department','Year','Status','Health','Risk','Progress','Readiness','Start','Target','Next Action'],...scopedDeliveryItems().map(p=>[p.code,p.title,pretty(p.sourceType),p.sourceType==='INITIATIVE'?'Enterprise initiative':(p.initiativeTitle||initiativeTitle(p.initiativeId)),p.owner,departmentName(p.departmentId),p.year,pretty(p.status),pretty(p.health),p.risk||'',p.progress,p.readiness||0,p.startDate,p.targetDate,p.nextAction||''])];
    else if(type==='departments')rows=[['Code','Department','Users','Initiatives','Approved Budget'],...state.data.departments.map(d=>[d.code,d.name,state.data.users.filter(u=>u.departmentId===d.id).length,state.data.initiatives.filter(i=>i.departmentId===d.id&&!i.archived).length,state.data.initiatives.filter(i=>i.departmentId===d.id&&!i.archived).reduce((s,i)=>s+Number(i.approvedBudget||0),0)])];
    else if(type==='audit')rows=[['Time','User','Action','Entity','Details'],...(state.data.audit||[]).map(a=>[a.time,a.user,a.action,a.entity,a.details])];
    else if(type==='comparison'){const old=state.data.initiatives.filter(i=>i.year===state.compareFrom),cur=state.data.initiatives.filter(i=>i.year===state.compareTo);rows=[['Initiative','AMP '+state.compareFrom,'AMP '+state.compareTo,'Movement'],...comparisonMovements(old,cur).map(m=>[m.title,m.old,m.current,m.diff])];}
    else{const items=scopedInitiatives(),totals=budgetTotals(items),projects=scopedProjects();rows=[['HOME31 Executive Portfolio Summary'],['Reporting Year',state.filters.year],['Department',state.filters.department==='all'?'All':departmentName(state.filters.department)],[],['Metric','Value'],['Active initiatives',items.length],['Projects',projects.length],['Approved budget',totals.approved],['Utilised budget',totals.utilised],['At risk projects',projects.filter(p=>p.health==='AT_RISK').length],['Delayed projects',projects.filter(p=>p.health==='DELAYED').length]];}
    if(rows.length<2)throw new Error('There are no records to export for the current filters.');downloadCsv(name,rows);toast(`${Math.max(0,rows.length-1)} record${rows.length===2?'':'s'} exported.`,'success');
  }
  function downloadCsv(filename,rows){
    const csv=rows.map(row=>row.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
    if(window.navigator&&typeof window.navigator.msSaveOrOpenBlob==='function'){window.navigator.msSaveOrOpenBlob(blob,filename);return;}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1000);
  }

  function departmentName(id){return state.data?.departments.find(d=>d.id===id)?.name||'Unassigned';}
  function initiativeTitle(id){return state.data?.initiatives.find(i=>i.id===id)?.title||'Unassigned initiative';}
  function money(value){const n=Number(value||0);return new Intl.NumberFormat(config.locale||'en-MY',{style:'currency',currency:config.currency||'MYR',minimumFractionDigits:0,maximumFractionDigits:0}).format(n);}
  function moneyShort(value){const n=Number(value||0),abs=Math.abs(n);if(abs>=1e9)return 'RM '+(n/1e9).toFixed(1)+'B';if(abs>=1e6)return 'RM '+(n/1e6).toFixed(1)+'M';if(abs>=1e3)return 'RM '+(n/1e3).toFixed(0)+'K';return 'RM '+n.toFixed(0);}
  function percent(value){return (Number(value||0)*100).toFixed(1).replace('.0','')+'%';}
  function pretty(value){return String(value??'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
  function formatDate(value){if(!value)return '—';const d=new Date(String(value).length===10?value+'T00:00:00':value);return isNaN(d)?'—':new Intl.DateTimeFormat(config.locale||'en-MY',{day:'2-digit',month:'short',year:'numeric'}).format(d);}
  function formatDateTime(value){if(!value)return 'Never';const d=new Date(value);return isNaN(d)?'—':new Intl.DateTimeFormat(config.locale||'en-MY',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}
  function initials(name){return String(name||'U').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function escapeAttr(value){return escapeHtml(value);}
  function toast(message,type){el.toast.textContent=message;el.toast.className='toast '+(type||'');el.toast.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.toast.classList.add('hidden'),3500);}
})();
