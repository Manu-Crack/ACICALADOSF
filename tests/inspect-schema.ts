import { createAdminClient } from "../src/lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("employee_attendances").select("*").limit(1);
  if (error) {
    console.error("Error querying employee_attendances:", error);
  } else {
    console.log("Sample employee_attendances row:", data);
    if (data && data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    }
  }
}

main();
