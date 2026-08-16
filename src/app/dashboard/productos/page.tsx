import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProductManager } from "./ProductManager";

export const metadata = {
  title: "Gestión de Productos — Acicalados",
  description: "Panel administrativo para gestionar el catálogo de productos de Acicalados.",
};

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "recepcionista"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Fetch initial products
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return <ProductManager initialProducts={products || []} />;
}
