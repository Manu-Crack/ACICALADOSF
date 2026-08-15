/**
 * Servicio de Integración de Facturación Electrónica con Keyfácil (Vitekey)
 * Normativa SUNAT Perú:
 * - Operación Onerosa: tipo_operacion = "0101"
 * - Moneda: moneda = "PEN"
 * - IGV Exonerado (Amazonía): tipo_igv = "20"
 * - Unidad de Medida (Servicios): unidad_medida = "ZZ"
 */

export interface FiscalData {
  tipo_comprobante: "03" | "01"; // "03": Boleta, "01": Factura
  tipo_doc?: string; // "1": DNI, "6": RUC, "-": Sin Documento
  num_doc?: string;
  cliente_nombre?: string;
  cliente_direccion?: string;
  cliente_email?: string;
}

export interface BookingServiceItem {
  service_name: string;
  service_price_cents: number;
  duration_minutes?: number;
}

export interface BookingForInvoice {
  id: string;
  booking_code: string;
  booking_date?: string;
  client_first_name: string;
  client_last_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  client_dni?: string | null;
  advance_percentage?: number;
  advance_amount_cents: number;
  total_price_cents: number;
  comprobante_tipo?: "03" | "01" | null;
  billing_doc_type?: string | null;
  billing_doc_number?: string | null;
  billing_name?: string | null;
  billing_address?: string | null;
}

export interface KeyfacilEmitResponse {
  success: boolean;
  comprobante?: {
    id?: string;
    tipo: string;
    serie: string;
    numero: number;
    pdf_url: string;
  };
  error?: string;
  raw?: unknown;
}

/**
 * Emite un comprobante electrónico (Boleta o Factura) a través de la API de Keyfácil
 */
export async function emitirComprobanteKeyfacil(
  booking: BookingForInvoice,
  services: BookingServiceItem[],
  chargeId?: string
): Promise<KeyfacilEmitResponse> {
  const token = process.env.KEYFACIL_API_TOKEN;
  const apiUrl =
    process.env.KEYFACIL_API_URL ||
    "https://api.vitekey.com/keyfact/integra/v1/invoices";

  if (!token) {
    console.error("[Keyfácil] KEYFACIL_API_TOKEN no está configurado.");
    return {
      success: false,
      error: "KEYFACIL_API_TOKEN no configurado en el servidor",
    };
  }

  try {
    const isFactura = booking.comprobante_tipo === "01";
    const tipoComprobante = isFactura ? "01" : "03";
    const serie = isFactura ? "FFF1" : "BBB1";

    // 1. Determinar datos del cliente
    let docType = "-";
    let docNumber = "00000000";
    let denominacion = `${booking.client_first_name} ${booking.client_last_name}`.trim();
    let direccion = booking.billing_address || "Amazonas, Perú";

    if (isFactura) {
      docType = "6"; // RUC
      docNumber = (booking.billing_doc_number || "").trim();
      denominacion = (booking.billing_name || denominacion).trim();
      if (booking.billing_address) {
        direccion = booking.billing_address.trim();
      }
    } else {
      const dni = (booking.billing_doc_number || booking.client_dni || "").trim();
      if (dni && dni.length === 8) {
        docType = "1"; // DNI
        docNumber = dni;
      }
      if (booking.billing_name) {
        denominacion = booking.billing_name.trim();
      }
    }

    const email = booking.client_email || "";
    const fechaEmision = new Date().toISOString().split("T")[0];

    // 2. Construcción de ítems
    // Monto pagado efectivamente (adelanto o total)
    const paidAmountCents = booking.advance_amount_cents || booking.total_price_cents;
    const paidTotalSoles = Number((paidAmountCents / 100).toFixed(2));
    const isFullPayment =
      booking.advance_percentage === 100 ||
      paidAmountCents === booking.total_price_cents;

    let items: Array<Record<string, unknown>> = [];

    if (services.length > 0) {
      let accumulatedTotal = 0;

      items = services.map((s, index) => {
        const isLast = index === services.length - 1;
        let itemTotal: number;

        if (isFullPayment) {
          itemTotal = Number((s.service_price_cents / 100).toFixed(2));
        } else {
          // Proporcional al monto pagado
          const ratio = s.service_price_cents / (booking.total_price_cents || 1);
          if (isLast) {
            itemTotal = Number((paidTotalSoles - accumulatedTotal).toFixed(2));
          } else {
            itemTotal = Number((paidTotalSoles * ratio).toFixed(2));
            accumulatedTotal += itemTotal;
          }
        }

        const description = isFullPayment
          ? s.service_name
          : `Adelanto (${booking.advance_percentage || 30}%): ${s.service_name}`;

        return {
          unidad_de_medida: "ZZ",
          unidad_medida: "ZZ",
          codigo: `SRV-${index + 1}`,
          descripcion: description,
          cantidad: 1,
          valor_unitario: itemTotal,
          precio_unitario: itemTotal,
          subtotal: itemTotal,
          total: itemTotal,
          tipo_de_igv: "20", // Exonerado - Amazonía (Catálogo 07)
          tipo_igv: "20",
          igv: 0,
          total_impuestos: 0,
        };
      });
    } else {
      // Fallback genérico si no hay desglose de servicios
      items = [
        {
          unidad_de_medida: "ZZ",
          unidad_medida: "ZZ",
          codigo: "SRV-01",
          descripcion: `Servicio de Barbería / Spa - Reserva ${booking.booking_code}`,
          cantidad: 1,
          valor_unitario: paidTotalSoles,
          precio_unitario: paidTotalSoles,
          subtotal: paidTotalSoles,
          total: paidTotalSoles,
          tipo_de_igv: "20",
          tipo_igv: "20",
          igv: 0,
          total_impuestos: 0,
        },
      ];
    }

    // 3. Payload para Keyfácil
    const payload = {
      tipo_operacion: "0101", // Venta interna onerosa
      tipo_de_comprobante: tipoComprobante,
      tipo_comprobante: tipoComprobante,
      serie: serie,
      fecha_de_emision: fechaEmision,
      fecha_emision: fechaEmision,
      moneda: "PEN",
      tipo_de_cambio: 1,

      // Datos de cliente
      cliente_tipo_de_documento: docType,
      cliente_tipo_documento: docType,
      cliente_numero_de_documento: docNumber,
      cliente_numero_documento: docNumber,
      cliente_denominacion: denominacion,
      cliente_nombre: denominacion,
      cliente_direccion: direccion,
      cliente_email: email,

      // Totales
      total_exonerada: paidTotalSoles,
      total_exonerado: paidTotalSoles,
      total_gravada: 0,
      total_gravado: 0,
      total_inafecta: 0,
      total_inafecto: 0,
      total_igv: 0,
      total_impuestos: 0,
      total: paidTotalSoles,

      // Items
      items: items,

      // Metadatos adicionales para trazabilidad
      observaciones: `Reserva: ${booking.booking_code}${chargeId ? ` | Culqi Charge: ${chargeId}` : ""}`,
      metadata: {
        booking_id: booking.id,
        booking_code: booking.booking_code,
        culqi_charge_id: chargeId || null,
      },
    };

    console.log(
      `[Keyfácil] Emitiendo ${isFactura ? "Factura" : "Boleta"} para reserva ${booking.booking_code}...`
    );

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        token: token,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("[Keyfácil] Error en respuesta de API:", responseData);
      return {
        success: false,
        error:
          responseData?.message ||
          responseData?.error ||
          `Error en API de Keyfácil (HTTP ${response.status})`,
        raw: responseData,
      };
    }

    console.log("[Keyfácil] Respuesta exitosa:", responseData);

    // Extraer datos del comprobante soportando diferentes formatos comunes
    const dataObj = responseData?.data || responseData;

    const comprobanteSerie =
      dataObj?.serie ||
      dataObj?.invoice_series ||
      serie;

    const comprobanteNumero = Number(
      dataObj?.numero ||
      dataObj?.correlativo ||
      dataObj?.invoice_number ||
      1
    );

    const pdfUrl =
      dataObj?.pdf_url ||
      dataObj?.enlace_pdf ||
      dataObj?.enlace_del_pdf ||
      dataObj?.url_pdf ||
      dataObj?.pdf ||
      dataObj?.links?.pdf ||
      "";

    const comprobanteId = String(dataObj?.id || dataObj?.invoice_id || "");

    return {
      success: true,
      comprobante: {
        id: comprobanteId,
        tipo: tipoComprobante,
        serie: comprobanteSerie,
        numero: comprobanteNumero,
        pdf_url: pdfUrl,
      },
      raw: responseData,
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("[Keyfácil] Excepción al emitir comprobante:", errMessage);
    return {
      success: false,
      error: `Excepción al conectar con Keyfácil: ${errMessage}`,
    };
  }
}
