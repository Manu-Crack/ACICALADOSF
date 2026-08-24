import { createAdminClient } from "../src/lib/supabase/admin";

async function checkCols() {
  const admin = createAdminClient();
  const testCols = [
    "id", "employee_id", "block_date", "reason", "start_time", "end_time",
    "start_date", "end_date", "is_all_day", "permission_type", "status"
  ];
  for (const col of testCols) {
    const { error } = await admin.from("employee_blocks").select(col).limit(0);
    console.log(`Column ${col} in employee_blocks:`, error ? "NO: " + error.message : "YES");
  }
}

checkCols();
