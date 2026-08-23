"use client";

import { useState, useEffect, useMemo } from "react";

interface ServiceItem {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  type: "barberia" | "spa";
  is_active: boolean;
  category?: string;
}

interface EmployeeItem {
  id: string;
  first_name: string;
  last_name: string;
  type?: string;
  is_active?: boolean;
}

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingCreated: () => void;
  employees?: EmployeeItem[];
}

export function NewBookingModal({
  isOpen,
  onClose,
  onBookingCreated,
  employees: initialEmployees = [],
}: NewBookingModalProps) {
  // ---------------------------------------------------------------------------
  // Estados del Formulario
  // ---------------------------------------------------------------------------
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [employeesList, setEmployeesList] = useState<EmployeeItem[]>(initialEmployees);
  const [loadingInitial, setLoadingInitial] = useState(false);

  // Filtro de rubro para seleccionar servicios rápidamente
  const [selectedRubro, setSelectedRubro] = useState<"todos" | "barberia" | "spa">("barberia");

  // Selección de servicios
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Datos del Cliente (Nombre obligatorio, resto opcional)
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientDni, setClientDni] = useState("");

  // Empleado Asignado
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>("");

  // Fecha y Hora
  const [bookingDate, setBookingDate] = useState<string>(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  });

  const [startTime, setStartTime] = useState<string>(() => {
    try {
      const now = new Date();
      const peruTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Lima",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);

      const [h, m] = peruTime.split(":").map(Number);
      // Redondear al siguiente bloque de 15 min
      const roundedM = Math.ceil(m / 15) * 15;
      const finalH = roundedM === 60 ? (h + 1) % 24 : h;
      const finalM = roundedM === 60 ? 0 : roundedM;
      return `${String(finalH).padStart(2, "0")}:${String(finalM).padStart(2, "0")}`;
    } catch {
      return "10:00";
    }
  });

  const [notes, setNotes] = useState("");

  // Feedback & Envío
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Cargar Servicios y Empleados al Abrir
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    async function loadData() {
      setLoadingInitial(true);
      try {
        const [resServices, resEmployees] = await Promise.all([
          fetch("/api/admin/services"),
          fetch("/api/admin/employees"),
        ]);

        if (resServices.ok) {
          const sData = await resServices.json();
          if (Array.isArray(sData)) {
            setServices(sData.filter((s) => s.is_active));
          }
        }

        if (resEmployees.ok) {
          const eData = await resEmployees.json();
          if (Array.isArray(eData)) {
            setEmployeesList(eData.filter((e) => e.is_active !== false));
          }
        }
      } catch (err) {
        console.error("Error loading services/employees for new booking:", err);
      } finally {
        setLoadingInitial(false);
      }
    }

    loadData();
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Cálculos Derivados (Total y Duración)
  // ---------------------------------------------------------------------------
  const selectedServices = useMemo(() => {
    return services.filter((s) => selectedServiceIds.includes(s.id));
  }, [services, selectedServiceIds]);

  const totalPriceCents = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.price_cents || 0), 0);
  }, [selectedServices]);

  const totalDurationMinutes = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.duration_minutes || 30), 0);
  }, [selectedServices]);

  // Cálculo de hora fin estimada
  const estimatedEndTime = useMemo(() => {
    if (!startTime) return "";
    const [h, m] = startTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "";
    const startMins = h * 60 + m;
    const endMins = startMins + (totalDurationMinutes || 30);
    const endH = Math.floor(endMins / 60) % 24;
    const endM = endMins % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  }, [startTime, totalDurationMinutes]);

  // Filtrar servicios mostrados en el selector según la pestaña de rubro
  const visibleServices = useMemo(() => {
    if (selectedRubro === "todos") return services;
    return services.filter((s) => s.type === selectedRubro);
  }, [services, selectedRubro]);

  // Filtrar empleados según el rubro o mostrar todos
  const visibleEmployees = useMemo(() => {
    if (selectedRubro === "todos") return employeesList;
    return employeesList.filter((e) => !e.type || e.type === selectedRubro || e.type === "ambos");
  }, [employeesList, selectedRubro]);

  // Manejador de selección de servicio (toggle)
  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // ---------------------------------------------------------------------------
  // Guardar Reserva Walk-in
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!clientFirstName.trim()) {
      setErrorMsg("Por favor, ingresa el nombre del cliente.");
      return;
    }

    if (selectedServiceIds.length === 0) {
      setErrorMsg("Debes seleccionar al menos un servicio a realizar.");
      return;
    }

    if (!bookingDate) {
      setErrorMsg("Por favor, selecciona la fecha de la cita.");
      return;
    }

    if (!startTime) {
      setErrorMsg("Por favor, indica la hora de inicio.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        client_first_name: clientFirstName.trim(),
        client_last_name: clientLastName.trim() || "Presencial",
        client_phone: clientPhone.trim() || null,
        client_email: clientEmail.trim() || null,
        client_dni: clientDni.trim() || null,
        service_ids: selectedServiceIds,
        assigned_employee_id: assignedEmployeeId || null,
        booking_date: bookingDate,
        start_time: startTime,
        notes: notes.trim() || null,
      };

      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al crear la reserva presencial");
      }

      setSuccessMsg(`¡Reserva creada exitosamente con código ${data.booking?.booking_code || ""}!`);

      // Limpiar formulario
      setTimeout(() => {
        setSelectedServiceIds([]);
        setClientFirstName("");
        setClientLastName("");
        setClientPhone("");
        setClientEmail("");
        setClientDni("");
        setNotes("");
        setAssignedEmployeeId("");
        onBookingCreated();
        onClose();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-surface, #18181b)",
          border: "1px solid var(--color-border, rgba(255,255,255,0.1))",
          borderRadius: "var(--radius-lg, 16px)",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          color: "var(--color-text, #f4f4f5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--color-border, rgba(255,255,255,0.1))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(200, 164, 92, 0.06)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.25rem" }}>➕</span>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--color-primary, #C8A45C)", margin: 0 }}>
                Nueva Reserva Presencial (Walk-in)
              </h2>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted, #a1a1aa)", margin: "4px 0 0 0" }}>
              Registro directo en mostrador para atención presencial inmediata o agendada
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-muted, #a1a1aa)",
              fontSize: "1.25rem",
              cursor: "pointer",
              padding: 6,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body Scrollable */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div
            style={{
              padding: "20px 24px",
              overflowY: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {/* Mensajes de Alerta */}
            {errorMsg && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  color: "#ef4444",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md, 8px)",
                  fontSize: "0.85rem",
                }}
              >
                ⚠️ {errorMsg}
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.12)",
                  border: "1px solid rgba(34, 197, 94, 0.4)",
                  color: "#22c55e",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md, 8px)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                ✅ {successMsg}
              </div>
            )}

            {/* SECCIÓN 1: DATOS DEL CLIENTE (Obligatorio Nombre, resto opcional) */}
            <div>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-primary, #C8A45C)", marginBottom: 10, letterSpacing: "0.05em" }}>
                1. Datos del Cliente
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    Nombre del Cliente <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    className="input"
                    placeholder="Ej. Juan Carlos"
                    value={clientFirstName}
                    onChange={(e) => setClientFirstName(e.target.value)}
                    required
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    Apellido <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>(opcional)</span>
                  </label>
                  <input
                    className="input"
                    placeholder="Ej. Pérez Gómez"
                    value={clientLastName}
                    onChange={(e) => setClientLastName(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    Teléfono / WhatsApp <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>(opcional)</span>
                  </label>
                  <input
                    className="input"
                    placeholder="Ej. 987654321"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    DNI / Documento <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>(opcional)</span>
                  </label>
                  <input
                    className="input"
                    placeholder="Ej. 72345678"
                    value={clientDni}
                    onChange={(e) => setClientDni(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: SERVICIO(S) A REALIZAR */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-primary, #C8A45C)", margin: 0, letterSpacing: "0.05em" }}>
                  2. Selección de Servicio(s) <span style={{ color: "#ef4444" }}>*</span>
                </h3>
                {/* Tabs de Rubro */}
                <div style={{ display: "flex", gap: 6 }}>
                  {(["barberia", "spa", "todos"] as const).map((rubro) => (
                    <button
                      key={rubro}
                      type="button"
                      onClick={() => setSelectedRubro(rubro)}
                      style={{
                        padding: "3px 10px",
                        fontSize: "0.72rem",
                        borderRadius: "var(--radius-sm, 6px)",
                        border: selectedRubro === rubro ? "1px solid var(--color-primary, #C8A45C)" : "1px solid var(--color-border, rgba(255,255,255,0.1))",
                        background: selectedRubro === rubro ? "rgba(200, 164, 92, 0.15)" : "transparent",
                        color: selectedRubro === rubro ? "var(--color-primary, #C8A45C)" : "var(--color-text-muted, #a1a1aa)",
                        cursor: "pointer",
                        fontWeight: selectedRubro === rubro ? 700 : 500,
                      }}
                    >
                      {rubro === "barberia" ? "💈 Barbería" : rubro === "spa" ? "💆‍♀️ Spa" : "✂️ Todos"}
                    </button>
                  ))}
                </div>
              </div>

              {loadingInitial ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
                  Cargando catálogo de servicios...
                </div>
              ) : visibleServices.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
                  No se encontraron servicios disponibles en este rubro.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                    gap: 8,
                    maxHeight: "180px",
                    overflowY: "auto",
                    padding: "8px 4px",
                    background: "rgba(0, 0, 0, 0.2)",
                    borderRadius: "var(--radius-md, 8px)",
                    border: "1px solid var(--color-border, rgba(255,255,255,0.06))",
                  }}
                >
                  {visibleServices.map((s) => {
                    const isSelected = selectedServiceIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleService(s.id)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "var(--radius-sm, 6px)",
                          border: isSelected
                            ? "1px solid var(--color-primary, #C8A45C)"
                            : "1px solid var(--color-border, rgba(255,255,255,0.08))",
                          background: isSelected ? "rgba(200, 164, 92, 0.12)" : "rgba(255,255,255,0.02)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // Manejado por div onClick
                          style={{ marginTop: 2, cursor: "pointer" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.78rem", fontWeight: isSelected ? 700 : 600, color: isSelected ? "var(--color-primary, #C8A45C)" : "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {s.name}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--color-text-muted, #a1a1aa)", marginTop: 2 }}>
                            <span>⏱️ {s.duration_minutes} min</span>
                            <span style={{ fontWeight: 700, color: "var(--color-success, #22c55e)" }}>
                              S/ {(s.price_cents / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECCIÓN 3: FECHA, HORA Y COLABORADOR ASIGNADO */}
            <div>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-primary, #C8A45C)", marginBottom: 10, letterSpacing: "0.05em" }}>
                3. Programación y Asignación
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    Fecha de Cita <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    required
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    Hora Inicio <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    Colaborador Asignado <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>(opcional)</span>
                  </label>
                  <select
                    className="select"
                    value={assignedEmployeeId}
                    onChange={(e) => setAssignedEmployeeId(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">— Asignación Automática / Sin asignar —</option>
                    {visibleEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} {emp.type ? `(${emp.type === "barberia" ? "Barbero" : emp.type === "spa" ? "Spa" : emp.type})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECCIÓN 4: RESUMEN FINANCIERO Y DE TIEMPO EN VIVO */}
            <div
              style={{
                background: "rgba(200, 164, 92, 0.08)",
                border: "1px solid rgba(200, 164, 92, 0.25)",
                borderRadius: "var(--radius-md, 10px)",
                padding: "14px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                  Horario Estimado
                </span>
                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>
                  🕒 {startTime || "—"} {estimatedEndTime ? `a ${estimatedEndTime}` : ""} ({totalDurationMinutes} min)
                </span>
              </div>

              <div>
                <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                  Servicios Elegidos
                </span>
                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-primary, #C8A45C)" }}>
                  {selectedServices.length} {selectedServices.length === 1 ? "servicio" : "servicios"}
                </span>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                  Total a Pagar en Caja
                </span>
                <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--color-success, #22c55e)" }}>
                  S/ {(totalPriceCents / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--color-border, rgba(255,255,255,0.1))",
              background: "rgba(0, 0, 0, 0.2)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
              style={{ fontSize: "0.85rem", padding: "8px 18px" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || selectedServiceIds.length === 0 || !clientFirstName.trim()}
              style={{
                fontSize: "0.85rem",
                padding: "8px 22px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span>💾 Guardar Reserva</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
