"use client";

import React, { useMemo } from "react";

export interface TicketVentaData {
  id: string;
  cliente_nombre: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number | string;
  total: number | string;
  metodo_pago: string;
  fecha: string;
  notas?: string | null;
}

interface TicketVentaTermicoProps {
  venta: TicketVentaData | null;
  isOpen?: boolean;
  onClose?: () => void;
}

export function TicketVentaTermico({
  venta,
  isOpen = false,
  onClose,
}: TicketVentaTermicoProps) {
  const emissionDate = useMemo(() => {
    const d = venta?.fecha ? new Date(venta.fecha) : new Date();
    return {
      fecha: d.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Lima",
      }),
      hora: d.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "America/Lima",
      }),
    };
  }, [venta]);

  if (!venta || !isOpen) return null;

  const codigoVenta = `VP-${venta.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const unitPriceFormatted = Number(venta.precio_unitario).toFixed(2);
  const totalFormatted = Number(venta.total).toFixed(2);

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

      <div className="center bold ticket-title">
        TICKET DE VENTA DE PRODUCTOS / MOSTRADOR
      </div>
      <div className="divider-dashed"></div>

      <div className="meta-data">
        <div>CÓDIGO VENTA    : {codigoVenta}</div>
        <div>CLIENTE         : {venta.cliente_nombre.toUpperCase()}</div>
        <div>FECHA EMISIÓN   : {emissionDate.fecha}</div>
        <div>HORA EMISIÓN    : {emissionDate.hora}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: "35px" }}>CANT</th>
            <th>PRODUCTO / DESCRIPCIÓN</th>
            <th className="right" style={{ width: "65px" }}>P. UNIT</th>
            <th className="right" style={{ width: "65px" }}>IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="td-qty bold">{venta.cantidad}</td>
            <td className="bold">{venta.producto_nombre}</td>
            <td className="td-price">S/ {unitPriceFormatted}</td>
            <td className="td-price bold">S/ {totalFormatted}</td>
          </tr>
          {venta.notas && (
            <tr>
              <td colSpan={4} style={{ fontSize: "10px", fontStyle: "italic", paddingTop: "2px" }}>
                Nota: {venta.notas}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="total-container">
        <span>TOTAL A PAGAR:</span>
        <span>S/. {totalFormatted}</span>
      </div>

      <div style={{ marginTop: "6px", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
        <span>MÉTODO DE PAGO:</span>
        <span className="bold">{venta.metodo_pago.toUpperCase()}</span>
      </div>

      <div style={{ textAlign: "center", fontSize: "11px", fontWeight: "bold", marginTop: "6px" }}>
        *** VENTA CANCELADA EN MOSTRADOR ***
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
        </div>
        <div className="social-name">Spa Acicalados Barber Shop</div>
      </div>
      <div className="divider-solid"></div>

      <div className="center footer">
        <div className="bold" style={{ marginTop: "5px" }}>
          ¡Gracias por su compra y preferencia!
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .ticket-thermal-body {
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 3mm;
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
          margin: -10px 0 -5px 0;
          padding: 0;
        }
        .ticket-thermal-body .ticket-logo {
          width: 85%;
          height: auto;
          display: block;
          margin: 0 auto;
          filter: grayscale(100%) contrast(150%);
        }

        .ticket-thermal-body .ticket-title {
          font-size: 11px;
          margin: 4px 0;
          letter-spacing: 0.02em;
        }

        .ticket-thermal-body .divider-dashed { border-bottom: 1px dashed #000000; margin: 4px 0; }
        .ticket-thermal-body .divider-solid { border-bottom: 2px solid #000000; margin: 4px 0; }

        .ticket-thermal-body .header, .ticket-thermal-body .footer { margin-bottom: 5px; }
        .ticket-thermal-body .meta-data { margin: 6px 0; font-size: 11px; line-height: 1.35; }

        .ticket-thermal-body table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        .ticket-thermal-body th {
          border-bottom: 2px solid #000000;
          border-top: 2px solid #000000;
          padding: 4px 0;
          text-align: left;
          font-size: 10px;
        }
        .ticket-thermal-body td { padding: 3px 0; vertical-align: top; font-size: 11px; }
        .ticket-thermal-body .td-qty { width: 35px; white-space: nowrap; }
        .ticket-thermal-body .td-price { text-align: right; white-space: nowrap; }

        .ticket-thermal-body .total-container {
          border-top: 1px dashed #000000;
          border-bottom: 1px dashed #000000;
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: bold;
          padding: 5px 0;
          margin: 6px 0;
        }

        .ticket-thermal-body .slogan {
          text-align: center;
          font-size: 10px;
          font-weight: bold;
          margin: 6px 0;
          padding: 0 4px;
          line-height: 1.2;
        }
        .ticket-thermal-body .social-container { text-align: center; margin: 6px 0; }
        .ticket-thermal-body .social-icons-row { display: flex; justify-content: center; gap: 15px; margin-bottom: 4px; }
        .ticket-thermal-body .social-icon { width: 16px; height: 16px; fill: #000000; }
        .ticket-thermal-body .social-name { font-size: 10px; font-weight: bold; }

        @media print {
          body * {
            visibility: hidden !important;
          }
          .ticket-modal-backdrop, .ticket-modal-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .ticket-thermal-body, .ticket-thermal-body * {
            visibility: visible !important;
          }
          .ticket-thermal-body {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 2mm !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
        `,
        }}
      />

      <div
        className="ticket-modal-backdrop"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 99999,
          padding: "16px",
        }}
        onClick={onClose}
      >
        <div
          className="ticket-modal-container"
          style={{
            backgroundColor: "var(--color-bg-card, #1A1612)",
            border: "1px solid var(--color-border, #332B20)",
            borderRadius: "var(--radius-lg, 12px)",
            width: "100%",
            maxWidth: "420px",
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header del Modal */}
          <div
            className="no-print"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 18px",
              borderBottom: "1px solid var(--color-border)",
              background: "rgba(200, 164, 92, 0.06)",
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
                  Ticket de Venta (58mm / 80mm)
                </h3>
                <p
                  className="text-muted"
                  style={{ fontSize: "0.72rem", margin: 0 }}
                >
                  Venta #{codigoVenta}
                </p>
              </div>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "1.1rem", padding: "2px 8px", lineHeight: 1 }}
                title="Cerrar"
              >
                ✕
              </button>
            )}
          </div>

          {/* Vista previa del ticket */}
          <div
            style={{
              padding: "18px",
              overflowY: "auto",
              background: "#dcdcdc",
              display: "flex",
              justifyContent: "center",
              flex: 1,
            }}
          >
            {ticketContent}
          </div>

          {/* Footer con botones de acción */}
          <div
            className="no-print"
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
              id="btn-print-venta-ticket"
            >
              <span>🖨️</span>
              <span>Imprimir Ticket</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
