/**
 * Servicio de Integración de Facturación Electrónica con Nubefact
 *
 * Catálogo Nubefact / SUNAT Perú:
 * - Operación: "generar_comprobante"
 * - Tipo de Comprobante: 1 = FACTURA, 2 = BOLETA
 * - Serie: "BBB1" para Boletas, "FFF1" para Facturas
 * - Moneda: 1 = SOLES, 2 = DÓLARES
 * - Tipo de IGV: 8 = EXONERADO - OPERACIÓN ONEROSA (Amazonía), 1 = GRAVADO (18%)
 * - Unidad de Medida: "ZZ" = Servicios, "NIU" = Bienes
 */

export interface FiscalData {
  tipo_comprobante: "03" | "01" | 2 | 1; // "03"/2: Boleta, "01"/1: Factura
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

export interface NubefactEmitResult {
  success: boolean;
  comprobante?: {
    id?: string;
    tipo: string; // "03" o "01"
    tipo_de_comprobante: number; // 2 o 1
    serie: string;
    numero: number;
    pdf_url: string;
    xml_url?: string;
    key?: string;
  };
  error?: string;
  raw?: unknown;
}

/**
 * Formatea una fecha actual o pasada al formato DD-MM-YYYY requerido por Nubefact
 */
function getFormattedDate(dateStr?: string): string {
  const date = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Emite un comprobante electrónico (Boleta o Factura) a través de la API de Nubefact
 */
export async function emitirComprobanteNubefact(
  booking: BookingForInvoice,
  services: BookingServiceItem[],
  chargeId?: string
): Promise<NubefactEmitResult> {
  const token = process.env.NUBEFACT_API_TOKEN;
  const apiUrl = process.env.NUBEFACT_API_URL;

  if (!token || !apiUrl) {
    console.error("[Nubefact] NUBEFACT_API_TOKEN o NUBEFACT_API_URL no configurados.");
    return {
      success: false,
      error: "Credenciales de NUBEFACT_API_URL o NUBEFACT_API_TOKEN no configuradas en el servidor",
    };
  }

  try {
    const isFactura = booking.comprobante_tipo === "01";
    const tipoDeComprobante = isFactura ? 1 : 2; // 1 = Factura, 2 = Boleta
    const serie = isFactura ? "FFF1" : "BBB1";

    // 1. Determinar datos del cliente
    let docType = 1; // 1: DNI por defecto
    let docNumber = "00000000";
    let denominacion = `${booking.client_first_name} ${booking.client_last_name}`.trim();
    let direccion = booking.billing_address || "Iquitos, Loreto, Perú";

    if (isFactura) {
      docType = 6; // RUC
      docNumber = (booking.billing_doc_number || "").trim();
      denominacion = (booking.billing_name || denominacion).trim();
      if (booking.billing_address) {
        direccion = booking.billing_address.trim();
      }
    } else {
      const dni = (booking.billing_doc_number || booking.client_dni || "").trim();
      if (dni && dni.length === 8) {
        docType = 1; // DNI
        docNumber = dni;
      } else if (booking.billing_doc_number) {
        docNumber = booking.billing_doc_number.trim();
      } else {
        docType = 1; // DNI default / persona natural
        docNumber = "00000000";
      }
      if (booking.billing_name) {
        denominacion = booking.billing_name.trim();
      }
    }

    const email = booking.client_email ? booking.client_email.trim() : "";
    const fechaEmision = getFormattedDate();

    // 2. Construcción de ítems con prorrateo según monto pagado (adelanto o 100%)
    const paidAmountCents = booking.advance_amount_cents || booking.total_price_cents;
    const paidTotalSoles = Number((paidAmountCents / 100).toFixed(2));
    const isFullPayment =
      booking.advance_percentage === 100 ||
      paidAmountCents === booking.total_price_cents;

    let items: Array<{
      unidad_de_medida: string;
      codigo: string;
      descripcion: string;
      cantidad: number;
      valor_unitario: number;
      precio_unitario: number;
      subtotal: number;
      tipo_de_igv: number;
      igv: number;
      total: number;
      anticipo_regularizacion: boolean;
    }> = [];

    if (services.length > 0) {
      let accumulatedTotal = 0;

      items = services.map((s, index) => {
        const isLast = index === services.length - 1;
        let itemTotal: number;

        if (isFullPayment) {
          itemTotal = Number((s.service_price_cents / 100).toFixed(2));
        } else {
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
          unidad_de_medida: "ZZ", // ZZ = Servicios
          codigo: `SRV-${index + 1}`,
          descripcion: description,
          cantidad: 1,
          valor_unitario: itemTotal,
          precio_unitario: itemTotal,
          subtotal: itemTotal,
          tipo_de_igv: 8, // 8 = Exonerado - Operación Onerosa (Amazonía)
          igv: 0,
          total: itemTotal,
          anticipo_regularizacion: false,
        };
      });
    } else {
      items = [
        {
          unidad_de_medida: "ZZ",
          codigo: "SRV-01",
          descripcion: `Servicio de Barbería / Spa - Reserva ${booking.booking_code}`,
          cantidad: 1,
          valor_unitario: paidTotalSoles,
          precio_unitario: paidTotalSoles,
          subtotal: paidTotalSoles,
          tipo_de_igv: 8, // 8 = Exonerado
          igv: 0,
          total: paidTotalSoles,
          anticipo_regularizacion: false,
        },
      ];
    }

    // 3. Construcción del Payload para Nubefact API
    const payload = {
      operacion: "generar_comprobante",
      tipo_de_comprobante: tipoDeComprobante,
      serie: serie,
      numero: "", // Correlativo automático generado por Nubefact
      codigo_unico: booking.booking_code, // Código único de trazabilidad
      sunat_transaction: 1, // Venta interna
      cliente_tipo_de_documento: docType,
      cliente_numero_de_documento: docNumber,
      cliente_denominacion: denominacion,
      cliente_direccion: direccion,
      cliente_email: email,
      fecha_de_emision: fechaEmision,
      moneda: 1, // 1 = Soles
      porcentaje_de_igv: 18.0,

      // Régimen Amazonía (Exonerado de IGV)
      total_exonerada: paidTotalSoles,
      total_gravada: 0,
      total_inafecta: 0,
      total_igv: 0,
      total: paidTotalSoles,

      items: items,
      observaciones: `Reserva: ${booking.booking_code}${chargeId ? ` | Culqi Charge: ${chargeId}` : ""}`,
    };

    console.log(
      `[Nubefact] Emitiendo ${isFactura ? "Factura" : "Boleta"} para reserva ${booking.booking_code} (Monto: S/ ${paidTotalSoles})...`
    );

    // 4. Petición HTTP POST obligatoria a Nubefact
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json().catch(() => null);

    if (!response.ok || responseData?.errors) {
      const errorMsg =
        responseData?.errors ||
        responseData?.message ||
        `Error en API de Nubefact (HTTP ${response.status})`;

      console.error("[Nubefact] Error en respuesta de API:", responseData);
      return {
        success: false,
        error: errorMsg,
        raw: responseData,
      };
    }

    console.log("[Nubefact] Comprobante emitido con éxito:", {
      serie: responseData.serie,
      numero: responseData.numero,
      pdf: responseData.enlace_del_pdf,
    });

    // 5. Extraer campos generados por Nubefact
    const comprobanteSerie = responseData.serie || serie;
    const comprobanteNumero = Number(responseData.numero || 1);
    const pdfUrl = responseData.enlace_del_pdf || responseData.enlace || "";
    const xmlUrl = responseData.enlace_del_xml || "";
    const key = responseData.key || "";

    return {
      success: true,
      comprobante: {
        id: key,
        tipo: isFactura ? "01" : "03",
        tipo_de_comprobante: tipoDeComprobante,
        serie: comprobanteSerie,
        numero: comprobanteNumero,
        pdf_url: pdfUrl,
        xml_url: xmlUrl,
        key: key,
      },
      raw: responseData,
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("[Nubefact] Excepción al emitir comprobante:", errMessage);
    return {
      success: false,
      error: `Excepción al conectar con Nubefact: ${errMessage}`,
    };
  }
}
