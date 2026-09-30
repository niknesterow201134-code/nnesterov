// Setup script — creates chef account in Supabase Auth
// Run: node setup_admin.js

const SUPABASE_URL = 'https://wmcrshretrerwvcjxper.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtY3JzaHJldHJlcnd2Y2p4cGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDc4ODc0OCwiZXhwIjoyMTA2MzY0NzQ4fQ.sD0SVgpYEKgjrg2TZBtqnHfQUdzxPtegF3HoFrEO_9Q';
const CHEF_EMAIL   = 'nik.nesterow201134@gmail.com';
const CHEF_PASS    = 'Xsub6dfnv9!';

const https = require('node:https');

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(SUPABASE_URL + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey':        SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type':  'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const r = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  console.log('=== Supabase Setup ===\n');

  // 1. Check if chef user already exists
  console.log('1. Checking existing users...');
  const listRes = await req('GET', '/auth/v1/admin/users?per_page=100');
  if (listRes.status !== 200) {
    console.error('Failed to list users:', listRes.body);
    process.exit(1);
  }
  const users = listRes.body.users || [];
  const existing = users.find(u => u.email === CHEF_EMAIL);

  if (existing) {
    console.log(`   Chef account already exists (id: ${existing.id})`);
    console.log('\n2. Updating password...');
    const upRes = await req('PUT', `/auth/v1/admin/users/${existing.id}`, {
      password: CHEF_PASS,
      email_confirm: true
    });
    if (upRes.status === 200) {
      console.log('   Password updated successfully');
    } else {
      console.error('   Failed to update password:', upRes.body);
    }
  } else {
    console.log('   No existing chef account found');
    console.log('\n2. Creating chef account...');
    const createRes = await req('POST', '/auth/v1/admin/users', {
      email:         CHEF_EMAIL,
      password:      CHEF_PASS,
      email_confirm: true,    // skip email confirmation — admin created account
      user_metadata: { role: 'chef', username: 'chef' }
    });
    if (createRes.status === 201 || createRes.status === 200) {
      console.log(`   Chef account created! id: ${createRes.body.id}`);
    } else {
      console.error('   Failed to create chef account:', createRes.body);
      process.exit(1);
    }
  }

  // 3. Verify login works
  console.log('\n3. Testing login...');
  const loginRes = await req('POST', '/auth/v1/token?grant_type=password', {
    email:    CHEF_EMAIL,
    password: CHEF_PASS
  });
  if (loginRes.status === 200 && loginRes.body.access_token) {
    console.log('   Login test PASSED ✓');
    console.log(`   Username: chef`);
    console.log(`   Email:    ${CHEF_EMAIL}`);
    console.log(`   Password: ${CHEF_PASS}`);
  } else {
    console.error('   Login test FAILED:', loginRes.body);
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
