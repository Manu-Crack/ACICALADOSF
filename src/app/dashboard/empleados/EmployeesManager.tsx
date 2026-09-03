"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils/format";
import { EmployeeQRBadgeModal } from "@/app/dashboard/asistencia/EmployeeQRBadgeModal";
import { EmployeeAbsenceRangeModal } from "./EmployeeAbsenceRangeModal";
import { generateEmployeeAgendaPdf } from "@/lib/utils/employee-agenda-pdf";

type Service = {
  id: string;
  name: string;
  type: string;
  price_cents: number;
  duration_minutes: number;
};

type EmployeeBlock = {
  id: string;
  employee_id: string;
  block_date: string;
  start_date?: string;
  end_date?: string;
  is_all_day?: boolean;
  reason: string;
  start_time: string | null;
  end_time: string | null;
};

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  type: "barberia" | "spa" | "recepcionista";
  is_active: boolean;
  rotation_order?: number;
  employee_skills?: { service_id: string }[];
  employee_blocks?: EmployeeBlock[];
};

type BookingServiceItem = {
  id: string;
  service_id: string;
  service_name: string;
  service_price_cents: number;
  duration_minutes: number;
  assigned_employee_id?: string | null;
  created_at?: string | null;
  start_time?: string;
  end_time?: string;
  services?: {
    id: string;
    name: string;
    type: string;
  } | null;
};

type AssignedBooking = {
  id: string;
  booking_code: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_price_cents: number;
  total_duration_minutes: number;
  assigned_employee_id: string | null;
  service_type?: string;
  client_first_name: string;
  client_last_name: string;
  client_phone: string | null;
  client_email: string | null;
  booking_services: BookingServiceItem[];
};

type EmployeeAssignmentCard = {
  cardId: string;
  booking: AssignedBooking;
  workerId: string | null;
  workerName: string;
  services: BookingServiceItem[];
  totalDurationMinutes: number;
  totalPriceCents: number;
  startTime: string;
  endTime: string;
};

// Utilidades para cálculo genérico y dinámico de cronogramas en citas
function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente (WhatsApp)",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  expirada: "Expirada",
};

const statusColors: Record<string, string> = {
  pendiente: "badge-warning",
  confirmada: "badge-success",
  completada: "badge-gold",
  cancelada: "badge-error",
  expirada: "badge-neutral",
};

const paymentLabels: Record<string, string> = {
  sin_pago: "Pendiente de cobro",
  pendiente: "Pendiente de cobro",
  parcial: "Parcial",
  total: "Pagado en local",
};

export default function EmployeesManager({ userRole = "admin" }: { userRole?: string }) {
  const isAdmin = userRole === "admin";
  const [activeTab, setActiveTab] = useState<"employees" | "assignments">("employees");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [assignedBookings, setAssignedBookings] = useState<AssignedBooking[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for Tab 1 (Employees list)
  const [filterType, setFilterType] = useState<"all" | "barberia" | "spa" | "recepcionista">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Filters for Tab 2 (Assigned Services & Bookings)
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>("all");
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<string>("all");
  const [assignmentDateFilter, setAssignmentDateFilter] = useState<string>("");
  const [assignmentSearch, setAssignmentSearch] = useState<string>("");

  // Modal states
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceEmp, setAbsenceEmp] = useState<Employee | null>(null);
  const [selectedQrEmp, setSelectedQrEmp] = useState<Employee | null>(null);

  // Form states - Employee
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [type, setType] = useState<"barberia" | "spa" | "recepcionista">("spa");
  const [isActive, setIsActive] = useState(true);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [savingEmp, setSavingEmp] = useState(false);

  // Form states - Absence
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("Permiso / Ausencia");
  const [savingAbsence, setSavingAbsence] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, svcRes] = await Promise.all([
        fetch("/api/admin/employees"),
        fetch("/api/admin/services"),
      ]);

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData);
      }
      if (svcRes.ok) {
        const svcData = await svcRes.json();
        setServices(svcData);
      }

      // Load bookings with assigned services
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(
          `
          id,
          booking_code,
          booking_date,
          start_time,
          end_time,
          status,
          payment_status,
          total_price_cents,
          total_duration_minutes,
          assigned_employee_id,
          service_type,
          client_first_name,
          client_last_name,
          client_phone,
          client_email,
          booking_services (
            id,
            service_id,
            service_name,
            service_price_cents,
            duration_minutes,
            assigned_employee_id,
            created_at,
            services:service_id (
              id,
              name,
              type
            )
          )
        `
        )
        .in("status", ["pendiente", "confirmada", "completada", "cancelada"])
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: true })
        .limit(200);

      setAssignedBookings((bookingsData as unknown as AssignedBooking[]) ?? []);
    } catch (err) {
      console.error("Error cargando datos de empleados y servicios asignados:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  // Suscripción protegida y autenticada a Supabase Realtime para cambios en reservas y asignaciones de empleados
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    async function initRealtime() {
      try {
        console.log("[Supabase Realtime: Employees] 🔄 Verificando sesión de administrador...");
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (session?.access_token) {
          console.log("[Supabase Realtime: Employees] 🔑 Autenticando canal Realtime con JWT...");
          await supabase.realtime.setAuth(session.access_token);
        }

        if (!isMounted) return;

        console.log("[Supabase Realtime: Employees/Assignments] 🔄 Inicializando canal 'realtime-employees-assignments-changes'...");

        channel = supabase
          .channel("realtime-employees-assignments-changes")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
            },
            (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
              console.log("[Supabase Realtime: Employees/Assignments] ⚡ Cambio en tabla bookings:", payload.eventType, payload);
              if (loadDataRef.current) {
                loadDataRef.current();
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "employees",
            },
            (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
              console.log("[Supabase Realtime: Employees/Assignments] ⚡ Cambio en tabla employees:", payload.eventType, payload);
              if (loadDataRef.current) {
                loadDataRef.current();
              }
            }
          )
          .subscribe((status: string, err?: Error | unknown) => {
            console.log(`[Supabase Realtime: Employees/Assignments] 📡 Estado de suscripción: ${status}`);
            if (status === "SUBSCRIBED") {
              console.log("[Supabase Realtime: Employees/Assignments] 🟢 Conexión activa y autenticada escuchando 'bookings' y 'employees'.");
            } else if (status === "CHANNEL_ERROR") {
              console.error("[Supabase Realtime: Employees/Assignments] ❌ Error en el canal Realtime:", err);
            } else if (status === "TIMED_OUT") {
              console.warn("[Supabase Realtime: Employees/Assignments] ⏱️ Timeout en canal Realtime.");
            } else if (status === "CLOSED") {
              console.log("[Supabase Realtime: Employees/Assignments] 🔒 Canal Realtime cerrado.");
            }
          });
      } catch (err) {
        console.error("[Supabase Realtime: Employees] Error inicializando suscripción:", err);
      }
    }

    initRealtime();

    const { data: authSubData } = supabase.auth.onAuthStateChange(async (_event: string, session: { access_token?: string } | null) => {
      if (session?.access_token) {
        console.log("[Supabase Realtime: Employees] 🔄 Token renovado, actualizando Realtime auth...");
        await supabase.realtime.setAuth(session.access_token);
      }
    });

    return () => {
      isMounted = false;
      authSubData?.subscription?.unsubscribe();
      if (channel) {
        console.log("[Supabase Realtime: Employees/Assignments] 🛑 Desmontando componente: Removiendo canal...");
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  // Mapas auxiliares para resolución de nombres y rubros
  const employeeMap = useMemo(() => {
    return new Map(employees.map((e) => [e.id, `${e.first_name || ""} ${e.last_name || ""}`.trim()]));
  }, [employees]);

  const employeeTypeMap = useMemo(() => {
    return new Map(employees.map((e) => [e.id, e.type]));
  }, [employees]);

  const serviceTypeMap = useMemo(() => {
    return new Map(services.map((s) => [s.id, s.type]));
  }, [services]);

  // Switch to assignments tab for a specific employee
  function viewEmployeeAssignments(employeeId: string) {
    setSelectedEmpFilter(employeeId);
    setActiveTab("assignments");
  }

  // Abrir Modal Empleado (Crear / Editar)
  function handleOpenEmpModal(emp?: Employee) {
    if (emp) {
      setEditingEmp(emp);
      setFirstName(emp.first_name);
      setLastName(emp.last_name);
      setType(emp.type);
      setIsActive(emp.is_active);
      setSelectedSkills(emp.employee_skills?.map((s) => s.service_id) || []);
    } else {
      setEditingEmp(null);
      setFirstName("");
      setLastName("");
      setType("spa");
      setIsActive(true);
      setSelectedSkills([]);
    }
    setShowEmpModal(true);
  }

  // Guardar Empleado (POST / PUT)
  async function handleSaveEmp(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      alert("Por favor ingrese Nombre y Apellido del trabajador");
      return;
    }

    setSavingEmp(true);
    try {
      const url = "/api/admin/employees";
      const method = editingEmp ? "PUT" : "POST";
      const payload = {
        id: editingEmp?.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        type,
        is_active: isActive,
        service_ids: type === "spa" ? selectedSkills : [],
      };

      // Los recepcionistas no tienen habilidades de servicio
      if (type === "recepcionista") {
        payload.service_ids = [];
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setShowEmpModal(false);
        loadData();
      } else {
        const errorMsg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
            ? data.message
            : "No se pudo guardar el trabajador";
        alert(errorMsg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Error de conexión al guardar el trabajador: " + msg);
    } finally {
      setSavingEmp(false);
    }
  }

  // Eliminar Empleado
  async function handleDeleteEmp(emp: Employee) {
    if (
      !confirm(
        `¿Estás seguro de eliminar a ${emp.first_name} ${emp.last_name}? Se desvinculará de sus habilidades asignadas.`
      )
    )
      return;

    try {
      const res = await fetch(`/api/admin/employees?id=${emp.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      } else {
        const errorMsg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
            ? data.message
            : "No se pudo eliminar el trabajador";
        alert(errorMsg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Error de conexión al intentar eliminar: " + msg);
    }
  }

  // Abrir Modal Ausencia
  function handleOpenAbsenceModal(emp: Employee) {
    setAbsenceEmp(emp);
    setBlockDate(new Date().toISOString().split("T")[0]);
    setBlockReason("Permiso / Ausencia");
    setShowAbsenceModal(true);
  }

  // Guardar Ausencia
  async function handleSaveAbsence(e: React.FormEvent) {
    e.preventDefault();
    if (!absenceEmp || !blockDate) return;

    setSavingAbsence(true);
    try {
      const res = await fetch("/api/admin/employees/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: absenceEmp.id,
          block_date: blockDate,
          reason: blockReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowAbsenceModal(false);
        loadData();
      } else {
        const errorMsg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
            ? data.message
            : "No se pudo registrar la ausencia";
        alert(errorMsg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Error de conexión al registrar ausencia: " + msg);
    } finally {
      setSavingAbsence(false);
    }
  }

  // Eliminar Ausencia
  async function handleDeleteAbsence(blockId: string) {
    if (!confirm("¿Deseas eliminar este permiso / ausencia?")) return;

    try {
      const res = await fetch(`/api/admin/employees/absences?id=${blockId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        loadData();
      } else {
        const errorMsg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
            ? data.message
            : "No se pudo eliminar la ausencia";
        alert(errorMsg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Error al eliminar ausencia: " + msg);
    }
  }

  // Toggle Seleccionar Habilidad
  function toggleSkill(serviceId: string) {
    setSelectedSkills((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  }

  // Seleccionar todas las habilidades filtradas
  function selectAllSkills(typeFilter: string) {
    const matchingServiceIds = services
      .filter((s) => s.type === typeFilter)
      .map((s) => s.id);
    setSelectedSkills((prev) => Array.from(new Set([...prev, ...matchingServiceIds])));
  }

  // Filtered employees for Tab 1
  const filteredEmployees = employees.filter((emp) => {
    if (filterType !== "all" && emp.type !== filterType) return false;
    if (!searchTerm) return true;
    const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });


  // Determinar el ID del trabajador asignado a un servicio específico
  const getServiceWorkerId = useCallback(
    (svc: BookingServiceItem, booking: AssignedBooking): string | null => {
      // 1. Asignación directa en el ítem de servicio
      if (svc.assigned_employee_id) {
        return svc.assigned_employee_id;
      }
      // 2. Si no tiene asignación directa, verificar asignación principal de la reserva
      if (booking.assigned_employee_id) {
        const empType = employeeTypeMap.get(booking.assigned_employee_id);
        const svcType = svc.services?.type || serviceTypeMap.get(svc.service_id);
        // Si el empleado tiene rubro ("barberia" o "spa"), asegurar que coincida con el rubro del servicio
        if (empType && svcType && empType !== "recepcionista") {
          return empType === svcType ? booking.assigned_employee_id : null;
        }
        return booking.assigned_employee_id;
      }
      return null;
    },
    [employeeTypeMap, serviceTypeMap]
  );

  // Desglosar estrictamente todas las reservas en tarjetas independientes por trabajador asignado,
  // calculando dinámicamente el cronograma interno, ventana horaria y duración real por colaborador.
  const allAssignmentCards = useMemo((): EmployeeAssignmentCard[] => {
    const cards: EmployeeAssignmentCard[] = [];

    for (const b of assignedBookings) {
      const services = b.booking_services || [];

      if (services.length > 0) {
        // 1. Ordenar servicios respetando la cronología de creación / secuencia contratada
        const sortedServices = [...services].sort((a, bItem) => {
          if (a.created_at && bItem.created_at) {
            const diff = new Date(a.created_at).getTime() - new Date(bItem.created_at).getTime();
            if (diff !== 0) return diff;
          }
          return 0;
        });

        // 2. Secuenciar cronológicamente los servicios iniciando en la hora de inicio de la cita
        const baseStartMin = parseTimeToMinutes(b.start_time);
        let currentMin = baseStartMin;

        const scheduledServices: Array<{
          service: BookingServiceItem;
          workerId: string | null;
          startMin: number;
          endMin: number;
          startTimeStr: string;
          endTimeStr: string;
        }> = [];

        for (const svc of sortedServices) {
          const duration = Math.max(1, Number(svc.duration_minutes) || 30);
          const svcStartMin = currentMin;
          const svcEndMin = svcStartMin + duration;
          const startTimeStr = formatMinutesToTime(svcStartMin);
          const endTimeStr = formatMinutesToTime(svcEndMin);
          const wId = getServiceWorkerId(svc, b);

          scheduledServices.push({
            service: {
              ...svc,
              start_time: startTimeStr,
              end_time: endTimeStr,
            },
            workerId: wId,
            startMin: svcStartMin,
            endMin: svcEndMin,
            startTimeStr,
            endTimeStr,
          });

          currentMin = svcEndMin;
        }

        // 3. Agrupar los servicios secuenciados por cada trabajador asignado
        const groups = new Map<string | null, typeof scheduledServices>();

        for (const scheduled of scheduledServices) {
          const currentList = groups.get(scheduled.workerId) || [];
          currentList.push(scheduled);
          groups.set(scheduled.workerId, currentList);
        }

        // 4. Construir la tarjeta individual para cada colaborador con su rango horario real
        for (const [wId, workerScheduled] of groups.entries()) {
          const svcs = workerScheduled.map((s) => s.service);
          const duration =
            svcs.reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0) || 30;
          const price =
            svcs.reduce((sum, s) => sum + (Number(s.service_price_cents) || 0), 0);

          const firstService = workerScheduled[0];
          const lastService = workerScheduled[workerScheduled.length - 1];

          const workerStartTime = firstService?.startTimeStr || formatMinutesToTime(baseStartMin);
          const workerEndTime =
            lastService?.endTimeStr || formatMinutesToTime(baseStartMin + duration);

          cards.push({
            cardId: `${b.id}-${wId || "unassigned"}`,
            booking: b,
            workerId: wId,
            workerName: wId
              ? employeeMap.get(wId) || "Especialista"
              : "Sin asignar",
            services: svcs,
            totalDurationMinutes: duration,
            totalPriceCents: svcs.length > 0 ? price : b.total_price_cents,
            startTime: workerStartTime,
            endTime: workerEndTime,
          });
        }
      } else {
        const wId = b.assigned_employee_id || null;
        const fallbackStart = b.start_time ? b.start_time.slice(0, 5) : "00:00";
        const fallbackEnd = b.end_time
          ? b.end_time.slice(0, 5)
          : formatMinutesToTime(parseTimeToMinutes(fallbackStart) + (b.total_duration_minutes || 30));

        cards.push({
          cardId: `${b.id}-${wId || "unassigned"}`,
          booking: b,
          workerId: wId,
          workerName: wId
            ? employeeMap.get(wId) || "Especialista"
            : "Sin asignar",
          services: [
            {
              id: `${b.id}-default`,
              service_id: "",
              service_name: `Servicio ${
                b.service_type === "barberia"
                  ? "de Barbería"
                  : b.service_type === "spa"
                  ? "de Spa"
                  : "Mixto"
              }`,
              service_price_cents: b.total_price_cents,
              duration_minutes: b.total_duration_minutes || 30,
              assigned_employee_id: wId,
              start_time: fallbackStart,
              end_time: fallbackEnd,
            },
          ],
          totalDurationMinutes: b.total_duration_minutes || 30,
          totalPriceCents: b.total_price_cents,
          startTime: fallbackStart,
          endTime: fallbackEnd,
        });
      }
    }

    return cards;
  }, [assignedBookings, getServiceWorkerId, employeeMap]);

  // Filtered cards for Tab 2 (Assigned Services Module)
  const filteredAssignmentCards = useMemo(() => {
    return allAssignmentCards.filter((card) => {
      // 1. Filtro por trabajador
      if (selectedEmpFilter === "unassigned") {
        if (card.workerId !== null) return false;
      } else if (selectedEmpFilter !== "all") {
        if (card.workerId !== selectedEmpFilter) return false;
      }

      // 2. Filtro por estado
      if (assignmentStatusFilter !== "all" && card.booking.status !== assignmentStatusFilter) {
        return false;
      }

      // 3. Filtro por fecha
      if (assignmentDateFilter && card.booking.booking_date !== assignmentDateFilter) {
        return false;
      }

      // 4. Búsqueda por texto
      if (assignmentSearch) {
        const term = assignmentSearch.toLowerCase();
        const code = card.booking.booking_code.toLowerCase();
        const client = `${card.booking.client_first_name} ${card.booking.client_last_name}`.toLowerCase();
        const phone = (card.booking.client_phone || "").toLowerCase();
        const worker = card.workerName.toLowerCase();
        const hasServiceMatch = card.services.some((s) =>
          s.service_name.toLowerCase().includes(term)
        );
        return (
          code.includes(term) ||
          client.includes(term) ||
          phone.includes(term) ||
          worker.includes(term) ||
          hasServiceMatch
        );
      }

      return true;
    });
  }, [
    allAssignmentCards,
    selectedEmpFilter,
    assignmentStatusFilter,
    assignmentDateFilter,
    assignmentSearch,
  ]);

  // Today string for calculations
  const todayStr = new Date().toISOString().split("T")[0];

  // Stats for the selected employee in Tab 2
  const selectedEmpCards = useMemo(() => {
    return allAssignmentCards.filter((card) => {
      if (selectedEmpFilter === "all") return true;
      if (selectedEmpFilter === "unassigned") return card.workerId === null;
      return card.workerId === selectedEmpFilter;
    });
  }, [allAssignmentCards, selectedEmpFilter]);

  const empTotalAssignments = selectedEmpCards.length;
  const empTodayAssignments = selectedEmpCards.filter(
    (card) => card.booking.booking_date === todayStr && card.booking.status !== "cancelada"
  ).length;
  const empCompletedAssignments = selectedEmpCards.filter(
    (card) => card.booking.status === "completada"
  ).length;

  const empTotalRevenue = useMemo(() => {
    return selectedEmpCards
      .filter(
        (card) =>
          card.booking.status === "completada" ||
          card.booking.payment_status === "total"
      )
      .reduce((sum, card) => sum + card.totalPriceCents, 0);
  }, [selectedEmpCards]);

  const totalEmployees = employees.length;
  const spaCount = employees.filter((e) => e.type === "spa").length;
  const barberiaCount = employees.filter((e) => e.type === "barberia").length;
  const recepcionCount = employees.filter((e) => e.type === "recepcionista").length;

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportAgendaPdf = () => {
    try {
      setIsExportingPdf(true);
      const preparedBookings = filteredAssignmentCards.map((card) => ({
        id: card.booking.id,
        booking_code: card.booking.booking_code,
        booking_date: card.booking.booking_date,
        start_time: card.startTime,
        end_time: card.endTime,
        status: card.booking.status,
        payment_status: card.booking.payment_status,
        total_duration_minutes: card.totalDurationMinutes,
        total_price_cents: card.totalPriceCents,
        assigned_employee_id: card.workerId,
        client_first_name: card.booking.client_first_name,
        client_last_name: card.booking.client_last_name,
        client_phone: card.booking.client_phone,
        client_email: card.booking.client_email,
        booking_services: card.services.map((s) => ({
          service_name: s.service_name,
          service_price_cents: s.service_price_cents,
          duration_minutes: s.duration_minutes,
        })),
      }));

      generateEmployeeAgendaPdf({
        bookings: preparedBookings,
        employees,
        selectedEmployeeId: selectedEmpFilter,
        dateFilter: assignmentDateFilter,
        statusFilter: assignmentStatusFilter,
        searchQuery: assignmentSearch,
        generatedByName: isAdmin ? "Administrador" : "Recepción",
      });
    } catch (err) {
      console.error("Error generando PDF de agenda:", err);
      alert("No se pudo generar el documento PDF de la agenda.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: 4 }}>
            👥 Personal y Asignación de Servicios
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
            Administra a tu equipo, revisa los servicios y citas asignadas a cada trabajador.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => handleOpenEmpModal()}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            ➕ Nuevo Trabajador
          </button>
        )}
      </div>

      {/* Tabs Navigation Bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 24,
          paddingBottom: 2,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("employees")}
          className={`btn ${activeTab === "employees" ? "btn-primary" : "btn-ghost"}`}
          style={{
            borderRadius: "var(--radius-md) var(--radius-md) 0 0",
            padding: "10px 20px",
            fontSize: "0.9375rem",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>👥 Directorio & Habilidades</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: "0.75rem",
              background:
                activeTab === "employees"
                  ? "rgba(0,0,0,0.3)"
                  : "rgba(255,255,255,0.1)",
            }}
          >
            {employees.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("assignments")}
          className={`btn ${activeTab === "assignments" ? "btn-primary" : "btn-ghost"}`}
          style={{
            borderRadius: "var(--radius-md) var(--radius-md) 0 0",
            padding: "10px 20px",
            fontSize: "0.9375rem",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>📋 Citas y Servicios Asignados por Trabajador</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: "0.75rem",
              background:
                activeTab === "assignments"
                  ? "rgba(0,0,0,0.3)"
                  : "rgba(255,255,255,0.1)",
            }}
          >
            {allAssignmentCards.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EMPLOYEES DIRECTORY & SKILLS */}
      {/* ========================================================================= */}
      {activeTab === "employees" && (
        <div className="animate-fadeIn">
          {/* Stats Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div className="card" style={{ padding: 16, textAlign: "center" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                Total Personal
              </span>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-primary)" }}>
                {totalEmployees}
              </p>
            </div>
            <div className="card" style={{ padding: 16, textAlign: "center" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                Especialistas Spa
              </span>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#e879f9" }}>
                {spaCount}
              </p>
            </div>
            <div className="card" style={{ padding: 16, textAlign: "center" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                Barberos
              </span>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#38bdf8" }}>
                {barberiaCount}
              </p>
            </div>
            <div className="card" style={{ padding: 16, textAlign: "center" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                🛎️ Recepción
              </span>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#2dd4bf" }}>
                {recepcionCount}
              </p>
            </div>
          </div>

          {/* Filters & Search */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              marginBottom: 24,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              {(["all", "spa", "barberia", "recepcionista"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`btn btn-sm ${filterType === t ? "btn-primary" : "btn-ghost"}`}
                  style={{ textTransform: "capitalize", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {t === "all" ? (
                    "Todos"
                  ) : t === "spa" ? (
                    <>
                      <img src="/LogoSpa.svg" alt="Spa" style={{ width: 14, height: 14, display: "inline-block" }} /> Spa
                    </>
                  ) : t === "barberia" ? (
                    "💈 Barbería"
                  ) : (
                    "🛎️ Recepción"
                  )}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="🔍 Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
              style={{ width: 260 }}
            />
          </div>

          {/* Employees Grid */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>
              Cargando personal...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <p style={{ color: "var(--color-text-muted)" }}>No se encontraron trabajadores.</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: 20,
              }}
            >
              {filteredEmployees.map((emp) => {
                const skillServiceIds = new Set(emp.employee_skills?.map((s) => s.service_id));
                const empServices = services.filter((s) => skillServiceIds.has(s.id));
                const blocks = emp.employee_blocks || [];
                const assignedCount = allAssignmentCards.filter(
                  (c) => c.workerId === emp.id && c.booking.status !== "cancelada"
                ).length;

                return (
                  <div
                    key={emp.id}
                    className="card card-gold"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: 20,
                      borderLeft: `4px solid ${
                        emp.type === "barberia" ? "#38bdf8" : emp.type === "recepcionista" ? "#2dd4bf" : "#e879f9"
                      }`,
                    }}
                  >
                    <div>
                      {/* Top row */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: 2 }}>
                            {emp.first_name} {emp.last_name}
                          </h3>
                          <span
                            className={`badge ${
                              emp.type === "barberia" ? "badge-info" : emp.type === "recepcionista" ? "badge-success" : "badge-secondary"
                            }`}
                            style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            {emp.type === "barberia" ? (
                              "💈 Barbería"
                            ) : emp.type === "recepcionista" ? (
                              "🛎️ Recepción"
                            ) : (
                              <>
                                <img src="/LogoSpa.svg" alt="Spa" style={{ width: 12, height: 12, display: "inline-block" }} /> Spa
                              </>
                            )}
                          </span>
                        </div>

                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            background: emp.is_active
                              ? "rgba(34,197,94,0.1)"
                              : "rgba(239,68,68,0.1)",
                            color: emp.is_active ? "#22c55e" : "#ef4444",
                          }}
                        >
                          {emp.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>

                      {/* Skills summary */}
                      <div style={{ marginBottom: 16 }}>
                        <p
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            color: "var(--color-text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            marginBottom: 6,
                          }}
                        >
                          Especialidades Habilitadas ({empServices.length})
                        </p>
                        {emp.type === "recepcionista" ? (
                          <span className="badge badge-outline" style={{ fontSize: "0.75rem" }}>
                            🛎️ Sin carga de servicios (Recepción)
                          </span>
                        ) : emp.type === "barberia" ? (
                          <span className="badge badge-outline" style={{ fontSize: "0.75rem" }}>
                            ✂️ Todos los servicios de Barbería
                          </span>
                        ) : empServices.length === 0 ? (
                          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                            Sin servicios asignados
                          </span>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 4,
                              maxHeight: 90,
                              overflowY: "auto",
                            }}
                          >
                            {empServices.map((s) => (
                              <span
                                key={s.id}
                                style={{
                                  fontSize: "0.6875rem",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "rgba(255,255,255,0.06)",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                {s.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Absences section */}
                      {blocks.length > 0 && (
                        <div
                          style={{
                            marginBottom: 16,
                            paddingTop: 12,
                            borderTop: "1px dashed var(--color-border)",
                          }}
                        >
                          <p
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              color: "var(--color-warning)",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              marginBottom: 6,
                            }}
                          >
                            ⚠️ Ausencias Registradas ({blocks.length})
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {blocks.map((b) => (
                              <div
                                key={b.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  fontSize: "0.75rem",
                                  background: "rgba(234,179,8,0.08)",
                                  padding: "4px 8px",
                                  borderRadius: 4,
                                }}
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <img src="/calendario.svg" alt="Fecha" style={{ width: 13, height: 13, display: "inline-block" }} />{" "}
                                  {b.start_date || b.block_date}
                                  {b.end_date && b.end_date !== (b.start_date || b.block_date) ? ` al ${b.end_date}` : ""} — {b.reason}
                                </span>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDeleteAbsence(b.id)}
                                    style={{
                                      border: "none",
                                      background: "none",
                                      cursor: "pointer",
                                      color: "#ef4444",
                                      fontSize: "0.75rem",
                                    }}
                                    title="Eliminar permiso"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions & Link to assigned appointments */}
                    <div style={{ paddingTop: 12, borderTop: "1px solid var(--color-border)", marginTop: 12 }}>
                      {emp.type !== "recepcionista" && (
                        <button
                          type="button"
                          onClick={() => viewEmployeeAssignments(emp.id)}
                          className="btn btn-sm"
                          style={{
                            width: "100%",
                            marginBottom: 8,
                            background: "rgba(200,164,92,0.12)",
                            color: "var(--color-primary)",
                            border: "1px solid var(--color-primary-border)",
                            fontWeight: 700,
                            fontSize: "0.8125rem",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <span>📋 Ver Citas Asignadas</span>
                          <span className="badge badge-gold" style={{ fontSize: "0.6875rem" }}>
                            {assignedCount}
                          </span>
                        </button>
                      )}

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {isAdmin && (
                          <button
                            onClick={() => setSelectedQrEmp(emp)}
                            className="btn btn-secondary btn-sm"
                            style={{ flex: "1 1 80px", padding: "6px 10px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                            title="Ver, descargar o compartir Carnet QR por WhatsApp"
                          >
                            🪪 Carnet QR
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEmpModal(emp)}
                              className="btn btn-ghost btn-sm"
                              style={{ flex: "1 1 70px", padding: "6px 8px", fontSize: "0.75rem" }}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => handleOpenAbsenceModal(emp)}
                              className="btn btn-ghost btn-sm"
                              style={{ flex: "1 1 75px", padding: "6px 8px", fontSize: "0.75rem", color: "var(--color-warning)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                            >
                              <img src="/calendario.svg" alt="Permiso" style={{ width: 13, height: 13, display: "inline-block" }} /> Permiso
                            </button>
                            <button
                              onClick={() => handleDeleteEmp(emp)}
                              className="btn btn-ghost btn-sm"
                              style={{ color: "#ef4444", padding: "6px 8px", fontSize: "0.75rem" }}
                              title="Eliminar trabajador"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ASSIGNED SERVICES & APPOINTMENTS PER WORKER */}
      {/* ========================================================================= */}
      {activeTab === "assignments" && (
        <div className="animate-fadeIn">
          {/* Quick Metrics for the selected Worker */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div
              className="card card-gold"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-md)",
                  background: "rgba(200,164,92,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                }}
              >
                📌
              </div>
              <div>
                <p
                  style={{
                    fontSize: "1.375rem",
                    fontWeight: 800,
                    color: "var(--color-primary)",
                    lineHeight: 1,
                  }}
                >
                  {empTotalAssignments}
                </p>
                <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                  Citas Asignadas
                </p>
              </div>
            </div>

            <div
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-md)",
                  background: "rgba(56,189,248,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                }}
              >
                <img src="/calendario.svg" alt="Citas para Hoy" style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <p
                  style={{
                    fontSize: "1.375rem",
                    fontWeight: 800,
                    color: "#38bdf8",
                    lineHeight: 1,
                  }}
                >
                  {empTodayAssignments}
                </p>
                <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                  Citas para Hoy
                </p>
              </div>
            </div>

            <div
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-md)",
                  background: "rgba(34,197,94,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                }}
              >
                🏁
              </div>
              <div>
                <p
                  style={{
                    fontSize: "1.375rem",
                    fontWeight: 800,
                    color: "var(--color-success)",
                    lineHeight: 1,
                  }}
                >
                  {empCompletedAssignments}
                </p>
                <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                  Completadas
                </p>
              </div>
            </div>

            <div
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-md)",
                  background: "rgba(200,164,92,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                }}
              >
                💰
              </div>
              <div>
                <p
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: "var(--color-primary)",
                    lineHeight: 1,
                  }}
                >
                  S/ {(empTotalRevenue / 100).toFixed(2)}
                </p>
                <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                  Ingresos Generados
                </p>
              </div>
            </div>
          </div>

          {/* Filtering controls */}
          <div
            className="card"
            style={{
              marginBottom: 24,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "end",
            }}
          >
            {/* Worker dropdown selector */}
            <div style={{ flex: "1 1 240px" }}>
              <label className="label">Filtrar por Trabajador</label>
              <select
                className="select"
                value={selectedEmpFilter}
                onChange={(e) => setSelectedEmpFilter(e.target.value)}
                style={{ fontWeight: 600 }}
              >
                <option value="all">👥 Todos los Trabajadores ({allAssignmentCards.length})</option>
                <option value="unassigned">⚠️ Citas Sin Asignar</option>
                <optgroup label="Especialistas y Barberos">
                  {employees.map((emp) => {
                    const count = allAssignmentCards.filter((c) => {
                      if (c.booking.status === "cancelada") return false;
                      return c.workerId === emp.id;
                    }).length;
                    return (
                      <option key={emp.id} value={emp.id}>
                        {emp.type === "barberia" ? "💈" : "💆 Spa:"} {emp.first_name}{" "}
                        {emp.last_name} ({count} citas)
                      </option>
                    );
                  })}
                </optgroup>
              </select>
            </div>

            {/* Status filter */}
            <div style={{ flex: "0 0 180px" }}>
              <label className="label">Estado</label>
              <select
                className="select"
                value={assignmentStatusFilter}
                onChange={(e) => setAssignmentStatusFilter(e.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="pendiente">🟡 Pendientes</option>
                <option value="confirmada">🟢 Confirmadas</option>
                <option value="completada">🏁 Completadas</option>
                <option value="cancelada">❌ Canceladas</option>
              </select>
            </div>

            {/* Date filter */}
            <div style={{ flex: "0 0 160px" }}>
              <label className="label">Fecha</label>
              <input
                type="date"
                className="input"
                value={assignmentDateFilter}
                onChange={(e) => setAssignmentDateFilter(e.target.value)}
              />
            </div>

            {/* Search */}
            <div style={{ flex: "1 1 200px" }}>
              <label className="label">Buscar Cita / Servicio</label>
              <input
                className="input"
                placeholder="Código, cliente, servicio..."
                value={assignmentSearch}
                onChange={(e) => setAssignmentSearch(e.target.value)}
              />
            </div>

            {isAdmin && selectedEmpFilter !== "all" && selectedEmpFilter !== "unassigned" && (
              <button
                type="button"
                onClick={() => {
                  const emp = employees.find((e) => e.id === selectedEmpFilter);
                  if (emp) setSelectedQrEmp(emp);
                }}
                className="btn btn-secondary btn-sm"
                style={{ marginBottom: 2, display: "inline-flex", alignItems: "center", gap: 6 }}
                title="Ver, descargar o compartir Carnet QR por WhatsApp"
              >
                🪪 Ver Carnet QR
              </button>
            )}

            <button
              type="button"
              onClick={handleExportAgendaPdf}
              disabled={isExportingPdf}
              className="btn btn-primary btn-sm"
              style={{
                marginBottom: 2,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 700,
              }}
              title="Descargar agenda estructurada en formato PDF con los filtros activos"
            >
              <span>{isExportingPdf ? "⏳ Generando..." : "📄 Exportar PDF"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedEmpFilter("all");
                setAssignmentStatusFilter("all");
                setAssignmentDateFilter("");
                setAssignmentSearch("");
              }}
              className="btn btn-ghost btn-sm"
              style={{ marginBottom: 2 }}
            >
              Limpiar
            </button>
          </div>

          {/* Assigned Bookings List */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>
              Cargando citas asignadas...
            </div>
          ) : filteredAssignmentCards.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📋</div>
              <p style={{ color: "var(--color-text-muted)" }}>
                No hay servicios ni citas asignadas con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {filteredAssignmentCards.map((card) => {
                const b = card.booking;
                const targetEmpName = card.workerName;
                const displayedServices = card.services;
                const displayedDuration = card.totalDurationMinutes;
                const displayedPriceCents = card.totalPriceCents;

                return (
                  <div
                    key={card.cardId}
                    className="card card-gold"
                    style={{
                      padding: "18px 22px",
                      borderLeft: `4px solid ${
                        b.status === "confirmada"
                          ? "var(--color-success)"
                          : b.status === "completada"
                          ? "var(--color-primary)"
                          : b.status === "pendiente"
                          ? "#f59e0b"
                          : "#ef4444"
                      }`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 12,
                        marginBottom: 12,
                      }}
                    >
                      {/* Left: Code, Worker and Date/Time */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <code
                            style={{
                              color: "var(--color-primary)",
                              fontWeight: 800,
                              fontSize: "1rem",
                              background: "rgba(200,164,92,0.1)",
                              padding: "2px 8px",
                              borderRadius: 4,
                            }}
                          >
                            {b.booking_code}
                          </code>

                          <span
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: 700,
                              color: targetEmpName !== "Sin asignar"
                                ? "#FFFFFF"
                                : "var(--color-warning)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            👤 Trabajador asignado:{" "}
                            <strong style={{ color: "var(--color-primary)" }}>
                              {targetEmpName}
                            </strong>
                          </span>
                        </div>

                        <p
                          className="text-muted"
                          style={{ fontSize: "0.875rem", display: "flex", gap: 14, flexWrap: "wrap" }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <img src="/calendario.svg" alt="Fecha" style={{ width: 14, height: 14, display: "inline-block" }} /> {b.booking_date}
                          </span>
                          <span>
                            ⏰ {card.startTime} – {card.endTime}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <img src="/Reloj.svg" alt="Duración" style={{ width: 14, height: 14, display: "inline-block" }} /> {formatDuration(displayedDuration)}
                          </span>
                        </p>
                      </div>

                      {/* Right: Badges */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className={`badge ${statusColors[b.status] || "badge-neutral"}`}>
                          {statusLabels[b.status] || b.status}
                        </span>
                        <span
                          className={`badge ${
                            b.payment_status === "total"
                              ? "badge-success"
                              : "badge-error"
                          }`}
                        >
                          {paymentLabels[b.payment_status] || b.payment_status}
                        </span>
                      </div>
                    </div>

                    {/* Services Assigned to this Worker */}
                    <div
                      style={{
                        background: "rgba(0,0,0,0.25)",
                        borderRadius: "var(--radius-md)",
                        padding: "12px 16px",
                        marginBottom: 14,
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          color: "var(--color-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 8,
                        }}
                      >
                        ✂️ Servicios Asignados ({displayedServices.length}):
                      </p>

                      {displayedServices.length > 0 ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fill, minmax(240px, 1fr))",
                            gap: 8,
                          }}
                        >
                          {displayedServices.map((svc) => (
                            <div
                              key={svc.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "6px 12px",
                                background: "rgba(255,255,255,0.04)",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--color-border)",
                                fontSize: "0.8125rem",
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 600, color: "#FFFFFF" }}>
                                  {svc.service_name}
                                </span>
                                <span
                                  className="text-muted"
                                  style={{ fontSize: "0.75rem", marginLeft: 6 }}
                                >
                                  ({svc.start_time && svc.end_time ? `${svc.start_time} – ${svc.end_time} · ` : ""}{formatDuration(svc.duration_minutes)})
                                </span>
                              </div>
                              <strong style={{ color: "var(--color-primary)" }}>
                                S/ {(svc.service_price_cents / 100).toFixed(2)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                          Sin servicios detallados para este trabajador
                        </p>
                      )}
                    </div>

                    {/* Bottom Row: Client info, WhatsApp link, and Total price */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                        paddingTop: 8,
                      }}
                    >
                      {/* Client Info & WhatsApp */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.875rem" }}>
                          Cliente: <strong>{b.client_first_name} {b.client_last_name}</strong>
                        </span>

                        {b.client_phone && (
                          <a
                            href={`https://wa.me/51${b.client_phone.replace(
                              /\D/g,
                              ""
                            )}?text=${encodeURIComponent(
                              `Hola ${b.client_first_name}, te saludamos de Acicalados respecto a tu cita ${b.booking_code} del ${b.booking_date} a las ${card.startTime} con ${targetEmpName}.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm"
                            style={{
                              background: "#25D366",
                              color: "#FFFFFF",
                              border: "none",
                              padding: "4px 10px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              textDecoration: "none",
                            }}
                          >
                            <img
                              src="/icons/whatsApp.svg"
                              alt="WhatsApp"
                              style={{ width: 14, height: 14 }}
                            />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>

                      {/* Right: Total Price */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontSize: "0.9375rem",
                            fontWeight: 800,
                            color: "var(--color-primary)",
                          }}
                        >
                          Total: S/ {(displayedPriceCents / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL CREAR/EDITAR EMPLEADO */}
      {showEmpModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 600,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: 16 }}>
              {editingEmp ? "✏️ Editar Trabajador" : "➕ Nuevo Trabajador"}
            </h2>

            <form onSubmit={handleSaveEmp}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label">Nombres *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Apellidos *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="label">Tipo de Personal *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "barberia" | "spa" | "recepcionista")}
                    className="input"
                  >
                    <option value="spa">Spa</option>
                    <option value="barberia">Barbería</option>
                    <option value="recepcionista">Recepción</option>
                  </select>
                </div>
                <div>
                  <label className="label">Estado</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <span>Activo en sistema</span>
                  </label>
                </div>
              </div>

              {/* Skills selection */}
              {type === "spa" && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label className="label" style={{ marginBottom: 0 }}>
                      Servicios de Spa Capacitados ({selectedSkills.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => selectAllSkills("spa")}
                      style={{ fontSize: "0.75rem", background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer" }}
                    >
                      Seleccionar Todos Spa
                    </button>
                  </div>

                  <div
                    style={{
                      maxHeight: 220,
                      overflowY: "auto",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      padding: 12,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      background: "rgba(0,0,0,0.2)",
                    }}
                  >
                    {services
                      .filter((s) => s.type === "spa")
                      .map((s) => (
                        <label
                          key={s.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: "0.8125rem",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSkills.includes(s.id)}
                            onChange={() => toggleSkill(s.id)}
                          />
                          <span>{s.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid var(--color-border)", flexWrap: "wrap" }}>
                {isAdmin && editingEmp && (
                  <button
                    type="button"
                    onClick={() => {
                      const empToView = editingEmp;
                      setShowEmpModal(false);
                      setSelectedQrEmp(empToView);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ marginRight: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    🪪 Ver Carnet QR
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEmp}
                  className="btn btn-primary btn-sm"
                >
                  {savingEmp ? "Guardando..." : "Guardar Trabajador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR AUSENCIA / PERMISO POR RANGO */}
      {showAbsenceModal && absenceEmp && (
        <EmployeeAbsenceRangeModal
          employee={absenceEmp}
          onClose={() => setShowAbsenceModal(false)}
          onSuccess={loadData}
        />
      )}

      {/* Employee QR Badge Modal */}
      {selectedQrEmp && (
        <EmployeeQRBadgeModal
          employee={selectedQrEmp}
          onClose={() => setSelectedQrEmp(null)}
        />
      )}
    </div>
  );
}
