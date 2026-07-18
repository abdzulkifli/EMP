import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RoleCode = 'SUPER_ADMIN' | 'ADMIN' | 'END_USER' | 'DEPARTMENT_HEAD' | 'FINANCE_REVIEWER' | 'AUDITOR';
type AccountStatus = 'PENDING' | 'ACTIVE' | 'FROZEN' | 'REVOKED' | 'LOCKED';

function roleCode(value: unknown): string | undefined {
  if (Array.isArray(value)) return (value[0] as { code?: string } | undefined)?.code;
  return (value as { code?: string } | null)?.code;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) throw new Error('Supabase function secrets are unavailable.');

    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);
    const token = authorization.slice('Bearer '.length);

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Invalid or expired session' }, 401);

    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('id, account_status')
      .eq('id', authData.user.id)
      .single();
    if (callerError || callerProfile?.account_status !== 'ACTIVE') return json({ error: 'Account is not active' }, 403);

    const { data: roleRows, error: roleError } = await adminClient
      .from('user_roles')
      .select('roles!inner(code)')
      .eq('user_id', authData.user.id);
    if (roleError) throw roleError;
    const callerRoles = (roleRows ?? []).map((row) => roleCode(row.roles) as RoleCode).filter(Boolean);
    const isSuperAdmin = callerRoles.includes('SUPER_ADMIN');
    const isAdmin = callerRoles.includes('ADMIN');
    if (!isSuperAdmin && !isAdmin) return json({ error: 'Administrator permission required' }, 403);

    const body = await request.json();
    const action = body.action as string;

    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const fullName = String(body.fullName ?? '').trim();
      const departmentId = body.departmentId ? String(body.departmentId) : null;
      const role = String(body.role ?? 'END_USER') as RoleCode;
      const temporaryPassword = String(body.temporaryPassword ?? '');
      const allowedRoles: RoleCode[] = ['SUPER_ADMIN', 'ADMIN', 'END_USER', 'DEPARTMENT_HEAD', 'FINANCE_REVIEWER', 'AUDITOR'];
      if (!email || !fullName) return json({ error: 'Email and full name are required' }, 400);
      if (temporaryPassword.length < 12) return json({ error: 'Temporary password must be at least 12 characters' }, 400);
      if (!allowedRoles.includes(role)) return json({ error: 'Invalid role' }, 400);
      if (!isSuperAdmin && role !== 'END_USER') return json({ error: 'Administrators may only create end-user accounts' }, 403);

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          home_department_id: departmentId,
          must_change_password: true,
        },
      });
      if (createError || !created.user) return json({ error: createError?.message ?? 'Unable to create Auth user' }, 400);

      try {
        const { error: profileError } = await adminClient
          .from('profiles')
          .update({
            email,
            full_name: fullName,
            home_department_id: departmentId,
            account_status: 'ACTIVE',
            must_change_password: true,
          })
          .eq('id', created.user.id);
        if (profileError) throw profileError;

        const { data: selectedRole, error: selectedRoleError } = await adminClient
          .from('roles')
          .select('id')
          .eq('code', role)
          .single();
        if (selectedRoleError || !selectedRole) throw selectedRoleError ?? new Error('Role not found');

        await adminClient.from('user_roles').delete().eq('user_id', created.user.id);
        const { error: assignError } = await adminClient.from('user_roles').insert({
          user_id: created.user.id,
          role_id: selectedRole.id,
          assigned_by: authData.user.id,
        });
        if (assignError) throw assignError;

        await adminClient.from('audit_logs').insert({
          user_id: authData.user.id,
          action: 'USER_CREATED',
          entity_type: 'profile',
          entity_id: created.user.id,
          new_values: { email, full_name: fullName, department_id: departmentId, role },
        });
      } catch (cause) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        throw cause;
      }
      return json({ id: created.user.id });
    }

    if (action === 'status') {
      const userId = String(body.userId ?? '');
      const status = String(body.status ?? '') as AccountStatus;
      const allowedStatuses: AccountStatus[] = ['PENDING', 'ACTIVE', 'FROZEN', 'REVOKED', 'LOCKED'];
      if (!userId || !allowedStatuses.includes(status)) return json({ error: 'Valid user and status are required' }, 400);
      if (userId === authData.user.id && status !== 'ACTIVE') return json({ error: 'You cannot disable your own account' }, 400);

      const { data: targetRoles } = await adminClient.from('user_roles').select('roles!inner(code)').eq('user_id', userId);
      const targetIsSuper = (targetRoles ?? []).some((row) => roleCode(row.roles) === 'SUPER_ADMIN');
      if (targetIsSuper && !isSuperAdmin) return json({ error: 'Only a super administrator can change this account' }, 403);

      const { error: updateError } = await adminClient.from('profiles').update({ account_status: status }).eq('id', userId);
      if (updateError) throw updateError;
      await adminClient.from('audit_logs').insert({
        user_id: authData.user.id,
        action: `USER_${status}`,
        entity_type: 'profile',
        entity_id: userId,
        new_values: { account_status: status },
      });
      return json({ success: true });
    }

    if (action === 'reset-password') {
      const userId = String(body.userId ?? '');
      const temporaryPassword = String(body.temporaryPassword ?? '');
      if (!userId || temporaryPassword.length < 12) return json({ error: 'User and a 12-character temporary password are required' }, 400);
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(userId, { password: temporaryPassword });
      if (passwordError) throw passwordError;
      const { error: profileError } = await adminClient.from('profiles').update({ must_change_password: true }).eq('id', userId);
      if (profileError) throw profileError;
      await adminClient.from('audit_logs').insert({
        user_id: authData.user.id,
        action: 'USER_PASSWORD_RESET',
        entity_type: 'profile',
        entity_id: userId,
      });
      return json({ success: true });
    }

    return json({ error: 'Unsupported action' }, 400);
  } catch (cause) {
    console.error(cause);
    return json({ error: cause instanceof Error ? cause.message : 'Unexpected function error' }, 500);
  }
});
