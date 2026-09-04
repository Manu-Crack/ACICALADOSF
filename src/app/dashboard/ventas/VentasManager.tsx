"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { TicketVentaTermico, TicketVentaData } from "./TicketVentaTermico";
import { createClient } from "@/lib/supabase/client";
import { emitVentaChange, subscribeVentasSync } from "@/lib/utils/ventas-sync";

export interface VentaItem {
  id: string;
  cliente_nombre: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  metodo_pago: string;
  fecha: string;
  registrado_por?: string | null;
  notas?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ProductSuggestion {
  id: string;
  name: string;
  price: number;
}

interface VentasManagerProps {
  userRole: string;
}

function getPeruDateString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(date);
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

function getPeruDateTimeLocal(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
    return parts.replace(" ", "T");
  } catch {
    return date.toISOString().slice(0, 16);
  }
}

export function VentasManager({ userRole }: VentasManagerProps) {
  const [ventas, setVentas] = useState<VentaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtros
  const [filterRange, setFilterRange] = useState<"hoy" | "semana" | "mes" | "todas">("hoy");
  const [searchTerm, setSearchTerm] = useState("");

  // Sugerencias opcionales de productos
  const [productSuggestions, setProductSuggestions] = useState<ProductSuggestion[]>([]);

  // Formulario de nueva venta
  const [clienteNombre, setClienteNombre] = useState("");
  const [productoNombre, setProductoNombre] = useState("");
  const [cantidad, setCantidad] = useState<number>(1);
  const [precioUnitario, setPrecioUnitario] = useState<number | string>(25);
  const [metodoPago, setMetodoPago] = useState<"Efectivo" | "Yape" | "Transferencia" | "Mixto">("Efectivo");
  const [fechaHora, setFechaHora] = useState<string>(getPeruDateTimeLocal());
  const [notas, setNotas] = useState("");

  // Modal de Ticket Térmico
  const [ticketVenta, setTicketVenta] = useState<TicketVentaData | null>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);

  // Modal / Estado de Edición Rápida
  const [editingVenta, setEditingVenta] = useState<VentaItem | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [editQty, setEditQty] = useState<number>(1);
  const [savingEdit, setSavingEdit] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // Cargar sugerencias de productos del catálogo (solo informativas/autocompletado, no bloqueantes)
  useEffect(() => {
    async function loadCatalogSuggestions() {
      try {
        const res = await fetch("/api/admin/products");
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json) ? json : json.products || [];
          setProductSuggestions(
            items.map((p: { id: string; name: string; price: number }) => ({
              id: p.id,
              name: p.name,
              price: Number(p.price) || 0,
            }))
          );
        }
      } catch (e) {
        console.warn("No se pudieron cargar sugerencias del catálogo de productos:", e);
      }
    }
    loadCatalogSuggestions();
  }, []);

  // Cargar ventas desde API
  const fetchVentas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ventas?limit=500");
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error al cargar ventas.");
      }
      const json = await res.json();
      setVentas(json.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de conexión al cargar ventas.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVentas();
  }, [fetchVentas]);

  // Suscripción Realtime a ventas_mostrador
  useEffect(() => {
    const channel = supabase
      .channel("realtime-ventas-mostrador")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ventas_mostrador",
        },
        () => {
          fetchVentas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchVentas]);

  // Sincronización instantánea cross-tab entre instancias de VentasManager
  useEffect(() => {
    const unsubscribe = subscribeVentasSync(() => {
      fetchVentas();
    });
    return () => {
      unsubscribe();
    };
  }, [fetchVentas]);

  // Si el usuario selecciona un producto del datalist, autocompletar precio si no se ha modificado
  const handleProductChange = (val: string) => {
    setProductoNombre(val);
    const match = productSuggestions.find(
      (p) => p.name.toLowerCase().trim() === val.toLowerCase().trim()
    );
    if (match && match.price > 0) {
      setPrecioUnitario(match.price);
    }
  };

  // Cálculo en tiempo real del total del formulario
  const liveTotal = useMemo(() => {
    const q = Math.max(1, Number(cantidad) || 1);
    const p = Math.max(0, Number(precioUnitario) || 0);
    return Math.round(q * p * 100) / 100;
  }, [cantidad, precioUnitario]);

  // Registro de venta
  const handleRegister = async (printTicketAfter: boolean = false) => {
    setError(null);
    setSuccessMessage(null);

    const clientTrimmed = clienteNombre.trim();
    const productTrimmed = productoNombre.trim();

    if (!clientTrimmed) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }
    if (!productTrimmed) {
      setError("El nombre del producto es obligatorio.");
      return;
    }

    const q = parseInt(String(cantidad), 10);
    if (isNaN(q) || q < 1) {
      setError("La cantidad debe ser mínimo 1 unidad.");
      return;
    }

    const p = parseFloat(String(precioUnitario));
    if (isNaN(p) || p < 0) {
      setError("El precio unitario no puede ser negativo.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        cliente_nombre: clientTrimmed,
        producto_nombre: productTrimmed,
        cantidad: q,
        precio_unitario: p,
        metodo_pago: metodoPago,
        fecha: fechaHora ? new Date(fechaHora).toISOString() : new Date().toISOString(),
        notas: notas.trim() || null,
      };

      const res = await fetch("/api/admin/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al registrar la venta.");
      }

      const createdSale: VentaItem = json.data;

      // Actualizar estado local inmediatamente
      setVentas((prev) => [createdSale, ...prev]);

      // Emitir evento de sincronización instantánea para Inicio y Reportes
      emitVentaChange({
        eventType: "INSERT",
        venta: createdSale,
      });

      setSuccessMessage(`✅ Venta de "${createdSale.producto_nombre}" registrada correctamente por S/ ${Number(createdSale.total).toFixed(2)}.`);

      // Limpiar formulario y resetear a valores predeterminados
      setClienteNombre("");
      setProductoNombre("");
      setCantidad(1);
      setPrecioUnitario(25);
      setNotas("");
      setFechaHora(getPeruDateTimeLocal());

      // Si solicitó imprimir de inmediato
      if (printTicketAfter) {
        setTicketVenta({
          id: createdSale.id,
          cliente_nombre: createdSale.cliente_nombre,
          producto_nombre: createdSale.producto_nombre,
          cantidad: createdSale.cantidad,
          precio_unitario: createdSale.precio_unitario,
          total: createdSale.total,
          metodo_pago: createdSale.metodo_pago,
          fecha: createdSale.fecha,
          notas: createdSale.notas,
        });
        setIsTicketOpen(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado al registrar venta.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Guardar edición post-creación
  const handleSaveEdit = async () => {
    if (!editingVenta) return;
    const p = parseFloat(editPrice);
    if (isNaN(p) || p < 0) {
      alert("Ingrese un precio unitario válido.");
      return;
    }
    const q = parseInt(String(editQty), 10);
    if (isNaN(q) || q < 1) {
      alert("Ingrese una cantidad válida (mínimo 1).");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch("/api/admin/ventas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingVenta.id,
          precio_unitario: p,
          cantidad: q,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al actualizar venta.");
      }

      const updatedSale: VentaItem = json.data;

      // Actualizar listado local y KPIs de inmediato
      setVentas((prev) =>
        prev.map((v) => (v.id === updatedSale.id ? updatedSale : v))
      );

      // Emitir evento de sincronización instantánea para Inicio y Reportes
      emitVentaChange({
        eventType: "UPDATE",
        venta: updatedSale,
        oldVenta: editingVenta,
      });

      setEditingVenta(null);
      setSuccessMessage(`✅ Venta actualizada: Total recalculado a S/ ${Number(updatedSale.total).toFixed(2)}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar venta.";
      alert(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // Abrir ticket de venta
  const handleOpenTicket = (v: VentaItem) => {
    setTicketVenta({
      id: v.id,
      cliente_nombre: v.cliente_nombre,
      producto_nombre: v.producto_nombre,
      cantidad: v.cantidad,
      precio_unitario: v.precio_unitario,
      total: v.total,
      metodo_pago: v.metodo_pago,
      fecha: v.fecha,
      notas: v.notas,
    });
    setIsTicketOpen(true);
  };

  // Eliminar venta
  const handleDeleteVenta = async (v: VentaItem) => {
    if (!confirm(`¿Estás seguro de eliminar la venta de "${v.producto_nombre}" para "${v.cliente_nombre}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/ventas?id=${v.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error al eliminar.");
      }
      setVentas((prev) => prev.filter((item) => item.id !== v.id));

      // Emitir evento de sincronización instantánea para Inicio y Reportes
      emitVentaChange({
        eventType: "DELETE",
        venta: v,
      });

      setSuccessMessage("Venta eliminada del registro.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo eliminar la venta.";
      alert(msg);
    }
  };

  // Límites de fecha en Perú
  const todayPeruStr = useMemo(() => getPeruDateString(), []);

  // Cálculos de KPIs del día
  const todaySales = useMemo(() => {
    return ventas.filter((v) => {
      const saleDatePeru = getPeruDateString(new Date(v.fecha));
      return saleDatePeru === todayPeruStr;
    });
  }, [ventas, todayPeruStr]);

  const totalVentasHoyCents = useMemo(() => {
    return todaySales.reduce((acc, v) => acc + Math.round(Number(v.total) * 100), 0);
  }, [todaySales]);

  const totalUnidadesHoy = useMemo(() => {
    return todaySales.reduce((acc, v) => acc + (v.cantidad || 1), 0);
  }, [todaySales]);

  // Filtrado de la tabla
  const filteredVentas = useMemo(() => {
    let list = ventas;

    // Filtro temporal
    if (filterRange === "hoy") {
      list = list.filter((v) => getPeruDateString(new Date(v.fecha)) === todayPeruStr);
    } else if (filterRange === "semana") {
      const now = new Date();
      const [y, m, d] = todayPeruStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d, 12, 0, 0);
      const dayOfWeek = dt.getDay();
      const diffToMonday = dt.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const mondayDate = new Date(y, m - 1, diffToMonday, 0, 0, 0);
      const sundayDate = new Date(y, m - 1, diffToMonday + 6, 23, 59, 59);

      list = list.filter((v) => {
        const saleD = new Date(v.fecha);
        return saleD >= mondayDate && saleD <= sundayDate;
      });
    } else if (filterRange === "mes") {
      const [year, month] = todayPeruStr.split("-");
      list = list.filter((v) => {
        const salePeru = getPeruDateString(new Date(v.fecha));
        return salePeru.startsWith(`${year}-${month}`);
      });
    }

    // Filtro de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.cliente_nombre.toLowerCase().includes(term) ||
          v.producto_nombre.toLowerCase().includes(term) ||
          v.metodo_pago.toLowerCase().includes(term)
      );
    }

    return list;
  }, [ventas, filterRange, searchTerm, todayPeruStr]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. Header Oficial */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.8rem" }}>🛍️</span>
            <h1 className="heading-lg" style={{ margin: 0 }}>
              Ventas Rápidas / Mostrador
            </h1>
          </div>
          <p className="text-muted" style={{ marginTop: 4, fontSize: "0.88rem" }}>
            Registro manual de productos físicos (ceras, ropa, accesorios) con ticket propio y consolidación financiera.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className="badge badge-success"
            style={{ fontSize: "0.75rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }}></span>
            Caja Activa (Perú)
          </span>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-md, 8px)",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#f87171",
            fontSize: "0.85rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="btn btn-ghost btn-sm"
            style={{ padding: "0 6px" }}
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-md, 8px)",
            background: "rgba(34, 197, 94, 0.12)",
            border: "1px solid rgba(34, 197, 94, 0.4)",
            color: "#4ade80",
            fontSize: "0.85rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="btn btn-ghost btn-sm"
            style={{ padding: "0 6px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Tarjetas KPI de Ventas del Día */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div
          className="card"
          style={{
            padding: "18px 20px",
            background: "linear-gradient(135deg, rgba(200, 164, 92, 0.15) 0%, rgba(200, 164, 92, 0.03) 100%)",
            border: "1px solid rgba(200, 164, 92, 0.35)",
            borderRadius: "var(--radius-lg, 12px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 800, color: "var(--color-primary, #C8A45C)", letterSpacing: "0.05em" }}>
              Total Ventas Hoy
            </span>
            <span style={{ fontSize: "1.3rem" }}>💵</span>
          </div>
          <p style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--color-primary, #C8A45C)", margin: "8px 0 2px" }}>
            S/ {(totalVentasHoyCents / 100).toFixed(2)}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Recaudación exclusiva en productos
          </span>
        </div>

        <div
          className="card"
          style={{
            padding: "18px 20px",
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg, 12px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.05em" }}>
              Unidades Vendidas Hoy
            </span>
            <span style={{ fontSize: "1.3rem" }}>📦</span>
          </div>
          <p style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--color-text)", margin: "8px 0 2px" }}>
            {totalUnidadesHoy}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Artículos físicos despachados
          </span>
        </div>

        <div
          className="card"
          style={{
            padding: "18px 20px",
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg, 12px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.05em" }}>
              Transacciones Hoy
            </span>
            <span style={{ fontSize: "1.3rem" }}>🧾</span>
          </div>
          <p style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--color-text)", margin: "8px 0 2px" }}>
            {todaySales.length}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Tickets y recibos emitidos hoy
          </span>
        </div>
      </div>

      {/* 3. Formulario de Registro Ágil en Mostrador */}
      <div
        className="card"
        style={{
          padding: "24px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg, 12px)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)", paddingBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.2rem" }}>⚡</span>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>
              Nueva Venta en Mostrador
            </h2>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Campos obligatorios marcados con *
          </span>
        </div>

        {/* Datalist de sugerencias */}
        <datalist id="datalist-catalog-products">
          {productSuggestions.map((p) => (
            <option key={p.id} value={p.name}>
              {`S/ ${p.price.toFixed(2)}`}
            </option>
          ))}
        </datalist>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {/* Cliente */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: 6 }}>
              Nombre del Cliente *
            </label>
            <input
              type="text"
              className="input"
              placeholder="Ej. Juan Pérez / Mario Vargas"
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              required
              id="input-venta-cliente"
              style={{ width: "100%" }}
            />
          </div>

          {/* Producto */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: 6 }}>
              Producto / Descripción *
            </label>
            <input
              type="text"
              list="datalist-catalog-products"
              className="input"
              placeholder="Ej. Cera Mate Gorilla / Polo Oversize"
              value={productoNombre}
              onChange={(e) => handleProductChange(e.target.value)}
              required
              id="input-venta-producto"
              style={{ width: "100%" }}
            />
            <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: 4, display: "block" }}>
              Texto libre o autocompletado del catálogo
            </span>
          </div>

          {/* Cantidad */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: 6 }}>
              Cantidad (Unidades) *
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCantidad((prev) => Math.max(1, prev - 1))}
                style={{ padding: "6px 12px", fontWeight: 800 }}
              >
                −
              </button>
              <input
                type="number"
                min="1"
                step="1"
                className="input"
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
                id="input-venta-cantidad"
                style={{ width: "100%", textAlign: "center", fontWeight: 700 }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCantidad((prev) => prev + 1)}
                style={{ padding: "6px 12px", fontWeight: 800 }}
              >
                +
              </button>
            </div>
          </div>

          {/* Precio Unitario */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: 6 }}>
              Precio Unitario (S/) *
            </label>
            <input
              type="number"
              min="0"
              step="0.50"
              className="input"
              placeholder="0.00"
              value={precioUnitario}
              onChange={(e) => setPrecioUnitario(e.target.value)}
              id="input-venta-precio"
              style={{ width: "100%", fontWeight: 700 }}
            />
            <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: 4, display: "block" }}>
              Editable libremente para rebajas o acuerdos
            </span>
          </div>

          {/* Método de Pago */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: 6 }}>
              Método de Pago
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
              {(["Efectivo", "Yape", "Transferencia", "Mixto"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodoPago(m)}
                  className={`btn btn-sm ${metodoPago === m ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: metodoPago === m ? 800 : 500,
                    padding: "6px 8px",
                  }}
                >
                  {m === "Efectivo" && "💵 "}
                  {m === "Yape" && "📱 "}
                  {m === "Transferencia" && "🏦 "}
                  {m === "Mixto" && "🔀 "}
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha y Hora */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: 6 }}>
              Fecha / Hora de Venta
            </label>
            <input
              type="datetime-local"
              className="input"
              value={fechaHora}
              onChange={(e) => setFechaHora(e.target.value)}
              style={{ width: "100%", fontSize: "0.82rem" }}
            />
          </div>
        </div>

        {/* Indicador de Total y Botones de Acción */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            background: "rgba(200, 164, 92, 0.06)",
            padding: "16px 20px",
            borderRadius: "var(--radius-md, 8px)",
            border: "1px solid rgba(200, 164, 92, 0.25)",
            marginTop: 4,
          }}
        >
          <div>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontWeight: 700 }}>
              Total Calculado ({cantidad} × S/ {Number(precioUnitario || 0).toFixed(2)})
            </span>
            <p
              style={{
                fontSize: "1.9rem",
                fontWeight: 900,
                color: "var(--color-primary, #C8A45C)",
                margin: "4px 0 0",
                letterSpacing: "-0.02em",
              }}
            >
              S/ {liveTotal.toFixed(2)}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => handleRegister(false)}
              disabled={submitting}
              className="btn btn-secondary"
              style={{ padding: "10px 20px", fontWeight: 700, fontSize: "0.88rem" }}
              id="btn-registrar-venta"
            >
              {submitting ? "Guardando..." : "Registrar Venta"}
            </button>

            <button
              type="button"
              onClick={() => handleRegister(true)}
              disabled={submitting}
              className="btn btn-primary"
              style={{
                padding: "10px 22px",
                fontWeight: 800,
                fontSize: "0.88rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 14px rgba(200, 164, 92, 0.35)",
              }}
              id="btn-registrar-e-imprimir"
            >
              <span>🖨️</span>
              <span>{submitting ? "Procesando..." : "Registrar e Imprimir Ticket"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Historial de Ventas y Edición Post-Creación */}
      <div
        className="card"
        style={{
          padding: "20px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg, 12px)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>
              Historial de Ventas ({filteredVentas.length})
            </h3>
            <p className="text-muted" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
              Modifica precios o reimprime tickets térmicos en cualquier momento.
            </p>
          </div>

          {/* Selector de periodo */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { id: "hoy", label: "Hoy" },
              { id: "semana", label: "Esta Semana" },
              { id: "mes", label: "Este Mes" },
              { id: "todas", label: "Todas" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterRange(t.id as typeof filterRange)}
                className={`btn btn-sm ${filterRange === t.id ? "btn-primary" : "btn-ghost"}`}
                style={{ fontSize: "0.78rem", fontWeight: 700, padding: "5px 12px" }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Buscador rápido */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="text"
            className="input"
            placeholder="🔍 Buscar por cliente, producto o método de pago..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, fontSize: "0.82rem" }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="btn btn-ghost btn-sm"
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Tabla */}
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Fecha / Hora</th>
                <th style={{ padding: "10px 12px" }}>Cliente</th>
                <th style={{ padding: "10px 12px" }}>Producto</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Cant.</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>P. Unitario</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Total</th>
                <th style={{ padding: "10px 12px" }}>Método</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--color-text-muted)" }}>
                    ⏳ Cargando ventas de mostrador...
                  </td>
                </tr>
              ) : filteredVentas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--color-text-muted)" }}>
                    No se encontraron ventas para el periodo o criterio seleccionado.
                  </td>
                </tr>
              ) : (
                filteredVentas.map((v) => {
                  const d = new Date(v.fecha);
                  const dateStr = d.toLocaleDateString("es-PE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    timeZone: "America/Lima",
                  });
                  const timeStr = d.toLocaleTimeString("es-PE", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "America/Lima",
                  });

                  return (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 600 }}>{dateStr}</span>
                        <br />
                        <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                          {timeStr}
                        </span>
                      </td>

                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                        {v.cliente_nombre}
                      </td>

                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontWeight: 600 }}>{v.producto_nombre}</span>
                        {v.notas && (
                          <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                            {v.notas}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800 }}>
                        {v.cantidad}
                      </td>

                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        S/ {Number(v.precio_unitario).toFixed(2)}
                      </td>

                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 900, color: "var(--color-primary, #C8A45C)" }}>
                        S/ {Number(v.total).toFixed(2)}
                      </td>

                      <td style={{ padding: "10px 12px" }}>
                        <span
                          className="badge"
                          style={{
                            background:
                              v.metodo_pago === "Yape"
                                ? "rgba(147, 51, 234, 0.15)"
                                : v.metodo_pago === "Efectivo"
                                ? "rgba(34, 197, 94, 0.15)"
                                : "rgba(59, 130, 246, 0.15)",
                            color:
                              v.metodo_pago === "Yape"
                                ? "#c084fc"
                                : v.metodo_pago === "Efectivo"
                                ? "#4ade80"
                                : "#60a5fa",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "3px 8px",
                          }}
                        >
                          {v.metodo_pago}
                        </span>
                      </td>

                      <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          {/* Edición de precio / cantidad post-creación */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVenta(v);
                              setEditPrice(String(v.precio_unitario));
                              setEditQty(v.cantidad);
                            }}
                            className="btn btn-ghost btn-sm"
                            title="Editar precio o cantidad"
                            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                          >
                            ✏️ Editar
                          </button>

                          {/* Reimprimir ticket */}
                          <button
                            type="button"
                            onClick={() => handleOpenTicket(v)}
                            className="btn btn-secondary btn-sm"
                            title="Reimprimir ticket térmico"
                            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                          >
                            🖨️ Ticket
                          </button>

                          {/* Anular si es admin */}
                          {userRole === "admin" && (
                            <button
                              type="button"
                              onClick={() => handleDeleteVenta(v)}
                              className="btn btn-ghost btn-sm"
                              title="Eliminar venta"
                              style={{ fontSize: "0.75rem", padding: "4px 8px", color: "#f87171" }}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edición Rápida Post-Creación */}
      {editingVenta && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(3px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setEditingVenta(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 420,
              width: "100%",
              padding: 24,
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg, 12px)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>
                ✏️ Modificar Venta Post-Creación
              </h3>
              <button
                type="button"
                onClick={() => setEditingVenta(null)}
                className="btn btn-ghost btn-sm"
                style={{ padding: "2px 6px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
              Venta a <strong>{editingVenta.cliente_nombre}</strong> — {editingVenta.producto_nombre}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: 4 }}>
                Cantidad de Unidades
              </label>
              <input
                type="number"
                min="1"
                step="1"
                className="input"
                value={editQty}
                onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: 4 }}>
                Precio Unitario (S/)
              </label>
              <input
                type="number"
                min="0"
                step="0.50"
                className="input"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {/* Total recalculado */}
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(200, 164, 92, 0.08)",
                border: "1px solid rgba(200, 164, 92, 0.3)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>Nuevo Total:</span>
              <span style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--color-primary)" }}>
                S/ {(Math.max(1, editQty) * Math.max(0, parseFloat(editPrice) || 0)).toFixed(2)}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setEditingVenta(null)}
                className="btn btn-ghost btn-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 800 }}
              >
                {savingEdit ? "Guardando..." : "Guardar y Recalcular"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ticket Térmico Independiente */}
      <TicketVentaTermico
        venta={ticketVenta}
        isOpen={isTicketOpen}
        onClose={() => setIsTicketOpen(false)}
      />
    </div>
  );
}
