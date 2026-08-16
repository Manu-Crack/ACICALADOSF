import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BlogManager } from "./BlogManager";

export const metadata = {
  title: "Gestión de Blog — Acicalados",
  description: "Panel administrativo para publicar y gestionar artículos editoriales de Acicalados.",
};

export default async function AdminBlogPage() {
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

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch initial blog posts
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return <BlogManager initialPosts={posts || []} />;
}
