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

  function decodeJwtExpiry(accessToken){
    try{
      var payload = String(accessToken||'').split('.')[1];
      if(!payload) return 0;
      payload = payload.replace(/-/g,'+').replace(/_/g,'/');
      while(payload.length % 4) payload += '=';
      var decoded = JSON.parse(atob(payload));
      return decoded && decoded.exp ? Number(decoded.exp) * 1000 : 0;
    }catch(error){ return 0; }
  }

  function sessionExpiryMs(session){
    if(!session) return 0;
    if(session.expires_at){
      var value = Number(session.expires_at);
      if(Number.isFinite(value)) return value > 1000000000000 ? value : value * 1000;
    }
    return decodeJwtExpiry(session.access_token);
  }

  function sessionNeedsRefresh(session){
    if(!session || !session.access_token) return true;
    var expiry = sessionExpiryMs(session);
    return !!expiry && expiry <= Date.now() + 60000;
  }

  async function refreshLiveSession(){
    var current = storageGet(SESSION_KEY);
    if(!current || !current.refresh_token){
      storageRemove(SESSION_KEY);
      throw new Error('Your HOME31 session has expired. Sign in again.');
    }
    var response = await fetch(config.supabaseUrl.replace(/\/$/,'') + '/auth/v1/token?grant_type=refresh_token',{
      method:'POST',
      headers:{'apikey':config.publishableKey,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:current.refresh_token})
    });
    var text = await response.text();
    var body = text ? (function(){ try{return JSON.parse(text);}catch(e){return text;} })() : null;
    if(!response.ok || !body || !body.access_token){
      storageRemove(SESSION_KEY);
      throw new Error('Your HOME31 session has expired. Sign in again.');
    }
    var refreshed = Object.assign({},current,body,{_stored_at:Date.now()});
    if(!refreshed.refresh_token) refreshed.refresh_token = current.refresh_token;
    storageSet(SESSION_KEY,refreshed);
    return refreshed;
  }

  async function request(path, options){
    options = options || {};
    var retried = options._home31Retried === true;
    var fetchOptions = Object.assign({},options);
    delete fetchOptions._home31Retried;
    var isTokenRequest = path.indexOf('/auth/v1/token?grant_type=') === 0;
    var session = storageGet(SESSION_KEY);
    if(!isTokenRequest && session && session.refresh_token && sessionNeedsRefresh(session)){
      session = await refreshLiveSession();
    }
    var headers = Object.assign({'apikey':config.publishableKey,'Content-Type':'application/json'}, fetchOptions.headers || {});
    if(!isTokenRequest && session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
    var response = await fetch(config.supabaseUrl.replace(/\/$/,'') + path, Object.assign({}, fetchOptions, {headers:headers}));
    var text = await response.text();
    var body = text ? (function(){ try{return JSON.parse(text);}catch(e){return text;} })() : null;
    if(!response.ok){
      if(response.status === 401 && !isTokenRequest && !retried && session && session.refresh_token){
        await refreshLiveSession();
        return request(path,Object.assign({},options,{_home31Retried:true}));
      }
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

  async function optionalRequestResult(path, options){
    try { return {available:true,data:await request(path,options),error:null}; }
    catch(error){
      console.warn('Optional HOME31 data source unavailable:', path, error.message);
      return {available:false,data:[],error:error.message||'Unavailable'};
    }
  }

  function ensureDemoPhase3(db){
    db.benefitMeasurements = db.benefitMeasurements || [];
    db.cbaReviews = db.cbaReviews || [];
    db.financeUpdates = db.financeUpdates || [];
    db.continuityLinks = db.continuityLinks || [];
    db.decisionReadinessModels = db.decisionReadinessModels || [{id:'drm-default',code:'HOME31_DEFAULT_V1',name:'HOME31 Default Decision Readiness',status:'ACTIVE',isDefault:true,effectiveFrom:new Date().toISOString().slice(0,10)}];
    db.decisionReadinessWeights = db.decisionReadinessWeights || [
      ['STRATEGIC_ALIGNMENT','Strategic alignment',15,1],['OWNERSHIP','Ownership',10,2],['VALUE_CBA','Value and CBA',15,3],['FINANCE','Finance',15,4],['DELIVERY_PLAN','Delivery plan',15,5],['RISK','Risk',10,6],['HR_CHANGE','HR and change',10,7],['ICT','ICT',5,8],['EVIDENCE','Evidence',5,9]
    ].map(function(row,index){return{id:'drw-'+index,modelId:'drm-default',dimensionCode:row[0],dimensionLabel:row[1],weightPercentage:row[2],displayOrder:row[3],isRequired:true};});
    db.decisionReadinessAssessments = db.decisionReadinessAssessments || [];
    return db;
  }

  function latestByDate(rows,dateKey){
    return rows.slice().sort(function(a,b){return String(b[dateKey]||'').localeCompare(String(a[dateKey]||''))||String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));})[0]||null;
  }

  function hydrateDemoPhase3(db){
    ensureDemoPhase3(db);
    db.initiatives.forEach(function(item){
      var cycleId=item.cycleId||item.id;item.cycleId=cycleId;
      var benefit=latestByDate(db.benefitMeasurements.filter(function(x){return x.initiativeCycleId===cycleId;}),'measurementDate');
      var cba=db.cbaReviews.filter(function(x){return x.initiativeCycleId===cycleId&&x.isCurrent!==false;}).slice(-1)[0]||null;
      var finance=latestByDate(db.financeUpdates.filter(function(x){return x.initiativeCycleId===cycleId;}),'reportingDate');
      var readiness=db.decisionReadinessAssessments.filter(function(x){return x.initiativeCycleId===cycleId&&x.isCurrent!==false;}).slice(-1)[0]||null;
      item.phase3={
        latestBenefitMeasurementId:benefit&&benefit.id,latestBenefitMeasurementDate:benefit&&benefit.measurementDate,
        actualValueText:benefit&&benefit.actualValueText,actualValueNumeric:benefit&&benefit.actualValueNumeric,actualValueUnit:benefit&&benefit.actualValueUnit,
        benefitStatus:benefit&&benefit.benefitStatus,benefitCommentary:benefit&&benefit.commentary,nextMeasurementDate:benefit&&benefit.nextMeasurementDate,
        currentCbaReviewId:cba&&cba.id,cbaReviewDate:cba&&cba.reviewDate,governedCbaRatio:cba&&cba.cbaRatio,cbaValidationStatus:cba&&cba.validationStatus,
        cbaMethodologyReference:cba&&cba.methodologyReference,cbaFinanceReviewComments:cba&&cba.financeReviewComments,managementTreatment:cba&&cba.managementTreatment,
        latestFinanceUpdateId:finance&&finance.id,financeReportingDate:finance&&finance.reportingDate,committedAmount:finance&&finance.committedAmount,
        utilisedAmount:finance&&finance.utilisedAmount,forecastAtCompletion:finance&&finance.forecastAtCompletion,varianceCommentary:finance&&finance.varianceCommentary,
        currentReadinessAssessmentId:readiness&&readiness.id,readinessModelId:readiness&&readiness.modelId,readinessAssessmentDate:readiness&&readiness.assessmentDate,
        decisionReadinessScore:readiness&&readiness.readinessScore,decisionReadinessStatus:readiness&&readiness.readinessStatus,
        decisionReadinessDimensionScores:readiness&&readiness.dimensionScores,decisionReadinessNotes:readiness&&readiness.assessmentNotes
      };
      if(finance){
        if(finance.committedAmount!==null&&finance.committedAmount!==undefined)item.committedBudget=Number(finance.committedAmount);
        if(finance.utilisedAmount!==null&&finance.utilisedAmount!==undefined)item.utilisedBudget=Number(finance.utilisedAmount);
        if(finance.forecastAtCompletion!==null&&finance.forecastAtCompletion!==undefined)item.forecastBudget=Number(finance.forecastAtCompletion);
      }
    });
    return db;
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
    storageSet(SESSION_KEY,Object.assign({},auth,{_stored_at:Date.now()}));
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
    var cycleIds=scoped.initiatives.map(function(i){return i.cycleId||i.id;});
    scoped.benefitMeasurements=(scoped.benefitMeasurements||[]).filter(function(x){return cycleIds.indexOf(x.initiativeCycleId)>=0;});
    scoped.cbaReviews=(scoped.cbaReviews||[]).filter(function(x){return cycleIds.indexOf(x.initiativeCycleId)>=0;});
    scoped.financeUpdates=(scoped.financeUpdates||[]).filter(function(x){return cycleIds.indexOf(x.initiativeCycleId)>=0;});
    scoped.decisionReadinessAssessments=(scoped.decisionReadinessAssessments||[]).filter(function(x){return cycleIds.indexOf(x.initiativeCycleId)>=0;});
    scoped.continuityLinks=(scoped.continuityLinks||[]).filter(function(x){return cycleIds.indexOf(x.previousCycleId)>=0||cycleIds.indexOf(x.currentCycleId)>=0;});
    return scoped;
  }

  function mapAuditRow(row){
    var details=row.details!==undefined?row.details:(row.new_values!==undefined?row.new_values:(row.metadata!==undefined?row.metadata:''));
    if(details&&typeof details==='object') details=JSON.stringify(details);
    return {
      id:row.id,
      time:row.created_at||row.occurred_at||row.event_time||row.time||row.timestamp,
      user:row.user_name||row.actor_name||row.full_name||row.email||row.user_email||row.actor_id||'System',
      action:row.action||row.action_type||row.event_type||'ACTIVITY',
      entity:row.entity||row.entity_type||row.table_name||'system',
      details:details||''
    };
  }

  async function loadAuditRows(){
    var candidates=[
      '/rest/v1/audit_logs?select=*&order=created_at.desc&limit=1000',
      '/rest/v1/audit_log?select=*&order=created_at.desc&limit=1000'
    ];
    for(var i=0;i<candidates.length;i++){
      try{return await request(candidates[i],{method:'GET',headers:{Accept:'application/json'}});}
      catch(error){if(i===candidates.length-1){console.warn('HOME31 audit source unavailable:',error.message);return [];}}
    }
    return [];
  }

  async function deleteAllAuditLogs(user){
    if(!user||user.role!=='SUPER_ADMIN') throw new Error('Only the Super Administrator can delete audit logs.');
    if(!isLive()){
      var db=getDemoDb(),count=(db.audit||[]).length;
      db.audit=[];
      saveDemoDb(db);
      return {deleted:count,remaining:0};
    }

    var before=await loadAuditRows();
    var result;
    try{
      result=await request('/rest/v1/rpc/purge_audit_logs',{method:'POST',body:'{}'});
    }catch(error){
      var message=String(error&&error.message||'');
      if(/could not find the function|PGRST202|404/i.test(message)){
        throw new Error('The protected audit purge function is not installed. Run migration 005_audit_log_purge.sql in Supabase, then try again.');
      }
      throw error;
    }

    var remaining=await loadAuditRows();
    if(remaining.length){
      throw new Error('Supabase did not remove the audit records. '+remaining.length+' records are still present. Run migration 005 and confirm that the signed-in account has the SUPER_ADMIN role.');
    }

    var deleted=Number(Array.isArray(result)?result[0]:result);
    if(!Number.isFinite(deleted)) deleted=before.length;
    return {deleted:deleted,remaining:0};
  }

  async function loadData(user){
    if(!isLive()){
      var demo=hydrateDemoPhase3(getDemoDb());
      saveDemoDb(demo);
      return applyDemoScope(demo,user);
    }
    var results = await Promise.all([
      request('/rest/v1/departments?select=id,code,name,status&status=eq.ACTIVE&order=name'),
      request('/rest/v1/reporting_years?select=id,year,display_name,is_active&order=year'),
      request('/rest/v1/initiative_portfolio_view?select=*&order=reporting_year.desc,initiative_code'),
      request('/rest/v1/project_overview_view?select=*&order=reporting_year.desc,project_code'),
      request('/rest/v1/portfolios?select=id,code,name,status&status=eq.ACTIVE&order=name'),
      request('/rest/v1/strategic_pillars?select=id,code,name,status&status=eq.ACTIVE&order=name'),
      request('/rest/v1/user_directory_view?select=*&order=full_name'),
      optionalRequest('/rest/v1/initiative_form_submissions?select=initiative_cycle_id,form_version,form_data,updated_at'),
      optionalRequestResult('/rest/v1/initiative_phase3_overview_v?select=*'),
      optionalRequestResult('/rest/v1/initiative_continuity_overview_v?select=*&order=updated_at.desc'),
      optionalRequestResult('/rest/v1/decision_readiness_models?select=id,code,name,description,status,effective_from,effective_to,is_default&status=eq.ACTIVE&order=is_default.desc,effective_from.desc'),
      optionalRequestResult('/rest/v1/decision_readiness_weights?select=id,model_id,dimension_code,dimension_label,weight_percentage,display_order,is_required&order=display_order'),
      loadAuditRows()
    ]);
    var formMap = {};
    (results[7] || []).forEach(function(row){ formMap[row.initiative_cycle_id] = row.form_data || {}; });
    var phase3Map = {};
    (results[8].data || []).forEach(function(row){
      phase3Map[row.initiative_cycle_id]={
        latestBenefitMeasurementId:row.latest_benefit_measurement_id,latestBenefitMeasurementDate:row.latest_benefit_measurement_date,
        actualValueText:row.actual_value_text,actualValueNumeric:row.actual_value_numeric===null?null:Number(row.actual_value_numeric),actualValueUnit:row.actual_value_unit,
        benefitStatus:row.benefit_status,benefitCommentary:row.benefit_commentary,nextMeasurementDate:row.next_measurement_date,
        currentCbaReviewId:row.current_cba_review_id,cbaReviewDate:row.cba_review_date,governedCbaRatio:row.governed_cba_ratio===null?null:Number(row.governed_cba_ratio),
        cbaValidationStatus:row.cba_validation_status,cbaMethodologyReference:row.cba_methodology_reference,cbaFinanceReviewComments:row.cba_finance_review_comments,
        managementTreatment:row.management_treatment,latestFinanceUpdateId:row.latest_finance_update_id,financeReportingDate:row.finance_reporting_date,
        committedAmount:row.committed_amount===null?null:Number(row.committed_amount),utilisedAmount:row.utilised_amount===null?null:Number(row.utilised_amount),
        forecastAtCompletion:row.forecast_at_completion===null?null:Number(row.forecast_at_completion),varianceCommentary:row.variance_commentary,
        currentReadinessAssessmentId:row.current_readiness_assessment_id,readinessModelId:row.readiness_model_id,readinessAssessmentDate:row.readiness_assessment_date,
        decisionReadinessScore:row.decision_readiness_score===null?null:Number(row.decision_readiness_score),decisionReadinessStatus:row.decision_readiness_status,
        decisionReadinessDimensionScores:row.decision_readiness_dimension_scores||{},decisionReadinessNotes:row.decision_readiness_notes
      };
    });
    var initiatives = results[2].map(function(i){
      var formData = formMap[i.cycle_id] || {},phase3=phase3Map[i.cycle_id]||{};
      return {
        id:i.initiative_id,cycleId:i.cycle_id,code:i.initiative_code,title:i.initiative_title,
        description:formData.projectDescription || i.description || '',portfolioId:i.portfolio_id,portfolioName:i.portfolio_name,
        departmentId:i.department_id,departmentName:i.department_name,ownerId:i.project_owner_id,
        owner:formData.projectOwnerName || i.project_owner_name,strategicPillarId:i.strategic_pillar_id,
        strategicPillarName:i.strategic_pillar_name,reportingYearId:i.reporting_year_id,year:i.reporting_year,
        classification:i.initiative_type,status:i.cycle_status,startDate:i.planned_start_date,targetDate:i.planned_end_date,
        progress:Number(i.progress_percentage||0),priority:i.priority || 'MEDIUM',requestedBudget:Number(i.requested_budget||0),
        approvedBudget:Number(i.approved_budget||0),committedBudget:phase3.committedAmount!==null&&phase3.committedAmount!==undefined?Number(phase3.committedAmount):Number(i.committed_amount||0),
        utilisedBudget:phase3.utilisedAmount!==null&&phase3.utilisedAmount!==undefined?Number(phase3.utilisedAmount):Number(i.utilised_amount||0),
        forecastBudget:phase3.forecastAtCompletion!==null&&phase3.forecastAtCompletion!==undefined?Number(phase3.forecastAtCompletion):Number(i.forecast_amount||0),
        archived:false,formData:formData,phase3:phase3
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
      version:3,
      departments:results[0].map(function(d){return{id:d.id,code:d.code,name:d.name,active:d.status==='ACTIVE'};}),
      reportingYears:results[1].map(function(y){return{id:y.id,year:y.year,label:y.display_name,active:y.is_active};}),
      initiatives:initiatives,projects:projects,milestones:[],risks:[],
      users:results[6].map(function(u){
        var roles=Array.isArray(u.roles)?u.roles:(u.roles?[u.roles]:[]),directoryRole=roles[0]||'END_USER';
        var mapped={id:u.id,name:u.full_name,email:u.email,role:directoryRole,departmentId:u.home_department_id,status:u.account_status,mustChangePassword:u.must_change_password,lastLogin:u.last_sign_in_at};
        if(user&&mapped.id===user.id){mapped.role=user.role||mapped.role;mapped.departmentId=user.departmentId||mapped.departmentId;mapped.name=user.name||mapped.name;mapped.status=user.status||mapped.status;}
        return mapped;
      }),
      portfolios:results[4],strategicPillars:results[5],audit:(results[12]||[]).map(mapAuditRow),
      continuityLinks:(results[9].data||[]).map(function(row){return{id:row.id,previousCycleId:row.previous_cycle_id,currentCycleId:row.current_cycle_id,continuityType:row.continuity_type,matchConfidence:row.match_confidence===null?null:Number(row.match_confidence),matchMethod:row.match_method,approvedBudgetMovement:row.approved_budget_movement===null?null:Number(row.approved_budget_movement),cbaRatioMovement:row.cba_ratio_movement===null?null:Number(row.cba_ratio_movement),scopeChangeExplanation:row.scope_change_explanation,managementStatus:row.management_status,confirmedBy:row.confirmed_by,confirmedAt:row.confirmed_at,updatedAt:row.updated_at};}),
      decisionReadinessModels:(results[10].data||[]).map(function(row){return{id:row.id,code:row.code,name:row.name,description:row.description,status:row.status,effectiveFrom:row.effective_from,effectiveTo:row.effective_to,isDefault:row.is_default};}),
      decisionReadinessWeights:(results[11].data||[]).map(function(row){return{id:row.id,modelId:row.model_id,dimensionCode:row.dimension_code,dimensionLabel:row.dimension_label,weightPercentage:Number(row.weight_percentage||0),displayOrder:Number(row.display_order||0),isRequired:row.is_required};}),
      capabilities:{
        phase3:results[8].available,
        continuity:results[9].available,
        readiness:results[10].available&&results[11].available,
        phase3Error:results[8].error||null,
        continuityError:results[9].error||null,
        readinessError:results[10].error||results[11].error||null
      }
    };
  }

  function validateInitiativeCodeForSave(record){
    var code=String(record&&record.code||'').trim().toUpperCase(),year=Number(record&&record.year);
    if(!code) throw new Error('Initiative code is required before saving.');
    var compact=code.replace(/[^A-Z0-9]/g,'');
    if(compact===String(year)||compact==='AMP'+String(year)||compact==='AMP'+String(year).slice(-2)) throw new Error('Initiative code cannot be only the AMP year.');
    if(!/^AMP\d{2}-[A-Z0-9]{2,10}-\d{6}$/.test(code)) throw new Error('Initiative code must follow the HOME31 format AMPYY-DEPARTMENT-######.');
    record.code=code;
  }

  async function saveInitiative(record,user,context){
    validateInitiativeCodeForSave(record);
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

  async function updateUser(record,user){
    if(!isLive()){
      var db=getDemoDb(), target=db.users.find(function(u){return u.id===record.id;});
      if(!target) throw new Error('User not found.');
      if(db.users.some(function(u){return u.id!==record.id && String(u.email).toLowerCase()===String(record.email).toLowerCase();})) throw new Error('A user with that email already exists.');
      target.name=record.name;
      target.email=record.email;
      target.departmentId=record.departmentId;
      target.role=record.role;
      demoAudit(db,user,'UPDATE','User','Updated '+record.email+'.');
      saveDemoDb(db);
      return clone(target);
    }
    return request('/functions/v1/admin-users',{
      method:'POST',
      body:JSON.stringify({
        action:'update',
        userId:record.id,
        fullName:record.name,
        email:record.email,
        roleCode:record.role,
        departmentId:record.departmentId
      })
    });
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


  async function loadPhase3History(cycleId){
    if(!cycleId) throw new Error('Choose an initiative cycle.');
    if(!isLive()){
      var db=ensureDemoPhase3(getDemoDb());
      return {
        benefits:db.benefitMeasurements.filter(function(x){return x.initiativeCycleId===cycleId;}).sort(function(a,b){return String(b.measurementDate).localeCompare(String(a.measurementDate));}),
        cbaReviews:db.cbaReviews.filter(function(x){return x.initiativeCycleId===cycleId;}).sort(function(a,b){return String(b.reviewDate).localeCompare(String(a.reviewDate));}),
        financeUpdates:db.financeUpdates.filter(function(x){return x.initiativeCycleId===cycleId;}).sort(function(a,b){return String(b.reportingDate).localeCompare(String(a.reportingDate));}),
        readinessAssessments:db.decisionReadinessAssessments.filter(function(x){return x.initiativeCycleId===cycleId;}).sort(function(a,b){return String(b.assessmentDate).localeCompare(String(a.assessmentDate));}),
        continuityLinks:db.continuityLinks.filter(function(x){return x.previousCycleId===cycleId||x.currentCycleId===cycleId;})
      };
    }
    var encoded=encodeURIComponent(cycleId);
    var rows=await Promise.all([
      request('/rest/v1/initiative_benefit_measurements?select=*&initiative_cycle_id=eq.'+encoded+'&order=measurement_date.desc,created_at.desc'),
      request('/rest/v1/initiative_cba_reviews?select=*&initiative_cycle_id=eq.'+encoded+'&order=review_date.desc,created_at.desc'),
      request('/rest/v1/initiative_finance_updates?select=*&initiative_cycle_id=eq.'+encoded+'&order=reporting_date.desc,created_at.desc'),
      request('/rest/v1/initiative_decision_readiness_assessments?select=*&initiative_cycle_id=eq.'+encoded+'&order=assessment_date.desc,created_at.desc'),
      request('/rest/v1/initiative_continuity_overview_v?select=*&or=(previous_cycle_id.eq.'+encoded+',current_cycle_id.eq.'+encoded+')&order=updated_at.desc')
    ]);
    return {
      benefits:rows[0].map(function(x){return{id:x.id,initiativeCycleId:x.initiative_cycle_id,measurementDate:x.measurement_date,actualValueText:x.actual_value_text,actualValueNumeric:x.actual_value_numeric===null?null:Number(x.actual_value_numeric),actualValueUnit:x.actual_value_unit,benefitStatus:x.benefit_status,commentary:x.commentary,nextMeasurementDate:x.next_measurement_date,measuredBy:x.measured_by};}),
      cbaReviews:rows[1].map(function(x){return{id:x.id,initiativeCycleId:x.initiative_cycle_id,reviewDate:x.review_date,cbaRatio:x.cba_ratio===null?null:Number(x.cba_ratio),validationStatus:x.validation_status,methodologyReference:x.methodology_reference,financeReviewComments:x.finance_review_comments,managementTreatment:x.management_treatment,validatedBy:x.validated_by,validatedAt:x.validated_at,isCurrent:x.is_current};}),
      financeUpdates:rows[2].map(function(x){return{id:x.id,initiativeCycleId:x.initiative_cycle_id,reportingDate:x.reporting_date,committedAmount:x.committed_amount===null?null:Number(x.committed_amount),utilisedAmount:x.utilised_amount===null?null:Number(x.utilised_amount),forecastAtCompletion:x.forecast_at_completion===null?null:Number(x.forecast_at_completion),varianceCommentary:x.variance_commentary,financeUpdateOwnerId:x.finance_update_owner_id};}),
      readinessAssessments:rows[3].map(function(x){return{id:x.id,initiativeCycleId:x.initiative_cycle_id,modelId:x.model_id,assessmentDate:x.assessment_date,readinessScore:Number(x.readiness_score),readinessStatus:x.readiness_status,dimensionScores:x.dimension_scores||{},assessmentNotes:x.assessment_notes,isCurrent:x.is_current};}),
      continuityLinks:rows[4].map(function(x){return{id:x.id,previousCycleId:x.previous_cycle_id,currentCycleId:x.current_cycle_id,continuityType:x.continuity_type,matchConfidence:x.match_confidence===null?null:Number(x.match_confidence),matchMethod:x.match_method,approvedBudgetMovement:x.approved_budget_movement===null?null:Number(x.approved_budget_movement),cbaRatioMovement:x.cba_ratio_movement===null?null:Number(x.cba_ratio_movement),scopeChangeExplanation:x.scope_change_explanation,managementStatus:x.management_status,confirmedBy:x.confirmed_by,confirmedAt:x.confirmed_at};})
    };
  }

  async function saveBenefitMeasurement(record,user){
    if(!isLive()){
      var db=ensureDemoPhase3(getDemoDb()),existing=record.id&&db.benefitMeasurements.find(function(x){return x.id===record.id;});
      var row=Object.assign({},record,{id:record.id||uid('benefit'),initiativeCycleId:record.initiativeCycleId,measuredBy:record.measuredBy||user.id,updatedAt:new Date().toISOString()});
      if(existing)Object.assign(existing,row);else{var conflict=db.benefitMeasurements.find(function(x){return x.initiativeCycleId===row.initiativeCycleId&&x.measurementDate===row.measurementDate;});if(conflict)Object.assign(conflict,row,{id:conflict.id});else db.benefitMeasurements.push(row);}
      demoAudit(db,user,existing?'UPDATE':'CREATE','Benefit Measurement','Updated benefits realisation.');saveDemoDb(hydrateDemoPhase3(db));return row.id;
    }
    return request('/rest/v1/rpc/save_benefit_measurement',{method:'POST',body:JSON.stringify({p_id:record.id||null,p_initiative_cycle_id:record.initiativeCycleId,p_measurement_date:record.measurementDate,p_actual_value_text:record.actualValueText||null,p_actual_value_numeric:record.actualValueNumeric,p_actual_value_unit:record.actualValueUnit||null,p_benefit_status:record.benefitStatus,p_commentary:record.commentary||null,p_next_measurement_date:record.nextMeasurementDate||null,p_measured_by:record.measuredBy||user.id})});
  }

  async function saveCbaReview(record,user){
    if(!isLive()){
      var db=ensureDemoPhase3(getDemoDb());db.cbaReviews.forEach(function(x){if(x.initiativeCycleId===record.initiativeCycleId)x.isCurrent=false;});
      var row=Object.assign({},record,{id:uid('cba'),validatedBy:record.validationStatus==='VALIDATED'?(record.validatedBy||user.id):null,validatedAt:record.validationStatus==='VALIDATED'?(record.validatedAt||new Date().toISOString()):null,isCurrent:true,updatedAt:new Date().toISOString()});db.cbaReviews.push(row);demoAudit(db,user,'CREATE','CBA Review','Recorded CBA governance review.');saveDemoDb(hydrateDemoPhase3(db));return row.id;
    }
    var validated=record.validationStatus==='VALIDATED';
    return request('/rest/v1/rpc/save_cba_review',{method:'POST',body:JSON.stringify({p_initiative_cycle_id:record.initiativeCycleId,p_review_date:record.reviewDate,p_cba_ratio:record.cbaRatio,p_validation_status:record.validationStatus,p_methodology_reference:record.methodologyReference||null,p_finance_review_comments:record.financeReviewComments||null,p_management_treatment:record.managementTreatment||null,p_validated_by:validated?(record.validatedBy||user.id):null,p_validated_at:validated?(record.validatedAt||new Date().toISOString()):null})});
  }

  async function saveFinanceUpdate(record,user){
    if(!isLive()){
      var db=ensureDemoPhase3(getDemoDb()),existing=record.id&&db.financeUpdates.find(function(x){return x.id===record.id;});
      var row=Object.assign({},record,{id:record.id||uid('finance'),financeUpdateOwnerId:record.financeUpdateOwnerId||user.id,updatedAt:new Date().toISOString()});
      if(existing)Object.assign(existing,row);else{var conflict=db.financeUpdates.find(function(x){return x.initiativeCycleId===row.initiativeCycleId&&x.reportingDate===row.reportingDate;});if(conflict)Object.assign(conflict,row,{id:conflict.id});else db.financeUpdates.push(row);}demoAudit(db,user,existing?'UPDATE':'CREATE','Finance Update','Recorded budget execution update.');saveDemoDb(hydrateDemoPhase3(db));return row.id;
    }
    return request('/rest/v1/rpc/save_finance_update',{method:'POST',body:JSON.stringify({p_id:record.id||null,p_initiative_cycle_id:record.initiativeCycleId,p_reporting_date:record.reportingDate,p_committed_amount:record.committedAmount,p_utilised_amount:record.utilisedAmount,p_forecast_at_completion:record.forecastAtCompletion,p_variance_commentary:record.varianceCommentary||null,p_finance_update_owner_id:record.financeUpdateOwnerId||user.id})});
  }

  async function saveContinuityLink(record,user){
    if(!isLive()){
      var db=ensureDemoPhase3(getDemoDb()),existing=record.id&&db.continuityLinks.find(function(x){return x.id===record.id;});
      var confirmed=record.managementStatus==='CONFIRMED',row=Object.assign({},record,{id:record.id||uid('continuity'),confirmedBy:confirmed?(record.confirmedBy||user.id):null,confirmedAt:confirmed?(record.confirmedAt||new Date().toISOString()):null,updatedAt:new Date().toISOString()});
      if(existing)Object.assign(existing,row);else db.continuityLinks.push(row);demoAudit(db,user,existing?'UPDATE':'CREATE','AMP Continuity','Recorded AMP continuity treatment.');saveDemoDb(db);return row.id;
    }
    var confirmed=record.managementStatus==='CONFIRMED';
    return request('/rest/v1/rpc/save_continuity_link',{method:'POST',body:JSON.stringify({p_id:record.id||null,p_previous_cycle_id:record.previousCycleId||null,p_current_cycle_id:record.currentCycleId||null,p_continuity_type:record.continuityType,p_match_confidence:record.matchConfidence,p_match_method:record.matchMethod||null,p_approved_budget_movement:record.approvedBudgetMovement,p_cba_ratio_movement:record.cbaRatioMovement,p_scope_change_explanation:record.scopeChangeExplanation||null,p_management_status:record.managementStatus,p_confirmed_by:confirmed?(record.confirmedBy||user.id):null,p_confirmed_at:confirmed?(record.confirmedAt||new Date().toISOString()):null})});
  }

  async function saveDecisionReadinessAssessment(record,user){
    if(!isLive()){
      var db=ensureDemoPhase3(getDemoDb());db.decisionReadinessAssessments.forEach(function(x){if(x.initiativeCycleId===record.initiativeCycleId)x.isCurrent=false;});
      var row=Object.assign({},record,{id:uid('readiness'),assessedBy:user.id,isCurrent:true,updatedAt:new Date().toISOString()});db.decisionReadinessAssessments.push(row);demoAudit(db,user,'CREATE','Decision Readiness','Recorded decision-readiness assessment.');saveDemoDb(hydrateDemoPhase3(db));return row.id;
    }
    return request('/rest/v1/rpc/save_decision_readiness_assessment',{method:'POST',body:JSON.stringify({p_initiative_cycle_id:record.initiativeCycleId,p_model_id:record.modelId,p_assessment_date:record.assessmentDate,p_readiness_score:record.readinessScore,p_readiness_status:record.readinessStatus,p_dimension_scores:record.dimensionScores||{},p_assessment_notes:record.assessmentNotes||null})});
  }

  function resetDemo(){ storageRemove(STORAGE_KEY); storageRemove(SESSION_KEY); return getDemoDb(); }

  window.HOME31_API={
    config:config,isLive:isLive,roleLabel:roleLabel,signIn:signIn,signOut:signOut,getCurrentUser:getCurrentUser,changePassword:changePassword,loadData:loadData,
    saveInitiative:saveInitiative,archiveInitiative:archiveInitiative,saveProject:saveProject,saveUser:saveUser,updateUser:updateUser,updateUserStatus:updateUserStatus,saveDepartment:saveDepartment,saveYear:saveYear,
    loadPhase3History:loadPhase3History,saveBenefitMeasurement:saveBenefitMeasurement,saveCbaReview:saveCbaReview,saveFinanceUpdate:saveFinanceUpdate,saveContinuityLink:saveContinuityLink,saveDecisionReadinessAssessment:saveDecisionReadinessAssessment,deleteAllAuditLogs:deleteAllAuditLogs,resetDemo:resetDemo
  };
})();
