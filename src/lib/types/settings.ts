/**
 * Tipos TypeScript para la configuración de pagos y gestión de comprobantes.
 * Coinciden con las tablas payment_settings y payment_proofs.
 */

export interface PaymentSettings {
  id: number;
  recipient_name: string;
  yape_phone: string;
  qr_image_url: string | null;
  advance_percentage: number;
  base_message: string;
  is_active: boolean;
  updated_at: string;
  updated_by: string | null;
  updated_by_name?: string;
}

export type ProofStatus = "pending" | "verified" | "rejected";

export interface PaymentProof {
  id: string;
  booking_id: string;
  payment_id: string | null;
  proof_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string | null;
  uploaded_by_name?: string;
  status: ProofStatus;
  notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  signed_url?: string;
}

export interface UpdatePaymentSettingsPayload {
  recipient_name: string;
  yape_phone: string;
  advance_percentage: number;
  base_message?: string;
  is_active?: boolean;
  qr_image_url?: string | null;
}

export interface DefaultPaymentSettings {
  recipient_name: string;
  yape_phone: string;
  advance_percentage: number;
  base_message: string;
  is_active: boolean;
}

export const DEFAULT_PAYMENT_SETTINGS: DefaultPaymentSettings = {
  recipient_name: "Jorjito",
  yape_phone: "51997766828",
  advance_percentage: 25,
  base_message: "Hola Acicalados, adjunto mi comprobante de pago para mi reserva.",
  is_active: true,
};
