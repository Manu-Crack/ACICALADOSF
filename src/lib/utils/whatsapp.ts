/**
 * Utilidad centralizada para generar enlaces dinámicos de WhatsApp en Acicalados.
 *
 * REGLAS DE NEGOCIO:
 * 1. Los mensajes diferencian entre: Adelanto (25%), Saldo pendiente y Pago total.
 * 2. No se asume ni se afirma que el comprobante o QR se adjuntarán automáticamente
 *    (WhatsApp Web solo soporta texto pre-cargado vía URL wa.me).
 * 3. Se añade la instrucción explícita para que el usuario adjunte manualmente su comprobante.
 */

// ---------------------------------------------------------------------------
// Tipos de Parámetros
// ---------------------------------------------------------------------------

export type WhatsAppPaymentMessageType = "advance" | "balance" | "full" | "partial";

export interface BaseWhatsAppParams {
  bookingCode: string;
  clientName: string;
  whatsappNumber?: string;
}

export interface WhatsAppAdvanceParams extends BaseWhatsAppParams {
  services: string | string[];
  bookingDate: string;
  startTime: string;
  totalPriceSoles: number | string;
  advancePercentage?: number;
  advanceAmountSoles: number | string;
  balanceSoles: number | string;
}

export interface WhatsAppBalanceParams extends BaseWhatsAppParams {
  totalPriceSoles: number | string;
  amountPaidSoles: number | string;
  balanceSoles: number | string;
  payingAmountSoles?: number | string;
}

export interface WhatsAppFullPaymentParams extends BaseWhatsAppParams {
  services: string | string[];
  totalPriceSoles: number | string;
}

export interface WhatsAppBookingParams {
  bookingCode?: string;
  clientName: string;
  services: string | string[];
  bookingDate: string;
  startTime: string;
  totalPriceSoles: number | string;
  advancePercentage?: number;
  advanceAmountSoles?: number | string;
  balanceSoles?: number | string;
  whatsappNumber?: string;
}

// ---------------------------------------------------------------------------
// Helpers de Formato
// ---------------------------------------------------------------------------

function cleanWhatsAppPhone(phone?: string): string {
  const number = phone || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "51997766828";
  return number.replace(/\D/g, "");
}

function formatSoles(val: number | string | undefined): string {
  if (val === undefined || val === null) return "0.00";
  const num = typeof val === "number" ? val : parseFloat(String(val)) || 0;
  return num.toFixed(2);
}

function formatDateFriendly(dateStr: string): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

function formatServices(services: string | string[]): string {
  return Array.isArray(services) ? services.join(", ") : services;
}

// ---------------------------------------------------------------------------
// Generadores Específicos
// ---------------------------------------------------------------------------

/**
 * 1. Mensaje para solicitud de ADELANTO (mínimo 25% para confirmar reserva)
 */
export function generateWhatsAppAdvanceUrl({
  bookingCode,
  clientName,
  services,
  bookingDate,
  startTime,
  totalPriceSoles,
  advancePercentage = 25,
  advanceAmountSoles,
  balanceSoles,
  whatsappNumber,
}: WhatsAppAdvanceParams): string {
  const phone = cleanWhatsAppPhone(whatsappNumber);
  const formattedDate = formatDateFriendly(bookingDate);
  const servicesText = formatServices(services);
  const total = formatSoles(totalPriceSoles);
  const advance = formatSoles(advanceAmountSoles);
  const balance = formatSoles(balanceSoles);

  const lines = [
    "💈 *ACICALADOS — Solicitud de Confirmación de Reserva*",
    "",
    "Hola, deseo confirmar mi reserva mediante el adelanto requerido:",
    `• *Código de Cita:* ${bookingCode}`,
    `• *Cliente:* ${clientName.trim()}`,
    `• *Servicio(s):* ${servicesText}`,
    `• *Fecha y Hora:* ${formattedDate} a las ${startTime?.slice(0, 5)}`,
    `• *Monto Total:* S/ ${total}`,
    `• *Adelanto Requerido (${advancePercentage}%):* S/ ${advance}`,
    `• *Saldo Pendiente en Local:* S/ ${balance}`,
    "",
    "📸 *Nota:* He realizado el pago por Yape y a continuación adjunto la captura de mi comprobante.",
  ];

  const message = lines.join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * 2. Mensaje para PAGO DE SALDO pendiente
 */
export function generateWhatsAppBalanceUrl({
  bookingCode,
  clientName,
  totalPriceSoles,
  amountPaidSoles,
  balanceSoles,
  payingAmountSoles,
  whatsappNumber,
}: WhatsAppBalanceParams): string {
  const phone = cleanWhatsAppPhone(whatsappNumber);
  const total = formatSoles(totalPriceSoles);
  const paid = formatSoles(amountPaidSoles);
  const balance = formatSoles(balanceSoles);
  const paying = formatSoles(payingAmountSoles || balanceSoles);

  const lines = [
    "💈 *ACICALADOS — Pago de Saldo de Reserva*",
    "",
    "Hola, deseo registrar el pago de saldo de mi reserva:",
    `• *Código de Cita:* ${bookingCode}`,
    `• *Cliente:* ${clientName.trim()}`,
    `• *Total del Servicio:* S/ ${total}`,
    `• *Total Anteriormente Pagado:* S/ ${paid}`,
    `• *Saldo Pendiente:* S/ ${balance}`,
    `• *Monto Pagado en esta Operación:* S/ ${paying}`,
    "",
    "📸 *Nota:* A continuación adjunto la captura de mi comprobante de pago.",
  ];

  const message = lines.join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * 3. Mensaje para PAGO TOTAL (100% en una sola transferencia)
 */
export function generateWhatsAppFullPaymentUrl({
  bookingCode,
  clientName,
  services,
  totalPriceSoles,
  whatsappNumber,
}: WhatsAppFullPaymentParams): string {
  const phone = cleanWhatsAppPhone(whatsappNumber);
  const servicesText = formatServices(services);
  const total = formatSoles(totalPriceSoles);

  const lines = [
    "💈 *ACICALADOS — Pago Total de Reserva*",
    "",
    "Hola, he realizado el pago completo del 100% de mi reserva:",
    `• *Código de Cita:* ${bookingCode}`,
    `• *Cliente:* ${clientName.trim()}`,
    `• *Servicio(s):* ${servicesText}`,
    `• *Monto Total Cancelado:* S/ ${total}`,
    `• *Estado:* Pago completo (100%)`,
    "",
    "📸 *Nota:* A continuación adjunto la captura de mi comprobante de pago.",
  ];

  const message = lines.join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * 4. Función unificada compatible con el flujo general de reservas
 */
export function generateWhatsAppBookingUrl({
  bookingCode,
  clientName,
  services,
  bookingDate,
  startTime,
  totalPriceSoles,
  advancePercentage = 25,
  advanceAmountSoles,
  balanceSoles,
  whatsappNumber,
}: WhatsAppBookingParams): string {
  if (advanceAmountSoles !== undefined) {
    return generateWhatsAppAdvanceUrl({
      bookingCode: bookingCode || "PENDIENTE",
      clientName,
      services,
      bookingDate,
      startTime,
      totalPriceSoles,
      advancePercentage,
      advanceAmountSoles,
      balanceSoles: balanceSoles !== undefined ? balanceSoles : totalPriceSoles,
      whatsappNumber,
    });
  }

  const phone = cleanWhatsAppPhone(whatsappNumber);
  const formattedDate = formatDateFriendly(bookingDate);
  const servicesText = formatServices(services);
  const total = formatSoles(totalPriceSoles);
  const advCalculated = formatSoles(
    (typeof totalPriceSoles === "number" ? totalPriceSoles : parseFloat(totalPriceSoles) || 0) * (advancePercentage / 100)
  );

  const lines = [
    "💈 *ACICALADOS — Solicitud de Reserva*",
    "",
    "Hola Acicalados, quisiera confirmar mi reserva:",
    ...(bookingCode ? [`• *Código:* ${bookingCode}`] : []),
    `• *Cliente:* ${clientName.trim()}`,
    `• *Servicio(s):* ${servicesText}`,
    `• *Fecha y Hora:* ${formattedDate} a las ${startTime?.slice(0, 5)}`,
    `• *Total del Servicio:* S/ ${total}`,
    `• *Adelanto Requerido (${advancePercentage}%):* S/ ${advCalculated}`,
    "",
    "📸 *Nota:* A continuación adjunto mi comprobante de Yape para confirmar la cita.",
  ];

  const message = lines.join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
