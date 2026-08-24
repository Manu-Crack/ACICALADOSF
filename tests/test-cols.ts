import { createAdminClient } from "../src/lib/supabase/admin";

async function testCols() {
  const admin = createAdminClient();
  
  // Test if bonus_minutes column exists by selecting it
  const { data, error } = await admin.from("employee_attendances").select("id, bonus_minutes").limit(1);
  console.log("Select bonus_minutes:", { data, error });

  // Test if bonus_settings table exists
  const { data: bData, error: bErr } = await admin.from("bonus_settings").select("*").limit(1);
  console.log("Select bonus_settings:", { bData, bErr });
}

testCols();
