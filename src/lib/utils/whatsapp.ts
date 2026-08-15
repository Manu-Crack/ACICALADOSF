/**
 * Utilidad para generar el enlace dinámico de WhatsApp para reservas en Acicalados.
 */

export interface WhatsAppBookingParams {
  bookingCode?: string;
  clientName: string;
  services: string | string[];
  bookingDate: string;
  startTime: string;
  totalPriceSoles: number | string;
  whatsappNumber?: string;
}

/**
 * Genera la URL codificada de WhatsApp con el mensaje pre-llenado de confirmación.
 *
 * Formato requerido:
 * Hola Acicalados, quisiera confirmar mi reserva:
 * - Código: [Código]
 * - Cliente: [Nombre completo]
 * - Servicio: [Nombre del Servicio]
 * - Fecha y Hora: [Día - Hora]
 * - Total a pagar en local: S/ [Precio]
 */
export function generateWhatsAppBookingUrl({
  bookingCode,
  clientName,
  services,
  bookingDate,
  startTime,
  totalPriceSoles,
  whatsappNumber,
}: WhatsAppBookingParams): string {
  const number =
    whatsappNumber ||
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
    "51997766828";

  const cleanNumber = number.replace(/\D/g, "");
  const servicesText = Array.isArray(services) ? services.join(", ") : services;

  // Formato amigable de fecha DD/MM/AAAA
  let formattedDate = bookingDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
    const [y, m, d] = bookingDate.split("-");
    formattedDate = `${d}/${m}/${y}`;
  }

  const priceText =
    typeof totalPriceSoles === "number"
      ? totalPriceSoles.toFixed(2)
      : Number(totalPriceSoles).toFixed(2);

  const lines = [
    "Hola Acicalados, quisiera confirmar mi reserva:",
    ...(bookingCode ? [`- Código: ${bookingCode}`] : []),
    `- Cliente: ${clientName.trim()}`,
    `- Servicio: ${servicesText}`,
    `- Fecha y Hora: ${formattedDate} - ${startTime}`,
    `- Total a pagar en local: S/ ${priceText}`,
  ];

  const message = lines.join("\n");
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}
