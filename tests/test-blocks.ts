import { createAdminClient } from "../src/lib/supabase/admin";

async function testBlocks() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("employee_blocks").select("*").limit(1);
  console.log("Blocks sample:", { data, error });
  if (data && data.length > 0) {
    console.log("Blocks columns:", Object.keys(data[0]));
  }
}

testBlocks();
