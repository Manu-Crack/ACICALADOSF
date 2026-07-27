import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";

const INITIAL_EMPLOYEES = [
  { first_name: "Yordi", last_name: "Atao Huaman", type: "barberia" },
  { first_name: "Medalid", last_name: "Huamán Chávez", type: "spa" },
  { first_name: "Liz", last_name: "Cuatimancani Vargas", type: "spa" },
  { first_name: "Yudith", last_name: "Muñoz Ochoa", type: "spa" },
  { first_name: "Yholi Milusca", last_name: "Lunasco Morales", type: "spa" },
  { first_name: "Luisa", last_name: "Pérez", type: "spa" },
  { first_name: "Layssa Elizabeth", last_name: "Suárez Aguila", type: "spa" },
  { first_name: "Aracely", last_name: "Orosco Champac", type: "spa" },
  { first_name: "Janet", last_name: "Vargas Quintero", type: "spa" },
];

const INITIAL_SERVICES = [
  // Barbería
  { name: "CORTE CLÁSICO", type: "barberia", duration_minutes: 30, price_cents: 2000 },
  { name: "CORTE FADE", type: "barberia", duration_minutes: 60, price_cents: 2500 },
  { name: "CORTE + BARBA", type: "barberia", duration_minutes: 60, price_cents: 3000 },
  { name: "CORTE + DISEÑO", type: "barberia", duration_minutes: 80, price_cents: 5000 },
  // Spa
  { name: "PEDICURE", type: "spa", duration_minutes: 90, price_cents: 4000 },
  { name: "DEPILACIÓN (PIERNA)", type: "spa", duration_minutes: 30, price_cents: 5000 },
  { name: "DEPILACIÓN (PIERNA Y MUSLO)", type: "spa", duration_minutes: 45, price_cents: 7000 },
  { name: "MANICURE", type: "spa", duration_minutes: 90, price_cents: 3500 },
  { name: "ACRÍLICAS (2H 30MIN)", type: "spa", duration_minutes: 150, price_cents: 7000 },
  { name: "ACRÍLICAS (2H)", type: "spa", duration_minutes: 120, price_cents: 6500 },
  { name: "FACIAL PROFUNDO", type: "spa", duration_minutes: 90, price_cents: 8000 },
  { name: "FACIAL BÁSICO", type: "spa", duration_minutes: 30, price_cents: 5000 },
  { name: "RIZADO DE PESTAÑAS", type: "spa", duration_minutes: 45, price_cents: 3500 },
  { name: "PIGMENTACIÓN DE CEJAS", type: "spa", duration_minutes: 30, price_cents: 2500 },
  { name: "PESTAÑAS POSTIZAS", type: "spa", duration_minutes: 30, price_cents: 3500 },
  { name: "PLANCHADO DE CEJAS", type: "spa", duration_minutes: 40, price_cents: 2500 },
  { name: "TINTE BUENO (1 SOLO COLOR)", type: "spa", duration_minutes: 90, price_cents: 12000 },
  { name: "TINTE NORMAL (1 SOLO COLOR)", type: "spa", duration_minutes: 90, price_cents: 10000 },
  { name: "TINTE BÁSICO (1 SOLO COLOR)", type: "spa", duration_minutes: 90, price_cents: 8000 },
  { name: "TOQUE DE RAÍZ", type: "spa", duration_minutes: 90, price_cents: 8000 },
  { name: "BAÑO DE COLOR", type: "spa", duration_minutes: 60, price_cents: 8000 },
  { name: "BALAGE", type: "spa", duration_minutes: 210, price_cents: 35000 },
  { name: "ALIZADO BÁSICO", type: "spa", duration_minutes: 180, price_cents: 20000 },
  { name: "ALIZADO DUAL (PORTUGAL)", type: "spa", duration_minutes: 240, price_cents: 35000 },
  { name: "ALIZADO VIP", type: "spa", duration_minutes: 420, price_cents: 45000 },
  { name: "DEPILACIÓN DE BOZO", type: "spa", duration_minutes: 10, price_cents: 1000 },
  { name: "DEPILACIÓN DE BOZO CON HILO", type: "spa", duration_minutes: 10, price_cents: 1000 },
  { name: "DEPILACIÓN DE BOZO CON CERA", type: "spa", duration_minutes: 10, price_cents: 1000 },
  { name: "DEPILACIÓN FACIAL CON HILO", type: "spa", duration_minutes: 45, price_cents: 3000 },
  { name: "DEPILACIÓN CON CERA", type: "spa", duration_minutes: 30, price_cents: 4500 },
  { name: "BOTOX DE 150", type: "spa", duration_minutes: 120, price_cents: 15000 },
  { name: "BOTOX DE 80", type: "spa", duration_minutes: 120, price_cents: 8000 },
  { name: "PIGMENTACIÓN DE 3 DÍAS", type: "spa", duration_minutes: 4320, price_cents: 1000 },
  { name: "PIGMENTACIÓN DE 2 SEMANAS", type: "spa", duration_minutes: 20160, price_cents: 2500 },
  { name: "RAYITOS", type: "spa", duration_minutes: 120, price_cents: 20000 },
  { name: "MECHAS + COLOR", type: "spa", duration_minutes: 180, price_cents: 28000 },
  { name: "BALAGE + COLOR", type: "spa", duration_minutes: 240, price_cents: 45000 },
  { name: "EXTENSIONES DE CABELLO 1", type: "spa", duration_minutes: 60, price_cents: 10000 },
  { name: "EXTENSIONES DE CABELLO 2", type: "spa", duration_minutes: 180, price_cents: 70000 },
  { name: "EXTENSIONES DE CABELLO 3", type: "spa", duration_minutes: 300, price_cents: 100000 },
  { name: "BLANQUEAMIENTO", type: "spa", duration_minutes: 30, price_cents: 3000 },
  { name: "PESTAÑAS POSTIZAS 1X1", type: "spa", duration_minutes: 35, price_cents: 3500 },
  { name: "PESTAÑAS POSTIZAS ANIME", type: "spa", duration_minutes: 25, price_cents: 2500 },
  { name: "LAVADO DE CABELLO", type: "spa", duration_minutes: 10, price_cents: 1000 },
  { name: "PLANCHADO DE CABELLO", type: "spa", duration_minutes: 30, price_cents: 3000 },
  { name: "SECADO + PLANCHADO", type: "spa", duration_minutes: 45, price_cents: 3000 },
  { name: "ONDULACIÓN CABELLO CORTO", type: "spa", duration_minutes: 120, price_cents: 5000 },
  { name: "ONDULACIÓN CABELLO MEDIANO", type: "spa", duration_minutes: 180, price_cents: 7000 },
  { name: "ONDULACIÓN CABELLO LARGO", type: "spa", duration_minutes: 240, price_cents: 12000 },
  { name: "MICRO BLADING", type: "spa", duration_minutes: 120, price_cents: 25000 },
  { name: "MICRO CHEADING", type: "spa", duration_minutes: 180, price_cents: 35000 },
  { name: "LABIOS", type: "spa", duration_minutes: 150, price_cents: 45000 },
  { name: "CEPILLADO DE CABELLO", type: "spa", duration_minutes: 60, price_cents: 3000 },
  { name: "DELINEADO DE OJOS SUPERIOR", type: "spa", duration_minutes: 120, price_cents: 25000 },
  { name: "DELINEADO DE OJOS BEAGLE", type: "spa", duration_minutes: 120, price_cents: 20000 },
  { name: "DELINEADO DE OJOS INFERIOR", type: "spa", duration_minutes: 120, price_cents: 15000 },
  { name: "YELITIPS", type: "spa", duration_minutes: 150, price_cents: 5000 },
];

const SERVICE_SKILL_MAP: Record<string, string[]> = {
  "PEDICURE": ["Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "MANICURE": ["Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "ACRÍLICAS (2H 30MIN)": ["Aracely Orosco Champac", "Yudith Muñoz Ochoa", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "ACRÍLICAS (2H)": ["Aracely Orosco Champac", "Yudith Muñoz Ochoa", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "FACIAL PROFUNDO": ["Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa"],
  "FACIAL BÁSICO": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "BLANQUEAMIENTO": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Yudith Muñoz Ochoa", "Yholi Milusca Lunasco Morales", "Luisa Pérez"],
  "RIZADO DE PESTAÑAS": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "PIGMENTACIÓN DE CEJAS": ["Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Layssa Elizabeth Suárez Aguila"],
  "PESTAÑAS POSTIZAS": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales"],
  "PESTAÑAS POSTIZAS 1X1": ["Aracely Orosco Champac", "Janet Vargas Quintero", "Layssa Elizabeth Suárez Aguila"],
  "PESTAÑAS POSTIZAS ANIME": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero"],
  "PLANCHADO DE CEJAS": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "DELINEADO DE OJOS SUPERIOR": ["Janet Vargas Quintero"],
  "DELINEADO DE OJOS BEAGLE": ["Janet Vargas Quintero"],
  "DELINEADO DE OJOS INFERIOR": ["Janet Vargas Quintero"],
  "MICRO BLADING": ["Janet Vargas Quintero"],
  "MICRO CHEADING": ["Janet Vargas Quintero"],
  "DEPILACIÓN (PIERNA)": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "DEPILACIÓN (PIERNA Y MUSLO)": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "DEPILACIÓN DE BOZO": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez"],
  "DEPILACIÓN DE BOZO CON HILO": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Janet Vargas Quintero"],
  "DEPILACIÓN FACIAL CON HILO": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Janet Vargas Quintero"],
  "DEPILACIÓN DE BOZO CON CERA": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "DEPILACIÓN CON CERA": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "TINTE BUENO (1 SOLO COLOR)": ["Aracely Orosco Champac", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "TINTE NORMAL (1 SOLO COLOR)": ["Aracely Orosco Champac", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "TINTE BÁSICO (1 SOLO COLOR)": ["Aracely Orosco Champac", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "TOQUE DE RAÍZ": ["Aracely Orosco Champac", "Janet Vargas Quintero", "Layssa Elizabeth Suárez Aguila"],
  "BAÑO DE COLOR": ["Aracely Orosco Champac", "Janet Vargas Quintero"],
  "BALAGE": ["Aracely Orosco Champac", "Janet Vargas Quintero"],
  "BALAGE + COLOR": ["Aracely Orosco Champac", "Janet Vargas Quintero"],
  "MECHAS + COLOR": ["Aracely Orosco Champac", "Janet Vargas Quintero"],
  "RAYITOS": ["Aracely Orosco Champac", "Janet Vargas Quintero", "Layssa Elizabeth Suárez Aguila"],
  "ALIZADO BÁSICO": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Layssa Elizabeth Suárez Aguila"],
  "ALIZADO DUAL (PORTUGAL)": ["Aracely Orosco Champac", "Yudith Muñoz Ochoa", "Janet Vargas Quintero"],
  "ALIZADO VIP": ["Aracely Orosco Champac", "Janet Vargas Quintero"],
  "BOTOX DE 150": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "BOTOX DE 80": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "PIGMENTACIÓN DE 3 DÍAS": ["Medalid Huamán Chávez", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "PIGMENTACIÓN DE 2 SEMANAS": ["Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "EXTENSIONES DE CABELLO 1": ["Janet Vargas Quintero"],
  "EXTENSIONES DE CABELLO 2": ["Janet Vargas Quintero"],
  "EXTENSIONES DE CABELLO 3": ["Janet Vargas Quintero"],
  "LAVADO DE CABELLO": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "CEPILLADO DE CABELLO": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Janet Vargas Quintero", "Luisa Pérez"],
  "PLANCHADO DE CABELLO": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "SECADO + PLANCHADO": ["Aracely Orosco Champac", "Medalid Huamán Chávez", "Liz Cuatimancani Vargas", "Yudith Muñoz Ochoa", "Janet Vargas Quintero", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
  "ONDULACIÓN CABELLO CORTO": ["Medalid Huamán Chávez", "Yudith Muñoz Ochoa", "Yholi Milusca Lunasco Morales", "Layssa Elizabeth Suárez Aguila"],
  "ONDULACIÓN CABELLO MEDIANO": ["Medalid Huamán Chávez", "Yudith Muñoz Ochoa", "Yholi Milusca Lunasco Morales", "Layssa Elizabeth Suárez Aguila"],
  "ONDULACIÓN CABELLO LARGO": ["Medalid Huamán Chávez", "Yudith Muñoz Ochoa", "Layssa Elizabeth Suárez Aguila"],
  "LABIOS": ["Janet Vargas Quintero"],
  "YELITIPS": ["Yudith Muñoz Ochoa", "Yholi Milusca Lunasco Morales", "Luisa Pérez", "Layssa Elizabeth Suárez Aguila"],
};

export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();

    // 1. Sembrar/asegurar servicios
    for (const svc of INITIAL_SERVICES) {
      const slug = slugify(svc.name);
      await admin
        .from("services")
        .upsert(
          {
            name: svc.name,
            slug,
            type: svc.type,
            duration_minutes: svc.duration_minutes,
            price_cents: svc.price_cents,
            is_active: true,
            is_public: true,
          },
          { onConflict: "slug", ignoreDuplicates: true }
        );
    }

    // 2. Sembrar empleados
    const employeeMap = new Map<string, string>(); // "Nombre Apellido" -> employee_id

    for (const emp of INITIAL_EMPLOYEES) {
      const fullName = `${emp.first_name} ${emp.last_name}`;
      
      const { data: existing } = await admin
        .from("employees")
        .select("id")
        .eq("first_name", emp.first_name)
        .eq("last_name", emp.last_name)
        .single();

      if (existing) {
        employeeMap.set(fullName, existing.id);
      } else {
        const { data: created } = await admin
          .from("employees")
          .insert({
            first_name: emp.first_name,
            last_name: emp.last_name,
            type: emp.type,
            is_active: true,
          })
          .select("id")
          .single();

        if (created) {
          employeeMap.set(fullName, created.id);
        }
      }
    }

    // 3. Obtener todos los servicios creados para obtener sus IDs
    const { data: dbServices } = await admin
      .from("services")
      .select("id, name, type");

    const serviceMap = new Map<string, string>();
    dbServices?.forEach((s) => serviceMap.set(s.name.toUpperCase(), s.id));

    // Barbería: Yordi Atao Huaman -> todos los servicios de barbería
    const yordiId = employeeMap.get("Yordi Atao Huaman");
    if (yordiId) {
      const barberiaServices = dbServices?.filter((s) => s.type === "barberia") || [];
      for (const bSvc of barberiaServices) {
        await admin
          .from("employee_skills")
          .upsert(
            { employee_id: yordiId, service_id: bSvc.id },
            { onConflict: "employee_id,service_id", ignoreDuplicates: true }
          );
      }
    }

    // Spa: Mapeo específico por servicio
    for (const [svcName, empNames] of Object.entries(SERVICE_SKILL_MAP)) {
      const serviceId = serviceMap.get(svcName.toUpperCase());
      if (!serviceId) continue;

      for (const empName of empNames) {
        const empId = employeeMap.get(empName);
        if (empId) {
          await admin
            .from("employee_skills")
            .upsert(
              { employee_id: empId, service_id: serviceId },
              { onConflict: "employee_id,service_id", ignoreDuplicates: true }
            );
        }
      }
    }

    return NextResponse.json({
      success: true,
      employees_seeded: INITIAL_EMPLOYEES.length,
      services_seeded: INITIAL_SERVICES.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Employee seed error:", msg);
    return NextResponse.json({ error: "Error en sembrado: " + msg }, { status: 500 });
  }
}
