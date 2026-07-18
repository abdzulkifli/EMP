(function(){
  'use strict';
  var now = new Date().toISOString();
  window.HOME31_DEMO = {
    version: 1,
    departments: [
      {id:'dept-pmo',code:'EPMO',name:'Enterprise PMO',active:true},
      {id:'dept-dt',code:'DT',name:'Digital & Technology',active:true},
      {id:'dept-ops',code:'OPS',name:'Operations',active:true},
      {id:'dept-cx',code:'CX',name:'Customer Experience',active:true},
      {id:'dept-corp',code:'CORP',name:'Corporate Services',active:true},
      {id:'dept-risk',code:'RISK',name:'Risk & Compliance',active:true}
    ],
    reportingYears: [
      {id:'year-2025',year:2025,label:'AMP 2025',active:false},
      {id:'year-2026',year:2026,label:'AMP 2026',active:false},
      {id:'year-2027',year:2027,label:'AMP 2027',active:true},
      {id:'year-2028',year:2028,label:'AMP 2028',active:false},
      {id:'year-2029',year:2029,label:'AMP 2029',active:false}
    ],
    users: [
      {id:'user-admin',name:'Abdul Zulkifli',email:'admin@home31.demo',password:'Home31!Demo',role:'SUPER_ADMIN',departmentId:'dept-pmo',status:'ACTIVE',mustChangePassword:false,lastLogin:now},
      {id:'user-dt',name:'Farah Nabilah',email:'farah@home31.demo',password:'Home31!User',role:'DEPARTMENT_ADMIN',departmentId:'dept-dt',status:'ACTIVE',mustChangePassword:false,lastLogin:'2026-07-17T08:42:00.000Z'},
      {id:'user-end',name:'Daniel Wong',email:'user@home31.demo',password:'Home31!User',role:'END_USER',departmentId:'dept-dt',status:'ACTIVE',mustChangePassword:false,lastLogin:'2026-07-17T03:18:00.000Z'},
      {id:'user-ops',name:'Nur Aina',email:'aina@home31.demo',password:'Home31!User',role:'END_USER',departmentId:'dept-ops',status:'FROZEN',mustChangePassword:false,lastLogin:'2026-07-11T08:00:00.000Z'},
      {id:'user-audit',name:'Amirul Hakim',email:'audit@home31.demo',password:'Home31!User',role:'AUDITOR',departmentId:'dept-risk',status:'ACTIVE',mustChangePassword:true,lastLogin:null}
    ],
    initiatives: [
      {id:'init-001',code:'AMP27-DT-001',title:'Core Platform Modernisation',owner:'Farah Nabilah',ownerId:'user-dt',departmentId:'dept-dt',year:2027,classification:'CARRY_FORWARD',status:'APPROVED',approvedBudget:18500000,requestedBudget:19600000,committedBudget:12100000,utilisedBudget:8420000,progress:64,priority:'CRITICAL',startDate:'2027-01-15',targetDate:'2027-12-15',description:'Modernise core integration, cloud landing zone and shared platform capabilities.',archived:false},
      {id:'init-002',code:'AMP27-CX-002',title:'Digital Customer Identity',owner:'Daniel Wong',ownerId:'user-end',departmentId:'dept-cx',year:2027,classification:'EVOLUTION',status:'APPROVED',approvedBudget:14200000,requestedBudget:15800000,committedBudget:7500000,utilisedBudget:5160000,progress:47,priority:'HIGH',startDate:'2027-02-01',targetDate:'2027-11-30',description:'Unified customer identity, consent and authentication services.',archived:false},
      {id:'init-003',code:'AMP27-OPS-003',title:'Branch Experience Refresh',owner:'Nur Aina',ownerId:'user-ops',departmentId:'dept-ops',year:2027,classification:'REPEAT',status:'APPROVED',approvedBudget:6900000,requestedBudget:7600000,committedBudget:5100000,utilisedBudget:4380000,progress:39,priority:'HIGH',startDate:'2027-03-20',targetDate:'2027-10-31',description:'Refresh branch service experience, workflow and assisted digital tools.',archived:false},
      {id:'init-004',code:'AMP27-RISK-004',title:'Data Governance Programme',owner:'Amirul Hakim',ownerId:'user-audit',departmentId:'dept-risk',year:2027,classification:'NEW',status:'APPROVED',approvedBudget:8400000,requestedBudget:8400000,committedBudget:3600000,utilisedBudget:2140000,progress:58,priority:'CRITICAL',startDate:'2027-01-05',targetDate:'2027-10-30',description:'Enterprise data quality, ownership, lineage and control framework.',archived:false},
      {id:'init-005',code:'AMP27-CORP-005',title:'Workplace Collaboration Renewal',owner:'Siti Mariam',ownerId:null,departmentId:'dept-corp',year:2027,classification:'EVOLUTION',status:'IN_REVIEW',approvedBudget:5200000,requestedBudget:6100000,committedBudget:1900000,utilisedBudget:900000,progress:31,priority:'MEDIUM',startDate:'2027-04-01',targetDate:'2027-12-20',description:'Modern collaboration, records and knowledge management platform.',archived:false},
      {id:'init-006',code:'AMP27-DT-006',title:'Cyber Resilience Uplift',owner:'Farah Nabilah',ownerId:'user-dt',departmentId:'dept-dt',year:2027,classification:'CARRY_FORWARD',status:'APPROVED',approvedBudget:11300000,requestedBudget:11900000,committedBudget:7800000,utilisedBudget:5900000,progress:72,priority:'CRITICAL',startDate:'2027-01-10',targetDate:'2027-09-30',description:'Identity, endpoint, detection and recovery resilience uplift.',archived:false},
      {id:'init-007',code:'AMP26-DT-001',title:'Core Platform Modernisation',owner:'Farah Nabilah',ownerId:'user-dt',departmentId:'dept-dt',year:2026,classification:'NEW',status:'COMPLETED',approvedBudget:12400000,requestedBudget:12700000,committedBudget:12100000,utilisedBudget:11900000,progress:100,priority:'CRITICAL',startDate:'2026-01-15',targetDate:'2026-12-20',description:'Initial platform modernisation scope.',archived:false},
      {id:'init-008',code:'AMP26-CX-002',title:'Digital Customer Identity',owner:'Daniel Wong',ownerId:'user-end',departmentId:'dept-cx',year:2026,classification:'NEW',status:'COMPLETED',approvedBudget:9800000,requestedBudget:10200000,committedBudget:9400000,utilisedBudget:9100000,progress:100,priority:'HIGH',startDate:'2026-02-01',targetDate:'2026-12-10',description:'Foundation identity and consent capabilities.',archived:false},
      {id:'init-009',code:'AMP26-OPS-003',title:'Branch Experience Refresh',owner:'Nur Aina',ownerId:'user-ops',departmentId:'dept-ops',year:2026,classification:'NEW',status:'COMPLETED',approvedBudget:8200000,requestedBudget:8500000,committedBudget:8000000,utilisedBudget:7800000,progress:100,priority:'HIGH',startDate:'2026-03-01',targetDate:'2026-11-30',description:'Initial branch pilot and customer journey redesign.',archived:false},
      {id:'init-010',code:'AMP26-CORP-004',title:'Enterprise Records Digitisation',owner:'Siti Mariam',ownerId:null,departmentId:'dept-corp',year:2026,classification:'NEW',status:'COMPLETED',approvedBudget:4700000,requestedBudget:4900000,committedBudget:4600000,utilisedBudget:4500000,progress:100,priority:'MEDIUM',startDate:'2026-02-15',targetDate:'2026-10-15',description:'Digitise priority enterprise records.',archived:false}
    ],
    projects: [
      {id:'proj-001',code:'PRJ27-001',title:'Cloud Landing Zone Phase 2',initiativeId:'init-001',owner:'Farah Nabilah',departmentId:'dept-dt',year:2027,status:'IN_PROGRESS',health:'ON_TRACK',progress:64,startDate:'2027-01-15',targetDate:'2027-09-30',budget:7200000,spent:4280000,description:'Expand secure cloud landing zone and platform guardrails.'},
      {id:'proj-002',code:'PRJ27-002',title:'API Management Renewal',initiativeId:'init-001',owner:'Johan Iskandar',departmentId:'dept-dt',year:2027,status:'IN_PROGRESS',health:'AT_RISK',progress:51,startDate:'2027-02-10',targetDate:'2027-11-30',budget:5300000,spent:2910000,description:'Modernise enterprise API management and developer portal.'},
      {id:'proj-003',code:'PRJ27-003',title:'Customer Identity Migration',initiativeId:'init-002',owner:'Daniel Wong',departmentId:'dept-cx',year:2027,status:'IN_PROGRESS',health:'AT_RISK',progress:47,startDate:'2027-02-01',targetDate:'2027-11-15',budget:8100000,spent:4260000,description:'Migrate customer authentication and consent records.'},
      {id:'proj-004',code:'PRJ27-004',title:'Branch Pilot Rollout',initiativeId:'init-003',owner:'Nur Aina',departmentId:'dept-ops',year:2027,status:'IN_PROGRESS',health:'DELAYED',progress:39,startDate:'2027-03-20',targetDate:'2027-08-31',budget:4100000,spent:2850000,description:'Roll out assisted digital branch pilot to priority locations.'},
      {id:'proj-005',code:'PRJ27-005',title:'Data Quality Controls',initiativeId:'init-004',owner:'Amirul Hakim',departmentId:'dept-risk',year:2027,status:'IN_PROGRESS',health:'AT_RISK',progress:58,startDate:'2027-01-05',targetDate:'2027-10-30',budget:4700000,spent:2210000,description:'Implement critical data quality rules and ownership controls.'},
      {id:'proj-006',code:'PRJ27-006',title:'Endpoint Recovery Enhancement',initiativeId:'init-006',owner:'Farah Nabilah',departmentId:'dept-dt',year:2027,status:'IN_PROGRESS',health:'ON_TRACK',progress:74,startDate:'2027-01-10',targetDate:'2027-09-15',budget:3900000,spent:2740000,description:'Improve endpoint containment and rapid recovery capability.'}
    ],
    milestones: [
      {id:'ms-001',projectId:'proj-001',title:'Production landing zone approved',date:'2027-07-28',status:'UPCOMING'},
      {id:'ms-002',projectId:'proj-003',title:'Pilot customer migration',date:'2027-08-12',status:'UPCOMING'},
      {id:'ms-003',projectId:'proj-004',title:'Branch wave 2 go-live',date:'2027-08-20',status:'AT_RISK'},
      {id:'ms-004',projectId:'proj-005',title:'Critical data controls implemented',date:'2027-09-05',status:'UPCOMING'},
      {id:'ms-005',projectId:'proj-006',title:'Recovery exercise',date:'2027-09-12',status:'UPCOMING'}
    ],
    risks: [
      {id:'risk-001',projectId:'proj-003',title:'Legacy identity data quality',rating:'CRITICAL',owner:'Daniel Wong',mitigation:'Complete cleansing rules before wave 1 migration.'},
      {id:'risk-002',projectId:'proj-004',title:'Branch readiness variance',rating:'HIGH',owner:'Nur Aina',mitigation:'Add readiness gate and weekly site escalation.'},
      {id:'risk-003',projectId:'proj-005',title:'Data owner availability',rating:'HIGH',owner:'Amirul Hakim',mitigation:'Executive mandate and delegated data stewards.'},
      {id:'risk-004',projectId:'proj-002',title:'Supplier integration delay',rating:'MEDIUM',owner:'Johan Iskandar',mitigation:'Parallel technical spike and fallback adapter.'}
    ],
    audit: [
      {id:'audit-001',time:now,user:'Abdul Zulkifli',action:'LOGIN',entity:'Session',details:'Administrator signed in.'},
      {id:'audit-002',time:'2026-07-17T08:42:00.000Z',user:'Farah Nabilah',action:'UPDATE',entity:'Initiative',details:'Updated progress for Core Platform Modernisation.'},
      {id:'audit-003',time:'2026-07-16T10:15:00.000Z',user:'Abdul Zulkifli',action:'CREATE',entity:'Reporting Year',details:'Created AMP 2029.'}
    ]
  };
})();
