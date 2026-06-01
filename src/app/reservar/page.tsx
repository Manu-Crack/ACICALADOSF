"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useCart, CartService } from "@/components/cart/CartProvider";

type Service = CartService;

export default function ReservarPage() {
  const { cart: sessionCart, clearCart: clearSessionCart } = useCart();

  const [step, setStep] = useState<"type" | "services" | "datetime" | "contact" | "payment" | "success">("type");
  const [serviceType, setServiceType] = useState<"barberia" | "spa" | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [cart, setCart] = useState<Service[]>([]);
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [paymentMode, setPaymentMode] = useState<"advance" | "full">("advance");
  const [contact, setContact] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    dni: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookingResult, setBookingResult] = useState<{
    booking_id: string;
    booking_code: string;
    advance_amount_cents: number;
    total_price_cents: number;
    payment_amount_cents: number;
    payment_mode: string;
  } | null>(null);

  const supabase = createClient();

  // Load cart from session on mount
  useEffect(() => {
    if (sessionCart.length > 0) {
      setCart(sessionCart);
      // Skip directly to datetime if cart has items
      setStep("datetime");
    }
    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get("type");
    if (typeParam === "barberia" || typeParam === "spa") {
      setServiceType(typeParam);
      if (sessionCart.length === 0) setStep("services");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load services — when a type is selected, filter by it; otherwise load all
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
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, phone, dni")
          .eq("id", user.id)
          .single();
        if (profile) {
          setContact((c) => ({
            ...c,
            firstName: profile.first_name || c.firstName,
            lastName: profile.last_name || c.lastName,
            phone: profile.phone || c.phone,
            dni: profile.dni || c.dni,
            email: user.email || c.email,
          }));
        }
      }
    }
    loadProfile();
  }, [supabase]);

  const totalCents = cart.reduce((sum, s) => sum + s.price_cents, 0);
  const totalDuration = cart.reduce((sum, s) => sum + s.duration_minutes, 0);
  const advanceCents = Math.ceil(totalCents * 0.3);

  function toggleService(service: Service) {
    setCart((prev) =>
      prev.find((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  }

  async function handleCreateBooking() {
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
          client_first_name: contact.firstName,
          client_last_name: contact.lastName,
          client_phone: contact.phone,
          client_email: contact.email,
          client_dni: contact.dni,
          payment_mode: paymentMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al crear la reserva");
        setLoading(false);
        return;
      }

      setBookingResult(data);
      setStep("payment");
      clearSessionCart();
    } catch {
      setError("Error de conexión");
    }
    setLoading(false);
  }

  // Initialize Culqi when reaching payment step
  const initCulqi = useCallback(() => {
    if (!bookingResult) return;

    const publicKey = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY;
    if (!publicKey || !(window as unknown as Record<string, unknown>).CulqiCheckout) return;

    const CulqiCheckout = (window as unknown as Record<string, unknown>).CulqiCheckout as new (
      key: string,
      config: Record<string, unknown>
    ) => Record<string, unknown>;

    const amount = bookingResult.payment_amount_cents;
    const isFull = bookingResult.payment_mode === "full";
    const config = {
      settings: {
        title: "Acicalados",
        currency: "PEN",
        amount,
      },
      client: { email: contact.email || "" },
      options: {
        lang: "es",
        modal: true,
        paymentMethods: { tarjeta: true, yape: true },
        paymentMethodsSort: ["tarjeta", "yape"],
      },
      appearance: {
        theme: "default",
        hiddenCulqiLogo: false,
        menuType: "sliderTop",
        buttonCardPayText: `Pagar S/ ${(amount / 100).toFixed(2)}`,
        defaultStyle: {
          bannerColor: "#1C1912",
          buttonBackground: "#C8A45C",
          menuColor: "#C8A45C",
          linksColor: "#C8A45C",
          buttonTextColor: "#1C1912",
          priceColor: "#C8A45C",
        },
      },
    };

    const culqi = new CulqiCheckout(publicKey, config);

    (culqi as Record<string, unknown>).culqi = async function () {
      const token = (culqi as Record<string, unknown>).token as { id: string } | undefined;
      if (token) {
        (culqi as { close: () => void }).close();

        try {
          const res = await fetch("/api/culqi/charge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token_id: token.id,
              booking_id: bookingResult.booking_id,
              client_email: contact.email,
            }),
          });

          const data = await res.json();
          if (res.ok) {
            setStep("success");
          } else {
            setError(data.error || "Error al procesar el pago");
          }
        } catch {
          setError("Error de conexión al procesar el pago");
        }
      } else {
        const errObj = (culqi as Record<string, unknown>).error as { user_message?: string } | undefined;
        setError(errObj?.user_message || "Error en el pago");
      }
    };

    (window as unknown as Record<string, unknown>).__culqi = culqi;
  }, [bookingResult, contact.email]);

  useEffect(() => {
    if (step === "payment") {
      if (!document.getElementById("culqi-script")) {
        const script = document.createElement("script");
        script.id = "culqi-script";
        script.src = "https://js.culqi.com/checkout-js";
        script.onload = () => initCulqi();
        document.body.appendChild(script);
      } else {
        initCulqi();
      }
    }
  }, [step, initCulqi]);

  function openCulqi() {
    const culqi = (window as unknown as Record<string, unknown>).__culqi as { open: () => void } | undefined;
    if (culqi) {
      culqi.open();
    }
  }

  const timeSlots: string[] = [];
  for (let h = 8; h <= 19; h++) {
    timeSlots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 19) timeSlots.push(`${String(h).padStart(2, "0")}:30`);
  }

  // Min date = today (allow same-day bookings)
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
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link
            href="/"
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 16, display: "inline-flex", padding: "6px 12px", fontSize: "0.875rem" }}
          >
            ← Volver al Inicio
          </Link>
          <div style={{ textAlign: "center" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <span className="text-gold" style={{ fontWeight: 800, fontSize: "1.25rem" }}>
                ACICALADOS
              </span>
            </Link>
            <h1 className="heading-lg" style={{ marginTop: 16 }}>
              Reservar Cita
            </h1>
            <div className="divider-gold" style={{ margin: "12px auto" }} />
          </div>
        </div>

        {/* Progress */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginBottom: 40,
          }}
        >
          {["type", "services", "datetime", "contact", "payment"].map((s, i) => (
            <div
              key={s}
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background:
                  ["type", "services", "datetime", "contact", "payment"].indexOf(step) >= i
                    ? "var(--color-primary)"
                    : "var(--color-border)",
                transition: "background var(--transition-normal)",
              }}
            />
          ))}
        </div>

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
            <h2 className="heading-md" style={{ marginBottom: 24, textAlign: "center" }}>
              ¿Qué servicio necesitas?
            </h2>
            <div className="grid grid-2">
              <button
                onClick={() => { setServiceType("barberia"); setStep("services"); }}
                className="card card-gold"
                style={{
                  cursor: "pointer",
                  textAlign: "center",
                  padding: 32,
                  border: "1px solid var(--color-primary-border)",
                }}
              >
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>💈</div>
                <h3 className="heading-sm">Barbería</h3>
                <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: 8 }}>
                  Cortes, barba, tratamientos capilares
                </p>
              </button>
              <button
                onClick={() => { setServiceType("spa"); setStep("services"); }}
                className="card card-gold"
                style={{
                  cursor: "pointer",
                  textAlign: "center",
                  padding: 32,
                  border: "1px solid var(--color-primary-border)",
                }}
              >
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>🧖‍♀️</div>
                <h3 className="heading-sm">Spa</h3>
                <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: 8 }}>
                  Masajes, faciales, manicure, pedicure
                </p>
              </button>
            </div>
            <button
              onClick={() => { setServiceType(null); setStep("services"); }}
              className="card card-gold"
              style={{
                cursor: "pointer",
                textAlign: "center",
                padding: 24,
                marginTop: 12,
                border: "1px solid var(--color-primary-border)",
                width: "100%",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>✨</div>
              <h3 className="heading-sm">Todos los servicios</h3>
              <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: 8 }}>
                Mezcla barbería y spa en una sola cita
              </p>
            </button>
          </div>
        )}

        {/* Step 2: Select services */}
        {step === "services" && (
          <div className="animate-fadeInUp">
            <h2 className="heading-md" style={{ marginBottom: 24 }}>
              Selecciona tus servicios
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {services.map((service) => {
                const isSelected = cart.some((s) => s.id === service.id);
                return (
                  <button
                    key={service.id}
                    onClick={() => toggleService(service)}
                    className="card"
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderColor: isSelected
                        ? "var(--color-primary)"
                        : "var(--color-border)",
                      background: isSelected
                        ? "rgba(200,164,92,0.05)"
                        : "var(--color-bg-card)",
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: 4 }}>{service.name}</h4>
                      <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                        {service.duration_minutes} min
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                        S/ {(service.price_cents / 100).toFixed(2)}
                      </span>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "var(--radius-sm)",
                          border: `2px solid ${isSelected ? "var(--color-primary)" : "var(--color-border)"}`,
                          background: isSelected ? "var(--color-primary)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#1C1912",
                          fontSize: "0.875rem",
                          fontWeight: 700,
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
                className="card card-gold"
                style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                    {cart.length} servicio(s) · {totalDuration} min
                  </p>
                  <p style={{ fontWeight: 700, fontSize: "1.125rem", color: "var(--color-primary)" }}>
                    Total: S/ {(totalCents / 100).toFixed(2)}
                  </p>
                </div>
                <button onClick={() => setStep("datetime")} className="btn btn-primary">
                  Continuar
                </button>
              </div>
            )}

            <button onClick={() => { setStep("type"); setCart([]); setServiceType(null); }} className="btn btn-ghost" style={{ marginTop: 12, width: "100%" }}>
              ← Volver
            </button>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === "datetime" && (
          <div className="animate-fadeInUp">
            <h2 className="heading-md" style={{ marginBottom: 24 }}>
              Elige fecha y hora
            </h2>
            <div style={{ marginBottom: 20 }}>
              <label className="label">Fecha</label>
              <input
                type="date"
                className="input"
                min={minDate}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="label">Hora de inicio</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                }}
              >
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setStartTime(time)}
                    className={startTime === time ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep("services")} className="btn btn-ghost" style={{ flex: 1 }}>
                ← Volver
              </button>
              <button
                onClick={() => setStep("contact")}
                disabled={!bookingDate || !startTime}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Contact Info */}
        {step === "contact" && (
          <div className="animate-fadeInUp">
            <h2 className="heading-md" style={{ marginBottom: 24 }}>
              Datos de contacto
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} required />
              </div>
              <div>
                <label className="label">Apellido *</label>
                <input className="input" value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} required />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Celular *</label>
              <input className="input" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="987654321" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Correo electrónico</label>
              <input className="input" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="tu@email.com" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="label">DNI</label>
              <input className="input" value={contact.dni} onChange={(e) => setContact({ ...contact, dni: e.target.value })} placeholder="12345678" maxLength={8} />
            </div>

            {/* Summary */}
            <div className="card card-gold" style={{ marginBottom: 24 }}>
              <h4 className="heading-sm" style={{ marginBottom: 12 }}>Resumen de tu reserva</h4>
              {cart.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.875rem" }}>
                  <span>{s.name}</span>
                  <span className="text-muted">S/ {(s.price_cents / 100).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 12, paddingTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                  <span>Total</span>
                  <span>S/ {(totalCents / 100).toFixed(2)}</span>
                </div>
              </div>
              <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: 12 }}>
                📅 {bookingDate} · ⏰ {startTime} · ⏱️ {totalDuration} min
              </p>
            </div>

            {/* Payment Mode Selector */}
            <div style={{ marginBottom: 24 }}>
              <label className="label" style={{ marginBottom: 12 }}>Método de pago</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPaymentMode("advance")}
                  className="card"
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 20px",
                    borderColor: paymentMode === "advance" ? "var(--color-primary)" : "var(--color-border)",
                    background: paymentMode === "advance" ? "rgba(200,164,92,0.06)" : "var(--color-bg-card)",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    border: `2px solid ${paymentMode === "advance" ? "var(--color-primary)" : "var(--color-border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {paymentMode === "advance" && (
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--color-primary)" }} />
                    )}
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ fontWeight: 600, marginBottom: 2 }}>💰 Reservar con adelanto (30%)</p>
                    <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                      Paga S/ {(advanceCents / 100).toFixed(2)} ahora, el resto al llegar
                    </p>
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--color-primary)", fontSize: "1.125rem" }}>
                    S/ {(advanceCents / 100).toFixed(2)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode("full")}
                  className="card"
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 20px",
                    borderColor: paymentMode === "full" ? "var(--color-primary)" : "var(--color-border)",
                    background: paymentMode === "full" ? "rgba(200,164,92,0.06)" : "var(--color-bg-card)",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    border: `2px solid ${paymentMode === "full" ? "var(--color-primary)" : "var(--color-border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {paymentMode === "full" && (
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--color-primary)" }} />
                    )}
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ fontWeight: 600, marginBottom: 2 }}>✅ Pagar el total</p>
                    <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                      Paga todo ahora y llega sin preocupaciones
                    </p>
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--color-primary)", fontSize: "1.125rem" }}>
                    S/ {(totalCents / 100).toFixed(2)}
                  </span>
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep("datetime")} className="btn btn-ghost" style={{ flex: 1 }}>
                ← Volver
              </button>
              <button
                onClick={handleCreateBooking}
                disabled={loading || !contact.firstName || !contact.lastName || (!contact.phone && !contact.email)}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {loading ? "Procesando..." : "Proceder al Pago"}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Payment */}
        {step === "payment" && bookingResult && (
          <div className="animate-fadeInUp" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>💳</div>
            <h2 className="heading-md" style={{ marginBottom: 12 }}>
              {bookingResult.payment_mode === "full" ? "Pagar Total" : "Pagar Adelanto"}
            </h2>
            <p className="text-muted" style={{ marginBottom: 8 }}>
              Código de reserva: <strong style={{ color: "var(--color-primary)" }}>{bookingResult.booking_code}</strong>
            </p>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-primary)", marginBottom: 32 }}>
              S/ {(bookingResult.payment_amount_cents / 100).toFixed(2)}
            </p>
            <button onClick={openCulqi} className="btn btn-primary btn-lg" style={{ width: "100%" }}>
              🔒 Pagar Ahora
            </button>
            <p className="text-muted" style={{ marginTop: 16, fontSize: "0.8125rem" }}>
              Tienes 15 minutos para completar el pago antes de que expire la reserva.
            </p>
          </div>
        )}

        {/* Step 6: Success */}
        {step === "success" && (
          <div className="animate-fadeInUp" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: 16 }}>🎉</div>
            <h2 className="heading-lg" style={{ marginBottom: 12 }}>
              ¡Cita <span className="text-gold">Confirmada</span>!
            </h2>
            <p className="text-muted" style={{ marginBottom: 8, fontSize: "1rem" }}>
              {bookingResult?.payment_mode === "full"
                ? "Tu cita está confirmada y pagada al 100%."
                : "Tu cita está confirmada. Paga el resto al llegar."}
            </p>
            {bookingResult && (
              <p style={{ marginBottom: 32 }}>
                Código: <strong className="text-gold" style={{ fontSize: "1.25rem" }}>{bookingResult.booking_code}</strong>
              </p>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/" className="btn btn-secondary">
                Ir al Inicio
              </Link>
              <Link href="/mi-cuenta" className="btn btn-primary">
                Ver Mis Reservas
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
