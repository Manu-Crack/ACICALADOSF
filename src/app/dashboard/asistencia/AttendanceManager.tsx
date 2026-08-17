"use client";

import { useState, useEffect, useCallback } from "react";
import { AttendanceQRScannerModal } from "./AttendanceQRScannerModal";
import { EmployeeQRBadgeModal } from "./EmployeeQRBadgeModal";
import { EmployeeHistoryModal } from "./EmployeeHistoryModal";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  type: "spa" | "barberia";
  is_active: boolean;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  status: string;
  notes: string | null;
}

interface BlockRecord {
  id: string;
  employee_id: string;
  block_date: string;
  reason: string;
  start_time: string | null;
  end_time: string | null;
}

export function AttendanceManager() {
  // Filters
  const [typeFilter, setTypeFilter] = useState<"all" | "spa" | "barberia">("all");
  const [rangeMode, setRangeMode] = useState<"day" | "week" | "month" | "year">("day");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear())
  );
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Data state
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);

  // Modals state
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [selectedQrEmployee, setSelectedQrEmployee] = useState<Employee | null>(null);
  const [selectedHistoryEmployee, setSelectedHistoryEmployee] = useState<Employee | null>(null);

  // Manual attendance edit modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEmployee, setManualEmployee] = useState<Employee | null>(null);
  const [manualDate, setManualDate] = useState<string>(selectedDate);
  const [manualCheckIn, setManualCheckIn] = useState<string>("09:00");
  const [manualCheckOut, setManualCheckOut] = useState<string>("18:00");
  const [manualNotes, setManualNotes] = useState<string>("");
  const [savingManual, setSavingManual] = useState(false);

  // Compute start/end dates
  const computeDates = useCallback(() => {
    if (rangeMode === "day") {
      return { start: selectedDate, end: selectedDate };
    }
    if (rangeMode === "week") {
      const cur = new Date(selectedDate);
      const day = cur.getDay();
      const diffToMonday = cur.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(cur.setDate(diffToMonday));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        start: monday.toISOString().split("T")[0],
        end: sunday.toISOString().split("T")[0],
      };
    }
    if (rangeMode === "month") {
      const [year, month] = selectedMonth.split("-");
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      return {
        start: `${selectedMonth}-01`,
        end: `${selectedMonth}-${String(lastDay).padStart(2, "0")}`,
      };
    }
    return {
      start: `${selectedYear}-01-01`,
      end: `${selectedYear}-12-31`,
    };
  }, [rangeMode, selectedDate, selectedMonth, selectedYear]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = computeDates();
      const res = await fetch(
        `/api/admin/attendance?type=${typeFilter}&start_date=${start}&end_date=${end}`
      );
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
        setAttendances(data.attendances || []);
        setBlocks(data.blocks || []);
      }
    } catch (err) {
      console.error("Error loading attendance data:", err);
    } finally {
      setLoading(false);
    }
  }, [computeDates, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Manual Modal
  function handleOpenManualModal(emp: Employee) {
    setManualEmployee(emp);
    setManualDate(selectedDate);
    setManualCheckIn("09:00");
    setManualCheckOut("18:00");
    setManualNotes("Ajuste manual administrativo");
    setShowManualModal(true);
  }

  // Save Manual Attendance
  async function handleSaveManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualEmployee || !manualDate || !manualCheckIn) return;

    setSavingManual(true);
    try {
      const checkInISO = `${manualDate}T${manualCheckIn}:00-05:00`;
      const checkOutISO = manualCheckOut ? `${manualDate}T${manualCheckOut}:00-05:00` : null;

      const res = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: manualEmployee.id,
          date: manualDate,
          check_in: checkInISO,
          check_out: checkOutISO,
          status: "presente",
          notes: manualNotes,
        }),
      });

      if (res.ok) {
        setShowManualModal(false);
        loadData();
      } else {
        const errData = await res.json();
        alert(errData.error || "No se pudo guardar la asistencia manual");
      }
    } catch {
      alert("Error al conectar con el servidor.");
    } finally {
      setSavingManual(false);
    }
  }

  // Formatting helpers
  function formatTime(isoString: string | null) {
    if (!isoString) return "—";
    try {
      return new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  }

  function calculateDuration(checkIn: string, checkOut: string | null) {
    if (!checkIn || !checkOut) return "—";
    try {
      const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
      if (diffMs <= 0) return "—";
      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}h ${minutes}m`;
    } catch {
      return "—";
    }
  }

  // Filter employees by search term
  const filteredEmployees = employees.filter((emp) => {
    if (typeFilter !== "all" && emp.type !== typeFilter) return false;
    if (!searchTerm) return true;
    const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  // Calculate high-level stats for the current view
  const activeEmployees = employees.filter((e) => e.is_active);
  const activeCount = activeEmployees.length;
  const presentCount = activeEmployees.filter((e) =>
    attendances.some((a) => a.employee_id === e.id)
  ).length;
  const blockCount = activeEmployees.filter((e) =>
    blocks.some((b) => b.employee_id === e.id)
  ).length;
  const absentCount = Math.max(0, activeCount - presentCount - blockCount);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60, width: "100%", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Header & Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 className="heading-lg" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span>📋</span> Control de <span className="text-gold">Asistencia</span> y QR
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: 4 }}>
            Supervisa las entradas, salidas y permisos del personal en tiempo real mediante escaneo de código QR.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <span>📷</span> Abrir Escáner QR
          </button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 14,
        }}
      >
        {/* Card 1: Presentes */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            borderLeft: "4px solid var(--color-success)",
            background: "rgba(106, 153, 78, 0.08)",
          }}
        >
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-dim)", fontWeight: 700 }}>
            🟢 Presentes {rangeMode === "day" ? "Hoy" : "en Período"}
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-success)" }}>
              {presentCount}
            </span>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
              / {activeCount} activos
            </span>
          </div>
        </div>

        {/* Card 2: Permisos Justificados */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            borderLeft: "4px solid var(--color-primary)",
            background: "rgba(200, 164, 92, 0.08)",
          }}
        >
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-dim)", fontWeight: 700 }}>
            🟡 Permisos Justificados
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-primary)" }}>
              {blockCount}
            </span>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
              permisos
            </span>
          </div>
        </div>

        {/* Card 3: Sin Marcar / Faltas */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            borderLeft: "4px solid var(--color-error)",
            background: "rgba(184, 59, 46, 0.08)",
          }}
        >
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-dim)", fontWeight: 700 }}>
            🔴 Sin Registro / Faltas
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-error)" }}>
              {absentCount}
            </span>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
              personal
            </span>
          </div>
        </div>

        {/* Card 4: Total Personal */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            borderLeft: "4px solid rgba(200, 164, 92, 0.5)",
          }}
        >
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-dim)", fontWeight: 700 }}>
            👥 Total Personal
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#ffffff" }}>
              {employees.length}
            </span>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
              ({employees.filter((e) => e.type === "spa").length} Spa · {employees.filter((e) => e.type === "barberia").length} Barb.)
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Toolbar Box */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Specialty Filter & Temporal Range Tabs */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          {/* Specialty Filter: Todos / Spa / Barbería */}
          <div style={{ display: "flex", gap: 8 }}>
            {(["all", "barberia", "spa"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTypeFilter(f)}
                className={typeFilter === f ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {f === "barberia" && (
                  <img src="/LogoBarberia.svg" alt="Barbería" style={{ height: 14, width: "auto" }} />
                )}
                {f === "spa" && (
                  <img src="/LogoSpa.svg" alt="Spa" style={{ height: 14, width: "auto" }} />
                )}
                {f === "all" ? "Todos" : f === "barberia" ? "Barbería" : "Spa"}
              </button>
            ))}
          </div>

          {/* Temporal Range Tabs: Día / Semana / Mes / Año */}
          <div style={{ display: "inline-flex", background: "rgba(200,164,92,0.08)", borderRadius: "var(--radius-sm)", padding: 3, gap: 4 }}>
            {(["day", "week", "month", "year"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setRangeMode(m)}
                style={{
                  border: "none",
                  background: rangeMode === m ? "var(--color-primary)" : "transparent",
                  color: rangeMode === m ? "#120f0a" : "var(--color-text-muted)",
                  fontWeight: rangeMode === m ? 700 : 500,
                  fontSize: "0.8125rem",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {m === "day" ? "Día" : m === "week" ? "Semana" : m === "month" ? "Mes" : "Año"}
              </button>
            ))}
          </div>
        </div>

        {/* Date Selector and Search Input */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
          {/* Date Selector input based on range */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", fontWeight: 600 }}>
              Fecha a consultar:
            </span>
            {rangeMode === "day" || rangeMode === "week" ? (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input"
                style={{ padding: "6px 12px", fontSize: "0.875rem", width: "auto" }}
              />
            ) : rangeMode === "month" ? (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input"
                style={{ padding: "6px 12px", fontSize: "0.875rem", width: "auto" }}
              />
            ) : (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="select"
                style={{ padding: "6px 12px", fontSize: "0.875rem", width: "auto" }}
              >
                {["2025", "2026", "2027"].map((y) => (
                  <option key={y} value={y}>
                    Año {y}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Search bar */}
          <div style={{ position: "relative", minWidth: 240, maxWidth: 360, width: "100%" }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-text-dim)",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="Buscar trabajador por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
              style={{ paddingLeft: 36, fontSize: "0.875rem", padding: "8px 12px 8px 36px" }}
            />
          </div>
        </div>
      </div>

      {/* Main Attendance Table with internal scroll */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <p className="text-muted">Cargando registros de asistencia...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>👥</div>
          <p className="text-muted" style={{ margin: 0 }}>
            No se encontraron empleados registrados con los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden", width: "100%" }}>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
            <table style={{ width: "100%", minWidth: "860px", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr
                  style={{
                    background: "rgba(200, 164, 92, 0.06)",
                    borderBottom: "1px solid var(--color-border)",
                    color: "var(--color-text-dim)",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  <th style={{ padding: "14px 16px" }}>Trabajador</th>
                  <th style={{ padding: "14px 16px" }}>Especialidad</th>
                  <th style={{ padding: "14px 16px" }}>Estado Asistencia</th>
                  <th style={{ padding: "14px 16px" }}>Entrada (Check-In)</th>
                  <th style={{ padding: "14px 16px" }}>Salida (Check-Out)</th>
                  <th style={{ padding: "14px 16px" }}>Tiempo Trabajado</th>
                  <th style={{ padding: "14px 16px", textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const empAttendance = attendances.find((a) => a.employee_id === emp.id);
                  const empBlock = blocks.find((b) => b.employee_id === emp.id);

                  let statusBadge = (
                    <span className="badge badge-error">
                      🔴 Sin Marcar / Falta
                    </span>
                  );

                  if (empAttendance) {
                    statusBadge = (
                      <span className="badge badge-success">
                        🟢 Presente
                      </span>
                    );
                  } else if (empBlock) {
                    statusBadge = (
                      <span className="badge badge-warning" title={empBlock.reason}>
                        🟡 Permiso: {empBlock.reason.slice(0, 18)}...
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={emp.id}
                      style={{
                        borderBottom: "1px solid rgba(200, 164, 92, 0.08)",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(200, 164, 92, 0.03)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Name & Active status */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              background: emp.type === "spa" ? "rgba(224, 98, 146, 0.15)" : "rgba(200, 164, 92, 0.15)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: emp.type === "spa" ? "#e06292" : "var(--color-primary)",
                              border: `1px solid ${emp.type === "spa" ? "rgba(224, 98, 146, 0.3)" : "rgba(200, 164, 92, 0.3)"}`,
                            }}
                          >
                            {emp.first_name.charAt(0)}
                          </div>
                          <div>
                            <span style={{ fontWeight: 700, color: "#ffffff", display: "block" }}>
                              {emp.first_name} {emp.last_name}
                            </span>
                            {!emp.is_active && (
                              <span style={{ fontSize: "0.6875rem", color: "var(--color-error)" }}>
                                (Inactivo)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Specialty */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          className={`badge ${emp.type === "spa" ? "badge-gold" : "badge-neutral"}`}
                          style={{ fontSize: "0.6875rem" }}
                        >
                          {emp.type === "spa" ? "Spa" : "Barbería"}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px" }}>
                        {statusBadge}
                      </td>

                      {/* Check-In */}
                      <td style={{ padding: "14px 16px", color: empAttendance ? "var(--color-primary)" : "var(--color-text-dim)", fontWeight: empAttendance ? 600 : 400 }}>
                        {empAttendance ? formatTime(empAttendance.check_in) : "—"}
                      </td>

                      {/* Check-Out */}
                      <td style={{ padding: "14px 16px", color: empAttendance?.check_out ? "var(--color-primary)" : "var(--color-text-dim)", fontWeight: empAttendance?.check_out ? 600 : 400 }}>
                        {empAttendance?.check_out ? formatTime(empAttendance.check_out) : "—"}
                      </td>

                      {/* Duration */}
                      <td style={{ padding: "14px 16px", color: "var(--color-text-muted)" }}>
                        {empAttendance ? calculateDuration(empAttendance.check_in, empAttendance.check_out) : "—"}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          {/* QR Badge Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedQrEmployee(emp)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                            title="Ver / Descargar Carnet QR"
                          >
                            🪪 QR
                          </button>

                          {/* Individual History */}
                          <button
                            type="button"
                            onClick={() => setSelectedHistoryEmployee(emp)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                            title="Ver historial completo del trabajador"
                          >
                            📊 Historial
                          </button>

                          {/* Manual adjustment */}
                          <button
                            type="button"
                            onClick={() => handleOpenManualModal(emp)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "5px 8px", fontSize: "0.75rem" }}
                            title="Ajuste manual de asistencia"
                          >
                            ✏️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QR Badge Modal */}
      {selectedQrEmployee && (
        <EmployeeQRBadgeModal
          employee={selectedQrEmployee}
          onClose={() => setSelectedQrEmployee(null)}
        />
      )}

      {/* QR Camera Live Scanner Modal */}
      {showScannerModal && (
        <AttendanceQRScannerModal
          onClose={() => setShowScannerModal(false)}
          onScanSuccess={loadData}
        />
      )}

      {/* Employee Individual History Modal */}
      {selectedHistoryEmployee && (
        <EmployeeHistoryModal
          employee={selectedHistoryEmployee}
          onClose={() => setSelectedHistoryEmployee(null)}
        />
      )}

      {/* Manual Attendance Adjustment Modal */}
      {showManualModal && manualEmployee && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowManualModal(false)}
        >
          <div
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-primary-border)",
              borderRadius: "var(--radius-lg)",
              width: "100%",
              maxWidth: 450,
              boxShadow: "var(--shadow-elevated)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.0625rem", color: "#ffffff", fontWeight: 700 }}>
                Ajuste Manual: {manualEmployee.first_name} {manualEmployee.last_name}
              </h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "1.2rem" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManual} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="label">Fecha</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Hora Entrada</label>
                  <input
                    type="time"
                    value={manualCheckIn}
                    onChange={(e) => setManualCheckIn(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Hora Salida</label>
                  <input
                    type="time"
                    value={manualCheckOut}
                    onChange={(e) => setManualCheckOut(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Notas / Motivo</label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Ej: Registro manual por olvido de carnet"
                  className="input"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingManual}
                  className="btn btn-primary btn-sm"
                >
                  {savingManual ? "Guardando..." : "Guardar Asistencia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
