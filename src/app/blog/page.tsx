import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata = {
  title: "Blog — Acicalados Spa & Barber Shop",
  description: "Consejos de belleza, tendencias y novedades del mundo del cuidado personal.",
};

export default async function BlogPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 100 }}>
        <section className="section">
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <span className="badge badge-gold">Blog</span>
              <h1 className="heading-lg" style={{ marginTop: 16, marginBottom: 8 }}>
                Nuestro <span className="text-gold">Blog</span>
              </h1>
              <div className="divider-gold" style={{ margin: "16px auto" }} />
              <p className="text-muted" style={{ maxWidth: 480, margin: "0 auto" }}>
                Consejos, tendencias y novedades del mundo de la belleza y el cuidado personal.
              </p>
            </div>

            {posts && posts.length > 0 ? (
              <div className="grid grid-3">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <article className="card card-gold" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "16/9",
                          borderRadius: "var(--radius-md)",
                          marginBottom: 16,
                          background:
                            post.cover_image
                              ? `url(${post.cover_image}) center/cover`
                              : "linear-gradient(135deg, var(--color-bg), rgba(200,164,92,0.1))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {!post.cover_image && (
                          <span style={{ fontSize: "2rem", opacity: 0.3 }}>📝</span>
                        )}
                      </div>
                      <h3 className="heading-sm" style={{ marginBottom: 8 }}>
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-muted" style={{ fontSize: "0.875rem", lineHeight: 1.6, flex: 1 }}>
                          {post.excerpt}
                        </p>
                      )}
                      {post.published_at && (
                        <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 12 }}>
                          {new Date(post.published_at).toLocaleDateString("es-PE", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </article>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p className="text-muted" style={{ fontSize: "1.125rem" }}>
                  Próximamente publicaremos artículos. ¡Mantente atento!
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
