"use client";

import { useState, useEffect, useCallback } from "react";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  type: "spa" | "barberia" | "recepcionista";
  is_active: boolean;
}

import { AttendanceRecord, getAttendanceStatusInfo } from "@/lib/types/attendance";
import {
  calculateEffectiveWorkingMinutes,
  parseTempLeavesFromNotes,
} from "@/lib/utils/attendance-temp-leaves";

interface BlockRecord {
  id: string;
  employee_id: string;
  block_date: string;
  reason: string;
  start_time: string | null;
  end_time: string | null;
}

interface EmployeeHistoryModalProps {
  employee: Employee;
  userRole?: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export function EmployeeHistoryModal({ employee, onClose }: EmployeeHistoryModalProps) {
  const [rangeMode, setRangeMode] = useState<"day" | "week" | "month" | "year">("month");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // "YYYY-MM"
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear()) // "YYYY"
  );

  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);

  // Calculate start and end date based on rangeMode
  const computeDateRange = useCallback(() => {
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
    // Year
    return {
      start: `${selectedYear}-01-01`,
      end: `${selectedYear}-12-31`,
    };
  }, [rangeMode, selectedDate, selectedMonth, selectedYear]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = computeDateRange();
      const res = await fetch(
        `/api/admin/attendance?employee_id=${employee.id}&start_date=${start}&end_date=${end}`
      );
      if (res.ok) {
        const data = await res.json();
        setAttendances(data.attendances || []);
      }

      // 2. Fetch justifications / agenda blocks for selected month
      const monthParam = rangeMode === "month" ? selectedMonth : undefined;
      const blocksRes = await fetch(
        `/api/admin/employees/blocks?employee_id=${employee.id}${monthParam ? `&month=${monthParam}` : ""}`
      );
      if (blocksRes.ok) {
        const blocksData = await blocksRes.json();
        setBlocks(blocksData.blocks || []);
      }
    } catch (err) {
      console.error("Error loading employee history:", err);
    } finally {
      setLoading(false);
    }
  }, [computeDateRange, employee.id, rangeMode, selectedMonth]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Statistics calculation
  const totalPresents = attendances.filter((a) => a.check_in).length;
  const totalBlocks = blocks.length;
  const totalBonusMinutes = attendances.reduce((acc, a) => acc + (a.bonus_minutes || 0), 0);
  const totalBonusHours = (totalBonusMinutes / 60).toFixed(1);

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

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-primary-border)",
          borderRadius: "var(--radius-lg)",
          width: "100%",
          maxWidth: 780,
          maxHeight: "90vh",
          boxShadow: "var(--shadow-elevated)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>
                Historial de Asistencia: {employee.first_name} {employee.last_name}
              </h3>
              <span
                className={`badge ${employee.type === "recepcionista" ? "badge-success" : employee.type === "spa" ? "badge-gold" : "badge-neutral"}`}
                style={{ fontSize: "0.6875rem" }}
              >
                {employee.type === "recepcionista" ? "🛎️ Recepción" : employee.type === "spa" ? "Spa" : "Barbería"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: 2 }}>
              Detalle cronológico de entradas, salidas y permisos justificados
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              fontSize: "1.25rem",
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Filters and Stats Bar */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            background: "rgba(0,0,0,0.15)",
          }}
        >
          {/* Time Filter Tabs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "inline-flex", background: "rgba(200,164,92,0.08)", borderRadius: "var(--radius-sm)", padding: 3, gap: 4 }}>
              {(["day", "week", "month", "year"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRangeMode(mode)}
                  style={{
                    border: "none",
                    background: rangeMode === mode ? "var(--color-primary)" : "transparent",
                    color: rangeMode === mode ? "#120f0a" : "var(--color-text-muted)",
                    fontWeight: rangeMode === mode ? 700 : 500,
                    fontSize: "0.75rem",
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {mode === "day" ? "Por Día" : mode === "week" ? "Por Semana" : mode === "month" ? "Por Mes" : "Por Año"}
                </button>
              ))}
            </div>

            {/* Date picker according to mode */}
            <div>
              {rangeMode === "day" || rangeMode === "week" ? (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="input"
                  style={{ padding: "6px 12px", fontSize: "0.8125rem", width: "auto" }}
                />
              ) : rangeMode === "month" ? (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input"
                  style={{ padding: "6px 12px", fontSize: "0.8125rem", width: "auto" }}
                />
              ) : (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="select"
                  style={{ padding: "6px 12px", fontSize: "0.8125rem", width: "auto" }}
                >
                  {["2025", "2026", "2027"].map((y) => (
                    <option key={y} value={y}>
                      Año {y}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <div style={{ padding: "10px 14px", background: "rgba(106, 153, 78, 0.1)", border: "1px solid rgba(106, 153, 78, 0.3)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-text-dim)", textTransform: "uppercase" }}>Días Asistidos</span>
              <p style={{ margin: "2px 0 0 0", fontSize: "1.25rem", fontWeight: 800, color: "var(--color-success)" }}>{totalPresents}</p>
            </div>
            <div style={{ padding: "10px 14px", background: "rgba(200, 164, 92, 0.1)", border: "1px solid rgba(200, 164, 92, 0.3)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-text-dim)", textTransform: "uppercase" }}>Permisos Justificados</span>
              <p style={{ margin: "2px 0 0 0", fontSize: "1.25rem", fontWeight: 800, color: "var(--color-primary)" }}>{totalBlocks}</p>
            </div>
            <div style={{ padding: "10px 14px", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-text-dim)", textTransform: "uppercase" }}>Tiempo Bonificación</span>
              <p style={{ margin: "2px 0 0 0", fontSize: "1.25rem", fontWeight: 800, color: "#22c55e" }}>
                +{totalBonusMinutes} min <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>({totalBonusHours}h)</span>
              </p>
            </div>
          </div>
        </div>

        {/* History Table Container with scroll */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <p className="text-muted">Cargando registros de asistencia...</p>
            </div>
          ) : attendances.length === 0 && blocks.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 8 }}>📅</span>
              <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
                No se encontraron registros de asistencia ni permisos en este rango.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
              <table style={{ width: "100%", minWidth: "600px", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                    <th style={{ padding: "10px 12px" }}>Fecha</th>
                    <th style={{ padding: "10px 12px" }}>Estado</th>
                    <th style={{ padding: "10px 12px" }}>Entrada</th>
                    <th style={{ padding: "10px 12px" }}>Salida</th>
                    <th style={{ padding: "10px 12px" }}>Bonificación</th>
                    <th style={{ padding: "10px 12px" }}>Tiempo</th>
                    <th style={{ padding: "10px 12px" }}>Notas / Permiso</th>
                  </tr>
                </thead>
                <tbody>
                  {attendances.map((att) => (
                    <tr key={att.id} style={{ borderBottom: "1px solid rgba(200, 164, 92, 0.1)" }}>
                      <td style={{ padding: "12px", fontWeight: 600, color: "#ffffff" }}>
                        {att.date}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {(() => {
                          const statusInfo = getAttendanceStatusInfo(att.status, att.entry_justification, att.exit_justification);
                          return (
                            <span className={`badge ${statusInfo.badgeClass}`}>
                              {statusInfo.icon} {statusInfo.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "12px", color: "var(--color-primary)" }}>
                        {formatTime(att.check_in)}
                        {att.check_in_justified && (
                          <span className="badge badge-success" style={{ fontSize: "0.62rem", display: "block", marginTop: 2 }}>
                            ✅ Entrada Justificada
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px", color: att.check_out ? "var(--color-primary)" : "var(--color-text-dim)" }}>
                        {formatTime(att.check_out)}
                        {att.check_out_justified && (
                          <span className="badge badge-success" style={{ fontSize: "0.62rem", display: "block", marginTop: 2 }}>
                            ✅ Salida Justificada
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px", color: (att.bonus_minutes || 0) > 0 ? "#22c55e" : "var(--color-text-dim)", fontWeight: (att.bonus_minutes || 0) > 0 ? 700 : 400 }}>
                        {(att.bonus_minutes || 0) > 0 ? `+${att.bonus_minutes} min` : "—"}
                      </td>
                      <td style={{ padding: "12px", color: "var(--color-text-muted)" }}>
                        {calculateDuration(att.check_in, att.check_out, att.notes)}
                      </td>
                      <td style={{ padding: "12px", color: "var(--color-text-muted)", fontSize: "0.8125rem" }}>
                        {(() => {
                          const { cleanNotes, tempLeaves } = parseTempLeavesFromNotes(att.notes);
                          if (cleanNotes) return cleanNotes;
                          if (tempLeaves.length > 0) return `${tempLeaves.length} permiso(s) temporal(es)`;
                          return "—";
                        })()}
                      </td>
                    </tr>
                  ))}

                  {/* Render justification blocks not covered by check_ins */}
                  {blocks
                    .filter((b) => !attendances.some((a) => a.date === b.block_date))
                    .map((block) => (
                      <tr key={block.id} style={{ borderBottom: "1px solid rgba(200, 164, 92, 0.1)", background: "rgba(212, 163, 76, 0.04)" }}>
                        <td style={{ padding: "12px", fontWeight: 600, color: "#ffffff" }}>
                          {block.block_date}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span className="badge badge-warning">🟡 Permiso Justificado</span>
                        </td>
                        <td style={{ padding: "12px", color: "var(--color-text-dim)" }}>—</td>
                        <td style={{ padding: "12px", color: "var(--color-text-dim)" }}>—</td>
                        <td style={{ padding: "12px", color: "var(--color-text-dim)" }}>—</td>
                        <td style={{ padding: "12px", color: "var(--color-warning)", fontSize: "0.8125rem" }}>
                          {block.reason}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            Cerrar Historial
          </button>
        </div>
      </div>
    </div>
  );
}
