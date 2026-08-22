"use client";

import { useState, useEffect, useCallback } from "react";
import type { FullReportData } from "@/lib/types/reports";

interface EmployeeOption {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
}

export function ReportsManager() {
  // Helpers para rangos de fecha rápidos
  const getTodayStr = () => new Date().toISOString().split("T")[0];
  const getFirstDayOfMonthStr = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  };
  const getFirstDayOfPrevMonthStr = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  };
  const getLastDayOfPrevMonthStr = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
  };
  const getStartOfWeekStr = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split("T")[0];
  };

  // Estados de filtro
  const [periodShortcut, setPeriodShortcut] = useState<string>("this_month");
  const [startDate, setStartDate] = useState(getFirstDayOfMonthStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [bookingStatus, setBookingStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [employeeId, setEmployeeId] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<"reservas" | "pagos" | "servicios" | "empleados" | "egresos">("reservas");

  // Datos
  const [reportData, setReportData] = useState<FullReportData | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar lista de empleados para el selector
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch("/api/admin/employees");
        if (res.ok) {
          const data = await res.json();
          if (data.employees) setEmployees(data.employees);
        }
      } catch (err) {
        console.error("Error loading employees for reports:", err);
      }
    }
    loadEmployees();
  }, []);

  // Manejar atajos de periodo
  const handlePeriodChange = (shortcut: string) => {
    setPeriodShortcut(shortcut);
    const today = getTodayStr();
    if (shortcut === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (shortcut === "this_week") {
      setStartDate(getStartOfWeekStr());
      setEndDate(today);
    } else if (shortcut === "this_month") {
      setStartDate(getFirstDayOfMonthStr());
      setEndDate(today);
    } else if (shortcut === "prev_month") {
      setStartDate(getFirstDayOfPrevMonthStr());
      setEndDate(getLastDayOfPrevMonthStr());
    } else if (shortcut === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  // Cargar datos completos del reporte
  const loadReportData = useCallback(async () => {
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
  }, [startDate, endDate, bookingStatus, paymentStatus, employeeId, paymentMethod, searchTerm]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Exportar Excel
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (bookingStatus && bookingStatus !== "all") params.set("bookingStatus", bookingStatus);
      if (paymentStatus && paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
      if (employeeId && employeeId !== "all") params.set("employeeId", employeeId);
      if (paymentMethod && paymentMethod !== "all") params.set("paymentMethod", paymentMethod);
      if (searchTerm.trim()) params.set("searchTerm", searchTerm.trim());

      const url = `/api/admin/reports/export/excel?${params.toString()}`;
      window.location.href = url;
    } catch (err) {
      console.error("Error exporting Excel:", err);
      alert("Error al descargar el archivo Excel.");
    } finally {
      setTimeout(() => setExportingExcel(false), 2000);
    }
  };

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Header & Export Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 900, margin: 0, color: "var(--color-primary)" }}>
            📊 Reportes Financieros y Operativos
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: 4 }}>
            Control exhaustivo de ingresos cobrados, adelantos, saldos, egresos y exportación en Excel / PDF
          </p>
        </div>

        {/* Botones de Exportación */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel || loading}
            className="btn btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              borderColor: "rgba(34, 197, 94, 0.4)",
              color: "#22c55e",
            }}
            id="export-excel-btn"
          >
            {exportingExcel ? "Generando..." : "📊 Exportar Excel (.xlsx)"}
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

      {/* Controles de Filtro */}
      <div
        className="card"
        style={{
          padding: "18px 20px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Atajos de Periodo */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
            Periodo:
          </span>
          {[
            { id: "today", label: "Hoy" },
            { id: "this_week", label: "Esta semana" },
            { id: "this_month", label: "Este mes" },
            { id: "prev_month", label: "Mes anterior" },
            { id: "all", label: "Todo" },
            { id: "custom", label: "Personalizado" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handlePeriodChange(item.id)}
              className={`btn btn-sm ${periodShortcut === item.id ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: "0.78rem", padding: "4px 10px" }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Inputs de Rango y Filtros Operativos */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <div>
            <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>Fecha Desde</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodShortcut("custom");
              }}
              style={{ width: "100%", fontSize: "0.8rem", padding: "6px 8px" }}
            />
          </div>

          <div>
            <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>Fecha Hasta</label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodShortcut("custom");
              }}
              style={{ width: "100%", fontSize: "0.8rem", padding: "6px 8px" }}
            />
          </div>

          <div>
            <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>Especialista (Individual)</label>
            <select
              className="input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              style={{ width: "100%", fontSize: "0.8rem", padding: "6px 8px" }}
            >
              <option value="all">Todos los empleados</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.position})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>Estado Reserva</label>
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
            <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>Estado Pago</label>
            <select
              className="input"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              style={{ width: "100%", fontSize: "0.8rem", padding: "6px 8px" }}
            >
              <option value="all">Todos los pagos</option>
              <option value="total">Pagado completo</option>
              <option value="parcial">Adelanto (25%)</option>
              <option value="sin_pago">Sin pago</option>
            </select>
          </div>

          <div>
            <label className="label" style={{ fontSize: "0.72rem", marginBottom: 2 }}>Canal de Pago</label>
            <select
              className="input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{ width: "100%", fontSize: "0.8rem", padding: "6px 8px" }}
            >
              <option value="all">Todos los canales</option>
              <option value="yape">Solo Yape 💜</option>
              <option value="cash">Solo Efectivo 💵</option>
              <option value="mixed">Solo Mixto 🔄</option>
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

      {/* Grid de KPIs Financieros */}
      {summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          {/* Ingresos Cobrados */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              background: "rgba(34, 197, 94, 0.06)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontWeight: 700 }}>
              💵 Ingresos Cobrados (Real)
            </span>
            <p style={{ fontSize: "1.45rem", fontWeight: 900, color: "#22c55e", margin: "6px 0 0" }}>
              S/ {(summary.total_collected_cents / 100).toFixed(2)}
            </p>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
              Dinero verificado y recibido en caja
            </span>
          </div>

          {/* Por Yape */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              background: "rgba(106, 27, 154, 0.06)",
              border: "1px solid rgba(106, 27, 154, 0.25)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontWeight: 700 }}>
              💜 Cobrado por Yape
            </span>
            <p style={{ fontSize: "1.45rem", fontWeight: 900, color: "#a855f7", margin: "6px 0 0" }}>
              S/ {(summary.yape_collected_cents / 100).toFixed(2)}
            </p>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
              Transferencias QR directas
            </span>
          </div>

          {/* En Efectivo */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              background: "rgba(200, 164, 92, 0.06)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontWeight: 700 }}>
              💵 Cobrado en Efectivo
            </span>
            <p style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--color-primary)", margin: "6px 0 0" }}>
              S/ {(summary.cash_collected_cents / 100).toFixed(2)}
            </p>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
              Efectivo en local
            </span>
          </div>

          {/* Saldos Pendientes */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              background: "rgba(245, 158, 11, 0.06)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontWeight: 700 }}>
              ⏳ Saldos Pendientes
            </span>
            <p style={{ fontSize: "1.45rem", fontWeight: 900, color: "#f59e0b", margin: "6px 0 0" }}>
              S/ {(summary.pending_balance_cents / 100).toFixed(2)}
            </p>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
              Por cobrar en reservas activas
            </span>
          </div>

          {/* Egresos Operativos */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              background: "rgba(239, 68, 68, 0.06)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontWeight: 700 }}>
              📉 Egresos Operativos
            </span>
            <p style={{ fontSize: "1.45rem", fontWeight: 900, color: "#ef4444", margin: "6px 0 0" }}>
              S/ {(summary.total_expenses_cents / 100).toFixed(2)}
            </p>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
              Costos y compras del negocio
            </span>
          </div>

          {/* Resultado Neto */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              background: summary.net_result_cents >= 0 ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
              border: `2px solid ${summary.net_result_cents >= 0 ? "#22c55e" : "#ef4444"}`,
              borderRadius: "var(--radius-md)",
            }}
          >
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--color-text)", fontWeight: 800 }}>
              📈 RESULTADO NETO
            </span>
            <p
              style={{
                fontSize: "1.55rem",
                fontWeight: 900,
                color: summary.net_result_cents >= 0 ? "#22c55e" : "#ef4444",
                margin: "6px 0 0",
              }}
            >
              S/ {(summary.net_result_cents / 100).toFixed(2)}
            </p>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--color-text)" }}>
              Ingresos Cobrados − Egresos
            </span>
          </div>
        </div>
      )}

      {/* Pestañas de Visualización */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--color-border)", paddingBottom: 6, overflowX: "auto" }}>
        {([
          { id: "reservas", label: `📋 Reservas (${reportData?.bookings.length || 0})` },
          { id: "pagos", label: `💳 Pagos (${reportData?.payments.length || 0})` },
          { id: "servicios", label: `✂️ Servicios (${reportData?.services_breakdown.length || 0})` },
          { id: "empleados", label: `👥 Empleados (${reportData?.employees_breakdown.length || 0})` },
          { id: "egresos", label: `💸 Egresos (${reportData?.expenses.length || 0})` },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`btn btn-sm ${activeTab === tab.id ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize: "0.82rem", padding: "6px 14px" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido de Pestañas */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <p className="text-muted">Procesando y generando reporte...</p>
        </div>
      ) : error ? (
        <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}>
          ❌ {error}
        </div>
      ) : !reportData ? null : (
        <div>
          {/* TAB 1: RESERVAS */}
          {activeTab === "reservas" && (
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
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Adelanto</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Saldo</th>
                      <th style={{ padding: "10px 12px" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.bookings.map((b) => (
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
                        <td style={{ padding: "10px 12px", textAlign: "right", color: b.balance_cents > 0 ? "#ef4444" : "var(--color-success)" }}>
                          S/ {(b.balance_cents / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span className={`badge ${b.booking_status === "confirmada" ? "badge-success" : b.booking_status === "completada" ? "badge-gold" : "badge-warning"}`} style={{ fontSize: "0.68rem" }}>
                            {b.booking_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PAGOS */}
          {activeTab === "pagos" && (
            <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(200, 164, 92, 0.08)", borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "10px 12px" }}>Cód. Cita</th>
                      <th style={{ padding: "10px 12px" }}>Cliente</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Monto</th>
                      <th style={{ padding: "10px 12px" }}>Canal</th>
                      <th style={{ padding: "10px 12px" }}>Tipo</th>
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
                            {p.payment_method === "yape" ? "💜 Yape" : p.payment_method === "cash" ? "💵 Efectivo" : "🔄 Mixto"}
                          </td>
                          <td style={{ padding: "10px 12px" }}>{p.payment_type}</td>
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

          {/* TAB 3: SERVICIOS */}
          {activeTab === "servicios" && (
            <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(200, 164, 92, 0.08)", borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "10px 14px" }}>Servicio</th>
                      <th style={{ padding: "10px 14px" }}>Categoría</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Precio Lista</th>
                      <th style={{ padding: "10px 14px", textAlign: "center" }}>Veces Reservado</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Total Generado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.services_breakdown.map((s) => (
                      <tr key={s.service_id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700 }}>{s.service_name}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span className="badge badge-neutral" style={{ fontSize: "0.72rem" }}>
                            {s.service_type}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          S/ {(s.price_cents / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700 }}>
                          {s.times_booked}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "var(--color-primary)" }}>
                          S/ {(s.total_revenue_cents / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: EMPLEADOS */}
          {activeTab === "empleados" && (
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
          {activeTab === "egresos" && (
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
        </div>
      )}
    </div>
  );
}
