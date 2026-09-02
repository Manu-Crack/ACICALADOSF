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
  description?: string;
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

export type WalkInPaymentMethod = "efectivo" | "yape" | "transferencia" | "mixto";

function normalizeText(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function NewBookingModal({
  isOpen,
  onClose,
  onBookingCreated,
  employees: initialEmployees = [],
}: NewBookingModalProps) {
  // ---------------------------------------------------------------------------
  // Estados del Catálogo y Formulario
  // ---------------------------------------------------------------------------
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [employeesList, setEmployeesList] = useState<EmployeeItem[]>(initialEmployees);
  const [loadingInitial, setLoadingInitial] = useState(false);

  // Filtro de Rubro / Pestañas: 'todos' | 'barberia' | 'spa'
  const [selectedRubro, setSelectedRubro] = useState<"todos" | "barberia" | "spa">("todos");

  // Buscador en tiempo real de servicios
  const [searchQuery, setSearchQuery] = useState("");

  // Selección de servicios (IDs seleccionados se preservan siempre)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Precios personalizados por servicio seleccionado: { [serviceId]: priceInCents }
  const [customServicePrices, setCustomServicePrices] = useState<Record<string, number>>({});
  // Servicio cuyo precio está siendo editado inline en el chip
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  // Valor temporal de texto mientras se edita el precio
  const [tempEditingPrice, setTempEditingPrice] = useState<string>("");

  // Asignación de personal por servicio: { [serviceId]: employeeId }
  const [serviceAssignments, setServiceAssignments] = useState<Record<string, string>>({});
  const [assignmentMode, setAssignmentMode] = useState<"auto" | "custom">("auto");

  // Empleado asignado globalmente (si aplica a 1 servicio o toda la cita)
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>("");

  // Datos del Cliente (Nombre obligatorio, resto opcional)
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientPhone, setClientPhone] = useState(""); // Solo 9 dígitos
  const [clientDni, setClientDni] = useState("");     // Solo 8 dígitos
  const [clientEmail, setClientEmail] = useState("");

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
      const roundedM = Math.ceil(m / 15) * 15;
      const finalH = roundedM === 60 ? (h + 1) % 24 : h;
      const finalM = roundedM === 60 ? 0 : roundedM;
      return `${String(finalH).padStart(2, "0")}:${String(finalM).padStart(2, "0")}`;
    } catch {
      return "10:00";
    }
  });

  // Método de Pago Presencial: 4 Opciones (Efectivo, Yape, Transferencia, Mixto)
  const [paymentMethod, setPaymentMethod] = useState<WalkInPaymentMethod>("efectivo");

  // Montos para Pago Mixto
  const [yapeAmount, setYapeAmount] = useState<string>("");
  const [cashAmount, setCashAmount] = useState<string>("");

  // Monto personalizado de "Total a Cobrar"
  const [customTotalPrice, setCustomTotalPrice] = useState<string>("");
  const [isCustomPrice, setIsCustomPrice] = useState(false);

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
    setSearchQuery("");
    setIsCustomPrice(false);
    setCustomTotalPrice("");
    setCustomServicePrices({});
    setEditingServiceId(null);
    setTempEditingPrice("");

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
  // Cálculos Derivados (Servicios Seleccionados, Totales, Filtros)
  // ---------------------------------------------------------------------------
  const selectedServices = useMemo(() => {
    return services.filter((s) => selectedServiceIds.includes(s.id));
  }, [services, selectedServiceIds]);

  const catalogTotalPriceCents = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.price_cents || 0), 0);
  }, [selectedServices]);

  const selectedServicesTotalPriceCents = useMemo(() => {
    return selectedServices.reduce((sum, s) => {
      const pCents = customServicePrices[s.id] !== undefined ? customServicePrices[s.id] : (s.price_cents || 0);
      return sum + pCents;
    }, 0);
  }, [selectedServices, customServicePrices]);

  const totalDurationMinutes = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.duration_minutes || 30), 0);
  }, [selectedServices]);

  const catalogTotalPriceSoles = (catalogTotalPriceCents / 100).toFixed(2);

  // Sincronizar automáticamente customTotalPrice con el total de seleccionados (incluyendo precios editados) mientras no haya sobreescritura manual abajo
  useEffect(() => {
    if (!isCustomPrice) {
      if (selectedServiceIds.length === 0) {
        setCustomTotalPrice("");
      } else {
        setCustomTotalPrice((selectedServicesTotalPriceCents / 100).toFixed(2));
      }
    }
  }, [selectedServicesTotalPriceCents, isCustomPrice, selectedServiceIds.length]);

  // Si se vacía la selección de servicios, reiniciar estado de personalización
  useEffect(() => {
    if (selectedServiceIds.length === 0) {
      setIsCustomPrice(false);
      setCustomTotalPrice("");
      setCustomServicePrices({});
      setEditingServiceId(null);
    }
  }, [selectedServiceIds.length]);

  // Monto efectivo final a cobrar (calculado o personalizado)
  const effectiveTotalPriceCents = useMemo(() => {
    if (customTotalPrice.trim() !== "") {
      const parsed = parseFloat(customTotalPrice);
      if (!isNaN(parsed) && parsed >= 0) {
        return Math.round(parsed * 100);
      }
    }
    return selectedServicesTotalPriceCents;
  }, [customTotalPrice, selectedServicesTotalPriceCents]);

  const effectiveTotalPriceSoles = (effectiveTotalPriceCents / 100).toFixed(2);

  // Conteo de catálogo por rubro
  const barberiaCount = useMemo(() => services.filter((s) => s.type === "barberia").length, [services]);
  const spaCount = useMemo(() => services.filter((s) => s.type === "spa").length, [services]);

  // Filtrar catálogo según rubro y término de búsqueda en tiempo real
  const visibleServices = useMemo(() => {
    const query = normalizeText(searchQuery);

    return services.filter((s) => {
      // 1. Filtro por pestaña de rubro
      if (selectedRubro !== "todos" && s.type !== selectedRubro) {
        return false;
      }
      // 2. Filtro por buscador interactivo
      if (query) {
        const nameNorm = normalizeText(s.name);
        const catNorm = normalizeText(s.category || "");
        const descNorm = normalizeText(s.description || "");
        const typeNorm = normalizeText(s.type);

        const matches =
          nameNorm.includes(query) ||
          catNorm.includes(query) ||
          descNorm.includes(query) ||
          typeNorm.includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [services, selectedRubro, searchQuery]);

  // Cronograma secuencial de los servicios seleccionados
  const serviceTimeline = useMemo(() => {
    if (!startTime || selectedServices.length === 0) return [];
    const [h, m] = startTime.split(":").map(Number);
    let curMin = (isNaN(h) ? 10 : h) * 60 + (isNaN(m) ? 0 : m);

    return selectedServices.map((s) => {
      const dur = s.duration_minutes || 30;
      const sH = Math.floor(curMin / 60) % 24;
      const sM = curMin % 60;
      const endMin = curMin + dur;
      const eH = Math.floor(endMin / 60) % 24;
      const eM = endMin % 60;

      const slotStr = `${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")} a ${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}`;
      curMin = endMin;

      return {
        service: s,
        slot: slotStr,
        duration: dur,
      };
    });
  }, [startTime, selectedServices]);

  // Sincronizar montos de pago mixto cuando cambie el total efectivo o se elija mixto
  useEffect(() => {
    if (paymentMethod === "mixto") {
      const totalNum = effectiveTotalPriceCents / 100;
      const half = (totalNum / 2).toFixed(2);
      const otherHalf = (totalNum - parseFloat(half)).toFixed(2);
      setYapeAmount(half);
      setCashAmount(otherHalf);
    }
  }, [paymentMethod, effectiveTotalPriceCents]);

  // Manejador bidireccional de Yape en Pago Mixto
  const handleYapeChange = (val: string) => {
    setYapeAmount(val);
    const yNum = parseFloat(val) || 0;
    const totalNum = effectiveTotalPriceCents / 100;
    const diff = Math.max(0, totalNum - yNum);
    setCashAmount(diff.toFixed(2));
  };

  // Manejador bidireccional de Efectivo en Pago Mixto
  const handleCashChange = (val: string) => {
    setCashAmount(val);
    const cNum = parseFloat(val) || 0;
    const totalNum = effectiveTotalPriceCents / 100;
    const diff = Math.max(0, totalNum - cNum);
    setYapeAmount(diff.toFixed(2));
  };

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

  // Manejador de selección de servicio (toggle)
  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const removeService = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedServiceIds((prev) => prev.filter((item) => item !== id));
    setCustomServicePrices((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (editingServiceId === id) {
      setEditingServiceId(null);
    }
    // Limpiar asignación individual si existía
    setServiceAssignments((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSaveCustomServicePrice = (serviceId: string) => {
    if (tempEditingPrice.trim() !== "") {
      const parsed = parseFloat(tempEditingPrice);
      if (!isNaN(parsed) && parsed >= 0) {
        const cents = Math.round(parsed * 100);
        setCustomServicePrices((prev) => ({
          ...prev,
          [serviceId]: cents,
        }));
      }
    }
    setEditingServiceId(null);
  };

  const handlePerServiceEmployeeChange = (serviceId: string, employeeId: string) => {
    setServiceAssignments((prev) => ({
      ...prev,
      [serviceId]: employeeId,
    }));
  };

  // ---------------------------------------------------------------------------
  // Guardar Reserva Walk-in con Asignación Inteligente
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!clientFirstName.trim()) {
      setErrorMsg("Por favor, ingresa el nombre del cliente.");
      return;
    }

    if (clientPhone.trim() && clientPhone.trim().length !== 9) {
      setErrorMsg("El número de teléfono / WhatsApp debe tener exactamente 9 dígitos.");
      return;
    }

    if (clientDni.trim() && clientDni.trim().length !== 8) {
      setErrorMsg("El número de DNI debe tener exactamente 8 dígitos.");
      return;
    }

    if (selectedServiceIds.length === 0) {
      setErrorMsg("Debes seleccionar al menos un servicio del catálogo.");
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

    // Validar total a cobrar personalizado
    if (customTotalPrice.trim() !== "") {
      const parsedCustom = parseFloat(customTotalPrice);
      if (isNaN(parsedCustom) || parsedCustom < 0) {
        setErrorMsg("El campo Total a Cobrar debe ser un número válido mayor o igual a S/ 0.00.");
        return;
      }
    }

    // Validar montos en pago mixto
    let yapeCents = 0;
    let cashCents = 0;

    if (paymentMethod === "mixto") {
      const yNum = parseFloat(yapeAmount) || 0;
      const cNum = parseFloat(cashAmount) || 0;
      const sum = Math.round((yNum + cNum) * 100);

      if (sum !== effectiveTotalPriceCents) {
        setErrorMsg(
          `La suma de Yape (S/ ${yNum.toFixed(2)}) y Efectivo (S/ ${cNum.toFixed(2)}) debe ser exactamente igual al total de S/ ${effectiveTotalPriceSoles}.`
        );
        return;
      }

      yapeCents = Math.round(yNum * 100);
      cashCents = Math.round(cNum * 100);
    }

    setSubmitting(true);

    try {
      const servicePricesMap: Record<string, number> = {};
      for (const id of selectedServiceIds) {
        const svc = services.find((s) => s.id === id);
        servicePricesMap[id] = customServicePrices[id] !== undefined
          ? customServicePrices[id]
          : (svc?.price_cents || 0);
      }

      const payload = {
        client_first_name: clientFirstName.trim(),
        client_last_name: clientLastName.trim() || "Presencial",
        client_phone: clientPhone.trim() || null,
        client_dni: clientDni.trim() || null,
        client_email: clientEmail.trim() || null,
        service_ids: selectedServiceIds,
        service_prices: servicePricesMap,
        total_price_cents: effectiveTotalPriceCents,
        assigned_employee_id: assignedEmployeeId || null,
        service_assignments: assignmentMode === "custom" ? serviceAssignments : undefined,
        booking_date: bookingDate,
        start_time: startTime,
        payment_method: paymentMethod,
        yape_amount_cents: yapeCents,
        cash_amount_cents: cashCents,
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

      setSuccessMsg(`¡Reserva ${data.booking?.booking_code || ""} confirmada y distribuida con éxito!`);

      // Limpiar formulario y cerrar
      setTimeout(() => {
        setSelectedServiceIds([]);
        setServiceAssignments({});
        setClientFirstName("");
        setClientLastName("");
        setClientPhone("");
        setClientDni("");
        setClientEmail("");
        setAssignedEmployeeId("");
        setPaymentMethod("efectivo");
        setSearchQuery("");
        setIsCustomPrice(false);
        setCustomTotalPrice("");
        setCustomServicePrices({});
        setEditingServiceId(null);
        setTempEditingPrice("");
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
          maxWidth: "820px",
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
              Buscador inteligente sobre catálogo, distribución equitativa de personal y cobro en mostrador
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

            {/* SECCIÓN 1: DATOS DEL CLIENTE */}
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
                    Teléfono / WhatsApp <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>(9 dígitos)</span>
                  </label>
                  <input
                    className="input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="Ej. 987654321"
                    value={clientPhone}
                    onChange={(e) => {
                      const numsOnly = e.target.value.replace(/\D/g, "").slice(0, 9);
                      setClientPhone(numsOnly);
                    }}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    DNI / Documento <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>(8 dígitos)</span>
                  </label>
                  <input
                    className="input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="Ej. 72345678"
                    value={clientDni}
                    onChange={(e) => {
                      const numsOnly = e.target.value.replace(/\D/g, "").slice(0, 8);
                      setClientDni(numsOnly);
                    }}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: BUSCADOR EN TIEMPO REAL Y SELECCIÓN DE SERVICIOS */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-primary, #C8A45C)", margin: 0, letterSpacing: "0.05em" }}>
                    2. Selección de Servicio(s) <span style={{ color: "#ef4444" }}>*</span>
                  </h3>
                  <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted, #a1a1aa)", margin: "2px 0 0 0" }}>
                    Filtra y selecciona múltiples servicios de Barbería y Spa en una misma cita
                  </p>
                </div>

                {/* Tabs de Rubro: Todos / Barbería / Spa con contadores */}
                <div
                  style={{
                    display: "flex",
                    background: "rgba(0, 0, 0, 0.3)",
                    padding: 3,
                    borderRadius: "var(--radius-md, 8px)",
                    border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
                    gap: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedRubro("todos")}
                    style={{
                      padding: "5px 12px",
                      fontSize: "0.75rem",
                      borderRadius: "var(--radius-sm, 6px)",
                      border: "none",
                      background: selectedRubro === "todos" ? "var(--color-primary, #C8A45C)" : "transparent",
                      color: selectedRubro === "todos" ? "#000" : "var(--color-text-muted, #a1a1aa)",
                      cursor: "pointer",
                      fontWeight: selectedRubro === "todos" ? 700 : 500,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>✨ Todos</span>
                    <span style={{ fontSize: "0.68rem", opacity: 0.85 }}>({services.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRubro("barberia")}
                    style={{
                      padding: "5px 12px",
                      fontSize: "0.75rem",
                      borderRadius: "var(--radius-sm, 6px)",
                      border: "none",
                      background: selectedRubro === "barberia" ? "var(--color-primary, #C8A45C)" : "transparent",
                      color: selectedRubro === "barberia" ? "#000" : "var(--color-text-muted, #a1a1aa)",
                      cursor: "pointer",
                      fontWeight: selectedRubro === "barberia" ? 700 : 500,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>💈 Barbería</span>
                    <span style={{ fontSize: "0.68rem", opacity: 0.85 }}>({barberiaCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRubro("spa")}
                    style={{
                      padding: "5px 12px",
                      fontSize: "0.75rem",
                      borderRadius: "var(--radius-sm, 6px)",
                      border: "none",
                      background: selectedRubro === "spa" ? "var(--color-primary, #C8A45C)" : "transparent",
                      color: selectedRubro === "spa" ? "#000" : "var(--color-text-muted, #a1a1aa)",
                      cursor: "pointer",
                      fontWeight: selectedRubro === "spa" ? 700 : 500,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>💆‍♀️ Spa</span>
                    <span style={{ fontSize: "0.68rem", opacity: 0.85 }}>({spaCount})</span>
                  </button>
                </div>
              </div>

              {/* Barra de Búsqueda Interactiva en Tiempo Real */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "0.9rem",
                    color: "var(--color-text-muted, #a1a1aa)",
                    pointerEvents: "none",
                  }}
                >
                  🔍
                </span>
                <input
                  type="text"
                  className="input"
                  placeholder="Buscar servicio por nombre, detalle o categoría (ej. Facial, Cejas, Corte, Barba, Depilación)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    paddingLeft: 36,
                    paddingRight: searchQuery ? 32 : 12,
                    fontSize: "0.82rem",
                    background: "rgba(0, 0, 0, 0.35)",
                    borderColor: searchQuery ? "var(--color-primary, #C8A45C)" : "var(--color-border)",
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "var(--color-text-muted, #a1a1aa)",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      padding: 4,
                    }}
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Riel de Servicios Seleccionados (Persistencia Visual) */}
              {selectedServices.length > 0 && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: "8px 12px",
                    background: "rgba(200, 164, 92, 0.08)",
                    border: "1px solid rgba(200, 164, 92, 0.25)",
                    borderRadius: "var(--radius-md, 8px)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-primary, #C8A45C)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      ✓ {selectedServices.length} {selectedServices.length === 1 ? "Servicio Seleccionado" : "Servicios Seleccionados"} (Total: S/ {effectiveTotalPriceSoles} · {totalDurationMinutes} min):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedServiceIds([]);
                        setServiceAssignments({});
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        fontSize: "0.7rem",
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: 0,
                      }}
                    >
                      Limpiar selección
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {selectedServices.map((s) => {
                      const curPriceCents = customServicePrices[s.id] !== undefined ? customServicePrices[s.id] : (s.price_cents || 0);
                      const isPriceEdited = customServicePrices[s.id] !== undefined && customServicePrices[s.id] !== s.price_cents;
                      const isEditingThis = editingServiceId === s.id;

                      return (
                        <span
                          key={s.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: isPriceEdited ? "rgba(200, 164, 92, 0.28)" : "rgba(200, 164, 92, 0.16)",
                            border: isPriceEdited ? "1px solid var(--color-primary, #C8A45C)" : "1px solid rgba(200, 164, 92, 0.35)",
                            color: "#fff",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: "var(--radius-sm, 6px)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span>{s.type === "barberia" ? "💈" : "💆‍♀️"}</span>
                          <span>{s.name}</span>

                          {/* Edición interactiva por clic en el monto */}
                          {isEditingThis ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                background: "rgba(0, 0, 0, 0.8)",
                                padding: "1px 4px",
                                borderRadius: "4px",
                                border: "1px solid var(--color-primary, #C8A45C)",
                                boxShadow: "0 0 8px rgba(200, 164, 92, 0.5)",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span style={{ fontSize: "0.7rem", color: "var(--color-primary, #C8A45C)", fontWeight: 700 }}>
                                S/
                              </span>
                              <input
                                type="number"
                                step="0.50"
                                min="0"
                                autoFocus
                                value={tempEditingPrice}
                                onChange={(e) => setTempEditingPrice(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSaveCustomServicePrice(s.id);
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditingServiceId(null);
                                  }
                                }}
                                onBlur={() => handleSaveCustomServicePrice(s.id)}
                                style={{
                                  width: "62px",
                                  padding: "1px 2px",
                                  fontSize: "0.75rem",
                                  fontWeight: 800,
                                  color: "var(--color-success, #22c55e)",
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                  textAlign: "right",
                                }}
                              />
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSaveCustomServicePrice(s.id);
                                }}
                                style={{
                                  background: "var(--color-primary, #C8A45C)",
                                  color: "#000",
                                  border: "none",
                                  borderRadius: "3px",
                                  padding: "1px 4px",
                                  fontSize: "0.68rem",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  lineHeight: 1,
                                }}
                                title="Confirmar nuevo precio"
                              >
                                ✓
                              </button>
                            </div>
                          ) : (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingServiceId(s.id);
                                setTempEditingPrice((curPriceCents / 100).toFixed(2));
                              }}
                              style={{
                                color: "var(--color-success, #22c55e)",
                                fontWeight: 700,
                                cursor: "pointer",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                background: isPriceEdited ? "rgba(200, 164, 92, 0.25)" : "rgba(34, 197, 94, 0.12)",
                                border: isPriceEdited ? "1px dashed var(--color-primary, #C8A45C)" : "1px solid transparent",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                transition: "all 0.15s ease",
                              }}
                              title="Clic sobre el monto para editar el precio de este servicio"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(200, 164, 92, 0.35)";
                                e.currentTarget.style.borderColor = "var(--color-primary, #C8A45C)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = isPriceEdited ? "rgba(200, 164, 92, 0.25)" : "rgba(34, 197, 94, 0.12)";
                                e.currentTarget.style.borderColor = isPriceEdited ? "var(--color-primary, #C8A45C)" : "transparent";
                              }}
                            >
                              <span>S/ {(curPriceCents / 100).toFixed(2)}</span>
                              <span style={{ fontSize: "0.65rem", opacity: 0.8 }} title="Editar monto">✏️</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => removeService(s.id, e)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--color-text-muted, #a1a1aa)",
                              cursor: "pointer",
                              padding: "0 2px",
                              fontSize: "0.75rem",
                              lineHeight: 1,
                            }}
                            title="Quitar servicio"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Catálogo de Tarjetas de Servicios Filtradas */}
              {loadingInitial ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
                  Cargando catálogo de servicios...
                </div>
              ) : visibleServices.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                    background: "rgba(0, 0, 0, 0.2)",
                    borderRadius: "var(--radius-md, 8px)",
                    border: "1px dashed var(--color-border)",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>
                    No se encontraron servicios que coincidan con <strong>"{searchQuery}"</strong> en {selectedRubro === "todos" ? "el catálogo" : selectedRubro === "barberia" ? "Barbería" : "Spa"}.
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: 8, fontSize: "0.75rem" }}
                    >
                      Mostrar todos los servicios
                    </button>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                    gap: 8,
                    maxHeight: "200px",
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
                          background: isSelected ? "rgba(200, 164, 92, 0.14)" : "rgba(255,255,255,0.02)",
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
                          onChange={() => {}}
                          style={{ marginTop: 2, cursor: "pointer", accentColor: "var(--color-primary, #C8A45C)" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: "0.75rem" }}>{s.type === "barberia" ? "💈" : "💆‍♀️"}</span>
                            <div
                              style={{
                                fontSize: "0.78rem",
                                fontWeight: isSelected ? 700 : 600,
                                color: isSelected ? "var(--color-primary, #C8A45C)" : "#fff",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {s.name}
                            </div>
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

            {/* SECCIÓN 3: PROGRAMACIÓN Y ASIGNACIÓN INTELIGENTE DE PERSONAL */}
            <div>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-primary, #C8A45C)", marginBottom: 10, letterSpacing: "0.05em" }}>
                3. Programación y Distribución de Personal
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

                {/* Si solo hay 1 servicio o modo simple */}
                {selectedServices.length <= 1 ? (
                  <div>
                    <label className="label" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                      Colaborador Asignado
                    </label>
                    <select
                      className="select"
                      value={assignedEmployeeId}
                      onChange={(e) => setAssignedEmployeeId(e.target.value)}
                      style={{ width: "100%" }}
                    >
                      <option value="">— 🤖 Asignación Automática Inteligente —</option>
                      {employeesList
                        .filter((emp) => {
                          if (selectedServices.length === 1) {
                            const reqType = selectedServices[0].type;
                            return !emp.type || emp.type === reqType || emp.type === "ambos";
                          }
                          return true;
                        })
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name} {emp.type ? `(${emp.type === "barberia" ? "Barbero" : emp.type === "spa" ? "Spa" : emp.type})` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="label" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                      Modo de Asignación ({selectedServices.length} servicios)
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setAssignmentMode("auto");
                          setAssignedEmployeeId("");
                        }}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          fontSize: "0.75rem",
                          borderRadius: "var(--radius-sm, 6px)",
                          border: assignmentMode === "auto" ? "1px solid var(--color-primary, #C8A45C)" : "1px solid var(--color-border)",
                          background: assignmentMode === "auto" ? "rgba(200, 164, 92, 0.15)" : "transparent",
                          color: assignmentMode === "auto" ? "var(--color-primary, #C8A45C)" : "var(--color-text-muted)",
                          fontWeight: assignmentMode === "auto" ? 700 : 500,
                          cursor: "pointer",
                        }}
                      >
                        🤖 Automático
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignmentMode("custom")}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          fontSize: "0.75rem",
                          borderRadius: "var(--radius-sm, 6px)",
                          border: assignmentMode === "custom" ? "1px solid var(--color-primary, #C8A45C)" : "1px solid var(--color-border)",
                          background: assignmentMode === "custom" ? "rgba(200, 164, 92, 0.15)" : "transparent",
                          color: assignmentMode === "custom" ? "var(--color-primary, #C8A45C)" : "var(--color-text-muted)",
                          fontWeight: assignmentMode === "custom" ? 700 : 500,
                          cursor: "pointer",
                        }}
                      >
                        ⚙️ Por Servicio
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Panel de Asignación Detallada Multi-Servicio */}
              {selectedServices.length > 1 && assignmentMode === "custom" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 14px",
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
                    borderRadius: "var(--radius-md, 8px)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-primary, #C8A45C)" }}>
                    ⚙️ Asignación Individual de Colaboradores por Servicio:
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                    {serviceTimeline.map((item, idx) => {
                      const svc = item.service;
                      const assignedId = serviceAssignments[svc.id] || "";
                      const matchingEmployees = employeesList.filter(
                        (e) => !e.type || e.type === svc.type || e.type === "ambos"
                      );

                      return (
                        <div
                          key={svc.id}
                          style={{
                            padding: "8px 10px",
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                            borderRadius: "var(--radius-sm, 6px)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>
                              {idx + 1}. {svc.type === "barberia" ? "💈" : "💆‍♀️"} {svc.name}
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
                              🕒 {item.slot} ({item.duration}m)
                            </span>
                          </div>
                          <select
                            className="select"
                            value={assignedId}
                            onChange={(e) => handlePerServiceEmployeeChange(svc.id, e.target.value)}
                            style={{ width: "100%", fontSize: "0.75rem", padding: "4px 8px" }}
                          >
                            <option value="">— 🤖 Asignación Automática —</option>
                            {matchingEmployees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.first_name} {emp.last_name} {emp.type ? `(${emp.type === "barberia" ? "Barbero" : "Spa"})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Timeline de Horario Estimado Multi-Servicio */}
              {selectedServices.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    background: "rgba(56, 189, 248, 0.06)",
                    border: "1px solid rgba(56, 189, 248, 0.2)",
                    borderRadius: "var(--radius-md, 8px)",
                    fontSize: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ color: "#38bdf8", fontWeight: 700 }}>📅 Cronograma:</span>
                  {serviceTimeline.map((item, idx) => (
                    <span key={item.service.id} style={{ color: "var(--color-text, #f4f4f5)" }}>
                      {idx > 0 && <span style={{ color: "var(--color-text-muted)", margin: "0 4px" }}>➔</span>}
                      <strong>{item.slot}</strong> ({item.service.name})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* SECCIÓN 4: MÉTODO DE PAGO Y CONFIRMACIÓN */}
            <div>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-primary, #C8A45C)", marginBottom: 10, letterSpacing: "0.05em" }}>
                4. Método de Pago y Confirmación *
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                {/* Opción 1: Efectivo */}
                <div
                  onClick={() => setPaymentMethod("efectivo")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md, 8px)",
                    border: paymentMethod === "efectivo"
                      ? "2px solid #22c55e"
                      : "1px solid var(--color-border, rgba(255,255,255,0.08))",
                    background: paymentMethod === "efectivo" ? "rgba(34, 197, 94, 0.12)" : "rgba(255,255,255,0.02)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.85rem", color: paymentMethod === "efectivo" ? "#22c55e" : "#fff" }}>
                    <span>💵</span>
                    <span>Efectivo</span>
                  </div>
                  <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted, #a1a1aa)", margin: "4px 0 0 0" }}>
                    Cobro físico en mostrador
                  </p>
                </div>

                {/* Opción 2: Yape */}
                <div
                  onClick={() => setPaymentMethod("yape")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md, 8px)",
                    border: paymentMethod === "yape"
                      ? "2px solid #a855f7"
                      : "1px solid var(--color-border, rgba(255,255,255,0.08))",
                    background: paymentMethod === "yape" ? "rgba(168, 85, 247, 0.12)" : "rgba(255,255,255,0.02)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.85rem", color: paymentMethod === "yape" ? "#c084fc" : "#fff" }}>
                    <span>💜</span>
                    <span>Yape</span>
                  </div>
                  <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted, #a1a1aa)", margin: "4px 0 0 0" }}>
                    Pago vía App / Código QR
                  </p>
                </div>

                {/* Opción 3: Transferencia */}
                <div
                  onClick={() => setPaymentMethod("transferencia")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md, 8px)",
                    border: paymentMethod === "transferencia"
                      ? "2px solid #3b82f6"
                      : "1px solid var(--color-border, rgba(255,255,255,0.08))",
                    background: paymentMethod === "transferencia" ? "rgba(59, 130, 246, 0.12)" : "rgba(255,255,255,0.02)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.85rem", color: paymentMethod === "transferencia" ? "#60a5fa" : "#fff" }}>
                    <span>🏦</span>
                    <span>Transferencia</span>
                  </div>
                  <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted, #a1a1aa)", margin: "4px 0 0 0" }}>
                    BCP, BBVA, Interbank, Plin
                  </p>
                </div>

                {/* Opción 4: Mixto (Yape + Efectivo) */}
                <div
                  onClick={() => setPaymentMethod("mixto")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md, 8px)",
                    border: paymentMethod === "mixto"
                      ? "2px solid #f59e0b"
                      : "1px solid var(--color-border, rgba(255,255,255,0.08))",
                    background: paymentMethod === "mixto" ? "rgba(245, 158, 11, 0.12)" : "rgba(255,255,255,0.02)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.85rem", color: paymentMethod === "mixto" ? "#f59e0b" : "#fff" }}>
                    <span>🔄</span>
                    <span>Mixto</span>
                  </div>
                  <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted, #a1a1aa)", margin: "4px 0 0 0" }}>
                    Yape + Efectivo combinado
                  </p>
                </div>
              </div>

              {/* Panel de desglose interactivo para Pago Mixto */}
              {paymentMethod === "mixto" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "14px 16px",
                    borderRadius: "var(--radius-md, 8px)",
                    background: "rgba(245, 158, 11, 0.08)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#f59e0b", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🔄</span>
                    <span>Desglose de Pago Mixto (Total: S/ {effectiveTotalPriceSoles})</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="label" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#c084fc" }}>
                        💜 Monto por Yape (S/)
                      </label>
                      <input
                        type="number"
                        step="0.10"
                        min="0"
                        max={effectiveTotalPriceSoles}
                        className="input"
                        placeholder="0.00"
                        value={yapeAmount}
                        onChange={(e) => handleYapeChange(e.target.value)}
                        style={{ width: "100%", fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#22c55e" }}>
                        💵 Monto en Efectivo (S/)
                      </label>
                      <input
                        type="number"
                        step="0.10"
                        min="0"
                        max={effectiveTotalPriceSoles}
                        className="input"
                        placeholder="0.00"
                        value={cashAmount}
                        onChange={(e) => handleCashChange(e.target.value)}
                        style={{ width: "100%", fontWeight: 700 }}
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted, #a1a1aa)", margin: 0 }}>
                    💡 Al ingresar el monto de uno de los métodos, el otro se calcula automáticamente para cuadrar con el total de S/ {effectiveTotalPriceSoles}.
                  </p>
                </div>
              )}

              {/* Mensaje de confirmación del método */}
              <div style={{ marginTop: 8, fontSize: "0.75rem", color: "#22c55e" }}>
                <span>
                  ✓ Al guardar, la reserva quedará <strong>confirmada</strong> y marcada como <strong>PAGADO COMPLETO (S/ {effectiveTotalPriceSoles})</strong> con comprobante de cobro registrado.
                </span>
              </div>
            </div>

            {/* SECCIÓN 5: RESUMEN FINANCIERO Y DE TIEMPO EN VIVO */}
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
                  {selectedRubro !== "todos" ? ` (${selectedRubro === "barberia" ? "Barbería" : "Spa"})` : ""}
                </span>
              </div>

              <div style={{ textAlign: "right", minWidth: "180px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginBottom: 4 }}>
                  <label
                    htmlFor="booking-custom-total-input"
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--color-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      cursor: "pointer",
                      margin: 0,
                    }}
                  >
                    Total a Cobrar
                  </label>
                  {isCustomPrice && customTotalPrice !== catalogTotalPriceSoles && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomPrice(false);
                        setCustomTotalPrice(catalogTotalPriceSoles);
                      }}
                      style={{
                        background: "rgba(200, 164, 92, 0.15)",
                        border: "1px solid rgba(200, 164, 92, 0.4)",
                        color: "var(--color-primary, #C8A45C)",
                        borderRadius: "4px",
                        fontSize: "0.65rem",
                        padding: "1px 6px",
                        cursor: "pointer",
                        lineHeight: "1.2",
                      }}
                      title="Restablecer al monto calculado referencial del catálogo"
                    >
                      ↺ Sugerido (S/ {catalogTotalPriceSoles})
                    </button>
                  )}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 10,
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      color: "var(--color-success, #22c55e)",
                      pointerEvents: "none",
                    }}
                  >
                    S/
                  </span>
                  <input
                    id="booking-custom-total-input"
                    type="number"
                    step="0.50"
                    min="0"
                    value={customTotalPrice}
                    onChange={(e) => {
                      setCustomTotalPrice(e.target.value);
                      setIsCustomPrice(true);
                    }}
                    placeholder="0.00"
                    disabled={submitting || selectedServiceIds.length === 0}
                    style={{
                      width: "140px",
                      padding: "5px 10px 5px 34px",
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      color: "var(--color-success, #22c55e)",
                      background: "rgba(0, 0, 0, 0.4)",
                      border: isCustomPrice && customTotalPrice !== catalogTotalPriceSoles
                        ? "1.5px solid var(--color-primary, #C8A45C)"
                        : "1px solid var(--color-border, rgba(255,255,255,0.18))",
                      borderRadius: "var(--radius-sm, 8px)",
                      textAlign: "right",
                      outline: "none",
                      boxShadow: isCustomPrice && customTotalPrice !== catalogTotalPriceSoles
                        ? "0 0 8px rgba(200, 164, 92, 0.3)"
                        : "none",
                    }}
                  />
                </div>
                {isCustomPrice && customTotalPrice !== catalogTotalPriceSoles && (
                  <span style={{ display: "block", fontSize: "0.68rem", color: "var(--color-primary, #C8A45C)", marginTop: 2 }}>
                    ✏️ Monto personalizado (Ref: S/ {catalogTotalPriceSoles})
                  </span>
                )}
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
                  <span>Guardando y Asignando...</span>
                </>
              ) : (
                <>
                  <span>💾 Guardar y Confirmar Reserva</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
