/**
 * Bus de Sincronización en Tiempo Real para Ventas de Mostrador
 * Proporciona comunicación instantánea (<1ms) entre pestañas y componentes
 * mediante BroadcastChannel, localStorage y eventos del DOM del navegador.
 */

export interface VentaSyncPayload {
  id?: string;
  cliente_nombre?: string;
  producto_nombre?: string;
  cantidad?: number;
  precio_unitario?: number;
  total?: number;
  metodo_pago?: string;
  fecha?: string;
  registrado_por?: string | null;
  notas?: string | null;
  [key: string]: any;
}

export type VentaSyncEventType = "INSERT" | "UPDATE" | "DELETE";

export interface VentaSyncEvent {
  eventType: VentaSyncEventType;
  venta: VentaSyncPayload;
  oldVenta?: VentaSyncPayload;
  timestamp: number;
}

const CHANNEL_NAME = "acicalados-ventas-sync-bus";
const CUSTOM_EVENT_NAME = "acicalados-ventas-event";
const STORAGE_KEY = "acicalados_last_venta_sync";

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!("BroadcastChannel" in window)) return null;

  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      console.warn("[ventas-sync] BroadcastChannel not supported or failed:", e);
      return null;
    }
  }
  return broadcastChannel;
}

export function getLastVentaSyncTimestamp(): number {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Number(parsed?.timestamp) || 0;
  } catch {
    return 0;
  }
}

/**
 * Emite una notificación de evento de venta (creación, edición o eliminación).
 * Se propaga a través de:
 * 1. BroadcastChannel (entre pestañas/ventanas de alta velocidad)
 * 2. CustomEvent (mismo documento DOM)
 * 3. localStorage (para persistir la última actualización entre navegaciones client-side)
 */
export function emitVentaChange(params: {
  eventType: VentaSyncEventType;
  venta: VentaSyncPayload;
  oldVenta?: VentaSyncPayload;
}): void {
  if (typeof window === "undefined") return;

  const eventData: VentaSyncEvent = {
    eventType: params.eventType,
    venta: params.venta,
    oldVenta: params.oldVenta,
    timestamp: Date.now(),
  };

  // 1. Persistir en localStorage para componentes que se monten posteriormente tras navegación
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eventData));
    } catch (err) {
      console.warn("[ventas-sync] Error saving to localStorage:", err);
    }
  }

  // 2. Enviar a través de BroadcastChannel a otras pestañas del navegador
  try {
    const bc = getBroadcastChannel();
    if (bc) {
      bc.postMessage(eventData);
    }
  } catch (err) {
    console.warn("[ventas-sync] Error posting message to BroadcastChannel:", err);
  }

  // 3. Enviar a través de CustomEvent para componentes montados en la pestaña actual
  try {
    const customEvt = new CustomEvent(CUSTOM_EVENT_NAME, { detail: eventData });
    window.dispatchEvent(customEvt);
  } catch (err) {
    console.warn("[ventas-sync] Error dispatching CustomEvent:", err);
  }
}

/**
 * Se suscribe a los cambios de ventas emitidos tanto por la pestaña actual como por otras pestañas.
 * Retorna una función para cancelar la suscripción.
 */
export function subscribeVentasSync(
  callback: (event: VentaSyncEvent) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  // Handler para la misma pestaña vía CustomEvent
  const handleCustomEvent = (e: Event) => {
    const customEvt = e as CustomEvent<VentaSyncEvent>;
    if (customEvt && customEvt.detail) {
      callback(customEvt.detail);
    }
  };

  window.addEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);

  // Handler para evento storage de window
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && parsed.eventType) {
          callback(parsed);
        }
      } catch {}
    }
  };

  window.addEventListener("storage", handleStorageEvent);

  // Handler para otras pestañas vía BroadcastChannel
  const bc = getBroadcastChannel();
  const handleBroadcastMessage = (event: MessageEvent<VentaSyncEvent>) => {
    if (event.data && event.data.eventType) {
      callback(event.data);
    }
  };

  if (bc) {
    bc.addEventListener("message", handleBroadcastMessage);
  }

  return () => {
    window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
    if (bc) {
      bc.removeEventListener("message", handleBroadcastMessage);
    }
  };
}
