"use client";

import { useEffect, useState, useCallback } from "react";

type Service = {
  id: string;
  name: string;
  type: string;
};

type EmployeeBlock = {
  id: string;
  employee_id: string;
  block_date: string;
  reason: string;
  start_time: string | null;
  end_time: string | null;
};

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  type: "barberia" | "spa";
  is_active: boolean;
  employee_skills?: { service_id: string }[];
  employee_blocks?: EmployeeBlock[];
};

export default function EmployeesManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "barberia" | "spa">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceEmp, setAbsenceEmp] = useState<Employee | null>(null);

  // Form states - Employee
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"barberia" | "spa">("spa");
  const [isActive, setIsActive] = useState(true);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [savingEmp, setSavingEmp] = useState(false);

  // Form states - Absence
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("Permiso / Ausencia");
  const [savingAbsence, setSavingAbsence] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, svcRes] = await Promise.all([
        fetch("/api/admin/employees"),
        fetch("/api/admin/services"),
      ]);

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData);
      }
      if (svcRes.ok) {
        const svcData = await svcRes.json();
        setServices(svcData);
      }
    } catch (err) {
      console.error("Error cargando datos de empleados:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Abrir Modal Empleado (Crear / Editar)
  function handleOpenEmpModal(emp?: Employee) {
    if (emp) {
      setEditingEmp(emp);
      setFirstName(emp.first_name);
      setLastName(emp.last_name);
      setEmail(emp.email || "");
      setPhone(emp.phone || "");
      setType(emp.type);
      setIsActive(emp.is_active);
      setSelectedSkills(emp.employee_skills?.map((s) => s.service_id) || []);
    } else {
      setEditingEmp(null);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setType("spa");
      setIsActive(true);
      setSelectedSkills([]);
    }
    setShowEmpModal(true);
  }

  // Guardar Empleado (POST / PUT)
  async function handleSaveEmp(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      alert("Por favor ingrese Nombre y Apellido del trabajador");
      return;
    }

    setSavingEmp(true);
    try {
      const url = "/api/admin/employees";
      const method = editingEmp ? "PUT" : "POST";
      const payload = {
        id: editingEmp?.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        type,
        is_active: isActive,
        service_ids: selectedSkills,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setShowEmpModal(false);
        loadData();
      } else {
        alert(data.error || "No se pudo guardar el trabajador");
      }
    } catch {
      alert("Error de conexión al guardar el trabajador");
    } finally {
      setSavingEmp(false);
    }
  }

  // Eliminar Empleado
  async function handleDeleteEmp(emp: Employee) {
    if (
      !confirm(
        `¿Estás seguro de eliminar a ${emp.first_name} ${emp.last_name}? Se desvinculará de sus habilidades asignadas.`
      )
    )
      return;

    try {
      const res = await fetch(`/api/admin/employees?id=${emp.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      } else {
        alert(data.error || "No se pudo eliminar el trabajador");
      }
    } catch {
      alert("Error de conexión al intentar eliminar");
    }
  }

  // Abrir Modal Ausencia
  function handleOpenAbsenceModal(emp: Employee) {
    setAbsenceEmp(emp);
    setBlockDate(new Date().toISOString().split("T")[0]);
    setBlockReason("Permiso / Ausencia");
    setShowAbsenceModal(true);
  }

  // Guardar Ausencia
  async function handleSaveAbsence(e: React.FormEvent) {
    e.preventDefault();
    if (!absenceEmp || !blockDate) return;

    setSavingAbsence(true);
    try {
      const res = await fetch("/api/admin/employees/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: absenceEmp.id,
          block_date: blockDate,
          reason: blockReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowAbsenceModal(false);
        loadData();
      } else {
        alert(data.error || "No se pudo registrar la ausencia");
      }
    } catch {
      alert("Error de conexión al registrar ausencia");
    } finally {
      setSavingAbsence(false);
    }
  }

  // Eliminar Ausencia
  async function handleDeleteAbsence(blockId: string) {
    if (!confirm("¿Deseas eliminar este permiso / ausencia?")) return;

    try {
      const res = await fetch(`/api/admin/employees/absences?id=${blockId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadData();
      } else {
        alert("No se pudo eliminar la ausencia");
      }
    } catch {
      alert("Error al eliminar ausencia");
    }
  }

  // Toggle Seleccionar Habilidad
  function toggleSkill(serviceId: string) {
    setSelectedSkills((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  }

  // Seleccionar todas las habilidades filtradas
  function selectAllSkills(typeFilter: string) {
    const matchingServiceIds = services
      .filter((s) => s.type === typeFilter)
      .map((s) => s.id);
    setSelectedSkills((prev) => Array.from(new Set([...prev, ...matchingServiceIds])));
  }

  const filteredEmployees = employees.filter((emp) => {
    if (filterType !== "all" && emp.type !== filterType) return false;
    if (!searchTerm) return true;
    const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  const totalEmployees = employees.length;
  const spaCount = employees.filter((e) => e.type === "spa").length;
  const barberiaCount = employees.filter((e) => e.type === "barberia").length;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: 4 }}>
            👥 Personal y Especialidades
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
            Gestión de trabajadores, asignación de servicios y control de ausencias.
          </p>
        </div>
        <button
          onClick={() => handleOpenEmpModal()}
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          ➕ Nuevo Trabajador
        </button>
      </div>

      {/* Stats Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
            Total Personal
          </span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-primary)" }}>
            {totalEmployees}
          </p>
        </div>
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
            Especialistas Spa
          </span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#e879f9" }}>
            {spaCount}
          </p>
        </div>
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
            Barberos
          </span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#38bdf8" }}>
            {barberiaCount}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {(["all", "spa", "barberia"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`btn btn-sm ${filterType === t ? "btn-primary" : "btn-ghost"}`}
              style={{ textTransform: "capitalize" }}
            >
              {t === "all" ? "Todos" : t === "spa" ? "🌸 Spa" : "💈 Barbería"}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="🔍 Buscar por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input"
          style={{ width: 260 }}
        />
      </div>

      {/* Employees Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>
          Cargando personal...
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "var(--color-text-muted)" }}>No se encontraron trabajadores.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 20,
          }}
        >
          {filteredEmployees.map((emp) => {
            const skillServiceIds = new Set(emp.employee_skills?.map((s) => s.service_id));
            const empServices = services.filter((s) => skillServiceIds.has(s.id));
            const blocks = emp.employee_blocks || [];

            return (
              <div
                key={emp.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: 20,
                  borderLeft: `4px solid ${
                    emp.type === "barberia" ? "#38bdf8" : "#e879f9"
                  }`,
                }}
              >
                <div>
                  {/* Top row */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: 2 }}>
                        {emp.first_name} {emp.last_name}
                      </h3>
                      <span
                        className={`badge ${
                          emp.type === "barberia" ? "badge-info" : "badge-secondary"
                        }`}
                        style={{ fontSize: "0.75rem" }}
                      >
                        {emp.type === "barberia" ? "💈 Barbería" : "🌸 Spa"}
                      </span>
                    </div>

                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        background: emp.is_active
                          ? "rgba(34,197,94,0.1)"
                          : "rgba(239,68,68,0.1)",
                        color: emp.is_active ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {emp.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  {/* Skills summary */}
                  <div style={{ marginBottom: 16 }}>
                    <p
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 6,
                      }}
                    >
                      Especialidades ({empServices.length})
                    </p>
                    {emp.type === "barberia" ? (
                      <span className="badge badge-outline" style={{ fontSize: "0.75rem" }}>
                        ✂️ Todos los servicios de Barbería
                      </span>
                    ) : empServices.length === 0 ? (
                      <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                        Sin servicios asignados
                      </span>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 90, overflowY: "auto" }}>
                        {empServices.map((s) => (
                          <span
                            key={s.id}
                            style={{
                              fontSize: "0.6875rem",
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid var(--color-border)",
                            }}
                          >
                            {s.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Absences section */}
                  {blocks.length > 0 && (
                    <div style={{ marginBottom: 16, paddingTop: 12, borderTop: "1px dashed var(--color-border)" }}>
                      <p
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          color: "var(--color-warning)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginBottom: 6,
                        }}
                      >
                        ⚠️ Ausencias Registradas ({blocks.length})
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {blocks.map((b) => (
                          <div
                            key={b.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "0.75rem",
                              background: "rgba(234,179,8,0.08)",
                              padding: "4px 8px",
                              borderRadius: 4,
                            }}
                          >
                            <span>📅 {b.block_date} — {b.reason}</span>
                            <button
                              onClick={() => handleDeleteAbsence(b.id)}
                              style={{
                                border: "none",
                                background: "none",
                                cursor: "pointer",
                                color: "#ef4444",
                                fontSize: "0.75rem",
                              }}
                              title="Eliminar permiso"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    paddingTop: 12,
                    borderTop: "1px solid var(--color-border)",
                    marginTop: 12,
                  }}
                >
                  <button
                    onClick={() => handleOpenEmpModal(emp)}
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => handleOpenAbsenceModal(emp)}
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1, color: "var(--color-warning)" }}
                  >
                    📅 Permiso
                  </button>
                  <button
                    onClick={() => handleDeleteEmp(emp)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: "#ef4444" }}
                    title="Eliminar trabajador"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR/EDITAR EMPLEADO */}
      {showEmpModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 600,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: 16 }}>
              {editingEmp ? "✏️ Editar Trabajador" : "➕ Nuevo Trabajador"}
            </h2>

            <form onSubmit={handleSaveEmp}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label">Nombres *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Apellidos *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="label">Tipo de Personal *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "barberia" | "spa")}
                    className="input"
                  >
                    <option value="spa">🌸 Spa</option>
                    <option value="barberia">💈 Barbería</option>
                  </select>
                </div>
                <div>
                  <label className="label">Estado</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <span>Activo en sistema</span>
                  </label>
                </div>
              </div>

              {/* Skills selection */}
              {type === "spa" && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label className="label" style={{ marginBottom: 0 }}>
                      Servicios de Spa Capacitados ({selectedSkills.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => selectAllSkills("spa")}
                      style={{ fontSize: "0.75rem", background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer" }}
                    >
                      Seleccionar Todos Spa
                    </button>
                  </div>

                  <div
                    style={{
                      maxHeight: 220,
                      overflowY: "auto",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      padding: 12,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      background: "rgba(0,0,0,0.2)",
                    }}
                  >
                    {services
                      .filter((s) => s.type === "spa")
                      .map((s) => (
                        <label
                          key={s.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: "0.8125rem",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSkills.includes(s.id)}
                            onChange={() => toggleSkill(s.id)}
                          />
                          <span>{s.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="btn btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEmp}
                  className="btn btn-primary"
                >
                  {savingEmp ? "Guardando..." : "Guardar Trabajador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR AUSENCIA */}
      {showAbsenceModal && absenceEmp && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
          }}
        >
          <div className="card" style={{ width: "100%", maxWidth: 450, padding: 24 }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: 8 }}>
              📅 Registrar Permiso / Ausencia
            </h2>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", marginBottom: 16 }}>
              Para: <strong>{absenceEmp.first_name} {absenceEmp.last_name}</strong>
            </p>

            <form onSubmit={handleSaveAbsence}>
              <div style={{ marginBottom: 12 }}>
                <label className="label">Fecha de Ausencia *</label>
                <input
                  type="date"
                  required
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="input"
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="label">Motivo</label>
                <input
                  type="text"
                  placeholder="Ej: Permiso médico, Vacaciones"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="input"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowAbsenceModal(false)}
                  className="btn btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAbsence}
                  className="btn btn-primary"
                >
                  {savingAbsence ? "Guardando..." : "Registrar Permiso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
