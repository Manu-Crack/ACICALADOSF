import EmployeesManager from "./EmployeesManager";

export const metadata = {
  title: "Gestión de Empleados | Panel de Administración",
  description: "Módulo de gestión de personal, especialidades y ausencias por fecha.",
};

export default function EmployeesPage() {
  return <EmployeesManager />;
}
