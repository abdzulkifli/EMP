(function(){
  'use strict';
  var config = window.HOME31_CONFIG || {mode:'demo'};
  var STORAGE_KEY = 'home31-enterprise-demo-v1';
  var SESSION_KEY = 'home31-session-v1';
  var memoryStore = {};

  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function storageGet(key){
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch(e){ return memoryStore[key] || null; }
  }
  function storageSet(key,value){
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch(e){ memoryStore[key] = clone(value); }
  }
  function storageRemove(key){
    try { localStorage.removeItem(key); } catch(e){ delete memoryStore[key]; }
  }
  function getDemoDb(){
    var db = storageGet(STORAGE_KEY);
    if(!db || db.version !== window.HOME31_DEMO.version){ db = clone(window.HOME31_DEMO); storageSet(STORAGE_KEY, db); }
    return db;
  }
  function saveDemoDb(db){ storageSet(STORAGE_KEY, db); return db; }
  function uid(prefix){ return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  function isLive(){ return String(config.mode).toLowerCase() === 'supabase' && config.supabaseUrl && config.publishableKey; }
  function roleLabel(code){ return ({SUPER_ADMIN:'Super Administrator',ADMIN:'Administrator',DEPARTMENT_ADMIN:'Department Administrator',DEPARTMENT_HEAD:'Department Head',PORTFOLIO_ADMIN:'Portfolio Administrator',FINANCE_REVIEWER:'Finance Reviewer',AUDITOR:'Auditor',END_USER:'End User'})[code] || code; }

  function demoAudit(db,user,action,entity,details){
    db.audit.unshift({id:uid('audit'),time:new Date().toISOString(),user:user ? user.name : 'System',action:action,entity:entity,details:details || ''});
    db.audit = db.audit.slice(0,250);
  }

  async function request(path, options){
    options = options || {};
    var session = storageGet(SESSION_KEY);
    var headers = Object.assign({'apikey':config.publishableKey,'Content-Type':'application/json'}, options.headers || {});
    if(session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
    var response = await fetch(config.supabaseUrl.replace(/\/$/,'') + path, Object.assign({}, options, {headers:headers}));
    var text = await response.text();
    var body = text ? (function(){ try{return JSON.parse(text);}catch(e){return text;} })() : null;
    if(!response.ok){
      var message = body && (body.message || body.msg || body.error_description || body.error) || ('Request failed ('+response.status+')');
      throw new Error(message);
    }
    return body;
  }

  async function optionalRequest(path, options){
    try { return await request(path, options); }
    catch(error){
      console.warn('Optional HOME31 data source unavailable:', path, error.message);
      return [];
    }
  }

  function extractCycleId(result){
    var value = Array.isArray(result) ? result[0] : result;
    if(!value) return null;
    if(typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) return value;
    return value.cycle_id || value.cycleId || value.initiative_cycle_id || null;
  }

  async function signIn(email,password){
    if(!isLive()){
      var db = getDemoDb();
      var user = db.users.find(function(item){return item.email.toLowerCase() === String(email).toLowerCase();});
      if(!user || user.password !== password) throw new Error('Incorrect email or password.');
      if(user.status === 'FROZEN') throw new Error('This account is frozen. Contact an administrator.');
      if(user.status === 'REVOKED') throw new Error('Access for this account has been revoked.');
      user.lastLogin = new Date().toISOString();
      demoAudit(db,user,'LOGIN','Session','User signed in to HOME31.');
      saveDemoDb(db);
      var session = {mode:'demo',userId:user.id};
      storageSet(SESSION_KEY,session);
      return enrichDemoUser(user,db);
    }
    var auth = await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:email,password:password})});
    storageSet(SESSION_KEY,auth);
    return getCurrentUser();
  }

  function enrichDemoUser(user,db){
    var department = db.departments.find(function(d){return d.id===user.departmentId;});
    return Object.assign({},user,{roleLabel:roleLabel(user.role),departmentName:department ? department.name : 'Unassigned'});
  }

  async function getCurrentUser(){
    var session = storageGet(SESSION_KEY);
    if(!session) return null;
    if(!isLive()){
      var db = getDemoDb();
      var user = db.users.find(function(item){return item.id===session.userId;});
      return user ? enrichDemoUser(user,db) : null;
    }
    try{
      var profileRows = await request('/rest/v1/my_profile_view?select=*',{method:'GET',headers:{Accept:'application/json'}});
      var profile = profileRows && profileRows[0];
      if(!profile) return null;
      var role = profile.roles && profile.roles[0] || 'END_USER';
      return {id:profile.id,name:profile.full_name,email:profile.email,role:role,roleLabel:roleLabel(role),departmentId:profile.home_department_id,departmentName:profile.department_name,status:profile.account_status,mustChangePassword:profile.must_change_password};
    }catch(error){ storageRemove(SESSION_KEY); return null; }
  }

  async function signOut(){
    if(isLive()){
      try{ await request('/auth/v1/logout',{method:'POST'}); }catch(e){}
    }
    storageRemove(SESSION_KEY);
  }

  async function changePassword(user,newPassword){
    if(!newPassword || newPassword.length < 10) throw new Error('Use at least 10 characters for the new password.');
    if(!isLive()){
      var db = getDemoDb();
      var target = db.users.find(function(item){return item.id===user.id;});
      if(!target) throw new Error('User was not found.');
      target.password = newPassword;
      target.mustChangePassword = false;
      demoAudit(db,target,'PASSWORD_CHANGED','Profile','Password changed by the account owner.');
      saveDemoDb(db);
      return enrichDemoUser(target,db);
    }
    await request('/auth/v1/user',{method:'PUT',body:JSON.stringify({password:newPassword})});
    await request('/rest/v1/rpc/complete_password_change',{method:'POST',body:'{}'});
    return getCurrentUser();
  }

  function applyDemoScope(data,user){
    var elevated = ['SUPER_ADMIN','ADMIN','AUDITOR','FINANCE_REVIEWER'].indexOf(user.role) >= 0;
    if(elevated) return data;
    var scoped = clone(data);
    scoped.initiatives = scoped.initiatives.filter(function(i){return i.departmentId===user.departmentId;});
    var allowedIds = scoped.initiatives.map(function(i){return i.id;});
    scoped.projects = scoped.projects.filter(function(p){return p.departmentId===user.departmentId || allowedIds.indexOf(p.initiativeId)>=0;});
    var projectIds = scoped.projects.map(function(p){return p.id;});
    scoped.milestones = scoped.milestones.filter(function(m){return projectIds.indexOf(m.projectId)>=0;});
    scoped.risks = scoped.risks.filter(function(r){return projectIds.indexOf(r.projectId)>=0;});
    scoped.users = scoped.users.filter(function(u){return u.departmentId===user.departmentId || u.id===user.id;});
    return scoped;
  }

  async function loadData(user){
    if(!isLive()) return applyDemoScope(getDemoDb(),user);
    var results = await Promise.all([
      request('/rest/v1/departments?select=id,code,name,status&status=eq.ACTIVE&order=name'),
      request('/rest/v1/reporting_years?select=id,year,display_name,is_active&order=year'),
      request('/rest/v1/initiative_portfolio_view?select=*&order=reporting_year.desc,initiative_code'),
      request('/rest/v1/project_overview_view?select=*&order=reporting_year.desc,project_code'),
      request('/rest/v1/portfolios?select=id,code,name,status&status=eq.ACTIVE&order=name'),
      request('/rest/v1/strategic_pillars?select=id,code,name,status&status=eq.ACTIVE&order=name'),
      request('/rest/v1/user_directory_view?select=*&order=full_name'),
      optionalRequest('/rest/v1/initiative_form_submissions?select=initiative_cycle_id,form_version,form_data,updated_at')
    ]);
    var formMap = {};
    (results[7] || []).forEach(function(row){ formMap[row.initiative_cycle_id] = row.form_data || {}; });
    var initiatives = results[2].map(function(i){
      var formData = formMap[i.cycle_id] || {};
      return {
        id:i.initiative_id,cycleId:i.cycle_id,code:i.initiative_code,title:i.initiative_title,
        description:formData.projectDescription || i.description || '',portfolioId:i.portfolio_id,portfolioName:i.portfolio_name,
        departmentId:i.department_id,departmentName:i.department_name,ownerId:i.project_owner_id,
        owner:formData.projectOwnerName || i.project_owner_name,strategicPillarId:i.strategic_pillar_id,
        strategicPillarName:i.strategic_pillar_name,reportingYearId:i.reporting_year_id,year:i.reporting_year,
        classification:i.initiative_type,status:i.cycle_status,startDate:i.planned_start_date,targetDate:i.planned_end_date,
        progress:Number(i.progress_percentage||0),priority:i.priority || 'MEDIUM',requestedBudget:Number(i.requested_budget||0),
        approvedBudget:Number(i.approved_budget||0),committedBudget:Number(i.committed_amount||0),utilisedBudget:Number(i.utilised_amount||0),
        forecastBudget:Number(i.forecast_amount||0),archived:false,formData:formData
      };
    });
    var projects = results[3].map(function(p){return {
      id:p.project_id,code:p.project_code,title:p.project_name,initiativeId:p.initiative_id,initiativeTitle:p.initiative_title,
      departmentId:p.department_id,departmentName:p.department_name,year:p.reporting_year,status:p.project_status,
      health:p.project_status==='DELAYED'?'DELAYED':(p.project_status==='AT_RISK'?'AT_RISK':'ON_TRACK'),
      ownerId:p.project_manager_id,owner:p.project_manager_name||'Unassigned',startDate:p.planned_start_date,targetDate:p.planned_end_date,
      progress:Number(p.progress_percentage||0),budget:0,spent:0,description:'',milestoneCount:p.milestone_count,openRisks:p.open_risks
    };});
    return {
      version:2,
      departments:results[0].map(function(d){return{id:d.id,code:d.code,name:d.name,active:d.status==='ACTIVE'};}),
      reportingYears:results[1].map(function(y){return{id:y.id,year:y.year,label:y.display_name,active:y.is_active};}),
      initiatives:initiatives,projects:projects,milestones:[],risks:[],
      users:results[6].map(function(u){return{id:u.id,name:u.full_name,email:u.email,role:(u.roles&&u.roles[0])||'END_USER',departmentId:u.home_department_id,status:u.account_status,mustChangePassword:u.must_change_password,lastLogin:u.last_sign_in_at};}),
      portfolios:results[4],strategicPillars:results[5],audit:[]
    };
  }

  async function saveInitiative(record,user,context){
    if(!isLive()){
      var db = getDemoDb();
      var existing = record.id && db.initiatives.find(function(i){return i.id===record.id;});
      if(existing) Object.assign(existing,record);
      else {
        record.id=uid('init');
        record.cycleId=uid('cycle');
        record.code=record.code || ('AMP'+String(record.year).slice(-2)+'-'+(db.departments.find(function(d){return d.id===record.departmentId;})||{code:'GEN'}).code+'-'+String(db.initiatives.length+1).padStart(3,'0'));
        record.archived=false;
        db.initiatives.push(record);
      }
      demoAudit(db,user,existing?'UPDATE':'CREATE','Initiative',(existing?'Updated ':'Created ')+record.title+'.');
      saveDemoDb(db); return clone(record);
    }
    var payload = {
      p_initiative_id:record.id||null,p_cycle_id:record.cycleId||null,p_code:record.code,p_title:record.title,p_description:record.description||'',
      p_portfolio_id:record.portfolioId || context.defaultPortfolioId,p_department_id:record.departmentId,p_project_owner_id:record.ownerId || user.id,
      p_strategic_pillar_id:record.strategicPillarId || context.defaultStrategicPillarId,p_reporting_year_id:record.reportingYearId,
      p_initiative_type:record.classification,p_cycle_status:record.status,p_planned_start_date:record.startDate||null,p_planned_end_date:record.targetDate||null,
      p_progress_percentage:Number(record.progress||0),p_requested_budget:Number(record.requestedBudget||0),p_approved_budget:Number(record.approvedBudget||0),
      p_forecast_amount:Number(record.forecastBudget||record.approvedBudget||0)
    };
    var coreResult = await request('/rest/v1/rpc/save_initiative_cycle',{method:'POST',body:JSON.stringify(payload)});
    var cycleId = record.cycleId || extractCycleId(coreResult);
    if(!cycleId && record.code && record.reportingYearId){
      var rows = await request('/rest/v1/initiative_portfolio_view?select=cycle_id&initiative_code=eq.'+encodeURIComponent(record.code)+'&reporting_year_id=eq.'+encodeURIComponent(record.reportingYearId)+'&limit=1');
      cycleId = rows && rows[0] && rows[0].cycle_id;
    }
    if(!cycleId) throw new Error('The initiative was saved, but HOME31 could not resolve its annual cycle for the comprehensive form payload. Refresh and edit the record again.');
    if(record.formData){
      var formPayload={initiative_cycle_id:cycleId,form_version:'V7.9.4.9',form_data:record.formData,updated_by:user.id};
      if(!record.cycleId) formPayload.submitted_by=user.id;
      await request('/rest/v1/initiative_form_submissions?on_conflict=initiative_cycle_id',{
        method:'POST',
        headers:{Prefer:'resolution=merge-duplicates,return=representation'},
        body:JSON.stringify(formPayload)
      });
    }
    return {core:coreResult,cycleId:cycleId};
  }

  async function archiveInitiative(id,user,cycleId){
    if(!isLive()){
      var db=getDemoDb(), item=db.initiatives.find(function(i){return i.id===id;});
      if(!item) throw new Error('Initiative was not found.');
      item.archived=true; demoAudit(db,user,'ARCHIVE','Initiative','Archived '+item.title+'.'); saveDemoDb(db); return true;
    }
    await request('/rest/v1/rpc/archive_initiative_cycle',{method:'POST',body:JSON.stringify({p_cycle_id:cycleId})}); return true;
  }

  async function saveProject(record,user,context){
    if(!isLive()){
      var db=getDemoDb(), existing=record.id&&db.projects.find(function(p){return p.id===record.id;});
      if(existing) Object.assign(existing,record); else {record.id=uid('proj');record.code=record.code||('PRJ'+String(record.year).slice(-2)+'-'+String(db.projects.length+1).padStart(3,'0'));db.projects.push(record);}
      demoAudit(db,user,existing?'UPDATE':'CREATE','Project',(existing?'Updated ':'Created ')+record.title+'.'); saveDemoDb(db); return clone(record);
    }
    var initiative=context.initiatives.find(function(i){return i.id===record.initiativeId;});
    if(!initiative) throw new Error('Choose an initiative cycle for this project.');
    var payload={p_project_id:record.id||null,p_initiative_cycle_id:initiative.cycleId,p_code:record.code,p_name:record.title,p_description:record.description||'',p_project_manager_id:record.ownerId||user.id,p_status:record.status,p_planned_start_date:record.startDate||null,p_planned_end_date:record.targetDate||null,p_progress_percentage:Number(record.progress||0)};
    return request('/rest/v1/rpc/save_project_cycle',{method:'POST',body:JSON.stringify(payload)});
  }

  async function saveUser(record,user){
    if(!isLive()){
      var db=getDemoDb();
      if(db.users.some(function(u){return u.email.toLowerCase()===record.email.toLowerCase();})) throw new Error('A user with that email already exists.');
      record.id=uid('user'); record.password=record.password||'Home31!Temp'; record.status='ACTIVE'; record.mustChangePassword=true; record.lastLogin=null; db.users.push(record);
      demoAudit(db,user,'CREATE','User','Created '+record.email+'.'); saveDemoDb(db); return clone(record);
    }
    return request('/functions/v1/admin-users',{method:'POST',body:JSON.stringify({action:'create',fullName:record.name,email:record.email,temporaryPassword:record.password,roleCode:record.role,departmentId:record.departmentId})});
  }

  async function updateUserStatus(id,status,user){
    if(!isLive()){
      var db=getDemoDb(), target=db.users.find(function(u){return u.id===id;});
      if(!target) throw new Error('User not found.'); target.status=status; demoAudit(db,user,'STATUS_CHANGE','User','Changed '+target.email+' to '+status+'.'); saveDemoDb(db); return clone(target);
    }
    return request('/functions/v1/admin-users',{method:'POST',body:JSON.stringify({action:'status',userId:id,status:status})});
  }

  async function saveDepartment(record,user){
    if(!isLive()){
      var db=getDemoDb(), existing=record.id&&db.departments.find(function(d){return d.id===record.id;});
      if(existing) Object.assign(existing,record); else {record.id=uid('dept');record.active=true;db.departments.push(record);} demoAudit(db,user,existing?'UPDATE':'CREATE','Department',record.name); saveDemoDb(db); return clone(record);
    }
    var path='/rest/v1/departments'+(record.id?('?id=eq.'+encodeURIComponent(record.id)):'');
    return request(path,{method:record.id?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({code:record.code,name:record.name,status:record.active!==false?'ACTIVE':'INACTIVE'})});
  }

  async function saveYear(record,user){
    if(!isLive()){
      var db=getDemoDb(), existing=record.id&&db.reportingYears.find(function(y){return y.id===record.id;});
      if(record.active) db.reportingYears.forEach(function(y){y.active=false;});
      if(existing) Object.assign(existing,record); else {record.id=uid('year');db.reportingYears.push(record);} demoAudit(db,user,existing?'UPDATE':'CREATE','Reporting Year',record.label); saveDemoDb(db); return clone(record);
    }
    var path='/rest/v1/reporting_years'+(record.id?('?id=eq.'+encodeURIComponent(record.id)):'');
    return request(path,{method:record.id?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({year:Number(record.year),display_name:record.label,is_active:record.active===true})});
  }

  function resetDemo(){ storageRemove(STORAGE_KEY); storageRemove(SESSION_KEY); return getDemoDb(); }

  window.HOME31_API={
    config:config,isLive:isLive,roleLabel:roleLabel,signIn:signIn,signOut:signOut,getCurrentUser:getCurrentUser,changePassword:changePassword,loadData:loadData,
    saveInitiative:saveInitiative,archiveInitiative:archiveInitiative,saveProject:saveProject,saveUser:saveUser,updateUserStatus:updateUserStatus,saveDepartment:saveDepartment,saveYear:saveYear,resetDemo:resetDemo
  };
})();
