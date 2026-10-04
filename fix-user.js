const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  const email = 'c.sangale@gmail.com';
  
  // 1. Check if user exists
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }
  
  let targetUser = users.find(u => u.email === email);
  
  if (!targetUser) {
    console.log(`User ${email} not found. Creating...`);
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: 'password123',
      email_confirm: true,
      user_metadata: { full_name: 'C Sangale' }
    });
    
    if (createError) {
      console.error('Error creating user:', createError);
      return;
    }
    targetUser = newUser.user;
    console.log(`User created successfully with ID: ${targetUser.id}`);
  } else {
    console.log(`User ${email} found (ID: ${targetUser.id}). Updating password to 'password123'...`);
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      { password: 'password123', email_confirm: true }
    );
    if (updateError) {
      console.error('Error updating password:', updateError);
    } else {
      console.log('Password updated successfully.');
    }
  }

  // 2. Set as Super Admin in public.users
  console.log('Setting system_role to super_admin...');
  const { error: roleError } = await supabaseAdmin
    .from('users')
    .update({ system_role: 'super_admin' })
    .eq('id', targetUser.id);
    
  if (roleError) {
    // Maybe the row doesn't exist? Try insert
    const { error: insertRoleError } = await supabaseAdmin
      .from('users')
      .insert({ id: targetUser.id, system_role: 'super_admin' });
    if (insertRoleError) {
      console.error('Error setting role:', insertRoleError);
    } else {
      console.log('Inserted super_admin role.');
    }
  } else {
    console.log('Updated super_admin role.');
  }
  
  // 3. Ensure they have a tenant (otherwise /setup blocks them)
  const { data: members } = await supabaseAdmin
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', targetUser.id);
    
  if (!members || members.length === 0) {
    console.log('No tenant found. Creating a master tenant...');
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from('tenants')
      .insert({ name: 'Master Admin Business', status: 'active' })
      .select()
      .single();
      
    if (tenant) {
      await supabaseAdmin.from('tenant_members').insert({
        user_id: targetUser.id,
        tenant_id: tenant.id,
        role: 'tenant_admin'
      });
      console.log('Tenant created and assigned.');
    } else {
      console.error('Error creating tenant:', tErr);
    }
  } else {
    console.log('User already belongs to a tenant.');
  }

  console.log('All done!');
}

run();
