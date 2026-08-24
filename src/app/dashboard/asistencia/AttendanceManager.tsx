"use client";

import { useState, useEffect, useCallback } from "react";
import { AttendanceQRScannerModal } from "./AttendanceQRScannerModal";
import { EmployeeQRBadgeModal } from "./EmployeeQRBadgeModal";
import { EmployeeHistoryModal } from "./EmployeeHistoryModal";
import { JustificationModal } from "./JustificationModal";
import { BonusSettingsModal } from "./BonusSettingsModal";
import { BonusAdjustmentModal } from "./BonusAdjustmentModal";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  type: "spa" | "barberia" | "recepcionista";
  is_active: boolean;
}

import { AttendanceRecord, getAttendanceStatusInfo } from "@/lib/types/attendance";
import type { JustificationType } from "@/lib/types/bonus";
import {
  calculateEffectiveWorkingMinutes,
  parseTempLeavesFromNotes,
  calculateTotalTempLeaveMinutes,
} from "@/lib/utils/attendance-temp-leaves";

interface BlockRecord {
  id: string;
  employee_id: string;
  block_date: string;
  reason: string;
  start_time: string | null;
  end_time: string | null;
}

export function AttendanceManager({ userRole = "admin" }: { userRole?: string }) {
  const isAdmin = userRole === "admin";
  const canEditOrDelete = isAdmin;

  // Filters
  const [typeFilter, setTypeFilter] = useState<"all" | "spa" | "barberia" | "recepcionista">("all");
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
  const [showBonusSettingsModal, setShowBonusSettingsModal] = useState(false);
  const [justificationModalData, setJustificationModalData] = useState<{
    attendanceId?: string | null;
    employeeId: string;
    employeeName: string;
    initialType: JustificationType;
    dateStr: string;
  } | null>(null);
  const [bonusAdjustmentData, setBonusAdjustmentData] = useState<{
    attendanceId: string;
    employeeName: string;
    dateStr: string;
    currentMinutes: number;
  } | null>(null);

  // Manual attendance edit modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEmployee, setManualEmployee] = useState<Employee | null>(null);
  const [manualDate, setManualDate] = useState<string>(selectedDate);
  const [manualCheckIn, setManualCheckIn] = useState<string>("09:00");
  const [manualCheckOut, setManualCheckOut] = useState<string>("18:00");
  const [manualStatus, setManualStatus] = useState<string>("presente");
  const [manualEntryJustification, setManualEntryJustification] = useState<string>("");
  const [manualExitJustification, setManualExitJustification] = useState<string>("");
  const [manualNotes, setManualNotes] = useState<string>("");
  const [savingManual, setSavingManual] = useState(false);
  const [showEntryJustifyInput, setShowEntryJustifyInput] = useState(false);
  const [showExitJustifyInput, setShowExitJustifyInput] = useState(false);

  // Helper to extract HH:mm in America/Lima timezone
  function isoToPeruTime(isoString: string | null | undefined): string {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Lima",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d);
    } catch {
      return "";
    }
  }

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

  // Open Manual Modal with existing data prefilled if available
  function handleOpenManualModal(emp: Employee) {
    if (!canEditOrDelete) return;
    setManualEmployee(emp);
    
    // Check if there is an existing attendance for this employee on selectedDate
    const existing = attendances.find(
      (a) => a.employee_id === emp.id && (rangeMode === "day" ? a.date === selectedDate : true)
    );

    const targetDate = existing?.date || selectedDate;
    setManualDate(targetDate);

    if (existing) {
      const inTime = isoToPeruTime(existing.check_in) || "09:00";
      const outTime = isoToPeruTime(existing.check_out) || "";
      setManualCheckIn(inTime);
      setManualCheckOut(outTime);
      setManualStatus(existing.status || "presente");
      setManualEntryJustification(existing.entry_justification || "");
      setManualExitJustification(existing.exit_justification || "");
      setManualNotes(existing.notes || "");
      setShowEntryJustifyInput(Boolean(existing.entry_justification || existing.status === "tardanza"));
      setShowExitJustifyInput(Boolean(existing.exit_justification || existing.status === "salida_temprana"));
    } else {
      setManualCheckIn("09:00");
      setManualCheckOut("18:00");
      setManualStatus("presente");
      setManualEntryJustification("");
      setManualExitJustification("");
      setManualNotes("Ajuste manual administrativo");
      setShowEntryJustifyInput(false);
      setShowExitJustifyInput(false);
    }

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
          status: manualStatus,
          entry_justification: manualEntryJustification.trim() || null,
          exit_justification: manualExitJustification.trim() || null,
          notes: manualNotes.trim() || null,
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

  function calculateDuration(checkIn: string, checkOut: string | null, notes?: string | null) {
    if (!checkIn || !checkOut) return "—";
    const { formatted } = calculateEffectiveWorkingMinutes(checkIn, checkOut, notes);
    return formatted;
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
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowBonusSettingsModal(true)}
              className="btn btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.85rem",
              }}
              title="Configurar horarios de inicio de bonificación"
              id="bonus-settings-btn"
            >
              ⚙️ Reglas de Bonificación
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="btn btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 16px rgba(200, 164, 92, 0.3)",
              fontSize: "0.95rem",
              fontWeight: 700,
            }}
          >
            📸 Escanear QR
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
              ({employees.filter((e) => e.type === "spa").length} Spa · {employees.filter((e) => e.type === "barberia").length} Barb. · {employees.filter((e) => e.type === "recepcionista").length} Rec.)
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
            {(["all", "barberia", "spa", "recepcionista"] as const).map((f) => (
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
                {f === "all" ? "Todos" : f === "barberia" ? "Barbería" : f === "spa" ? "Spa" : "🛎️ Recepción"}
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
            <table style={{ width: "100%", minWidth: "1000px", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ background: "rgba(200, 164, 92, 0.05)", textAlign: "left", fontSize: "0.78rem" }}>
                  <th style={{ padding: "14px 16px", color: "var(--color-primary)", fontWeight: 700 }}>Trabajador</th>
                  <th style={{ padding: "14px 16px", color: "var(--color-primary)", fontWeight: 700 }}>Especialidad</th>
                  <th style={{ padding: "14px 16px", color: "var(--color-primary)", fontWeight: 700 }}>Estado</th>
                  <th style={{ padding: "14px 16px", color: "var(--color-primary)", fontWeight: 700 }}>Entrada</th>
                  <th style={{ padding: "14px 16px", color: "var(--color-primary)", fontWeight: 700 }}>Salida</th>
                  <th style={{ padding: "14px 16px", color: "var(--color-primary)", fontWeight: 700 }}>Bonificación</th>
                  <th style={{ padding: "14px 16px", color: "var(--color-primary)", fontWeight: 700 }}>Duración</th>
                  <th style={{ padding: "14px 16px", color: "var(--color-primary)", fontWeight: 700, textAlign: "right" }}>Acciones</th>
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
                    const statusInfo = getAttendanceStatusInfo(
                      empAttendance.status,
                      empAttendance.entry_justification,
                      empAttendance.exit_justification
                    );
                    const { cleanNotes, tempLeaves } = parseTempLeavesFromNotes(empAttendance.notes);
                    const activeTemp = tempLeaves.find((tl) => !tl.return_time);
                    const tempSummary = tempLeaves.length > 0
                      ? `${tempLeaves.length} permiso(s) temporal(es)`
                      : null;

                    const tooltipParts = [
                      activeTemp ? `⏸️ En Permiso: ${activeTemp.reason}` : null,
                      empAttendance.entry_justification ? `Entrada: ${empAttendance.entry_justification}` : null,
                      empAttendance.exit_justification ? `Salida: ${empAttendance.exit_justification}` : null,
                      cleanNotes ? `Notas: ${cleanNotes}` : null,
                      tempSummary,
                    ].filter(Boolean);

                    statusBadge = (
                      <span className={`badge ${statusInfo.badgeClass}`} title={tooltipParts.join(" | ") || undefined}>
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    );
                  } else if (empBlock) {
                    statusBadge = (
                      <span className="badge badge-warning" title={empBlock.reason}>
                        🟡 Permiso: {empBlock.reason.slice(0, 18)}...
                      </span>
                    );
                  }

                  const isCheckInTardy = empAttendance?.status === "tardanza";
                  const isCheckOutEarly = empAttendance?.status === "salida_temprana";
                  const bonusMinutes = empAttendance?.bonus_minutes || 0;

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
                              background: emp.type === "spa" ? "rgba(224, 98, 146, 0.15)" : emp.type === "recepcionista" ? "rgba(45, 212, 191, 0.15)" : "rgba(200, 164, 92, 0.15)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: emp.type === "spa" ? "#e06292" : emp.type === "recepcionista" ? "#2dd4bf" : "var(--color-primary)",
                              border: `1px solid ${emp.type === "spa" ? "rgba(224, 98, 146, 0.3)" : emp.type === "recepcionista" ? "rgba(45, 212, 191, 0.3)" : "rgba(200, 164, 92, 0.3)"}`,
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
                          className={`badge ${emp.type === "spa" ? "badge-gold" : emp.type === "recepcionista" ? "badge-success" : "badge-neutral"}`}
                          style={{ fontSize: "0.6875rem" }}
                        >
                          {emp.type === "spa" ? "Spa" : emp.type === "recepcionista" ? "🛎️ Recepción" : "Barbería"}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px" }}>
                        {statusBadge}
                      </td>

                      {/* Check-In con Justificación Independiente */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        {empAttendance ? (
                          <div>
                            <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                              {formatTime(empAttendance.check_in)}
                            </span>
                            {empAttendance.check_in_justified ? (
                              <span className="badge badge-success" style={{ display: "block", fontSize: "0.65rem", marginTop: 4 }}>
                                ✅ Entrada Justificada
                              </span>
                            ) : isCheckInTardy ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setJustificationModalData({
                                    attendanceId: empAttendance.id,
                                    employeeId: emp.id,
                                    employeeName: `${emp.first_name} ${emp.last_name}`,
                                    initialType: "check_in",
                                    dateStr: empAttendance.date || selectedDate,
                                  })
                                }
                                className="btn btn-ghost btn-sm"
                                style={{ display: "block", fontSize: "0.68rem", padding: "2px 6px", marginTop: 4, color: "#f59e0b" }}
                              >
                                📝 Justificar Entrada
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>—</span>
                        )}
                      </td>

                      {/* Check-Out con Justificación Independiente */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        {empAttendance?.check_out ? (
                          <div>
                            <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                              {formatTime(empAttendance.check_out)}
                            </span>
                            {empAttendance.check_out_justified ? (
                              <span className="badge badge-success" style={{ display: "block", fontSize: "0.65rem", marginTop: 4 }}>
                                ✅ Salida Justificada
                              </span>
                            ) : isCheckOutEarly ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setJustificationModalData({
                                    attendanceId: empAttendance.id,
                                    employeeId: emp.id,
                                    employeeName: `${emp.first_name} ${emp.last_name}`,
                                    initialType: "check_out",
                                    dateStr: empAttendance.date || selectedDate,
                                  })
                                }
                                className="btn btn-ghost btn-sm"
                                style={{ display: "block", fontSize: "0.68rem", padding: "2px 6px", marginTop: 4, color: "#f59e0b" }}
                              >
                                📝 Justificar Salida
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Tiempo de Bonificación */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        {bonusMinutes > 0 ? (
                          <div>
                            <span style={{ color: "#22c55e", fontWeight: 800, fontSize: "0.88rem" }}>
                              +{bonusMinutes} min
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", display: "block" }}>
                              ({(bonusMinutes / 60).toFixed(2)} hrs) · {empAttendance?.bonus_calculation_type === "manual" ? "Manual" : "Auto"}
                            </span>
                            {isAdmin && empAttendance && (
                              <button
                                type="button"
                                onClick={() =>
                                  setBonusAdjustmentData({
                                    attendanceId: empAttendance.id,
                                    employeeName: `${emp.first_name} ${emp.last_name}`,
                                    dateStr: empAttendance.date || selectedDate,
                                    currentMinutes: bonusMinutes,
                                  })
                                }
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: "0.65rem", padding: "1px 5px", marginTop: 2 }}
                              >
                                ⏱️ Ajustar
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--color-text-dim)", fontSize: "0.78rem" }}>0 min</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td style={{ padding: "14px 16px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                        {empAttendance
                          ? calculateDuration(empAttendance.check_in, empAttendance.check_out, empAttendance.notes)
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          {/* QR Badge Button - Solo visible para Administrador */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setSelectedQrEmployee(emp)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                              title="Ver / Descargar Carnet QR"
                            >
                              🪪 QR
                            </button>
                          )}

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

                          {/* Manual adjustment — solo visible para admin */}
                          {canEditOrDelete && (
                            <button
                              type="button"
                              onClick={() => handleOpenManualModal(emp)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: "5px 8px", fontSize: "0.75rem" }}
                              title="Ajuste manual y justificaciones de asistencia"
                            >
                              ✏️
                            </button>
                          )}
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

      {/* Employee History Modal */}
      {selectedHistoryEmployee && (
        <EmployeeHistoryModal
          employee={selectedHistoryEmployee}
          userRole={userRole}
          onClose={() => setSelectedHistoryEmployee(null)}
          onRefresh={loadData}
        />
      )}

      {/* Justification Modal */}
      {justificationModalData && (
        <JustificationModal
          attendanceId={justificationModalData.attendanceId}
          employeeId={justificationModalData.employeeId}
          employeeName={justificationModalData.employeeName}
          initialType={justificationModalData.initialType}
          dateStr={justificationModalData.dateStr}
          onClose={() => setJustificationModalData(null)}
          onSuccess={() => {
            setJustificationModalData(null);
            loadData();
          }}
        />
      )}

      {/* Bonus Settings Modal */}
      {showBonusSettingsModal && (
        <BonusSettingsModal
          onClose={() => setShowBonusSettingsModal(false)}
          onSuccess={() => {
            setShowBonusSettingsModal(false);
            loadData();
          }}
        />
      )}

      {/* Bonus Adjustment Modal */}
      {bonusAdjustmentData && (
        <BonusAdjustmentModal
          attendanceId={bonusAdjustmentData.attendanceId}
          employeeName={bonusAdjustmentData.employeeName}
          dateStr={bonusAdjustmentData.dateStr}
          currentBonusMinutes={bonusAdjustmentData.currentMinutes}
          onClose={() => setBonusAdjustmentData(null)}
          onSuccess={() => {
            setBonusAdjustmentData(null);
            loadData();
          }}
        />
      )}

      {/* Manual Attendance Adjustment Modal */}
      {showManualModal && manualEmployee && canEditOrDelete && (
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
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={() => setShowManualModal(false)}
        >
          <div
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-primary-border)",
              borderRadius: "var(--radius-lg)",
              width: "100%",
              maxWidth: 520,
              maxHeight: "90vh",
              boxShadow: "var(--shadow-elevated)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(200, 164, 92, 0.05)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1.0625rem", color: "#ffffff", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>✏️</span> Ajuste Manual: {manualEmployee.first_name} {manualEmployee.last_name}
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
                  {manualEmployee.type === "spa" ? "Especialidad: Spa" : manualEmployee.type === "recepcionista" ? "Recepción" : "Especialidad: Barbería"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "1.2rem" }}
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Form */}
            <form
              onSubmit={handleSaveManual}
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                overflowY: "auto",
              }}
            >
              {/* Fecha y Estado General */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label" style={{ fontSize: "0.8125rem" }}>Fecha del Registro</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: "0.8125rem" }}>Estado de Asistencia</label>
                  <select
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value)}
                    className="select"
                    style={{ width: "100%" }}
                  >
                    <option value="presente">🟢 Presente (A tiempo)</option>
                    <option value="tardanza">🟡 Tardanza</option>
                    <option value="salida_temprana">🟠 Salida Temprana</option>
                    <option value="falta_justificada">🟡 Falta Justificada</option>
                    <option value="falta_injustificada">🔴 Falta Injustificada</option>
                  </select>
                </div>
              </div>

              {/* BLOQUE ENTRADA (CHECK-IN) & JUSTIFICACIÓN */}
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid rgba(200, 164, 92, 0.15)",
                  borderRadius: "var(--radius-md)",
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#ffffff" }}>
                      🟢 Entrada (Check-In)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEntryJustifyInput(!showEntryJustifyInput)}
                    className="btn btn-ghost btn-sm"
                    style={{
                      fontSize: "0.75rem",
                      padding: "3px 8px",
                      color: showEntryJustifyInput || manualEntryJustification ? "var(--color-primary)" : "var(--color-text-dim)",
                    }}
                  >
                    📝 {showEntryJustifyInput ? "Ocultar motivo" : manualEntryJustification ? "Editar justificación" : "+ Justificar Entrada"}
                  </button>
                </div>

                <div>
                  <label className="label" style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
                    Hora de Entrada
                  </label>
                  <input
                    type="time"
                    value={manualCheckIn}
                    onChange={(e) => setManualCheckIn(e.target.value)}
                    className="input"
                    required
                  />
                </div>

                {(showEntryJustifyInput || manualEntryJustification) && (
                  <div
                    style={{
                      background: "rgba(200, 164, 92, 0.05)",
                      border: "1px dashed rgba(200, 164, 92, 0.3)",
                      borderRadius: "var(--radius-sm)",
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <label className="label" style={{ fontSize: "0.75rem", color: "var(--color-primary)", margin: 0 }}>
                      Motivo / Justificación de Entrada (Tardanza o Ajuste)
                    </label>
                    <input
                      type="text"
                      value={manualEntryJustification}
                      onChange={(e) => setManualEntryJustification(e.target.value)}
                      placeholder="Ej: Retraso por congestión vehicular severa en Av. Principal"
                      className="input"
                      style={{ fontSize: "0.8125rem", padding: "6px 10px" }}
                    />
                    {/* Quick suggestion chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {[
                        "Tráfico / Transporte",
                        "Cita médica autorizada",
                        "Emergencia personal",
                        "Autorización de gerencia",
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setManualEntryJustification(chip)}
                          style={{
                            border: "1px solid rgba(200, 164, 92, 0.2)",
                            background: manualEntryJustification === chip ? "rgba(200, 164, 92, 0.2)" : "rgba(0, 0, 0, 0.3)",
                            color: "var(--color-text-dim)",
                            fontSize: "0.6875rem",
                            padding: "3px 7px",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* BLOQUE SALIDA (CHECK-OUT) & JUSTIFICACIÓN */}
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid rgba(200, 164, 92, 0.15)",
                  borderRadius: "var(--radius-md)",
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#ffffff" }}>
                      🔴 Salida (Check-Out)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExitJustifyInput(!showExitJustifyInput)}
                    className="btn btn-ghost btn-sm"
                    style={{
                      fontSize: "0.75rem",
                      padding: "3px 8px",
                      color: showExitJustifyInput || manualExitJustification ? "var(--color-primary)" : "var(--color-text-dim)",
                    }}
                  >
                    📝 {showExitJustifyInput ? "Ocultar motivo" : manualExitJustification ? "Editar justificación" : "+ Justificar Salida"}
                  </button>
                </div>

                <div>
                  <label className="label" style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
                    Hora de Salida (Opcional si aún no sale)
                  </label>
                  <input
                    type="time"
                    value={manualCheckOut}
                    onChange={(e) => setManualCheckOut(e.target.value)}
                    className="input"
                  />
                </div>

                {(showExitJustifyInput || manualExitJustification) && (
                  <div
                    style={{
                      background: "rgba(200, 164, 92, 0.05)",
                      border: "1px dashed rgba(200, 164, 92, 0.3)",
                      borderRadius: "var(--radius-sm)",
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <label className="label" style={{ fontSize: "0.75rem", color: "var(--color-primary)", margin: 0 }}>
                      Motivo / Justificación de Salida (Salida Temprana o Incidencia)
                    </label>
                    <input
                      type="text"
                      value={manualExitJustification}
                      onChange={(e) => setManualExitJustification(e.target.value)}
                      placeholder="Ej: Salida anticipada autorizada por urgencia familiar"
                      className="input"
                      style={{ fontSize: "0.8125rem", padding: "6px 10px" }}
                    />
                    {/* Quick suggestion chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {[
                        "Salida temprana autorizada",
                        "Urgencia familiar",
                        "Cita médica",
                        "Compensación de horas",
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setManualExitJustification(chip)}
                          style={{
                            border: "1px solid rgba(200, 164, 92, 0.2)",
                            background: manualExitJustification === chip ? "rgba(200, 164, 92, 0.2)" : "rgba(0, 0, 0, 0.3)",
                            color: "var(--color-text-dim)",
                            fontSize: "0.6875rem",
                            padding: "3px 7px",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Observaciones generales */}
              <div>
                <label className="label" style={{ fontSize: "0.8125rem" }}>Observaciones Generales</label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Notas adicionales o comentarios del administrador"
                  className="input"
                />
              </div>

              {/* Botones del formulario */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6, paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
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
