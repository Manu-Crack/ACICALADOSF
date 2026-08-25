"use client";

import React, { useMemo } from "react";
import type { BookingServiceItem } from "./ReservasManager";

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
  isOpen = false,
  onClose,
}: TicketTermicoProps) {
  const emissionDate = useMemo(() => {
    const now = new Date();
    return {
      fecha: now.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      hora: now.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
    };
  }, [booking]);

  const items = useMemo(() => {
    if (booking?.booking_services && booking.booking_services.length > 0) {
      return booking.booking_services.map((bs, idx) => ({
        codigo: bs.service_id
          ? `SERV-${bs.service_id.slice(0, 6).toUpperCase()}`
          : `SERV-${String(idx + 1).padStart(2, "0")}`,
        cantidad: 1,
        nombre: bs.service_name,
        precio: (bs.service_price_cents / 100).toFixed(2),
      }));
    }
    if (booking) {
      return [
        {
          codigo: `SERV-${booking.service_type.toUpperCase()}`,
          cantidad: 1,
          nombre: `Servicio ${
            booking.service_type === "barberia"
              ? "de Barbería"
              : booking.service_type === "spa"
              ? "de Spa"
              : "Mixto"
          }`,
          precio: (booking.total_price_cents / 100).toFixed(2),
        },
      ];
    }
    return [];
  }, [booking]);

  if (!booking) return null;

  const totalReserva = (booking.total_price_cents / 100).toFixed(2);

  // Estructura HTML exacta según la plantilla base
  const ticketContent = (
    <div className="ticket-thermal-body">
      <div className="header">
        <div className="divider-solid"></div>

        <div className="logo-container">
          <img
            src="/BN_acica.png"
            alt="Logo Spa Acicalados"
            className="ticket-logo"
          />
        </div>

        <div className="center bold">HUAMANI AZURZA, JORGE ROBERT</div>
        <div className="center bold">&quot;SPA ACICALADOS BARBER SHOP&quot;</div>
        <div className="center">RUC: 10436217574</div>
        <div className="center">Av. Arriba Perú Nro. 263 - Pichari</div>
        <div className="center">Telf: 997766828 | www.spaacicalados.com</div>
        <div className="divider-solid"></div>
      </div>

      <div className="meta-data">
        <div>TICKET CORRELATIVO      : {booking.booking_code}</div>
        <br />
        <div>FECHA EMISIÓN : {emissionDate.fecha}</div>
        <div>HORA EMISIÓN  : {emissionDate.hora}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th colSpan={2}>CÓDIGO / DETALLE DEL SERVICIO</th>
            <th className="right">IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              <tr>
                <td colSpan={3} className="item-code">
                  {item.codigo}
                </td>
              </tr>
              <tr>
                <td className="td-qty">{item.cantidad} x</td>
                <td>{item.nombre}</td>
                <td className="td-price">S/. {item.precio}</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div className="total-container">
        <span>TOTAL A PAGAR:</span>
        <span>S/. {totalReserva}</span>
      </div>

      <div className="divider-solid" style={{ marginTop: "6px" }}></div>

      <div className="slogan">
        Verte brillar es nuestro propósito; verte volver, nuestro mayor orgullo
      </div>
      <div className="divider-dashed"></div>

      <div className="social-container">
        <div className="social-icons-row">
          <svg className="social-icon" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <svg className="social-icon" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.07M12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
          </svg>
          <svg className="social-icon" viewBox="0 0 24 24">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
          </svg>
          <svg className="social-icon" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </div>
        <div className="social-name">Spa Acicalados Barber Shop</div>
      </div>
      <div className="divider-solid"></div>

      <div className="center footer">
        <div className="bold" style={{ marginTop: "5px" }}>
          ¡Gracias por tu preferencia!
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Estilos CSS exactos de la plantilla ticket-barberia.html */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .ticket-thermal-body {
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 2mm;
          background-color: #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          color: #000000 !important;
          font-size: 12px;
          font-family: 'Courier New', Courier, monospace;
          line-height: 1.25;
          text-align: left;
          box-sizing: border-box;
        }

        .ticket-thermal-body * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Courier New', Courier, monospace;
          color: #000000 !important;
        }

        .ticket-thermal-body .center { text-align: center; }
        .ticket-thermal-body .left { text-align: left; }
        .ticket-thermal-body .right { text-align: right; }
        .ticket-thermal-body .bold { font-weight: bold; }

        .ticket-thermal-body .logo-container {
          text-align: center;
          margin: -15px 0 -10px 0;
          padding: 0;
        }
        .ticket-thermal-body .ticket-logo {
          width: 90%;
          height: auto;
          display: block;
          margin: 0 auto;
          filter: grayscale(100%) contrast(150%);
        }

        .ticket-thermal-body .divider-dashed { border-bottom: 1px dashed #000000; margin: 4px 0; }
        .ticket-thermal-body .divider-solid { border-bottom: 2px solid #000000; margin: 4px 0; }

        .ticket-thermal-body .header, .ticket-thermal-body .footer { margin-bottom: 5px; }
        .ticket-thermal-body .meta-data { margin: 5px 0; font-size: 12px; }

        .ticket-thermal-body table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
        .ticket-thermal-body th { border-bottom: 2px solid #000000; border-top: 2px solid #000000; padding: 4px 0; text-align: left; font-size: 11px; }
        .ticket-thermal-body td { padding: 2px 0; vertical-align: top; }
        .ticket-thermal-body .td-qty { width: 28px; white-space: nowrap; }
        .ticket-thermal-body .td-price { text-align: right; white-space: nowrap; }
        .ticket-thermal-body .item-code { font-weight: bold; padding-top: 4px; }

        .ticket-thermal-body .total-container {
          border-top: 1px dashed #000000;
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          font-weight: bold;
          padding-top: 5px;
          margin-top: 5px;
        }

        .ticket-thermal-body .slogan {
          text-align: center;
          font-size: 11px;
          font-weight: bold;
          margin: 6px 0;
          padding: 0 4px;
          line-height: 1.2;
        }
        .ticket-thermal-body .social-container { text-align: center; margin: 6px 0; }
        .ticket-thermal-body .social-icons-row { display: flex; justify-content: center; gap: 15px; margin-bottom: 4px; }
        .ticket-thermal-body .social-icon { width: 18px; height: 18px; fill: #000000; }
        .ticket-thermal-body .social-name { font-size: 11px; font-weight: bold; }

        @media print {
          @page { margin: 0; size: 80mm auto; }
          html, body {
            background-color: #ffffff !important;
            width: 80mm !important;
            min-width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
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
            margin: 0 !important;
            padding: 2mm !important;
            box-shadow: none !important;
            width: 80mm !important;
            max-width: 80mm !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            display: block !important;
            z-index: 999999 !important;
          }
          .no-print-in-thermal {
            display: none !important;
          }
        }
      `,
        }}
      />

      {/* Contenedor invisible en pantalla que se imprime directamente en @media print */}
      <div id="thermal-ticket-print-area" style={{ display: "none" }}>
        {ticketContent}
      </div>

      {/* Modal de Vista Previa en Pantalla */}
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

            {/* Cuerpo del Modal con el ticket idéntico a la plantilla base */}
            <div
              style={{
                padding: "18px",
                overflowY: "auto",
                background: "#e0e0e0",
                display: "flex",
                justifyContent: "center",
                flex: 1,
              }}
            >
              {ticketContent}
            </div>

            {/* Footer del Modal */}
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
