-- Optional HOME31 sample data.
-- Run only after creating an Auth user and executing:
-- select public.bootstrap_super_admin('your-email@example.com');

begin;

do $$
declare
  v_admin uuid;
  v_dig uuid; v_fin uuid; v_ops uuid; v_ppl uuid; v_cex uuid;
  v_y2026 uuid;
  v_trn uuid; v_gro uuid; v_res uuid;
  v_p1 uuid; v_p2 uuid; v_p3 uuid; v_p4 uuid;
  v_i1 uuid; v_i2 uuid; v_i3 uuid; v_i4 uuid; v_i5 uuid;
  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_c4 uuid; v_c5 uuid;
  v_pj uuid; v_pc uuid;
begin
  select ur.user_id into v_admin
  from public.user_roles ur join public.roles r on r.id = ur.role_id
  where r.code = 'SUPER_ADMIN'
  limit 1;
  if v_admin is null then raise exception 'Bootstrap a super administrator before running seed.sql'; end if;

  select id into v_dig from public.departments where code = 'DIG';
  select id into v_fin from public.departments where code = 'FIN';
  select id into v_ops from public.departments where code = 'OPS';
  select id into v_ppl from public.departments where code = 'PPL';
  select id into v_cex from public.departments where code = 'CEX';
  select id into v_y2026 from public.reporting_years where year = 2026;
  select id into v_trn from public.portfolios where code = 'TRN';
  select id into v_gro from public.portfolios where code = 'GRO';
  select id into v_res from public.portfolios where code = 'RES';
  select id into v_p1 from public.strategic_pillars where code = 'P1';
  select id into v_p2 from public.strategic_pillars where code = 'P2';
  select id into v_p3 from public.strategic_pillars where code = 'P3';
  select id into v_p4 from public.strategic_pillars where code = 'P4';

  insert into public.initiatives (code, title, description, portfolio_id, lead_department_id, project_owner_id, strategic_pillar_id, created_by_id)
  values ('H31-DIG-001', 'Unified Digital Service Platform', 'Consolidate customer and internal digital services into one secure platform.', v_trn, v_dig, v_admin, v_p1, v_admin)
  on conflict (code) do update set title = excluded.title returning id into v_i1;
  insert into public.initiative_cycles (initiative_id, reporting_year_id, initiative_type, cycle_status, planned_start_date, planned_end_date, progress_percentage, created_by_id, submitted_at, approved_by_id, approved_at)
  values (v_i1, v_y2026, 'EVOLUTION', 'APPROVED', '2026-01-15', '2027-06-30', 64, v_admin, now(), v_admin, now())
  on conflict (initiative_id, reporting_year_id) do update set progress_percentage = excluded.progress_percentage returning id into v_c1;
  insert into public.initiative_budgets (initiative_cycle_id, requested_budget, approved_budget, committed_amount, utilised_amount, forecast_amount)
  values (v_c1, 12800000, 12000000, 8700000, 6350000, 11800000)
  on conflict (initiative_cycle_id) do update set requested_budget=excluded.requested_budget, approved_budget=excluded.approved_budget, committed_amount=excluded.committed_amount, utilised_amount=excluded.utilised_amount, forecast_amount=excluded.forecast_amount;

  insert into public.initiatives (code, title, description, portfolio_id, lead_department_id, project_owner_id, strategic_pillar_id, created_by_id)
  values ('H31-FIN-002', 'Enterprise Financial Planning Modernisation', 'Modernise budgeting, forecasting and management reporting.', v_trn, v_fin, v_admin, v_p3, v_admin)
  on conflict (code) do update set title = excluded.title returning id into v_i2;
  insert into public.initiative_cycles (initiative_id, reporting_year_id, initiative_type, cycle_status, planned_start_date, planned_end_date, progress_percentage, created_by_id, submitted_at, approved_by_id, approved_at)
  values (v_i2, v_y2026, 'CARRY_FORWARD', 'APPROVED', '2025-08-01', '2026-12-15', 72, v_admin, now(), v_admin, now())
  on conflict (initiative_id, reporting_year_id) do update set progress_percentage = excluded.progress_percentage returning id into v_c2;
  insert into public.initiative_budgets (initiative_cycle_id, requested_budget, approved_budget, committed_amount, utilised_amount, forecast_amount)
  values (v_c2, 8200000, 7800000, 6100000, 4880000, 7700000)
  on conflict (initiative_cycle_id) do update set requested_budget=excluded.requested_budget, approved_budget=excluded.approved_budget, committed_amount=excluded.committed_amount, utilised_amount=excluded.utilised_amount, forecast_amount=excluded.forecast_amount;

  insert into public.initiatives (code, title, description, portfolio_id, lead_department_id, project_owner_id, strategic_pillar_id, created_by_id)
  values ('H31-OPS-003', 'Smart Operations Control Tower', 'Create an enterprise control tower for operational performance and risk visibility.', v_res, v_ops, v_admin, v_p3, v_admin)
  on conflict (code) do update set title = excluded.title returning id into v_i3;
  insert into public.initiative_cycles (initiative_id, reporting_year_id, initiative_type, cycle_status, planned_start_date, planned_end_date, progress_percentage, created_by_id, submitted_at)
  values (v_i3, v_y2026, 'NEW', 'UNDER_REVIEW', '2026-03-01', '2027-03-31', 41, v_admin, now())
  on conflict (initiative_id, reporting_year_id) do update set progress_percentage = excluded.progress_percentage returning id into v_c3;
  insert into public.initiative_budgets (initiative_cycle_id, requested_budget, approved_budget, committed_amount, utilised_amount, forecast_amount)
  values (v_c3, 9500000, 9000000, 5600000, 3250000, 9100000)
  on conflict (initiative_cycle_id) do update set requested_budget=excluded.requested_budget, approved_budget=excluded.approved_budget, committed_amount=excluded.committed_amount, utilised_amount=excluded.utilised_amount, forecast_amount=excluded.forecast_amount;

  insert into public.initiatives (code, title, description, portfolio_id, lead_department_id, project_owner_id, strategic_pillar_id, created_by_id)
  values ('H31-CEX-004', 'Customer 360 and Personalisation', 'Build a trusted customer data foundation and personalised engagement capabilities.', v_gro, v_cex, v_admin, v_p2, v_admin)
  on conflict (code) do update set title = excluded.title returning id into v_i4;
  insert into public.initiative_cycles (initiative_id, reporting_year_id, initiative_type, cycle_status, planned_start_date, planned_end_date, progress_percentage, created_by_id, submitted_at, approved_by_id, approved_at)
  values (v_i4, v_y2026, 'EVOLUTION', 'APPROVED', '2026-02-01', '2027-09-30', 55, v_admin, now(), v_admin, now())
  on conflict (initiative_id, reporting_year_id) do update set progress_percentage = excluded.progress_percentage returning id into v_c4;
  insert into public.initiative_budgets (initiative_cycle_id, requested_budget, approved_budget, committed_amount, utilised_amount, forecast_amount)
  values (v_c4, 14300000, 13750000, 9400000, 5900000, 13600000)
  on conflict (initiative_cycle_id) do update set requested_budget=excluded.requested_budget, approved_budget=excluded.approved_budget, committed_amount=excluded.committed_amount, utilised_amount=excluded.utilised_amount, forecast_amount=excluded.forecast_amount;

  insert into public.initiatives (code, title, description, portfolio_id, lead_department_id, project_owner_id, strategic_pillar_id, created_by_id)
  values ('H31-PPL-005', 'Future Skills Academy', 'Build priority digital, leadership and commercial capabilities across the organisation.', v_trn, v_ppl, v_admin, v_p4, v_admin)
  on conflict (code) do update set title = excluded.title returning id into v_i5;
  insert into public.initiative_cycles (initiative_id, reporting_year_id, initiative_type, cycle_status, planned_start_date, planned_end_date, progress_percentage, created_by_id, submitted_at)
  values (v_i5, v_y2026, 'REPEAT', 'SUBMITTED', '2026-01-01', '2026-12-31', 48, v_admin, now())
  on conflict (initiative_id, reporting_year_id) do update set progress_percentage = excluded.progress_percentage returning id into v_c5;
  insert into public.initiative_budgets (initiative_cycle_id, requested_budget, approved_budget, committed_amount, utilised_amount, forecast_amount)
  values (v_c5, 4300000, 4000000, 3100000, 2100000, 3950000)
  on conflict (initiative_cycle_id) do update set requested_budget=excluded.requested_budget, approved_budget=excluded.approved_budget, committed_amount=excluded.committed_amount, utilised_amount=excluded.utilised_amount, forecast_amount=excluded.forecast_amount;

  -- Project 1
  insert into public.projects (initiative_id, code, name, project_manager_id, created_by_id)
  values (v_i1, 'DIG-PLT-01', 'Experience Portal', v_admin, v_admin)
  on conflict (code) do update set name = excluded.name returning id into v_pj;
  insert into public.project_cycles (project_id, initiative_cycle_id, project_status, planned_start_date, planned_end_date, progress_percentage)
  values (v_pj, v_c1, 'ON_TRACK', '2026-01-15', '2026-10-31', 76)
  on conflict (project_id, initiative_cycle_id) do update set project_status=excluded.project_status, progress_percentage=excluded.progress_percentage returning id into v_pc;
  insert into public.milestones (project_cycle_id, name, planned_end_date, milestone_status, progress_percentage, owner_id) values
    (v_pc, 'Experience design approved', '2026-03-31', 'COMPLETED', 100, v_admin),
    (v_pc, 'Public beta released', '2026-08-31', 'IN_PROGRESS', 70, v_admin)
  on conflict do nothing;

  insert into public.projects (initiative_id, code, name, project_manager_id, created_by_id)
  values (v_i1, 'DIG-PLT-02', 'Integration and API Layer', v_admin, v_admin)
  on conflict (code) do update set name = excluded.name returning id into v_pj;
  insert into public.project_cycles (project_id, initiative_cycle_id, project_status, planned_start_date, planned_end_date, progress_percentage)
  values (v_pj, v_c1, 'AT_RISK', '2026-03-01', '2027-02-28', 52)
  on conflict (project_id, initiative_cycle_id) do update set project_status=excluded.project_status, progress_percentage=excluded.progress_percentage returning id into v_pc;
  insert into public.project_risks (project_cycle_id, title, risk_level, risk_status, mitigation, owner_id)
  values (v_pc, 'Legacy integration dependency', 'CRITICAL', 'MITIGATING', 'Introduce staged interface migration and weekly dependency review.', v_admin)
  on conflict do nothing;

  insert into public.projects (initiative_id, code, name, project_manager_id, created_by_id)
  values (v_i2, 'FIN-EPM-01', 'Planning Model and Workflow', v_admin, v_admin)
  on conflict (code) do update set name = excluded.name returning id into v_pj;
  insert into public.project_cycles (project_id, initiative_cycle_id, project_status, planned_start_date, planned_end_date, progress_percentage)
  values (v_pj, v_c2, 'ON_TRACK', '2025-08-01', '2026-08-31', 88)
  on conflict (project_id, initiative_cycle_id) do update set project_status=excluded.project_status, progress_percentage=excluded.progress_percentage;

  insert into public.projects (initiative_id, code, name, project_manager_id, created_by_id)
  values (v_i2, 'FIN-EPM-02', 'Management Reporting Transformation', v_admin, v_admin)
  on conflict (code) do update set name = excluded.name returning id into v_pj;
  insert into public.project_cycles (project_id, initiative_cycle_id, project_status, planned_start_date, planned_end_date, progress_percentage)
  values (v_pj, v_c2, 'DELAYED', '2026-01-01', '2026-12-15', 54)
  on conflict (project_id, initiative_cycle_id) do update set project_status=excluded.project_status, progress_percentage=excluded.progress_percentage returning id into v_pc;
  insert into public.project_risks (project_cycle_id, title, risk_level, risk_status, mitigation, owner_id)
  values (v_pc, 'Data reconciliation delay', 'CRITICAL', 'OPEN', 'Daily data triage and prioritised source-system remediation.', v_admin)
  on conflict do nothing;

  insert into public.projects (initiative_id, code, name, project_manager_id, created_by_id)
  values (v_i3, 'OPS-CTL-01', 'Operations Data Hub', v_admin, v_admin)
  on conflict (code) do update set name = excluded.name returning id into v_pj;
  insert into public.project_cycles (project_id, initiative_cycle_id, project_status, planned_start_date, planned_end_date, progress_percentage)
  values (v_pj, v_c3, 'AT_RISK', '2026-03-01', '2026-11-30', 48)
  on conflict (project_id, initiative_cycle_id) do update set project_status=excluded.project_status, progress_percentage=excluded.progress_percentage;

  insert into public.projects (initiative_id, code, name, project_manager_id, created_by_id)
  values (v_i3, 'OPS-CTL-02', 'Executive Control Tower', v_admin, v_admin)
  on conflict (code) do update set name = excluded.name returning id into v_pj;
  insert into public.project_cycles (project_id, initiative_cycle_id, project_status, planned_start_date, planned_end_date, progress_percentage)
  values (v_pj, v_c3, 'DELAYED', '2026-05-01', '2027-03-31', 29)
  on conflict (project_id, initiative_cycle_id) do update set project_status=excluded.project_status, progress_percentage=excluded.progress_percentage;

  insert into public.projects (initiative_id, code, name, project_manager_id, created_by_id)
  values (v_i4, 'CEX-360-01', 'Customer Data Foundation', v_admin, v_admin)
  on conflict (code) do update set name = excluded.name returning id into v_pj;
  insert into public.project_cycles (project_id, initiative_cycle_id, project_status, planned_start_date, planned_end_date, progress_percentage)
  values (v_pj, v_c4, 'ON_TRACK', '2026-02-01', '2026-12-31', 69)
  on conflict (project_id, initiative_cycle_id) do update set project_status=excluded.project_status, progress_percentage=excluded.progress_percentage;

  insert into public.projects (initiative_id, code, name, project_manager_id, created_by_id)
  values (v_i5, 'PPL-SKL-01', 'Digital Skills Curriculum', v_admin, v_admin)
  on conflict (code) do update set name = excluded.name returning id into v_pj;
  insert into public.project_cycles (project_id, initiative_cycle_id, project_status, planned_start_date, planned_end_date, progress_percentage)
  values (v_pj, v_c5, 'AT_RISK', '2026-01-01', '2026-09-30', 58)
  on conflict (project_id, initiative_cycle_id) do update set project_status=excluded.project_status, progress_percentage=excluded.progress_percentage;
end $$;

commit;
