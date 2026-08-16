"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useCart, CartService } from "@/components/cart/CartProvider";
import { formatDuration } from "@/lib/utils/format";
import { generateWhatsAppBookingUrl } from "@/lib/utils/whatsapp";

type Service = CartService;
type Step = "type" | "services" | "datetime" | "contact" | "success";

export default function ReservarPage() {
  const { cart: sessionCart, clearCart: clearSessionCart } = useCart();

  const [stepHistory, setStepHistory] = useState<Step[]>(["type"]);
  const step = stepHistory[stepHistory.length - 1] || "type";

  const [serviceType, setServiceType] = useState<"barberia" | "spa" | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [cart, setCart] = useState<Service[]>([]);
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [contact, setContact] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    dni: "",
    notes: "",
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookingResult, setBookingResult] = useState<{
    booking_id: string;
    booking_code: string;
    client_name: string;
    booking_date: string;
    start_time: string;
    total_price_cents: number;
    total_price_soles: string;
    services: string[];
    whatsapp_url: string;
  } | null>(null);

  const supabase = createClient();

  function goToStep(nextStep: Step) {
    setError("");
    setStepHistory((prev) => {
      if (prev[prev.length - 1] === nextStep) return prev;
      return [...prev, nextStep];
    });
  }

  function handlePrevStep() {
    setError("");
    if (stepHistory.length > 1) {
      setStepHistory((prev) => prev.slice(0, -1));
    } else {
      window.location.href = "/";
    }
  }

  // Load cart and URL params on mount
  useEffect(() => {
    async function initBookingState() {
      const params = new URLSearchParams(window.location.search);
      const typeParam = params.get("type") as "barberia" | "spa" | null;
      const serviceIdParam = params.get("serviceId") || params.get("service");

      let currentCart = [...sessionCart];

      if (serviceIdParam) {
        const existsInCart = currentCart.some((s) => s.id === serviceIdParam);
        if (!existsInCart) {
          const { data: fetchedService } = await supabase
            .from("services")
            .select("id, name, slug, description, type, price_cents, duration_minutes, images")
            .eq("id", serviceIdParam)
            .single();

          if (fetchedService) {
            const newService: Service = {
              id: fetchedService.id,
              name: fetchedService.name,
              slug: fetchedService.slug,
              description: fetchedService.description,
              type: fetchedService.type as "barberia" | "spa",
              price_cents: fetchedService.price_cents,
              duration_minutes: fetchedService.duration_minutes,
              images: fetchedService.images || [],
            };
            currentCart = [...currentCart, newService];
          }
        }
      }

      if (currentCart.length > 0) {
        setCart(currentCart);
        const primaryType = currentCart[0]?.type || typeParam;
        if (primaryType === "barberia" || primaryType === "spa") {
          setServiceType(primaryType);
        }
        setStepHistory(["type", "services", "datetime"]);
      } else if (typeParam === "barberia" || typeParam === "spa") {
        setServiceType(typeParam);
        setStepHistory(["type", "services"]);
      }
    }

    initBookingState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load services
  useEffect(() => {
    async function loadServices() {
      let query = supabase
        .from("services")
        .select("id, name, slug, description, type, price_cents, duration_minutes, images")
        .eq("is_active", true)
        .eq("is_public", true);
      if (serviceType) {
        query = query.eq("type", serviceType);
      }
      const { data } = await query.order("sort_order");
      setServices(data ?? []);
    }
    loadServices();
  }, [serviceType, supabase]);

  // Prefill contact from profile
  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setIsAuthenticated(true);
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, phone, dni")
          .eq("id", user.id)
          .single();
        if (profile) {
          let fn = (profile.first_name || "").trim();
          let ln = (profile.last_name || "").trim();
          if (!ln && fn.includes(" ")) {
            const parts = fn.split(" ");
            fn = parts[0];
            ln = parts.slice(1).join(" ");
          }
          const rawPhone = profile.phone ? profile.phone.replace(/\D/g, "") : "";
          const cleanPhone = rawPhone.length > 9 ? rawPhone.slice(-9) : rawPhone;

          setContact((c) => ({
            ...c,
            firstName: fn || c.firstName,
            lastName: ln || c.lastName,
            phone: cleanPhone || c.phone,
            dni: profile.dni || c.dni,
            email: user.email || c.email,
          }));
        }
      } else {
        setIsAuthenticated(false);
      }
    }
    loadProfile();
  }, [supabase]);

  const totalCents = cart.reduce((sum, s) => sum + s.price_cents, 0);
  const totalDuration = cart.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPriceSoles = (totalCents / 100).toFixed(2);

  function toggleService(service: Service) {
    setCart((prev) =>
      prev.find((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  }

  // Handle WhatsApp Reservation
  async function handleCreateBookingWhatsApp() {
    if (!contact.firstName.trim() || !contact.lastName.trim()) {
      setError("Por favor, ingresa tu nombre y apellido completo.");
      return;
    }
    const cleanPhone = contact.phone.replace(/\D/g, "");
    if (!cleanPhone) {
      setError("Por favor, ingresa tu número de WhatsApp / Teléfono.");
      return;
    }
    if (cleanPhone.length !== 9) {
      setError("El número de WhatsApp / Teléfono debe contener exactamente 9 dígitos numéricos.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_ids: cart.map((s) => s.id),
          booking_date: bookingDate,
          start_time: startTime,
          client_first_name: contact.firstName.trim(),
          client_last_name: contact.lastName.trim(),
          client_phone: cleanPhone,
          client_email: contact.email.trim() || null,
          client_dni: contact.dni.trim() || null,
          notes: contact.notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al registrar la reserva.");
        setLoading(false);
        return;
      }

      setBookingResult(data);
      clearSessionCart();
      setCart([]);
      setBookingDate("");
      setStartTime("");
      setStepHistory(["success"]);

      // Abrir automáticamente WhatsApp en una nueva pestaña
      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, "_blank");
      }
    } catch {
      setError("Error de conexión al registrar la reserva. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function handleNewBooking() {
    setCart([]);
    clearSessionCart();
    setBookingDate("");
    setStartTime("");
    setBookingResult(null);
    setServiceType(null);
    setStepHistory(["type"]);
  }

  // Generate time slots according to selected day of week:
  // Lunes a Sábado: 9:00 am a 9:00 pm (09:00 - 21:00)
  // Domingo: 10:00 am a 8:00 pm (10:00 - 20:00)
  let isSunday = false;
  const timeSlots: string[] = [];

  if (bookingDate) {
    const [y, m, d] = bookingDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    isSunday = dateObj.getDay() === 0;

    const startHour = isSunday ? 10 : 9;
    const endHour = isSunday ? 20 : 21;

    for (let h = startHour; h <= endHour; h++) {
      timeSlots.push(`${String(h).padStart(2, "0")}:00`);
      if (h < endHour) {
        timeSlots.push(`${String(h).padStart(2, "0")}:30`);
      }
    }
  }

  const today = new Date();
  const minDate = today.toISOString().split("T")[0];

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "100px 24px 60px",
        background:
          "radial-gradient(ellipse at 50% 10%, rgba(200,164,92,0.06) 0%, var(--color-bg) 60%)",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Navigation Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            gap: 16,
          }}
        >
          {step !== "success" ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="btn btn-ghost btn-sm"
              style={{
                padding: "6px 14px",
                fontSize: "0.875rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ← Volver
            </button>
          ) : (
            <div />
          )}

          <Link
            href="/"
            className="btn btn-ghost btn-sm"
            style={{
              padding: "6px 14px",
              fontSize: "0.875rem",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            🏠 Volver al Inicio
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 36, textAlign: "center" }}>
          <Link
            href="/"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <img
              src="/LogoAcicalados.svg"
              alt="Logo Acicalados"
              style={{ height: 26, width: "auto" }}
            />
            <span className="text-gold" style={{ fontWeight: 800, fontSize: "1.25rem" }}>
              ACICALADOS
            </span>
          </Link>
          <h1 className="heading-lg" style={{ marginTop: 12 }}>
            Reservar Cita
          </h1>
          <div className="divider-gold" style={{ margin: "12px auto 0" }} />
        </div>

        {/* Progress Bar */}
        {step !== "success" && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginBottom: 40,
            }}
          >
            {["type", "services", "datetime", "contact"].map((s, i) => (
              <div
                key={s}
                style={{
                  width: 44,
                  height: 4,
                  borderRadius: 2,
                  background:
                    ["type", "services", "datetime", "contact"].indexOf(step) >= i
                      ? "var(--color-primary)"
                      : "var(--color-border)",
                  transition: "background var(--transition-normal)",
                }}
              />
            ))}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(184,59,46,0.1)",
              border: "1px solid rgba(184,59,46,0.2)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-error)",
              fontSize: "0.875rem",
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        {/* Step 1: Choose type */}
        {step === "type" && (
          <div className="animate-fadeInUp">
            <h2
              className="heading-md"
              style={{ marginBottom: 24, textAlign: "center", color: "#FFFFFF" }}
            >
              ¿Qué servicio necesitas?
            </h2>
            <div className="grid grid-2">
              <button
                type="button"
                onClick={() => {
                  setServiceType("barberia");
                  goToStep("services");
                }}
                className="card card-gold"
                style={{
                  cursor: "pointer",
                  textAlign: "center",
                  padding: 32,
                  border: "1px solid var(--color-primary-border)",
                  background: "rgba(20, 18, 12, 0.9)",
                  color: "#FFFFFF",
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <img
                    src="/LogoBarberia.svg"
                    alt="Barbería"
                    style={{ width: 64, height: 64, display: "inline-block" }}
                  />
                </div>
                <h3
                  className="heading-sm"
                  style={{
                    color: "var(--color-primary)",
                    fontSize: "1.25rem",
                    fontWeight: 700,
                  }}
                >
                  Barbería
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    marginTop: 8,
                    color: "rgba(255, 255, 255, 0.85)",
                  }}
                >
                  Cortes, barba, perfilado y tratamientos capilares
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setServiceType("spa");
                  goToStep("services");
                }}
                className="card card-gold"
                style={{
                  cursor: "pointer",
                  textAlign: "center",
                  padding: 32,
                  border: "1px solid var(--color-primary-border)",
                  background: "rgba(20, 18, 12, 0.9)",
                  color: "#FFFFFF",
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <img
                    src="/LogoSpa.svg"
                    alt="Spa"
                    style={{ width: 64, height: 64, display: "inline-block" }}
                  />
                </div>
                <h3
                  className="heading-sm"
                  style={{
                    color: "var(--color-primary)",
                    fontSize: "1.25rem",
                    fontWeight: 700,
                  }}
                >
                  Spa & Relax
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    marginTop: 8,
                    color: "rgba(255, 255, 255, 0.85)",
                  }}
                >
                  Masajes, faciales, manicure, pedicure y exfoliación
                </p>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setServiceType(null);
                goToStep("services");
              }}
              className="card card-gold"
              style={{
                cursor: "pointer",
                textAlign: "center",
                padding: 24,
                marginTop: 16,
                border: "1px solid var(--color-primary-border)",
                width: "100%",
                background: "rgba(20, 18, 12, 0.9)",
                color: "#FFFFFF",
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <img
                  src="/LogoTodo.svg"
                  alt="Todos los servicios"
                  style={{ width: 48, height: 48, display: "inline-block" }}
                />
              </div>
              <h3
                className="heading-sm"
                style={{
                  color: "var(--color-primary)",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                }}
              >
                Ver todos los servicios
              </h3>
              <p
                style={{
                  fontSize: "0.875rem",
                  marginTop: 8,
                  color: "rgba(255, 255, 255, 0.85)",
                }}
              >
                Combina barbería y spa en una sola cita
              </p>
            </button>
          </div>
        )}

        {/* Step 2: Select services */}
        {step === "services" && (
          <div className="animate-fadeInUp">
            <h2
              className="heading-md"
              style={{ marginBottom: 24, color: "#FFFFFF" }}
            >
              Selecciona tus servicios
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {services.map((service) => {
                const isSelected = cart.some((s) => s.id === service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service)}
                    className="card card-gold"
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderColor: isSelected
                        ? "var(--color-primary)"
                        : "var(--color-border)",
                      background: isSelected
                        ? "rgba(200,164,92,0.08)"
                        : "rgba(20, 18, 12, 0.9)",
                      textAlign: "left",
                      padding: "16px 20px",
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <h4
                          style={{
                            fontWeight: 700,
                            color: isSelected
                              ? "var(--color-primary)"
                              : "#FFFFFF",
                            fontSize: "1rem",
                          }}
                        >
                          {service.name}
                        </h4>
                        <span
                          className="badge"
                          style={{
                            fontSize: "0.6875rem",
                            textTransform: "uppercase",
                          }}
                        >
                          {service.type}
                        </span>
                      </div>
                      {service.description && (
                        <p
                          style={{
                            fontSize: "0.84rem",
                            color: "rgba(255, 255, 255, 0.8)",
                            marginBottom: 6,
                            lineHeight: 1.4,
                          }}
                        >
                          {service.description}
                        </p>
                      )}
                      <p
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--color-primary-light)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        ⏱️ {formatDuration(service.duration_minutes)}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span
                        style={{
                          fontWeight: 800,
                          color: "var(--color-primary)",
                          fontSize: "1.125rem",
                        }}
                      >
                        S/ {(service.price_cents / 100).toFixed(2)}
                      </span>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "var(--radius-sm)",
                          border: `2px solid ${
                            isSelected
                              ? "var(--color-primary)"
                              : "var(--color-primary-border)"
                          }`,
                          background: isSelected
                            ? "var(--color-primary)"
                            : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#000000",
                          fontSize: "0.9375rem",
                          fontWeight: 800,
                          boxShadow: isSelected
                            ? "0 0 8px rgba(200, 164, 92, 0.4)"
                            : "none",
                        }}
                      >
                        {isSelected ? "✓" : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {cart.length > 0 && (
              <div
                style={{
                  marginTop: 24,
                  padding: 16,
                  background: "var(--color-bg-card)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                    {cart.length} {cart.length === 1 ? "servicio" : "servicios"}{" "}
                    seleccionados
                  </p>
                  <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                    Duración estimada: {formatDuration(totalDuration)}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      color: "var(--color-primary)",
                    }}
                  >
                    S/ {totalPriceSoles}
                  </p>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button
                onClick={handlePrevStep}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                ← Volver
              </button>
              <button
                onClick={() => goToStep("datetime")}
                disabled={cart.length === 0}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Continuar ({cart.length}) →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === "datetime" && (
          <div className="animate-fadeInUp">
            <h2
              className="heading-md"
              style={{ marginBottom: 24, color: "#FFFFFF" }}
            >
              Selecciona Fecha y Hora
            </h2>

            <div style={{ marginBottom: 24 }}>
              <label className="label">Fecha de la cita *</label>
              <input
                type="date"
                min={minDate}
                value={bookingDate}
                onChange={(e) => {
                  setBookingDate(e.target.value);
                  setStartTime("");
                }}
                className="input"
                required
              />
            </div>

            {bookingDate && (
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                    flexWrap: "wrap",
                    gap: 4,
                  }}
                >
                  <label className="label" style={{ marginBottom: 0 }}>
                    Horario de atención *
                  </label>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--color-primary)",
                      fontWeight: 600,
                    }}
                  >
                    {isSunday
                      ? "Domingo (10:00 am – 8:00 pm)"
                      : "Lunes a Sábado (9:00 am – 9:00 pm)"}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                    gap: 8,
                  }}
                >
                  {timeSlots.map((slot) => {
                    const isSelected = startTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setStartTime(slot)}
                        className={`btn ${
                          isSelected ? "btn-primary" : "btn-secondary"
                        } btn-sm`}
                        style={{
                          padding: "8px 4px",
                          fontSize: "0.875rem",
                          fontWeight: isSelected ? 700 : 500,
                        }}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={handlePrevStep}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                ← Volver
              </button>
              <button
                onClick={() => goToStep("contact")}
                disabled={!bookingDate || !startTime}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Contact & WhatsApp Reservation */}
        {step === "contact" && (
          <div className="animate-fadeInUp">
            <h2
              className="heading-md"
              style={{ marginBottom: 24, color: "#FFFFFF" }}
            >
              Datos del Cliente
            </h2>

            <div
              className="grid grid-2"
              style={{ gap: 16, marginBottom: 16 }}
            >
              <div>
                <label className="label">Nombre *</label>
                <input
                  className="input"
                  value={contact.firstName}
                  onChange={(e) =>
                    setContact({ ...contact, firstName: e.target.value })
                  }
                  placeholder="Tu nombre"
                  required
                />
              </div>
              <div>
                <label className="label">Apellidos *</label>
                <input
                  className="input"
                  value={contact.lastName}
                  onChange={(e) =>
                    setContact({ ...contact, lastName: e.target.value })
                  }
                  placeholder="Tus apellidos"
                  required
                />
              </div>
            </div>

            <div
              className="grid grid-2"
              style={{ gap: 16, marginBottom: 16 }}
            >
              <div>
                <label className="label">WhatsApp / Teléfono *</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  className="input"
                  value={contact.phone}
                  onChange={(e) => {
                    const numericOnly = e.target.value.replace(/\D/g, "").slice(0, 9);
                    setContact({ ...contact, phone: numericOnly });
                  }}
                  placeholder="Ej. 997766828"
                  maxLength={9}
                  required
                />
              </div>
              <div>
                <label className="label">DNI (Opcional)</label>
                <input
                  className="input"
                  value={contact.dni}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setContact({ ...contact, dni: val });
                  }}
                  placeholder="8 dígitos"
                  maxLength={8}
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="label">Correo Electrónico (Opcional)</label>
              <input
                type="email"
                className="input"
                value={contact.email}
                onChange={(e) =>
                  setContact({ ...contact, email: e.target.value })
                }
                placeholder="tu@correo.com"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="label">Indicaciones especiales (Opcional)</label>
              <textarea
                className="input"
                rows={2}
                value={contact.notes}
                onChange={(e) =>
                  setContact({ ...contact, notes: e.target.value })
                }
                placeholder="¿Alguna preferencia de corte, alergia o detalle especial?"
                style={{ resize: "vertical" }}
              />
            </div>

            {/* Summary Card */}
            <div className="card card-gold" style={{ marginBottom: 24 }}>
              <h4 className="heading-sm" style={{ marginBottom: 12 }}>
                Resumen de tu reserva
              </h4>
              {cart.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                    fontSize: "0.875rem",
                  }}
                >
                  <span>{s.name}</span>
                  <span className="text-muted">
                    S/ {(s.price_cents / 100).toFixed(2)}
                  </span>
                </div>
              ))}
              <div
                style={{
                  borderTop: "1px solid var(--color-border)",
                  marginTop: 12,
                  paddingTop: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    fontSize: "1.0625rem",
                  }}
                >
                  <span>Total a pagar en local:</span>
                  <span style={{ color: "var(--color-primary)" }}>
                    S/ {totalPriceSoles}
                  </span>
                </div>
              </div>
              <p
                className="text-muted"
                style={{ fontSize: "0.8125rem", marginTop: 12 }}
              >
                📅 {bookingDate} · ⏰ {startTime} · ⏱️{" "}
                {formatDuration(totalDuration)}
              </p>
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: "rgba(37, 211, 102, 0.08)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid rgba(37, 211, 102, 0.2)",
                  fontSize: "0.8125rem",
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              >
                📍 <strong>Pago presencial:</strong> Paga en efectivo, Yape o
                tarjeta directamente en nuestro local al momento de tu cita.
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={handlePrevStep}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                ← Volver
              </button>

              {/* Botón Principal WhatsApp */}
              <button
                onClick={handleCreateBookingWhatsApp}
                disabled={
                  loading ||
                  !contact.firstName.trim() ||
                  !contact.lastName.trim() ||
                  contact.phone.replace(/\D/g, "").length !== 9
                }
                className="btn"
                style={{
                  flex: 2,
                  background: "#25D366",
                  color: "#FFFFFF",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "1rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  boxShadow: "0 4px 14px rgba(37, 211, 102, 0.4)",
                  cursor:
                    loading || contact.phone.replace(/\D/g, "").length !== 9
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                <img
                  src="/icons/whatsApp.svg"
                  alt="WhatsApp"
                  style={{ width: 22, height: 22 }}
                />
                {loading ? "Registrando..." : "Reservar por WhatsApp"}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Success Confirmation Screen */}
        {step === "success" && (
          <div className="animate-fadeInUp" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: 16 }}>🎉</div>
            <h2 className="heading-lg" style={{ marginBottom: 8 }}>
              ¡Reserva <span className="text-gold">Registrada</span>!
            </h2>
            <p
              className="text-muted"
              style={{ marginBottom: 20, fontSize: "1rem" }}
            >
              Tu solicitud ha sido guardada. Confírmala enviando el mensaje por
              WhatsApp para asegurar tu atención inmediata.
            </p>

            {bookingResult && (
              <div
                className="card card-gold"
                style={{
                  margin: "0 auto 28px",
                  padding: "20px 24px",
                  maxWidth: 480,
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    borderBottom: "1px solid var(--color-border)",
                    paddingBottom: 10,
                  }}
                >
                  <span className="text-muted" style={{ fontSize: "0.875rem" }}>
                    Código de cita:
                  </span>
                  <strong
                    className="text-gold"
                    style={{ fontSize: "1.125rem", letterSpacing: "0.05em" }}
                  >
                    {bookingResult.booking_code}
                  </strong>
                </div>

                <div style={{ fontSize: "0.875rem", marginBottom: 8 }}>
                  <span className="text-muted">Cliente: </span>
                  <strong>{bookingResult.client_name}</strong>
                </div>

                <div style={{ fontSize: "0.875rem", marginBottom: 8 }}>
                  <span className="text-muted">Fecha y Hora: </span>
                  <strong>
                    {bookingResult.booking_date} a las {bookingResult.start_time}
                  </strong>
                </div>

                <div style={{ fontSize: "0.875rem", marginBottom: 12 }}>
                  <span className="text-muted">Servicios: </span>
                  <strong>{bookingResult.services.join(", ")}</strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 10,
                    borderTop: "1px solid var(--color-border)",
                    fontSize: "1rem",
                    fontWeight: 700,
                  }}
                >
                  <span>Total a pagar en local:</span>
                  <span style={{ color: "var(--color-primary)", fontSize: "1.125rem" }}>
                    S/ {bookingResult.total_price_soles}
                  </span>
                </div>
              </div>
            )}

            {/* Mensaje de confirmación informativa */}
            <div
              style={{
                margin: "0 auto 28px",
                padding: "16px 20px",
                background: "rgba(37, 211, 102, 0.08)",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(37, 211, 102, 0.25)",
                maxWidth: 480,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontWeight: 700,
                  color: "#25D366",
                  fontSize: "0.9375rem",
                  marginBottom: 6,
                }}
              >
                ✅ Solicitud registrada y enviada a WhatsApp
              </p>
              <p
                className="text-muted"
                style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}
              >
                Tu cita está en espera en nuestro panel. Quedará confirmada en el momento que se corrobore el pago en nuestro local.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link href="/" className="btn btn-secondary">
                🏠 Ir al Inicio
              </Link>
              <button
                type="button"
                onClick={handleNewBooking}
                className="btn btn-primary"
              >
                ➕ Nueva Reserva
              </button>
              {isAuthenticated && (
                <Link href="/mi-cuenta" className="btn btn-ghost">
                  👤 Ver Mis Reservas
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
