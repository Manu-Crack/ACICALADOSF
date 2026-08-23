export default function DashboardLoading() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1400,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        animation: "dashboardFadeIn 0.2s ease-in-out",
      }}
      aria-label="Cargando módulo..."
      role="status"
    >
      <style>{`
        @keyframes dashboardSkeletonPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.75; }
        }
        @keyframes dashboardFadeIn {
          from { opacity: 0.4; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dash-skeleton {
          background: linear-gradient(90deg, rgba(200, 164, 92, 0.06) 0%, rgba(200, 164, 92, 0.14) 50%, rgba(200, 164, 92, 0.06) 100%);
          background-size: 200% 100%;
          border-radius: var(--radius-sm, 6px);
          animation: dashboardSkeletonPulse 1.4s ease-in-out infinite;
        }
      `}</style>

      {/* Header Skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="dash-skeleton" style={{ width: 220, height: 32, borderRadius: 8 }} />
          <div className="dash-skeleton" style={{ width: 340, height: 16 }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="dash-skeleton" style={{ width: 110, height: 36, borderRadius: 6 }} />
          <div className="dash-skeleton" style={{ width: 130, height: 36, borderRadius: 6 }} />
        </div>
      </div>

      {/* Stats Cards Skeleton Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "rgba(18, 16, 12, 0.7)",
              border: "1px solid rgba(200, 164, 92, 0.12)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="dash-skeleton" style={{ width: 90, height: 14 }} />
              <div className="dash-skeleton" style={{ width: 28, height: 28, borderRadius: "50%" }} />
            </div>
            <div className="dash-skeleton" style={{ width: 140, height: 28, borderRadius: 6 }} />
            <div className="dash-skeleton" style={{ width: 110, height: 12 }} />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div
        className="card card-gold"
        style={{
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          background: "rgba(18, 16, 12, 0.75)",
          border: "1px solid rgba(200, 164, 92, 0.2)",
          minHeight: 380,
        }}
      >
        {/* Table / Panel Filter Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div className="dash-skeleton" style={{ width: 260, height: 38, borderRadius: 6 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <div className="dash-skeleton" style={{ width: 90, height: 36, borderRadius: 6 }} />
            <div className="dash-skeleton" style={{ width: 90, height: 36, borderRadius: 6 }} />
          </div>
        </div>

        {/* Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderRadius: 6,
                background: "rgba(200, 164, 92, 0.03)",
                border: "1px solid rgba(200, 164, 92, 0.08)",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <div className="dash-skeleton" style={{ width: 34, height: 34, borderRadius: "50%" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <div className="dash-skeleton" style={{ width: "40%", height: 16 }} />
                  <div className="dash-skeleton" style={{ width: "25%", height: 12 }} />
                </div>
              </div>
              <div className="dash-skeleton" style={{ width: 80, height: 22, borderRadius: 12 }} />
              <div className="dash-skeleton" style={{ width: 70, height: 20 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
