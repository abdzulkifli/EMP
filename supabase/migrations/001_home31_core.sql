-- HOME31 V2 core schema for Supabase PostgreSQL
-- Run through Supabase migrations or paste into the SQL Editor on a new project.

begin;

create extension if not exists pgcrypto;

create type public.account_status as enum ('PENDING', 'ACTIVE', 'FROZEN', 'REVOKED', 'LOCKED');
create type public.record_status as enum ('ACTIVE', 'ARCHIVED', 'CANCELLED');
create type public.access_level as enum ('VIEW', 'EDIT', 'APPROVE', 'ADMIN');
create type public.initiative_type as enum ('NEW', 'CARRY_FORWARD', 'REPEAT', 'EVOLUTION');
create type public.cycle_status as enum ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED', 'ARCHIVED');
create type public.project_status as enum ('NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'DELAYED', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
create type public.milestone_status as enum ('NOT_STARTED', 'IN_PROGRESS', 'AT_RISK', 'DELAYED', 'COMPLETED', 'CANCELLED');
create type public.risk_level as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
create type public.risk_status as enum ('OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code varchar(40) not null unique,
  name varchar(200) not null,
  parent_department_id uuid references public.departments(id) on delete restrict,
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_code_not_blank check (btrim(code) <> ''),
  constraint departments_name_not_blank check (btrim(name) <> ''),
  constraint departments_not_own_parent check (parent_department_id is null or parent_department_id <> id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(320) not null,
  full_name varchar(200) not null,
  home_department_id uuid references public.departments(id) on delete restrict,
  account_status public.account_status not null default 'PENDING',
  must_change_password boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_not_blank check (btrim(email) <> ''),
  constraint profiles_full_name_not_blank check (btrim(full_name) <> ''),
  constraint profiles_version_positive check (version > 0)
);

create unique index profiles_email_normalized_unique on public.profiles (lower(btrim(email)));

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code varchar(80) not null unique,
  name varchar(120) not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table public.user_department_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  access_level public.access_level not null default 'VIEW',
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (user_id, department_id)
);

create table public.reporting_years (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  code varchar(20) not null unique,
  display_name varchar(80) not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reporting_years_valid_range check (end_date >= start_date),
  constraint reporting_years_reasonable_year check (year between 2000 and 2200)
);

create table public.strategic_pillars (
  id uuid primary key default gen_random_uuid(),
  code varchar(40) not null unique,
  name varchar(200) not null,
  description text,
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  code varchar(40) not null unique,
  name varchar(200) not null,
  description text,
  lead_department_id uuid references public.departments(id) on delete restrict,
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.initiatives (
  id uuid primary key default gen_random_uuid(),
  code varchar(60) not null unique,
  title varchar(300) not null,
  description text,
  portfolio_id uuid not null references public.portfolios(id) on delete restrict,
  lead_department_id uuid not null references public.departments(id) on delete restrict,
  project_owner_id uuid not null references public.profiles(id) on delete restrict,
  strategic_pillar_id uuid references public.strategic_pillars(id) on delete restrict,
  created_by_id uuid not null references public.profiles(id) on delete restrict,
  status public.record_status not null default 'ACTIVE',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint initiatives_code_not_blank check (btrim(code) <> ''),
  constraint initiatives_title_not_blank check (btrim(title) <> ''),
  constraint initiatives_version_positive check (version > 0)
);

create table public.initiative_cycles (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete restrict,
  reporting_year_id uuid not null references public.reporting_years(id) on delete restrict,
  initiative_type public.initiative_type not null,
  cycle_status public.cycle_status not null default 'DRAFT',
  objectives text,
  business_justification text,
  planned_start_date date,
  planned_end_date date,
  progress_percentage numeric(5,2) not null default 0,
  created_by_id uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  approved_by_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (initiative_id, reporting_year_id),
  constraint initiative_cycles_dates check (planned_end_date is null or planned_start_date is null or planned_end_date >= planned_start_date),
  constraint initiative_cycles_progress check (progress_percentage between 0 and 100),
  constraint initiative_cycles_version_positive check (version > 0)
);

create table public.initiative_budgets (
  id uuid primary key default gen_random_uuid(),
  initiative_cycle_id uuid not null unique references public.initiative_cycles(id) on delete cascade,
  currency_code char(3) not null default 'MYR',
  requested_budget numeric(18,2) not null default 0,
  approved_budget numeric(18,2) not null default 0,
  committed_amount numeric(18,2) not null default 0,
  utilised_amount numeric(18,2) not null default 0,
  forecast_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint initiative_budgets_nonnegative check (
    requested_budget >= 0 and approved_budget >= 0 and committed_amount >= 0 and utilised_amount >= 0 and forecast_amount >= 0
  )
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete restrict,
  code varchar(60) not null unique,
  name varchar(300) not null,
  description text,
  project_manager_id uuid references public.profiles(id) on delete set null,
  status public.record_status not null default 'ACTIVE',
  created_by_id uuid not null references public.profiles(id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint projects_code_not_blank check (btrim(code) <> ''),
  constraint projects_name_not_blank check (btrim(name) <> '')
);

create table public.project_cycles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  initiative_cycle_id uuid not null references public.initiative_cycles(id) on delete restrict,
  project_status public.project_status not null default 'NOT_STARTED',
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  progress_percentage numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, initiative_cycle_id),
  constraint project_cycles_planned_dates check (planned_end_date is null or planned_start_date is null or planned_end_date >= planned_start_date),
  constraint project_cycles_actual_dates check (actual_end_date is null or actual_start_date is null or actual_end_date >= actual_start_date),
  constraint project_cycles_progress check (progress_percentage between 0 and 100)
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_cycle_id uuid not null references public.project_cycles(id) on delete cascade,
  name varchar(300) not null,
  description text,
  planned_start_date date,
  planned_end_date date,
  actual_end_date date,
  milestone_status public.milestone_status not null default 'NOT_STARTED',
  progress_percentage numeric(5,2) not null default 0,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestones_progress check (progress_percentage between 0 and 100)
);

create table public.project_risks (
  id uuid primary key default gen_random_uuid(),
  project_cycle_id uuid not null references public.project_cycles(id) on delete cascade,
  title varchar(300) not null,
  description text,
  risk_level public.risk_level not null default 'MEDIUM',
  risk_status public.risk_status not null default 'OPEN',
  mitigation text,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid references public.initiatives(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint attachments_one_parent check ((initiative_id is not null)::integer + (project_id is not null)::integer = 1)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action varchar(120) not null,
  entity_type varchar(100) not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index initiatives_department_idx on public.initiatives (lead_department_id);
create index initiatives_owner_idx on public.initiatives (project_owner_id);
create index initiative_cycles_year_status_idx on public.initiative_cycles (reporting_year_id, cycle_status);
create index projects_initiative_idx on public.projects (initiative_id);
create index project_cycles_status_idx on public.project_cycles (project_status);
create index milestones_project_cycle_idx on public.milestones (project_cycle_id);
create index project_risks_project_cycle_idx on public.project_risks (project_cycle_id, risk_status, risk_level);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

-- Seed controlled reference data.
insert into public.roles (code, name, description) values
  ('SUPER_ADMIN', 'Super Administrator', 'Full platform administration and all-department access.'),
  ('ADMIN', 'Administrator', 'Operational administration within authorised departments.'),
  ('END_USER', 'End User', 'Department-scoped initiative and project access.'),
  ('DEPARTMENT_HEAD', 'Department Head', 'Department review and delivery accountability.'),
  ('FINANCE_REVIEWER', 'Finance Reviewer', 'Cross-department budget review and reporting.'),
  ('AUDITOR', 'Auditor', 'Read-only access to approved records and audit history.');

insert into public.departments (code, name) values
  ('DIG', 'Digital & Technology'),
  ('FIN', 'Finance'),
  ('OPS', 'Operations'),
  ('PPL', 'People & Culture'),
  ('CEX', 'Customer Experience');

insert into public.reporting_years (year, code, display_name, start_date, end_date, is_locked) values
  (2025, 'AMP25', 'AMP 2025', '2025-01-01', '2025-12-31', true),
  (2026, 'AMP26', 'AMP 2026', '2026-01-01', '2026-12-31', false),
  (2027, 'AMP27', 'AMP 2027', '2027-01-01', '2027-12-31', false),
  (2028, 'AMP28', 'AMP 2028', '2028-01-01', '2028-12-31', false);

insert into public.strategic_pillars (code, name) values
  ('P1', 'Digital Leadership'),
  ('P2', 'Customer Excellence'),
  ('P3', 'Productivity & Efficiency'),
  ('P4', 'Future-Ready Talent');

insert into public.portfolios (code, name) values
  ('TRN', 'Enterprise Transformation'),
  ('GRO', 'Growth & Customer'),
  ('RES', 'Operational Resilience');

-- Shared timestamp trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger departments_set_updated_at before update on public.departments for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger reporting_years_set_updated_at before update on public.reporting_years for each row execute function public.set_updated_at();
create trigger strategic_pillars_set_updated_at before update on public.strategic_pillars for each row execute function public.set_updated_at();
create trigger portfolios_set_updated_at before update on public.portfolios for each row execute function public.set_updated_at();
create trigger initiatives_set_updated_at before update on public.initiatives for each row execute function public.set_updated_at();
create trigger initiative_cycles_set_updated_at before update on public.initiative_cycles for each row execute function public.set_updated_at();
create trigger initiative_budgets_set_updated_at before update on public.initiative_budgets for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger project_cycles_set_updated_at before update on public.project_cycles for each row execute function public.set_updated_at();
create trigger milestones_set_updated_at before update on public.milestones for each row execute function public.set_updated_at();
create trigger project_risks_set_updated_at before update on public.project_risks for each row execute function public.set_updated_at();

-- Create a business profile whenever Supabase Auth creates a user.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_department_id uuid;
  v_end_user_role uuid;
begin
  begin
    v_department_id := nullif(new.raw_user_meta_data ->> 'home_department_id', '')::uuid;
  exception when invalid_text_representation then
    v_department_id := null;
  end;

  insert into public.profiles (id, email, full_name, home_department_id, account_status, must_change_password)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@pending.local'),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'HOME31 User'), '@', 1)),
    v_department_id,
    'ACTIVE',
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;

  select id into v_end_user_role from public.roles where code = 'END_USER';
  insert into public.user_roles (user_id, role_id) values (new.id, v_end_user_role)
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill profiles when the migration is applied to a project that already has Auth users.
insert into public.profiles (id, email, full_name, account_status, must_change_password)
select
  au.id,
  coalesce(au.email, au.id::text || '@pending.local'),
  coalesce(nullif(au.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(au.email, 'HOME31 User'), '@', 1)),
  'ACTIVE',
  true
from auth.users au
on conflict (id) do nothing;

insert into public.user_roles (user_id, role_id)
select p.id, r.id
from public.profiles p
cross join public.roles r
where r.code = 'END_USER'
on conflict do nothing;

-- Security helpers used by every RLS policy.
create or replace function public.current_account_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_status = 'ACTIVE'
  );
$$;

create or replace function public.has_role(p_role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code = p_role_code
  );
$$;

create or replace function public.can_access_department(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_account_active() and (
    public.has_role('SUPER_ADMIN')
    or public.has_role('FINANCE_REVIEWER')
    or public.has_role('AUDITOR')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.home_department_id = p_department_id)
    or exists (
      select 1 from public.user_department_access uda
      where uda.user_id = auth.uid()
        and uda.department_id = p_department_id
        and (uda.expires_at is null or uda.expires_at > now())
    )
  );
$$;

create or replace function public.can_manage_department(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_account_active() and (
    public.has_role('SUPER_ADMIN')
    or (
      public.has_role('ADMIN') and (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.home_department_id = p_department_id)
        or exists (
          select 1 from public.user_department_access uda
          where uda.user_id = auth.uid()
            and uda.department_id = p_department_id
            and uda.access_level in ('EDIT', 'APPROVE', 'ADMIN')
            and (uda.expires_at is null or uda.expires_at > now())
        )
      )
    )
    or (
      public.has_role('DEPARTMENT_HEAD')
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.home_department_id = p_department_id)
    )
  );
$$;

create or replace function public.can_access_initiative(p_initiative_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.initiatives i
    where i.id = p_initiative_id
      and i.status = 'ACTIVE'
      and (public.can_access_department(i.lead_department_id) or i.project_owner_id = auth.uid())
  );
$$;

create or replace function public.can_edit_initiative(p_initiative_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.initiatives i
    where i.id = p_initiative_id
      and i.status = 'ACTIVE'
      and (public.can_manage_department(i.lead_department_id) or i.project_owner_id = auth.uid())
  );
$$;

revoke all on function public.current_account_active() from public;
revoke all on function public.has_role(text) from public;
revoke all on function public.can_access_department(uuid) from public;
revoke all on function public.can_manage_department(uuid) from public;
revoke all on function public.can_access_initiative(uuid) from public;
revoke all on function public.can_edit_initiative(uuid) from public;
grant execute on function public.current_account_active() to authenticated;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.can_access_department(uuid) to authenticated;
grant execute on function public.can_manage_department(uuid) to authenticated;
grant execute on function public.can_access_initiative(uuid) to authenticated;
grant execute on function public.can_edit_initiative(uuid) to authenticated;

-- Enable RLS.
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_department_access enable row level security;
alter table public.reporting_years enable row level security;
alter table public.strategic_pillars enable row level security;
alter table public.portfolios enable row level security;
alter table public.initiatives enable row level security;
alter table public.initiative_cycles enable row level security;
alter table public.initiative_budgets enable row level security;
alter table public.projects enable row level security;
alter table public.project_cycles enable row level security;
alter table public.milestones enable row level security;
alter table public.project_risks enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_logs enable row level security;

-- API grants are still constrained by the RLS policies below.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;

create policy departments_select on public.departments for select to authenticated using (public.current_account_active());
create policy departments_insert on public.departments for insert to authenticated with check (public.current_account_active() and (public.has_role('SUPER_ADMIN') or public.has_role('ADMIN')));
create policy departments_update on public.departments for update to authenticated using (public.current_account_active() and (public.has_role('SUPER_ADMIN') or public.has_role('ADMIN'))) with check (public.current_account_active() and (public.has_role('SUPER_ADMIN') or public.has_role('ADMIN')));

create policy profiles_select on public.profiles for select to authenticated using (
  public.current_account_active() and (
    id = auth.uid()
    or public.has_role('SUPER_ADMIN')
    or public.has_role('ADMIN')
    or public.can_access_department(home_department_id)
  )
);

create policy roles_select on public.roles for select to authenticated using (public.current_account_active());
create policy user_roles_select on public.user_roles for select to authenticated using (public.current_account_active() and (user_id = auth.uid() or public.has_role('SUPER_ADMIN') or public.has_role('ADMIN')));
create policy user_department_access_select on public.user_department_access for select to authenticated using (public.current_account_active() and (user_id = auth.uid() or public.has_role('SUPER_ADMIN') or public.has_role('ADMIN')));

create policy reporting_years_select on public.reporting_years for select to authenticated using (public.current_account_active());
create policy reporting_years_insert on public.reporting_years for insert to authenticated with check (public.current_account_active() and (public.has_role('SUPER_ADMIN') or public.has_role('ADMIN')));
create policy reporting_years_update on public.reporting_years for update to authenticated using (public.current_account_active() and (public.has_role('SUPER_ADMIN') or public.has_role('ADMIN'))) with check (public.current_account_active() and (public.has_role('SUPER_ADMIN') or public.has_role('ADMIN')));

create policy strategic_pillars_select on public.strategic_pillars for select to authenticated using (public.current_account_active());
create policy portfolios_select on public.portfolios for select to authenticated using (public.current_account_active());

create policy initiatives_select on public.initiatives for select to authenticated using (public.can_access_initiative(id));
create policy initiatives_insert on public.initiatives for insert to authenticated with check (public.can_manage_department(lead_department_id) or (project_owner_id = auth.uid() and public.can_access_department(lead_department_id)));
create policy initiatives_update on public.initiatives for update to authenticated using (public.can_edit_initiative(id)) with check (public.can_manage_department(lead_department_id) or (project_owner_id = auth.uid() and public.can_access_department(lead_department_id)));

create policy initiative_cycles_select on public.initiative_cycles for select to authenticated using (public.can_access_initiative(initiative_id));
create policy initiative_cycles_insert on public.initiative_cycles for insert to authenticated with check (public.can_edit_initiative(initiative_id));
create policy initiative_cycles_update on public.initiative_cycles for update to authenticated using (public.can_edit_initiative(initiative_id)) with check (public.can_edit_initiative(initiative_id));

create policy initiative_budgets_select on public.initiative_budgets for select to authenticated using (
  exists (select 1 from public.initiative_cycles ic where ic.id = initiative_cycle_id and public.can_access_initiative(ic.initiative_id))
);
create policy initiative_budgets_insert on public.initiative_budgets for insert to authenticated with check (
  exists (select 1 from public.initiative_cycles ic where ic.id = initiative_cycle_id and public.can_edit_initiative(ic.initiative_id))
);
create policy initiative_budgets_update on public.initiative_budgets for update to authenticated using (
  exists (select 1 from public.initiative_cycles ic where ic.id = initiative_cycle_id and public.can_edit_initiative(ic.initiative_id))
) with check (
  exists (select 1 from public.initiative_cycles ic where ic.id = initiative_cycle_id and public.can_edit_initiative(ic.initiative_id))
);

create policy projects_select on public.projects for select to authenticated using (public.can_access_initiative(initiative_id));
create policy projects_insert on public.projects for insert to authenticated with check (public.can_edit_initiative(initiative_id));
create policy projects_update on public.projects for update to authenticated using (public.can_edit_initiative(initiative_id)) with check (public.can_edit_initiative(initiative_id));

create policy project_cycles_select on public.project_cycles for select to authenticated using (
  exists (select 1 from public.projects p where p.id = project_id and public.can_access_initiative(p.initiative_id))
);
create policy project_cycles_insert on public.project_cycles for insert to authenticated with check (
  exists (select 1 from public.projects p where p.id = project_id and public.can_edit_initiative(p.initiative_id))
);
create policy project_cycles_update on public.project_cycles for update to authenticated using (
  exists (select 1 from public.projects p where p.id = project_id and public.can_edit_initiative(p.initiative_id))
) with check (
  exists (select 1 from public.projects p where p.id = project_id and public.can_edit_initiative(p.initiative_id))
);

create policy milestones_select on public.milestones for select to authenticated using (
  exists (
    select 1 from public.project_cycles pc join public.projects p on p.id = pc.project_id
    where pc.id = project_cycle_id and public.can_access_initiative(p.initiative_id)
  )
);
create policy milestones_manage on public.milestones for all to authenticated using (
  exists (
    select 1 from public.project_cycles pc join public.projects p on p.id = pc.project_id
    where pc.id = project_cycle_id and public.can_edit_initiative(p.initiative_id)
  )
) with check (
  exists (
    select 1 from public.project_cycles pc join public.projects p on p.id = pc.project_id
    where pc.id = project_cycle_id and public.can_edit_initiative(p.initiative_id)
  )
);

create policy project_risks_select on public.project_risks for select to authenticated using (
  exists (
    select 1 from public.project_cycles pc join public.projects p on p.id = pc.project_id
    where pc.id = project_cycle_id and public.can_access_initiative(p.initiative_id)
  )
);
create policy project_risks_manage on public.project_risks for all to authenticated using (
  exists (
    select 1 from public.project_cycles pc join public.projects p on p.id = pc.project_id
    where pc.id = project_cycle_id and public.can_edit_initiative(p.initiative_id)
  )
) with check (
  exists (
    select 1 from public.project_cycles pc join public.projects p on p.id = pc.project_id
    where pc.id = project_cycle_id and public.can_edit_initiative(p.initiative_id)
  )
);

create policy attachments_select on public.attachments for select to authenticated using (
  (initiative_id is not null and public.can_access_initiative(initiative_id))
  or (project_id is not null and exists (select 1 from public.projects p where p.id = project_id and public.can_access_initiative(p.initiative_id)))
);
create policy attachments_manage on public.attachments for all to authenticated using (uploaded_by = auth.uid() or public.has_role('SUPER_ADMIN') or public.has_role('ADMIN')) with check (uploaded_by = auth.uid());

create policy audit_logs_select on public.audit_logs for select to authenticated using (public.current_account_active() and (public.has_role('SUPER_ADMIN') or public.has_role('ADMIN') or public.has_role('AUDITOR')));

-- Read models. security_invoker ensures underlying RLS remains active.
create view public.my_profile_view with (security_invoker = true) as
select
  p.id,
  p.email,
  p.full_name,
  p.account_status,
  p.must_change_password,
  p.home_department_id,
  d.name as department_name,
  coalesce(array_agg(r.code order by r.code) filter (where r.code is not null), '{}'::varchar[]) as roles
from public.profiles p
left join public.departments d on d.id = p.home_department_id
left join public.user_roles ur on ur.user_id = p.id
left join public.roles r on r.id = ur.role_id
where p.id = auth.uid()
group by p.id, d.name;

create view public.user_directory_view with (security_invoker = true) as
select p.id, p.full_name, p.email, p.account_status, p.home_department_id, d.name as department_name
from public.profiles p
left join public.departments d on d.id = p.home_department_id
where p.account_status = 'ACTIVE';

create view public.initiative_portfolio_view with (security_invoker = true) as
select
  i.id as initiative_id,
  i.code as initiative_code,
  i.title as initiative_title,
  i.description,
  i.portfolio_id,
  po.name as portfolio_name,
  i.lead_department_id as department_id,
  d.code as department_code,
  d.name as department_name,
  i.project_owner_id,
  owner.full_name as project_owner_name,
  i.strategic_pillar_id,
  sp.name as strategic_pillar_name,
  ic.id as cycle_id,
  ic.reporting_year_id,
  ry.year as reporting_year,
  ic.initiative_type,
  ic.cycle_status,
  ic.planned_start_date,
  ic.planned_end_date,
  ic.progress_percentage,
  coalesce(ib.requested_budget, 0)::numeric(18,2) as requested_budget,
  coalesce(ib.approved_budget, 0)::numeric(18,2) as approved_budget,
  coalesce(ib.committed_amount, 0)::numeric(18,2) as committed_amount,
  coalesce(ib.utilised_amount, 0)::numeric(18,2) as utilised_amount,
  coalesce(ib.forecast_amount, 0)::numeric(18,2) as forecast_amount,
  count(distinct pc.project_id)::integer as project_count,
  count(distinct pc.project_id) filter (where pc.project_status = 'AT_RISK')::integer as at_risk_projects,
  count(distinct pc.project_id) filter (where pc.project_status = 'DELAYED')::integer as delayed_projects,
  greatest(i.updated_at, ic.updated_at, coalesce(ib.updated_at, i.updated_at)) as updated_at
from public.initiatives i
join public.portfolios po on po.id = i.portfolio_id
join public.departments d on d.id = i.lead_department_id
join public.profiles owner on owner.id = i.project_owner_id
left join public.strategic_pillars sp on sp.id = i.strategic_pillar_id
join public.initiative_cycles ic on ic.initiative_id = i.id and ic.archived_at is null
join public.reporting_years ry on ry.id = ic.reporting_year_id
left join public.initiative_budgets ib on ib.initiative_cycle_id = ic.id
left join public.project_cycles pc on pc.initiative_cycle_id = ic.id
where i.status = 'ACTIVE'
group by i.id, po.name, d.code, d.name, owner.full_name, sp.name, ic.id, ry.year, ib.id;

create view public.project_overview_view with (security_invoker = true) as
select
  p.id as project_id,
  p.code as project_code,
  p.name as project_name,
  i.id as initiative_id,
  i.code as initiative_code,
  i.title as initiative_title,
  i.lead_department_id as department_id,
  d.name as department_name,
  ry.year as reporting_year,
  pc.project_status,
  p.project_manager_id,
  manager.full_name as project_manager_name,
  pc.planned_start_date,
  pc.planned_end_date,
  pc.actual_start_date,
  pc.actual_end_date,
  pc.progress_percentage,
  count(distinct m.id)::integer as milestone_count,
  count(distinct m.id) filter (where m.milestone_status = 'COMPLETED')::integer as completed_milestones,
  count(distinct pr.id) filter (where pr.risk_status in ('OPEN', 'MITIGATING'))::integer as open_risks,
  count(distinct pr.id) filter (where pr.risk_status in ('OPEN', 'MITIGATING') and pr.risk_level = 'CRITICAL')::integer as critical_risks
from public.projects p
join public.initiatives i on i.id = p.initiative_id
join public.departments d on d.id = i.lead_department_id
join public.project_cycles pc on pc.project_id = p.id
join public.initiative_cycles ic on ic.id = pc.initiative_cycle_id
join public.reporting_years ry on ry.id = ic.reporting_year_id
left join public.profiles manager on manager.id = p.project_manager_id
left join public.milestones m on m.project_cycle_id = pc.id
left join public.project_risks pr on pr.project_cycle_id = pc.id
where p.status = 'ACTIVE'
group by p.id, i.id, d.name, ry.year, pc.id, manager.full_name;

-- Admin-only directory function. It can read Auth metadata without exposing auth.users directly.
create or replace function public.get_admin_user_directory()
returns table (
  id uuid,
  email varchar,
  full_name varchar,
  account_status public.account_status,
  must_change_password boolean,
  department_id uuid,
  department_name varchar,
  roles varchar[],
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.current_account_active() or not (public.has_role('SUPER_ADMIN') or public.has_role('ADMIN')) then
    raise exception 'Administrator permission required';
  end if;

  return query
  select
    p.id,
    p.email,
    p.full_name,
    p.account_status,
    p.must_change_password,
    p.home_department_id,
    d.name,
    coalesce(array_agg(r.code order by r.code) filter (where r.code is not null), '{}'::varchar[]),
    au.last_sign_in_at
  from public.profiles p
  left join public.departments d on d.id = p.home_department_id
  left join public.user_roles ur on ur.user_id = p.id
  left join public.roles r on r.id = ur.role_id
  left join auth.users au on au.id = p.id
  group by p.id, d.name, au.last_sign_in_at
  order by p.full_name;
end;
$$;

revoke all on public.my_profile_view from anon;
revoke all on public.user_directory_view from anon;
revoke all on public.initiative_portfolio_view from anon;
revoke all on public.project_overview_view from anon;
grant select on public.my_profile_view to authenticated;
grant select on public.user_directory_view to authenticated;
grant select on public.initiative_portfolio_view to authenticated;
grant select on public.project_overview_view to authenticated;

-- Transactional initiative save used by the static frontend.
create or replace function public.save_initiative_cycle(
  p_initiative_id uuid,
  p_cycle_id uuid,
  p_code text,
  p_title text,
  p_description text,
  p_portfolio_id uuid,
  p_department_id uuid,
  p_project_owner_id uuid,
  p_strategic_pillar_id uuid,
  p_reporting_year_id uuid,
  p_initiative_type public.initiative_type,
  p_cycle_status public.cycle_status,
  p_planned_start_date date,
  p_planned_end_date date,
  p_progress_percentage numeric,
  p_requested_budget numeric,
  p_approved_budget numeric,
  p_forecast_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initiative_id uuid;
  v_cycle_id uuid;
  v_old jsonb;
begin
  if not public.current_account_active() then raise exception 'Account is not active'; end if;
  if not (public.can_manage_department(p_department_id) or (p_project_owner_id = auth.uid() and public.can_access_department(p_department_id))) then raise exception 'Not authorised for this department'; end if;
  if p_cycle_status in ('UNDER_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED') and not (public.has_role('SUPER_ADMIN') or public.has_role('ADMIN') or public.has_role('DEPARTMENT_HEAD') or public.has_role('FINANCE_REVIEWER')) then raise exception 'Approval status requires reviewer permission'; end if;
  if p_planned_start_date is not null and p_planned_end_date is not null and p_planned_end_date < p_planned_start_date then raise exception 'Invalid planned date range'; end if;
  if coalesce(p_approved_budget, 0) > coalesce(p_requested_budget, 0) and coalesce(p_requested_budget, 0) > 0 then raise exception 'Approved budget exceeds requested budget'; end if;

  if p_initiative_id is null then
    insert into public.initiatives (code, title, description, portfolio_id, lead_department_id, project_owner_id, strategic_pillar_id, created_by_id)
    values (upper(btrim(p_code)), btrim(p_title), nullif(btrim(p_description), ''), p_portfolio_id, p_department_id, p_project_owner_id, p_strategic_pillar_id, auth.uid())
    returning id into v_initiative_id;
  else
    if not public.can_edit_initiative(p_initiative_id) then raise exception 'Not authorised to edit initiative'; end if;
    select to_jsonb(i) into v_old from public.initiatives i where i.id = p_initiative_id;
    update public.initiatives set
      code = upper(btrim(p_code)), title = btrim(p_title), description = nullif(btrim(p_description), ''),
      portfolio_id = p_portfolio_id, lead_department_id = p_department_id, project_owner_id = p_project_owner_id,
      strategic_pillar_id = p_strategic_pillar_id, version = version + 1
    where id = p_initiative_id;
    v_initiative_id := p_initiative_id;
  end if;

  if p_cycle_id is null then
    insert into public.initiative_cycles (
      initiative_id, reporting_year_id, initiative_type, cycle_status, planned_start_date, planned_end_date,
      progress_percentage, created_by_id, submitted_at, approved_by_id, approved_at
    ) values (
      v_initiative_id, p_reporting_year_id, p_initiative_type, p_cycle_status, p_planned_start_date, p_planned_end_date,
      coalesce(p_progress_percentage, 0), auth.uid(),
      case when p_cycle_status in ('SUBMITTED','UNDER_REVIEW','APPROVED') then now() else null end,
      case when p_cycle_status = 'APPROVED' then auth.uid() else null end,
      case when p_cycle_status = 'APPROVED' then now() else null end
    ) returning id into v_cycle_id;
  else
    update public.initiative_cycles set
      initiative_type = p_initiative_type, cycle_status = p_cycle_status,
      planned_start_date = p_planned_start_date, planned_end_date = p_planned_end_date,
      progress_percentage = coalesce(p_progress_percentage, 0), version = version + 1,
      submitted_at = case when p_cycle_status in ('SUBMITTED','UNDER_REVIEW','APPROVED') then coalesce(submitted_at, now()) else submitted_at end,
      approved_by_id = case when p_cycle_status = 'APPROVED' then auth.uid() else approved_by_id end,
      approved_at = case when p_cycle_status = 'APPROVED' then coalesce(approved_at, now()) else approved_at end
    where id = p_cycle_id and initiative_id = v_initiative_id;
    if not found then raise exception 'Initiative cycle not found'; end if;
    v_cycle_id := p_cycle_id;
  end if;

  insert into public.initiative_budgets (initiative_cycle_id, requested_budget, approved_budget, forecast_amount)
  values (v_cycle_id, coalesce(p_requested_budget, 0), coalesce(p_approved_budget, 0), coalesce(p_forecast_amount, 0))
  on conflict (initiative_cycle_id) do update set
    requested_budget = excluded.requested_budget,
    approved_budget = excluded.approved_budget,
    forecast_amount = excluded.forecast_amount;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
  values (auth.uid(), case when p_initiative_id is null then 'INITIATIVE_CREATED' else 'INITIATIVE_UPDATED' end, 'initiative', v_initiative_id, v_old,
    jsonb_build_object('cycle_id', v_cycle_id, 'code', upper(btrim(p_code)), 'title', btrim(p_title), 'cycle_status', p_cycle_status));
  return v_cycle_id;
end;
$$;

create or replace function public.archive_initiative_cycle(p_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initiative_id uuid;
  v_department_id uuid;
  v_owner_id uuid;
  v_cycle_status public.cycle_status;
begin
  select ic.initiative_id, i.lead_department_id, i.project_owner_id, ic.cycle_status
  into v_initiative_id, v_department_id, v_owner_id, v_cycle_status
  from public.initiative_cycles ic join public.initiatives i on i.id = ic.initiative_id
  where ic.id = p_cycle_id;
  if v_initiative_id is null then raise exception 'Initiative cycle not found'; end if;
  if not (public.can_manage_department(v_department_id) or (v_owner_id = auth.uid() and v_cycle_status = 'DRAFT')) then raise exception 'Not authorised to archive this cycle'; end if;
  update public.initiative_cycles set cycle_status = 'ARCHIVED', archived_at = now(), version = version + 1 where id = p_cycle_id;
  insert into public.audit_logs (user_id, action, entity_type, entity_id) values (auth.uid(), 'INITIATIVE_CYCLE_ARCHIVED', 'initiative_cycle', p_cycle_id);
end;
$$;

create or replace function public.save_project_cycle(
  p_project_id uuid,
  p_initiative_cycle_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_project_manager_id uuid,
  p_status public.project_status,
  p_planned_start_date date,
  p_planned_end_date date,
  p_progress_percentage numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initiative_id uuid;
  v_project_id uuid;
  v_project_cycle_id uuid;
begin
  select initiative_id into v_initiative_id from public.initiative_cycles where id = p_initiative_cycle_id and archived_at is null;
  if v_initiative_id is null or not public.can_edit_initiative(v_initiative_id) then raise exception 'Not authorised'; end if;
  if p_planned_start_date is not null and p_planned_end_date is not null and p_planned_end_date < p_planned_start_date then raise exception 'Invalid planned date range'; end if;

  if p_project_id is null then
    insert into public.projects (initiative_id, code, name, description, project_manager_id, created_by_id)
    values (v_initiative_id, upper(btrim(p_code)), btrim(p_name), nullif(btrim(p_description), ''), p_project_manager_id, auth.uid())
    returning id into v_project_id;
    insert into public.project_cycles (project_id, initiative_cycle_id, project_status, planned_start_date, planned_end_date, progress_percentage)
    values (v_project_id, p_initiative_cycle_id, p_status, p_planned_start_date, p_planned_end_date, coalesce(p_progress_percentage, 0))
    returning id into v_project_cycle_id;
  else
    update public.projects set code = upper(btrim(p_code)), name = btrim(p_name), description = nullif(btrim(p_description), ''), project_manager_id = p_project_manager_id, version = version + 1
    where id = p_project_id and initiative_id = v_initiative_id;
    if not found then raise exception 'Project not found'; end if;
    v_project_id := p_project_id;
    insert into public.project_cycles (project_id, initiative_cycle_id, project_status, planned_start_date, planned_end_date, progress_percentage)
    values (v_project_id, p_initiative_cycle_id, p_status, p_planned_start_date, p_planned_end_date, coalesce(p_progress_percentage, 0))
    on conflict (project_id, initiative_cycle_id) do update set
      project_status = excluded.project_status,
      planned_start_date = excluded.planned_start_date,
      planned_end_date = excluded.planned_end_date,
      progress_percentage = excluded.progress_percentage
    returning id into v_project_cycle_id;
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, new_values)
  values (auth.uid(), case when p_project_id is null then 'PROJECT_CREATED' else 'PROJECT_UPDATED' end, 'project', v_project_id,
    jsonb_build_object('project_cycle_id', v_project_cycle_id, 'status', p_status, 'progress', p_progress_percentage));
  return v_project_cycle_id;
end;
$$;

create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.profiles set must_change_password = false, version = version + 1 where id = auth.uid();
  insert into public.audit_logs (user_id, action, entity_type, entity_id) values (auth.uid(), 'PASSWORD_CHANGED', 'profile', auth.uid());
end;
$$;

-- One-time SQL Editor helper. It only works before the first super administrator exists.
create or replace function public.bootstrap_super_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_role_id uuid;
begin
  if exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where r.code = 'SUPER_ADMIN'
  ) then raise exception 'A super administrator already exists'; end if;

  select id into v_user_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_user_id is null then raise exception 'Create the Auth user first'; end if;
  update public.profiles set account_status = 'ACTIVE', must_change_password = true where id = v_user_id;
  select id into v_role_id from public.roles where code = 'SUPER_ADMIN';
  delete from public.user_roles where user_id = v_user_id;
  insert into public.user_roles (user_id, role_id) values (v_user_id, v_role_id);
  return v_user_id;
end;
$$;

revoke all on function public.get_admin_user_directory() from public;
grant execute on function public.get_admin_user_directory() to authenticated;

revoke all on function public.save_initiative_cycle(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,uuid,public.initiative_type,public.cycle_status,date,date,numeric,numeric,numeric,numeric) from public;
revoke all on function public.archive_initiative_cycle(uuid) from public;
revoke all on function public.save_project_cycle(uuid,uuid,text,text,text,uuid,public.project_status,date,date,numeric) from public;
revoke all on function public.complete_password_change() from public;
revoke all on function public.bootstrap_super_admin(text) from public, anon, authenticated;
grant execute on function public.save_initiative_cycle(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,uuid,public.initiative_type,public.cycle_status,date,date,numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.archive_initiative_cycle(uuid) to authenticated;
grant execute on function public.save_project_cycle(uuid,uuid,text,text,text,uuid,public.project_status,date,date,numeric) to authenticated;
grant execute on function public.complete_password_change() to authenticated;

-- Storage bucket for future initiative/project documents.
insert into storage.buckets (id, name, public, file_size_limit)
values ('home31-documents', 'home31-documents', false, 52428800)
on conflict (id) do nothing;

create policy home31_documents_select on storage.objects for select to authenticated
using (bucket_id = 'home31-documents' and public.current_account_active());

create policy home31_documents_insert on storage.objects for insert to authenticated
with check (bucket_id = 'home31-documents' and public.current_account_active() and (storage.foldername(name))[1] = auth.uid()::text);

create policy home31_documents_update on storage.objects for update to authenticated
using (bucket_id = 'home31-documents' and owner_id = auth.uid()::text)
with check (bucket_id = 'home31-documents' and owner_id = auth.uid()::text);

create policy home31_documents_delete on storage.objects for delete to authenticated
using (bucket_id = 'home31-documents' and (owner_id = auth.uid()::text or public.has_role('SUPER_ADMIN') or public.has_role('ADMIN')));

commit;
