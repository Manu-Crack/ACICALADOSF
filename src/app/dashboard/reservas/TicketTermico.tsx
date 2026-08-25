"use client";

import React, { useMemo } from "react";
import type { BookingServiceItem } from "./ReservasManager";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/types/payments";

export interface TicketBookingData {
  id: string;
  booking_code: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  total_price_cents: number;
  advance_percentage?: number;
  advance_amount_cents?: number;
  balance_cents?: number;
  service_type: string;
  client_first_name: string;
  client_last_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_dni: string | null;
  total_duration_minutes?: number;
  confirmed_at: string | null;
  assigned_employee_id: string | null;
  created_at?: string;
  booking_services?: BookingServiceItem[];
}

export interface TicketEmployee {
  id: string;
  first_name: string;
  last_name: string;
  type?: string;
}

interface TicketTermicoProps {
  booking: TicketBookingData | null;
  employeeMap?: Map<string, TicketEmployee>;
  isOpen?: boolean;
  onClose?: () => void;
}

export function TicketTermico({
  booking,
  employeeMap = new Map(),
  isOpen = false,
  onClose,
}: TicketTermicoProps) {
  const emissionDateStr = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }, [booking]);

  if (!booking) return null;

  const generalEmployee = booking.assigned_employee_id
    ? employeeMap.get(booking.assigned_employee_id)
    : null;

  const generalEmployeeName = generalEmployee
    ? `${generalEmployee.first_name} ${generalEmployee.last_name}`
    : "Sin asignar";

  const totalSoles = (booking.total_price_cents / 100).toFixed(2);
  const paidSoles = ((booking.advance_amount_cents || 0) / 100).toFixed(2);
  const balanceSoles = (
    (booking.balance_cents !== undefined
      ? booking.balance_cents
      : Math.max(0, booking.total_price_cents - (booking.advance_amount_cents || 0))) / 100
  ).toFixed(2);

  const isFullPaid =
    booking.payment_status === "total" ||
    (booking.advance_amount_cents || 0) >= booking.total_price_cents;

  const isPartialPaid =
    booking.payment_status === "parcial" ||
    ((booking.advance_amount_cents || 0) > 0 &&
      (booking.advance_amount_cents || 0) < booking.total_price_cents);

  const paymentStatusText = isFullPaid
    ? "PAGADO COMPLETO"
    : isPartialPaid
    ? "SALDO PENDIENTE"
    : "SIN PAGO / PENDIENTE";

  const paymentMethodLabel = booking.payment_method
    ? PAYMENT_METHOD_LABELS[booking.payment_method as PaymentMethod] || booking.payment_method.toUpperCase()
    : "NO REGISTRADO";

  const serviceTypeLabel =
    booking.service_type === "barberia"
      ? "BARBERÍA"
      : booking.service_type === "spa"
      ? "SPA"
      : "MIXTO";

  // Estructura del contenido del ticket (compartida entre preview e impresión real)
  const ticketContent = (
    <div
      className="thermal-ticket-root"
      style={{
        width: "100%",
        maxWidth: "76mm",
        margin: "0 auto",
        backgroundColor: "#ffffff",
        color: "#000000",
        fontFamily: "'Courier New', Courier, 'Lucida Console', monospace, sans-serif",
        fontSize: "11px",
        lineHeight: "1.25",
        padding: "4mm 2mm 8mm 2mm",
        boxSizing: "border-box",
        textAlign: "left",
      }}
    >
      {/* 1. Logotipo oficial B/N en cabecera */}
      <div style={{ textAlign: "center", marginBottom: "4px" }}>
        <img
          src="/BN_acica.png"
          alt="Acicalados Logo"
          style={{
            maxWidth: "140px",
            width: "70%",
            height: "auto",
            margin: "0 auto 4px auto",
            display: "block",
            filter: "grayscale(100%) contrast(140%)",
            imageRendering: "crisp-edges",
          }}
        />
        <div
          style={{
            fontSize: "13px",
            fontWeight: 900,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            lineHeight: "1.1",
          }}
        >
          SPA ACICALADOS BARBER SHOP
        </div>
        <div style={{ fontSize: "9px", fontWeight: 700, marginTop: "2px", letterSpacing: "0.5px" }}>
          EXCELENCIA EN CORTE & CUIDADO PERSONAL
        </div>
      </div>

      {/* 2. Datos fiscales y de contacto del negocio */}
      <div
        style={{
          textAlign: "center",
          fontSize: "9.5px",
          marginTop: "4px",
          lineHeight: "1.25",
          borderBottom: "1px dashed #000000",
          paddingBottom: "5px",
        }}
      >
        <div><strong>R.U.C.:</strong> 10436217574</div>
        <div>Av. Arriba Perú Nro. 263 - Pichari</div>
        <div><strong>Telf / WhatsApp:</strong> +51 997 766 828</div>
        <div>www.spaacicalados.com</div>
      </div>

      {/* 3. Identificador de Ticket / Código de Reserva */}
      <div
        style={{
          textAlign: "center",
          padding: "5px 0",
          borderBottom: "1px dashed #000000",
        }}
      >
        <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>
          TICKET DE VENTA Y RESERVA
        </div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 900,
            letterSpacing: "1px",
            margin: "2px 0",
          }}
        >
          #{booking.booking_code}
        </div>
        <div style={{ fontSize: "9px", color: "#222" }}>
          Emisión: {emissionDateStr}
        </div>
      </div>

      {/* 4. Datos de la Cita y del Cliente */}
      <div
        style={{
          padding: "5px 0",
          fontSize: "10px",
          lineHeight: "1.3",
          borderBottom: "1px dashed #000000",
        }}
      >
        <div>
          <strong>FECHA CITA :</strong> {booking.booking_date}
        </div>
        <div>
          <strong>HORARIO    :</strong> {booking.start_time?.slice(0, 5)} – {booking.end_time?.slice(0, 5)} {booking.total_duration_minutes ? `(${booking.total_duration_minutes} min)` : ""}
        </div>
        <div>
          <strong>CLIENTE    :</strong> {booking.client_first_name} {booking.client_last_name}
        </div>
        {booking.client_dni && (
          <div>
            <strong>DNI        :</strong> {booking.client_dni}
          </div>
        )}
        {booking.client_phone && (
          <div>
            <strong>TELÉFONO   :</strong> {booking.client_phone}
          </div>
        )}
        <div>
          <strong>TIPO       :</strong> {serviceTypeLabel}
        </div>
        <div>
          <strong>PERSONAL   :</strong> {generalEmployeeName}
        </div>
      </div>

      {/* 5. Desglose de Servicios / Productos */}
      <div style={{ padding: "6px 0", borderBottom: "1px dashed #000000" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "24px 1fr 58px",
            fontSize: "9.5px",
            fontWeight: 800,
            borderBottom: "1px solid #000000",
            paddingBottom: "3px",
            marginBottom: "4px",
          }}
        >
          <span>CT</span>
          <span>DESCRIPCIÓN</span>
          <span style={{ textAlign: "right" }}>TOTAL</span>
        </div>

        {booking.booking_services && booking.booking_services.length > 0 ? (
          booking.booking_services.map((bs, index) => {
            const emp = bs.assigned_employee_id
              ? employeeMap.get(bs.assigned_employee_id)
              : generalEmployee;
            const empName = emp ? `${emp.first_name} ${emp.last_name}` : null;

            return (
              <div key={bs.id || index} style={{ marginBottom: "4px", fontSize: "10px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr 58px",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>1x</span>
                  <span style={{ fontWeight: 700, wordBreak: "break-word" }}>
                    {bs.service_name}
                  </span>
                  <span style={{ textAlign: "right", fontWeight: 700 }}>
                    S/ {(bs.service_price_cents / 100).toFixed(2)}
                  </span>
                </div>
                <div
                  style={{
                    paddingLeft: "24px",
                    fontSize: "8.5px",
                    color: "#333",
                    lineHeight: "1.1",
                  }}
                >
                  ⏱️ {bs.duration_minutes} min {empName ? `| 👤 ${empName}` : ""}
                </div>
              </div>
            );
          })
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "24px 1fr 58px",
              alignItems: "flex-start",
              fontSize: "10px",
            }}
          >
            <span style={{ fontWeight: 700 }}>1x</span>
            <span style={{ fontWeight: 700 }}>Servicio {serviceTypeLabel}</span>
            <span style={{ textAlign: "right", fontWeight: 700 }}>
              S/ {totalSoles}
            </span>
          </div>
        )}
      </div>

      {/* 6. Totales y Resumen Financiero */}
      <div
        style={{
          padding: "6px 0",
          fontSize: "10px",
          lineHeight: "1.35",
          borderBottom: "1px dashed #000000",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>SUBTOTAL:</span>
          <span>S/ {totalSoles}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12.5px",
            fontWeight: 900,
            margin: "3px 0",
            borderTop: "1px solid #000000",
            borderBottom: "1px solid #000000",
            padding: "2px 0",
          }}
        >
          <span>TOTAL A PAGAR:</span>
          <span>S/ {totalSoles}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
          <strong>ESTADO DE PAGO:</strong>
          <strong style={{ textDecoration: isFullPaid ? "none" : "underline" }}>
            {paymentStatusText}
          </strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>MÉTODO DE PAGO:</span>
          <span>{paymentMethodLabel}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>MONTO ABONADO:</span>
          <span>S/ {paidSoles}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: isFullPaid ? 400 : 800,
          }}
        >
          <span>SALDO RESTANTE:</span>
          <span>S/ {balanceSoles}</span>
        </div>
      </div>

      {/* 7. Slogan Oficial y Mensaje de Agradecimiento */}
      <div style={{ textAlign: "center", padding: "6px 0 4px 0" }}>
        <div style={{ fontSize: "11px", fontWeight: 900, textTransform: "uppercase" }}>
          ¡GRACIAS POR TU PREFERENCIA!
        </div>
        <div
          style={{
            fontSize: "9.5px",
            fontStyle: "italic",
            marginTop: "3px",
            lineHeight: "1.25",
            padding: "0 4px",
          }}
        >
          &quot;Verte brillar es nuestro propósito; verte volver, nuestro mayor orgullo&quot;
        </div>
      </div>

      {/* 8. Bloque de Redes Sociales con Iconos Locales (/public/icons) */}
      <div
        style={{
          borderTop: "1px dashed #000000",
          paddingTop: "6px",
          marginTop: "4px",
          fontSize: "9px",
          lineHeight: "1.35",
          textAlign: "center",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: "4px", fontSize: "9.5px", textTransform: "uppercase" }}>
          SÍGUENOS EN NUESTRAS REDES:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <img
              src="/icons/Facebook.svg"
              alt="Facebook"
              style={{ width: "11px", height: "11px", filter: "brightness(0)", objectFit: "contain", display: "inline-block" }}
            />
            <span><strong>Facebook:</strong> @SpaAcicaladosBarberShop</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <img
              src="/icons/Instagram.svg"
              alt="Instagram"
              style={{ width: "11px", height: "11px", filter: "brightness(0)", objectFit: "contain", display: "inline-block" }}
            />
            <span><strong>Instagram:</strong> @spaacicaladosbarbershop</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <img
              src="/icons/Tiktok.svg"
              alt="TikTok"
              style={{ width: "11px", height: "11px", filter: "brightness(0)", objectFit: "contain", display: "inline-block" }}
            />
            <span><strong>TikTok:</strong> @spa_acicalados</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <img
              src="/icons/Youtube.svg"
              alt="YouTube"
              style={{ width: "11px", height: "11px", filter: "brightness(0)", objectFit: "contain", display: "inline-block" }}
            />
            <span><strong>YouTube:</strong> @AcicaladosSPA</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <img
              src="/icons/whatsApp.svg"
              alt="WhatsApp"
              style={{ width: "11px", height: "11px", filter: "brightness(0)", objectFit: "contain", display: "inline-block" }}
            />
            <span><strong>WhatsApp:</strong> +51 997 766 828</span>
          </div>
        </div>
        <div
          style={{
            fontSize: "8px",
            color: "#333333",
            marginTop: "6px",
            borderTop: "1px dashed #000000",
            paddingTop: "4px",
          }}
        >
          Comprobante no oficial para control interno y atención de citas.
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Reglas de estilo para impresión térmica pura de 80mm */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: 80mm auto;
            margin: 0mm !important;
          }
          html, body {
            width: 80mm !important;
            min-width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-ticket-print-area,
          #thermal-ticket-print-area * {
            visibility: visible !important;
          }
          #thermal-ticket-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 2mm 3mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            display: block !important;
            z-index: 999999 !important;
          }
          .no-print-in-thermal {
            display: none !important;
          }
        }
      `}} />

      {/* Contenedor invisible en pantalla que se activa únicamente en @media print */}
      <div
        id="thermal-ticket-print-area"
        style={{
          display: "none",
        }}
      >
        {ticketContent}
      </div>

      {/* Modal de Vista Previa en Pantalla (si está abierto) */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(6px)",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && onClose) onClose();
          }}
          className="no-print-in-thermal"
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 420,
              maxHeight: "94vh",
              display: "flex",
              flexDirection: "column",
              background: "var(--color-bg-card, #12100C)",
              border: "1px solid rgba(200, 164, 92, 0.4)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.85)",
              borderRadius: "var(--radius-lg, 12px)",
              overflow: "hidden",
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`Vista previa ticket ${booking.booking_code}`}
          >
            {/* Header del Modal */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 18px",
                borderBottom: "1px solid var(--color-border)",
                background: "rgba(200, 164, 92, 0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.25rem" }}>🖨️</span>
                <div>
                  <h3
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 800,
                      color: "var(--color-text, #F2E8D0)",
                      margin: 0,
                    }}
                  >
                    Ticket Térmico (80mm)
                  </h3>
                  <p
                    className="text-muted"
                    style={{ fontSize: "0.72rem", margin: 0 }}
                  >
                    Reserva #{booking.booking_code}
                  </p>
                </div>
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "1.1rem", padding: "2px 8px", lineHeight: 1 }}
                  title="Cerrar vista previa"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Cuerpo del Modal con scroll y aspecto de papel térmico */}
            <div
              style={{
                padding: "18px",
                overflowY: "auto",
                background: "#1c1917",
                display: "flex",
                justifyContent: "center",
                flex: 1,
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  color: "#000000",
                  borderRadius: "4px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  width: "100%",
                  maxWidth: "340px",
                  border: "1px solid #d6d3d1",
                }}
              >
                {ticketContent}
              </div>
            </div>

            {/* Footer con Botones de Acción */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                borderTop: "1px solid var(--color-border)",
                background: "rgba(18, 16, 12, 0.95)",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.82rem" }}
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary btn-sm"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  padding: "8px 18px",
                  boxShadow: "0 2px 10px rgba(200, 164, 92, 0.3)",
                }}
                id="modal-print-ticket-btn"
              >
                <span>🖨️</span>
                <span>Imprimir Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
