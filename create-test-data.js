const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function createTestData() {
  console.log("Creating Test Business 1...");
  const res1 = await supabase.auth.signUp({
    email: 'alpha_store@example.com',
    password: 'password123',
    options: { data: { full_name: 'Alpha Electronics' } }
  });
  console.log("Alpha Store:", res1.error ? res1.error.message : "Success");

  console.log("Creating Test Business 2...");
  const res2 = await supabase.auth.signUp({
    email: 'beta_cafe@example.com',
    password: 'password123',
    options: { data: { full_name: 'Beta Cafe' } }
  });
  console.log("Beta Cafe:", res2.error ? res2.error.message : "Success");

  console.log("Creating Test Business 3...");
  const res3 = await supabase.auth.signUp({
    email: 'gamma_logistics@example.com',
    password: 'password123',
    options: { data: { full_name: 'Gamma Logistics' } }
  });
  console.log("Gamma Logistics:", res3.error ? res3.error.message : "Success");
}

createTestData();
