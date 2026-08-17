import { AttendanceManager } from "./AttendanceManager";

export const metadata = {
  title: "Control de Asistencia y QR | Panel de Administración",
  description: "Módulo de gestión de asistencias, marcación por código QR, permisos y reportes de personal.",
};

export default function AttendancePage() {
  return <AttendanceManager />;
}
