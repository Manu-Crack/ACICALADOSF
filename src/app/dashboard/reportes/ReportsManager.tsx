"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { FullReportData } from "@/lib/types/reports";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from "@/lib/types/payments";
import { DailyClosingWhatsAppModal } from "./DailyClosingWhatsAppModal";

interface EmployeeOption {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
}

type PeriodType = "day" | "week" | "month" | "year" | "custom";
type ModuleFilter = "all" | "spa" | "barberia";

function getPeruDateString(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
  } catch {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

export function ReportsManager() {
  // Modal de Cierre de Caja WhatsApp
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Helpers de fechas y rangos (Zona Horaria Perú America/Lima)
  // ---------------------------------------------------------------------------
  const [currentDateReference, setCurrentDateReference] = useState<Date>(new Date());
  const [periodType, setPeriodType] = useState<PeriodType>("month");

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Calcular fechas basadas en periodType y currentDateReference en America/Lima
  const calculateDates = useCallback((type: PeriodType, refDate: Date) => {
    const todayStr = getPeruDateString(refDate);
    const [y, m, d] = todayStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);

    if (type === "day") {
      return { start: todayStr, end: todayStr };
    }

    if (type === "week") {
      const dayOfWeek = dt.getDay(); // 0 = Domingo, 1 = Lunes
      const diffToMonday = dt.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(y, m - 1, diffToMonday, 12, 0, 0);
      const sunday = new Date(y, m - 1, diffToMonday + 6, 12, 0, 0);
      return {
        start: getPeruDateString(monday),
        end: getPeruDateString(sunday),
      };
    }

    if (type === "month") {
      const monthStr = String(m).padStart(2, "0");
      const lastDay = new Date(y, m, 0, 12, 0, 0).getDate();
      return {
        start: `${y}-${monthStr}-01`,
        end: `${y}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
      };
    }

    if (type === "year") {
      return {
        start: `${y}-01-01`,
        end: `${y}-12-31`,
      };
    }

    return { start: "", end: "" };
  }, []);

  // Sincronizar fechas cuando cambia el periodo o la fecha de referencia
  useEffect(() => {
    if (periodType !== "custom") {
      const { start, end } = calculateDates(periodType, currentDateReference);
      setStartDate(start);
      setEndDate(end);
    }
  }, [periodType, currentDateReference, calculateDates]);

  // Navegación de periodos (Anterior / Siguiente / Hoy) en Perú
  const navigatePeriod = (direction: -1 | 1 | 0) => {
    if (direction === 0) {
      setCurrentDateReference(new Date());
      return;
    }

    const curPeruStr = getPeruDateString(currentDateReference);
    const [y, m, d] = curPeruStr.split("-").map(Number);
    const newDate = new Date(y, m - 1, d, 12, 0, 0);

    if (periodType === "day") {
      newDate.setDate(newDate.getDate() + direction);
    } else if (periodType === "week") {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else if (periodType === "month") {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (periodType === "year") {
      newDate.setFullYear(newDate.getFullYear() + direction);
    }
    setCurrentDateReference(newDate);
  };

  // Texto legible del periodo activo
  const periodLabel = useMemo(() => {
    const curPeruStr = getPeruDateString(currentDateReference);
    const [y, m, d] = curPeruStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);

    if (periodType === "day") {
      return dt.toLocaleDateString("es-PE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    if (periodType === "week") {
      const { start, end } = calculateDates("week", currentDateReference);
      return `Semana: ${start} al ${end}`;
    }
    if (periodType === "month") {
      return dt.toLocaleDateString("es-PE", {
        month: "long",
        year: "numeric",
      });
    }
    if (periodType === "year") {
      return `Año ${y}`;
    }
    return `${startDate || "Inicio"} — ${endDate || "Fin"}`;
  }, [periodType, currentDateReference, calculateDates, startDate, endDate]);

  // ---------------------------------------------------------------------------
  // Filtros secundarios
  // ---------------------------------------------------------------------------
  const [employeeId, setEmployeeId] = useState("all");
  const [bookingStatus, setBookingStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Pestaña principal activa
  const [activeMainTab, setActiveMainTab] = useState<
    "dashboard" | "reservas" | "pagos" | "empleados" | "egresos"
  >("dashboard");

  // Filtros de módulo para Ranking y Tabla de Auditoría
  const [topServicesModule, setTopServicesModule] = useState<ModuleFilter>("all");
  const [auditModuleFilter, setAuditModuleFilter] = useState<ModuleFilter>("all");
  const [auditSearchTerm, setAuditSearchTerm] = useState("");

  // ---------------------------------------------------------------------------
  // Estado de Datos
  // ---------------------------------------------------------------------------
  const [reportData, setReportData] = useState<FullReportData | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar lista de empleados
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch("/api/admin/employees");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setEmployees(data);
          } else if (data.employees && Array.isArray(data.employees)) {
            setEmployees(data.employees);
          }
        }
      } catch (err) {
        console.error("Error loading employees for reports:", err);
      }
    }
    loadEmployees();
  }, []);

  // Cargar datos completos del reporte
  const loadReportData = useCallback(async () => {
    if (!startDate && periodType !== "custom") return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (bookingStatus && bookingStatus !== "all") params.set("bookingStatus", bookingStatus);
      if (paymentStatus && paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
      if (employeeId && employeeId !== "all") params.set("employeeId", employeeId);
      if (paymentMethod && paymentMethod !== "all") params.set("paymentMethod", paymentMethod);
      if (searchTerm.trim()) params.set("searchTerm", searchTerm.trim());

      const res = await fetch(`/api/admin/reports/data?${params.toString()}`);
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "No se pudieron obtener los datos del reporte.");
        return;
      }

      setReportData(result.data);
    } catch {
      setError("Error de conexión al cargar los datos del reporte.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, bookingStatus, paymentStatus, employeeId, paymentMethod, searchTerm, periodType]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Exportar PDF
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (bookingStatus && bookingStatus !== "all") params.set("bookingStatus", bookingStatus);
      if (paymentStatus && paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
      if (employeeId && employeeId !== "all") params.set("employeeId", employeeId);
      if (paymentMethod && paymentMethod !== "all") params.set("paymentMethod", paymentMethod);
      if (searchTerm.trim()) params.set("searchTerm", searchTerm.trim());

      const url = `/api/admin/reports/export/pdf?${params.toString()}`;
      window.location.href = url;
    } catch (err) {
      console.error("Error exporting PDF:", err);
      alert("Error al descargar el archivo PDF.");
    } finally {
      setTimeout(() => setExportingPdf(false), 2000);
    }
  };

  const summary = reportData?.summary;

  // ---------------------------------------------------------------------------
  // Top Servicios Calculados y Filtrados por Módulo
  // ---------------------------------------------------------------------------
  const filteredTopServices = useMemo(() => {
    if (!reportData?.services_breakdown) return [];
    let items = reportData.services_breakdown;
    if (topServicesModule === "spa") {
      items = items.filter((s) => s.service_type === "spa");
    } else if (topServicesModule === "barberia") {
      items = items.filter((s) => s.service_type === "barberia");
    }
    return items.sort((a, b) => b.times_booked - a.times_booked || b.total_revenue_cents - a.total_revenue_cents);
  }, [reportData?.services_breakdown, topServicesModule]);

  const maxServiceBookings = useMemo(() => {
    if (!filteredTopServices.length) return 1;
    return Math.max(...filteredTopServices.map((s) => s.times_booked), 1);
  }, [filteredTopServices]);

  const totalFilteredServicesCount = useMemo(() => {
    return filteredTopServices.reduce((acc, curr) => acc + curr.times_booked, 0);
  }, [filteredTopServices]);

  // ---------------------------------------------------------------------------
  // Tabla de Auditoría Filtrada (Desglose de Servicios por Módulo)
  // ---------------------------------------------------------------------------
  const filteredAuditServices = useMemo(() => {
    if (!reportData?.completed_services_audit) return [];
    let items = reportData.completed_services_audit;

    if (auditModuleFilter === "spa") {
      items = items.filter((s) => s.service_type === "spa");
    } else if (auditModuleFilter === "barberia") {
      items = items.filter((s) => s.service_type === "barberia");
    }

    if (auditSearchTerm.trim()) {
      const term = auditSearchTerm.toLowerCase();
      items = items.filter(
        (s) =>
          s.service_name.toLowerCase().includes(term) ||
          s.employee_name.toLowerCase().includes(term) ||
          s.client_name.toLowerCase().includes(term) ||
          s.booking_code.toLowerCase().includes(term)
      );
    }

    return items;
  }, [reportData?.completed_services_audit, auditModuleFilter, auditSearchTerm]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 60 }}>
      {/* 1. Header & Export Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.6rem" }}>📊</span>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 900,
                margin: 0,
                color: "var(--color-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Panel Analítico & Reportes
            </h1>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: 4 }}>
            Inteligencia de negocio, segmentación Spa vs Barbería, ranking de servicios y auditoría financiera.
          </p>
        </div>

        {/* Botones de Acción y Exportación */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setIsClosingModalOpen(true)}
            className="btn btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              borderColor: "rgba(34, 197, 94, 0.5)",
              background: "rgba(34, 197, 94, 0.08)",
              color: "#22c55e",
              boxShadow: "0 2px 10px rgba(34, 197, 94, 0.15)",
            }}
            id="daily-closing-whatsapp-btn"
            title="Generar Reporte Acicalados del Día para WhatsApp"
          >
            <span>📱 Reporte acicalados del dia</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf || loading}
            className="btn btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
            }}
            id="export-pdf-btn"
          >
            {exportingPdf ? "Generando..." : "📄 Exportar PDF (.pdf)"}
          </button>
        </div>
      </div>

      {/* 2. Selector de Tiempo Global y Barra de Filtros */}
      <div
        className="card"
        style={{
          padding: "18px 20px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg, 12px)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Selector de Rango Rápido (Día, Semana, Mes, Año, Personalizado) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: 14,
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginRight: 4,
              }}
            >
              Filtro Temporal:
            </span>

            {[
              { id: "day", label: "📅 Día" },
              { id: "week", label: "📆 Semana" },
              { id: "month", label: "🗓️ Mes" },
              { id: "year", label: "📈 Año" },
              { id: "custom", label: "⚙️ Personalizado" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriodType(item.id as PeriodType)}
                className={`btn btn-sm ${
                  periodType === item.id ? "btn-primary" : "btn-ghost"
                }`}
                style={{
                  fontSize: "0.8rem",
                  padding: "5px 12px",
                  fontWeight: periodType === item.id ? 700 : 500,
                  borderRadius: "var(--radius-sm, 6px)",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Navegación Temporal (Anterior, Siguiente, Hoy) */}
          {periodType !== "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => navigatePeriod(-1)}
                className="btn btn-ghost btn-sm"
                style={{ padding: "4px 8px", fontSize: "0.85rem" }}
                title="Periodo anterior"
              >
                ◀
              </button>

              <div
                style={{
                  padding: "5px 14px",
                  background: "rgba(200, 164, 92, 0.12)",
                  border: "1px solid rgba(200, 164, 92, 0.3)",
                  borderRadius: "var(--radius-sm, 6px)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "var(--color-primary)",
                  textTransform: "capitalize",
                }}
              >
                {periodLabel}
              </div>

              <button
                type="button"
                onClick={() => navigatePeriod(1)}
                className="btn btn-ghost btn-sm"
                style={{ padding: "4px 8px", fontSize: "0.85rem" }}
                title="Periodo siguiente"
              >
                ▶
              </button>

              <button
                type="button"
                onClick={() => navigatePeriod(0)}
                className="btn btn-ghost btn-sm"
                style={{
                  padding: "4px 10px",
                  fontSize: "0.75rem",
                  color: "var(--color-text-muted)",
                }}
                title="Ir al periodo actual"
              >
                Hoy
              </button>

              {periodType === "day" && (
                <button
                  type="button"
                  onClick={() => setIsClosingModalOpen(true)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    fontSize: "0.75rem",
                    padding: "4px 10px",
                    color: "#22c55e",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    background: "rgba(34, 197, 94, 0.08)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Abrir Reporte Acicalados del Día para compartir por WhatsApp"
                >
                  <span>📱 Reporte acicalados del dia</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Inputs de Rango y Filtros Secundarios */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
          }}
        >
          {periodType === "custom" && (
            <>
              <div>
                <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>
                  Fecha Desde
                </label>
                <input
                  type="date"
                  className="input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: "100%", fontSize: "0.8rem", padding: "6px 8px" }}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  className="input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: "100%", fontSize: "0.8rem", padding: "6px 8px" }}
                />
              </div>
            </>
          )}

          <div>
            <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>
              Especialista
            </label>
            <select
              className="input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              style={{ width: "100%", fontSize: "0.8rem", padding: "6px 8px" }}
            >
              <option value="all">Todos los especialistas</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.position})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>
              Estado Reserva
            </label>
            <select
              className="input"
              value={bookingStatus}
              onChange={(e) => setBookingStatus(e.target.value)}
              style={{ width: "100%", fontSize: "0.8rem", padding: "6px 8px" }}
            >
              <option value="all">Todos los estados</option>
              <option value="confirmada">Confirmadas</option>
              <option value="completada">Completadas</option>
              <option value="pendiente">Pendientes</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>

          <div>
            <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>
              Estado de Pago
            </label>
            <select
              className="input"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              style={{ width: "100%", fontSize: "0.8rem", padding: "6px 8px" }}
            >
              <option value="all">Todos los pagos</option>
              <option value="total">Pagado completo (Verde)</option>
              <option value="parcial">Saldo pendiente (Amarillo)</option>
              <option value="sin_pago">Sin pago (Rojo)</option>
            </select>
          </div>

          <div>
            <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>
              Método de Pago
            </label>
            <select
              className="input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{ width: "100%", fontSize: "0.8rem", padding: "6px 8px" }}
            >
              <option value="all">Todos los métodos</option>
              <option value="yape">Solo Yape 💜</option>
              <option value="efectivo">Solo Efectivo 💵</option>
              <option value="transferencia">Solo Transferencia 🏦</option>
              <option value="mixto">Solo Mixto 🔄</option>
            </select>
          </div>
        </div>

        {/* Búsqueda rápida */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="text"
            className="input"
            placeholder="🔍 Buscar por código de cita (ej. AC-1234), cliente o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, fontSize: "0.82rem" }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="btn btn-ghost btn-sm"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* 3. Tarjetas de Segmentación Financiera (KPIs) */}
      {summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          {/* Total Ingresos Cobrados */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              background: "linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(34, 197, 94, 0.03) 100%)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              borderRadius: "var(--radius-md, 8px)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                }}
              >
                💵 Total Ingresos Cobrados
              </span>
              <span style={{ fontSize: "1.2rem" }}>💰</span>
            </div>
            <p
              style={{
                fontSize: "1.55rem",
                fontWeight: 900,
                color: "#22c55e",
                margin: "8px 0 2px",
                letterSpacing: "-0.02em",
              }}
            >
              S/ {(summary.total_collected_cents / 100).toFixed(2)}
            </p>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
              {summary.total_bookings} atenciones registradas
            </span>
          </div>

          {/* Ingresos Spa (Segmentación Exacta) */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              background: "linear-gradient(135deg, rgba(236, 72, 153, 0.12) 0%, rgba(236, 72, 153, 0.03) 100%)",
              border: "1px solid rgba(236, 72, 153, 0.35)",
              borderRadius: "var(--radius-md, 8px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  color: "#f472b6",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                }}
              >
                💆‍♀️ Ingresos Spa
              </span>
              <span
                className="badge"
                style={{
                  background: "rgba(236, 72, 153, 0.2)",
                  color: "#f472b6",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                }}
              >
                {summary.total_collected_cents > 0
                  ? `${Math.round(((summary.spa_collected_cents || 0) / summary.total_collected_cents) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <p
              style={{
                fontSize: "1.55rem",
                fontWeight: 900,
                color: "#f472b6",
                margin: "8px 0 2px",
                letterSpacing: "-0.02em",
              }}
            >
              S/ {((summary.spa_collected_cents || 0) / 100).toFixed(2)}
            </p>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
              {summary.spa_bookings_count || 0} atenciones en Spa
            </span>
          </div>

          {/* Ingresos Barbería (Segmentación Exacta) */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              background: "linear-gradient(135deg, rgba(200, 164, 92, 0.14) 0%, rgba(200, 164, 92, 0.03) 100%)",
              border: "1px solid rgba(200, 164, 92, 0.4)",
              borderRadius: "var(--radius-md, 8px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  color: "var(--color-primary)",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                }}
              >
                💈 Ingresos Barbería
              </span>
              <span
                className="badge"
                style={{
                  background: "rgba(200, 164, 92, 0.2)",
                  color: "var(--color-primary)",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                }}
              >
                {summary.total_collected_cents > 0
                  ? `${Math.round(((summary.barberia_collected_cents || 0) / summary.total_collected_cents) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <p
              style={{
                fontSize: "1.55rem",
                fontWeight: 900,
                color: "var(--color-primary)",
                margin: "8px 0 2px",
                letterSpacing: "-0.02em",
              }}
            >
              S/ {((summary.barberia_collected_cents || 0) / 100).toFixed(2)}
            </p>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
              {summary.barberia_bookings_count || 0} atenciones en Barbería
            </span>
          </div>

          {/* Egresos Operativos */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.03) 100%)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              borderRadius: "var(--radius-md, 8px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  color: "#f87171",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                }}
              >
                📉 Egresos Operativos
              </span>
              <span style={{ fontSize: "1.2rem" }}>💸</span>
            </div>
            <p
              style={{
                fontSize: "1.55rem",
                fontWeight: 900,
                color: "#ef4444",
                margin: "8px 0 2px",
                letterSpacing: "-0.02em",
              }}
            >
              S/ {(summary.total_expenses_cents / 100).toFixed(2)}
            </p>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
              {reportData?.expenses.length || 0} gastos registrados en el periodo
            </span>
          </div>

          {/* Resultado Neto / Ganancia */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              background:
                summary.net_result_cents >= 0
                  ? "linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.04) 100%)"
                  : "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.04) 100%)",
              border: `2px solid ${
                summary.net_result_cents >= 0 ? "rgba(34, 197, 94, 0.6)" : "rgba(239, 68, 68, 0.6)"
              }`,
              borderRadius: "var(--radius-md, 8px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  color: "var(--color-text)",
                  fontWeight: 900,
                  letterSpacing: "0.05em",
                }}
              >
                📈 GANANCIA NETA
              </span>
              <span style={{ fontSize: "1.2rem" }}>{summary.net_result_cents >= 0 ? "🏆" : "⚠️"}</span>
            </div>
            <p
              style={{
                fontSize: "1.6rem",
                fontWeight: 900,
                color: summary.net_result_cents >= 0 ? "#22c55e" : "#ef4444",
                margin: "8px 0 2px",
                letterSpacing: "-0.02em",
              }}
            >
              S/ {(summary.net_result_cents / 100).toFixed(2)}
            </p>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text)" }}>
              Ingresos Cobrados − Egresos
            </span>
          </div>
        </div>
      )}

      {/* Pestañas de Vistas */}
      <div
        style={{
          display: "flex",
          gap: 8,
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: 6,
          overflowX: "auto",
        }}
      >
        {[
          { id: "dashboard", label: "📊 Dashboard Analítico & Auditoría" },
          { id: "reservas", label: `📋 Reservas (${reportData?.bookings.length || 0})` },
          { id: "pagos", label: `💳 Registro de Pagos (${reportData?.payments.length || 0})` },
          { id: "empleados", label: `👥 Rendimiento de Personal (${reportData?.employees_breakdown.length || 0})` },
          { id: "egresos", label: `💸 Gastos & Egresos (${reportData?.expenses.length || 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveMainTab(tab.id as typeof activeMainTab)}
            className={`btn btn-sm ${activeMainTab === tab.id ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize: "0.82rem", padding: "6px 14px", fontWeight: 700 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido Principal */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</div>
          <p className="text-muted" style={{ fontWeight: 600 }}>
            Procesando y generando reporte analítico...
          </p>
        </div>
      ) : error ? (
        <div
          style={{
            padding: 18,
            borderRadius: "var(--radius-md)",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#f87171",
          }}
        >
          ❌ {error}
        </div>
      ) : !reportData ? null : (
        <>
          {/* TAB DASHBOARD ANALÍTICO (TOP SERVICIOS + TABLA DE AUDITORÍA) */}
          {activeMainTab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {/* 4. Top Servicios Más Realizados (Ranking y Gráfico Visual) */}
              <div
                className="card"
                style={{
                  padding: "22px 24px",
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg, 12px)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                {/* Header del Top Servicios con selector de rubro */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "1.25rem" }}>🔥</span>
                      <h3
                        style={{
                          fontSize: "1.15rem",
                          fontWeight: 800,
                          margin: 0,
                          color: "var(--color-text)",
                        }}
                      >
                        Top de Servicios Más Realizados
                      </h3>
                    </div>
                    <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", margin: "3px 0 0" }}>
                      Demanda y recaudación de servicios ordenados por cantidad de atenciones en el periodo activo.
                    </p>
                  </div>

                  {/* Selector de Rubro para el Gráfico */}
                  <div
                    style={{
                      display: "flex",
                      background: "rgba(255, 255, 255, 0.04)",
                      padding: 3,
                      borderRadius: "var(--radius-md, 8px)",
                      border: "1px solid var(--color-border)",
                      gap: 4,
                    }}
                  >
                    {[
                      { id: "all", label: "🌟 Todos" },
                      { id: "spa", label: "💆‍♀️ Spa" },
                      { id: "barberia", label: "💈 Barbería" },
                    ].map((mod) => (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => setTopServicesModule(mod.id as ModuleFilter)}
                        className={`btn btn-sm ${
                          topServicesModule === mod.id ? "btn-primary" : "btn-ghost"
                        }`}
                        style={{
                          fontSize: "0.76rem",
                          padding: "4px 10px",
                          fontWeight: topServicesModule === mod.id ? 700 : 500,
                        }}
                      >
                        {mod.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panel Gráfico de Barras y Ranking */}
                {filteredTopServices.length === 0 ? (
                  <div
                    style={{
                      padding: "36px 20px",
                      textAlign: "center",
                      color: "var(--color-text-muted)",
                      background: "rgba(255, 255, 255, 0.02)",
                      borderRadius: "var(--radius-md)",
                      border: "1px dashed var(--color-border)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "0.88rem" }}>
                      No se encontraron atenciones registradas para el rubro y periodo seleccionado.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {filteredTopServices.slice(0, 8).map((service, index) => {
                      const percentage = Math.round((service.times_booked / maxServiceBookings) * 100);
                      const shareOfTotal = totalFilteredServicesCount > 0
                        ? Math.round((service.times_booked / totalFilteredServicesCount) * 100)
                        : 0;

                      const isSpa = service.service_type === "spa";
                      const rankBadge =
                        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;

                      return (
                        <div
                          key={service.service_id || service.service_name}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            padding: "10px 14px",
                            background: "rgba(255, 255, 255, 0.02)",
                            borderRadius: "var(--radius-md, 8px)",
                            border: "1px solid rgba(255, 255, 255, 0.04)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span
                                style={{
                                  fontSize: "1rem",
                                  fontWeight: 800,
                                  minWidth: 26,
                                  color: index < 3 ? "var(--color-primary)" : "var(--color-text-muted)",
                                }}
                              >
                                {rankBadge}
                              </span>

                              <div>
                                <strong style={{ fontSize: "0.88rem", color: "var(--color-text)" }}>
                                  {service.service_name}
                                </strong>
                                <span
                                  className="badge"
                                  style={{
                                    marginLeft: 8,
                                    fontSize: "0.65rem",
                                    padding: "2px 6px",
                                    background: isSpa ? "rgba(236, 72, 153, 0.15)" : "rgba(200, 164, 92, 0.15)",
                                    color: isSpa ? "#f472b6" : "var(--color-primary)",
                                    borderColor: isSpa ? "rgba(236, 72, 153, 0.3)" : "rgba(200, 164, 92, 0.3)",
                                  }}
                                >
                                  {isSpa ? "💆‍♀️ Spa" : "💈 Barbería"}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                              <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                                <strong style={{ color: "var(--color-text)" }}>{service.times_booked}</strong>{" "}
                                {service.times_booked === 1 ? "atención" : "atenciones"} ({shareOfTotal}%)
                              </span>

                              <strong
                                style={{
                                  fontSize: "0.92rem",
                                  color: "var(--color-primary)",
                                  minWidth: 90,
                                  textAlign: "right",
                                }}
                              >
                                S/ {(service.total_revenue_cents / 100).toFixed(2)}
                              </strong>
                            </div>
                          </div>

                          {/* Barra de progreso visual con gradiente dinámico */}
                          <div
                            style={{
                              width: "100%",
                              height: 8,
                              background: "rgba(255, 255, 255, 0.06)",
                              borderRadius: 999,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${percentage}%`,
                                background: isSpa
                                  ? "linear-gradient(90deg, #ec4899, #f472b6)"
                                  : "linear-gradient(90deg, #C8A45C, #E5C378)",
                                borderRadius: 999,
                                transition: "width 0.4s ease-out",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 5. Desglose de Servicios por Módulo (Tabla de Auditoría) */}
              <div
                className="card"
                style={{
                  padding: "20px 22px",
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg, 12px)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {/* Header de la Tabla de Auditoría */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "1.25rem" }}>📋</span>
                      <h3
                        style={{
                          fontSize: "1.15rem",
                          fontWeight: 800,
                          margin: 0,
                          color: "var(--color-text)",
                        }}
                      >
                        Desglose de Servicios por Módulo (Auditoría)
                      </h3>
                    </div>
                    <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", margin: "3px 0 0" }}>
                      Historial detallado de cada servicio atendido, precio cobrado, especialista y canal de pago.
                    </p>
                  </div>

                  {/* Selector de Pestañas: Todos / Spa / Barbería */}
                  <div
                    style={{
                      display: "flex",
                      background: "rgba(255, 255, 255, 0.04)",
                      padding: 3,
                      borderRadius: "var(--radius-md, 8px)",
                      border: "1px solid var(--color-border)",
                      gap: 4,
                    }}
                  >
                    {[
                      { id: "all", label: `🌟 Todos (${reportData.completed_services_audit?.length || 0})` },
                      {
                        id: "spa",
                        label: `💆‍♀️ Spa (${
                          (reportData.completed_services_audit || []).filter((s) => s.service_type === "spa").length
                        })`,
                      },
                      {
                        id: "barberia",
                        label: `💈 Barbería (${
                          (reportData.completed_services_audit || []).filter((s) => s.service_type === "barberia").length
                        })`,
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAuditModuleFilter(tab.id as ModuleFilter)}
                        className={`btn btn-sm ${
                          auditModuleFilter === tab.id ? "btn-primary" : "btn-ghost"
                        }`}
                        style={{
                          fontSize: "0.76rem",
                          padding: "5px 12px",
                          fontWeight: auditModuleFilter === tab.id ? 700 : 500,
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buscador interno para la tabla */}
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="🔍 Filtrar servicios por nombre, especialista, cliente o código..."
                    value={auditSearchTerm}
                    onChange={(e) => setAuditSearchTerm(e.target.value)}
                    style={{ flex: 1, fontSize: "0.8rem", padding: "7px 10px" }}
                  />
                  {auditSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setAuditSearchTerm("")}
                      className="btn btn-ghost btn-sm"
                    >
                      ✕ Limpiar
                    </button>
                  )}
                </div>

                {/* Tabla de Detalle de Auditoría con Columnas Estrictas */}
                <div
                  style={{
                    overflowX: "auto",
                    borderRadius: "var(--radius-md, 8px)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr
                        style={{
                          background: "rgba(200, 164, 92, 0.08)",
                          borderBottom: "1px solid var(--color-border)",
                          textAlign: "left",
                        }}
                      >
                        <th style={{ padding: "12px 14px", fontWeight: 700 }}>Nombre del Servicio</th>
                        <th style={{ padding: "12px 14px", fontWeight: 700, textAlign: "right" }}>Precio Cobrado</th>
                        <th style={{ padding: "12px 14px", fontWeight: 700 }}>Personal Asignado</th>
                        <th style={{ padding: "12px 14px", fontWeight: 700 }}>Fecha Exacta</th>
                        <th style={{ padding: "12px 14px", fontWeight: 700 }}>Método(s) de Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAuditServices.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              padding: "36px 16px",
                              textAlign: "center",
                              color: "var(--color-text-muted)",
                            }}
                          >
                            No hay servicios para mostrar con los filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        filteredAuditServices.map((item) => {
                          const isSpa = item.service_type === "spa";
                          const methodKey = (item.payment_method || "").toLowerCase();
                          const methodIcon =
                            PAYMENT_METHOD_ICONS[methodKey as keyof typeof PAYMENT_METHOD_ICONS] ||
                            (methodKey === "cash" || methodKey === "efectivo"
                              ? "💵"
                              : methodKey === "yape"
                              ? "💜"
                              : methodKey === "mixed" || methodKey === "mixto"
                              ? "🔄"
                              : methodKey === "transfer" || methodKey === "transferencia"
                              ? "🏦"
                              : "💳");

                          const methodLabel =
                            PAYMENT_METHOD_LABELS[methodKey as keyof typeof PAYMENT_METHOD_LABELS] ||
                            (methodKey === "cash" || methodKey === "efectivo"
                              ? "Efectivo"
                              : methodKey === "yape"
                              ? "Yape"
                              : methodKey === "mixed" || methodKey === "mixto"
                              ? "Mixto"
                              : methodKey === "transfer" || methodKey === "transferencia"
                              ? "Transferencia"
                              : item.payment_method || "Sin registro");

                          return (
                            <tr
                              key={item.id}
                              style={{
                                borderBottom: "1px solid var(--color-border)",
                                transition: "background 0.15s ease",
                              }}
                            >
                              {/* 1. Nombre del Servicio */}
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span
                                    className="badge"
                                    style={{
                                      fontSize: "0.65rem",
                                      padding: "2px 6px",
                                      background: isSpa
                                        ? "rgba(236, 72, 153, 0.15)"
                                        : "rgba(200, 164, 92, 0.15)",
                                      color: isSpa ? "#f472b6" : "var(--color-primary)",
                                    }}
                                  >
                                    {isSpa ? "💆‍♀️ Spa" : "💈 Barbería"}
                                  </span>
                                  <strong style={{ color: "var(--color-text)" }}>{item.service_name}</strong>
                                </div>
                                <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
                                  Cita: <strong style={{ color: "var(--color-primary)" }}>{item.booking_code}</strong> · {item.client_name}
                                </span>
                              </td>

                              {/* 2. Precio Cobrado */}
                              <td
                                style={{
                                  padding: "12px 14px",
                                  textAlign: "right",
                                  fontWeight: 800,
                                  color: "#22c55e",
                                  fontSize: "0.9rem",
                                }}
                              >
                                S/ {(item.price_cents / 100).toFixed(2)}
                              </td>

                              {/* 3. Personal Asignado */}
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span>👤</span>
                                  <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                                    {item.employee_name}
                                  </span>
                                </div>
                              </td>

                              {/* 4. Fecha Exacta */}
                              <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                <div style={{ fontWeight: 600 }}>{item.booking_date}</div>
                                <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                                  ⏰ {item.start_time ? item.start_time.slice(0, 5) : "—"}
                                </span>
                              </td>

                              {/* 5. Método(s) de Pago Utilizado(s) */}
                              <td style={{ padding: "12px 14px" }}>
                                {item.payment_method ? (
                                  <span
                                    className="badge badge-neutral"
                                    style={{
                                      fontSize: "0.72rem",
                                      fontWeight: 600,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      background: "rgba(255, 255, 255, 0.06)",
                                      color: "var(--color-text)",
                                    }}
                                  >
                                    <span>{methodIcon}</span>
                                    <span>{methodLabel}</span>
                                  </span>
                                ) : (
                                  <span
                                    className="badge badge-error"
                                    style={{ fontSize: "0.68rem" }}
                                  >
                                    Sin método registrado
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RESERVAS */}
          {activeMainTab === "reservas" && (
            <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(200, 164, 92, 0.08)", borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "10px 12px" }}>Código</th>
                      <th style={{ padding: "10px 12px" }}>Cliente</th>
                      <th style={{ padding: "10px 12px" }}>Fecha / Hora</th>
                      <th style={{ padding: "10px 12px" }}>Empleado</th>
                      <th style={{ padding: "10px 12px" }}>Servicio(s)</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Total</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Cobrado</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Saldo</th>
                      <th style={{ padding: "10px 12px" }}>Pago (Método)</th>
                      <th style={{ padding: "10px 12px" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.bookings.map((b) => {
                      const isNoPayment = b.payment_status === "sin_pago" || (b.advance_amount_cents || 0) === 0;
                      const methodKey = (b.last_payment_method || "").toLowerCase();
                      const methodIcon =
                        PAYMENT_METHOD_ICONS[methodKey as keyof typeof PAYMENT_METHOD_ICONS] ||
                        (methodKey === "cash" || methodKey === "efectivo"
                          ? "💵"
                          : methodKey === "yape"
                          ? "💜"
                          : methodKey === "mixed" || methodKey === "mixto"
                          ? "🔄"
                          : methodKey === "transfer" || methodKey === "transferencia"
                          ? "🏦"
                          : "");

                      const methodLabel =
                        PAYMENT_METHOD_LABELS[methodKey as keyof typeof PAYMENT_METHOD_LABELS] ||
                        (methodKey === "cash" || methodKey === "efectivo"
                          ? "Efectivo"
                          : methodKey === "yape"
                          ? "Yape"
                          : methodKey === "mixed" || methodKey === "mixto"
                          ? "Mixto"
                          : methodKey === "transfer" || methodKey === "transferencia"
                          ? "Transferencia"
                          : b.last_payment_method || "");

                      const combinedPayText = isNoPayment
                        ? "SIN PAGO"
                        : b.payment_status === "parcial"
                        ? methodLabel ? `Adelanto - ${methodLabel}` : "Adelanto"
                        : methodLabel ? `Total - ${methodLabel}` : "Total";

                      return (
                        <tr key={b.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--color-primary)" }}>{b.booking_code}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <div>{b.client_name}</div>
                            {b.client_phone && <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>{b.client_phone}</span>}
                          </td>
                          <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                            {b.booking_date} · {b.start_time?.slice(0, 5)}
                          </td>
                          <td style={{ padding: "10px 12px" }}>{b.employee_name}</td>
                          <td style={{ padding: "10px 12px" }}>{b.service_names}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>
                            S/ {(b.total_price_cents / 100).toFixed(2)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-success)" }}>
                            S/ {(b.advance_amount_cents / 100).toFixed(2)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: b.balance_cents > 0 ? "#f59e0b" : "var(--color-success)" }}>
                            S/ {(b.balance_cents / 100).toFixed(2)}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              className={`badge ${
                                isNoPayment
                                  ? "badge-error"
                                  : b.payment_status === "total"
                                  ? "badge-success"
                                  : "badge-warning"
                              }`}
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              {!isNoPayment && methodIcon && <span>{methodIcon}</span>}
                              <span>{combinedPayText}</span>
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              className={`badge ${
                                b.booking_status === "confirmada"
                                  ? "badge-success"
                                  : b.booking_status === "completada"
                                  ? "badge-gold"
                                  : "badge-warning"
                              }`}
                              style={{ fontSize: "0.68rem" }}
                            >
                              {b.booking_status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PAGOS */}
          {activeMainTab === "pagos" && (
            <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(200, 164, 92, 0.08)", borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "10px 12px" }}>Cód. Cita</th>
                      <th style={{ padding: "10px 12px" }}>Cliente</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Monto</th>
                      <th style={{ padding: "10px 12px" }}>Canal</th>
                      <th style={{ padding: "10px 12px" }}>Estado</th>
                      <th style={{ padding: "10px 12px" }}>Fecha</th>
                      <th style={{ padding: "10px 12px" }}>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.payments.map((p) => {
                      const isVoided = p.status === "voided";
                      return (
                        <tr key={p.id} style={{ borderBottom: "1px solid var(--color-border)", opacity: isVoided ? 0.6 : 1 }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700 }}>{p.booking_code}</td>
                          <td style={{ padding: "10px 12px" }}>{p.client_name}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: isVoided ? "var(--color-text-muted)" : "var(--color-success)" }}>
                            S/ {(p.amount_cents / 100).toFixed(2)}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {p.payment_method === "yape" ? "💜 Yape" : p.payment_method === "cash" || p.payment_method === "efectivo" ? "💵 Efectivo" : p.payment_method === "transfer" || p.payment_method === "transferencia" ? "🏦 Transferencia" : "🔄 Mixto"}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span className={`badge ${isVoided ? "badge-error" : "badge-success"}`} style={{ fontSize: "0.68rem" }}>
                              {isVoided ? "Anulado" : "Verificado"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                            {p.paid_at ? new Date(p.paid_at).toLocaleDateString("es-PE") : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                            {p.notes || (isVoided && p.void_reason ? `🚫 ${p.void_reason}` : "—")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: EMPLEADOS */}
          {activeMainTab === "empleados" && (
            <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(200, 164, 92, 0.08)", borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "10px 14px" }}>Empleado</th>
                      <th style={{ padding: "10px 14px" }}>Cargo</th>
                      <th style={{ padding: "10px 14px", textAlign: "center" }}>Citas Asignadas</th>
                      <th style={{ padding: "10px 14px", textAlign: "center" }}>Completadas</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Ingresos Cobrados Asociados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.employees_breakdown.map((e) => (
                      <tr key={e.employee_id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700 }}>👤 {e.employee_name}</td>
                        <td style={{ padding: "10px 14px", color: "var(--color-text-muted)" }}>{e.position}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>{e.bookings_count}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "var(--color-success)", fontWeight: 700 }}>{e.completed_count}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "var(--color-primary)" }}>
                          S/ {(e.total_revenue_collected_cents / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: EGRESOS */}
          {activeMainTab === "egresos" && (
            <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(200, 164, 92, 0.08)", borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "10px 14px" }}>Fecha</th>
                      <th style={{ padding: "10px 14px" }}>Categoría</th>
                      <th style={{ padding: "10px 14px" }}>Descripción</th>
                      <th style={{ padding: "10px 14px" }}>Método</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Monto</th>
                      <th style={{ padding: "10px 14px" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.expenses.map((ex) => {
                      const isVoided = ex.status === "voided";
                      return (
                        <tr key={ex.id} style={{ borderBottom: "1px solid var(--color-border)", opacity: isVoided ? 0.6 : 1 }}>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{ex.expense_date}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span className="badge badge-neutral" style={{ fontSize: "0.72rem" }}>
                              {ex.category}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {ex.description}
                            {ex.supplier && <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}> · {ex.supplier}</span>}
                          </td>
                          <td style={{ padding: "10px 14px" }}>{ex.payment_method}</td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: isVoided ? "var(--color-text-muted)" : "#ef4444" }}>
                            S/ {(ex.amount_cents / 100).toFixed(2)}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span className={`badge ${isVoided ? "badge-error" : "badge-success"}`} style={{ fontSize: "0.68rem" }}>
                              {isVoided ? "Anulado" : "Activo"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Cierre de Caja Diario (WhatsApp) */}
      <DailyClosingWhatsAppModal
        isOpen={isClosingModalOpen}
        onClose={() => setIsClosingModalOpen(false)}
        initialDate={periodType === "day" ? startDate : undefined}
      />
    </div>
  );
}
