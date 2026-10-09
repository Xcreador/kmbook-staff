import { redirect } from "next/navigation";
import { getStaffViewerContext, setActiveOrganization, logout } from "@/lib/kmbook/auth";
import { BrandMark } from "@/components/BrandMark";
import { BuildingIcon, ArrowRightIcon, LogOutIcon } from "@/components/Icons";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import styles from "./select-organization.module.css";

export default async function SelectOrganizationPage() {
  const context = await getStaffViewerContext();
  if (!context) {
    redirect("/login");
  }

  // Con 1 sola organización no hay nada que elegir: getStaffViewerContext la resuelve
  // sola en /today. NO se escribe la cookie aquí: un Server Component no puede
  // (Next lanza error → 500 al entrar directo a esta ruta).
  if (context.organizations.length === 1) {
    redirect("/today");
  }

  const handleSelectOrg = async (formData: FormData) => {
    "use server";
    const orgId = formData.get("orgId") as string;
    if (orgId) {
      await setActiveOrganization(orgId);
      redirect("/today");
    }
  };

  const handleLogout = async () => {
    "use server";
    await logout();
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <BrandMark size={40} />
          <h1 className={styles.title}>Selecciona tu salón</h1>
          <p className={styles.subtitle}>
            Hola {context.profile?.displayName || "Profesional"}, elige el negocio donde vas a trabajar hoy:
          </p>
        </div>

        {context.organizations.length === 0 ? (
          <EmptyState
            icon={<BuildingIcon size={24} color="var(--km-oxford)" />}
            title="Sin organizaciones activas"
            description="Tu usuario todavía no tiene una membresía asignada en ningún salón o negocio KMBOOK."
            action={
              <form action={handleLogout}>
                <Button variant="secondary" size="sm" type="submit" icon={<LogOutIcon size={16} />}>
                  Cerrar sesión
                </Button>
              </form>
            }
          />
        ) : (
          <div className={styles.orgList}>
            {context.organizations.map((org) => {
              const isSelected = context.activeOrganization?.id === org.id;

              return (
                <form key={org.id} action={handleSelectOrg} className={styles.orgForm}>
                  <input type="hidden" name="orgId" value={org.id} />
                  <button
                    type="submit"
                    className={`${styles.orgButton} ${isSelected ? styles.orgSelected : ""}`}
                  >
                    <div className={styles.orgInfo}>
                      <div className={styles.orgIconWrapper}>
                        <BuildingIcon size={20} color="var(--km-oxford)" />
                      </div>
                      <div className={styles.orgTexts}>
                        <span className={styles.orgName}>{org.name}</span>
                        <span className={styles.orgRole}>
                          Rol: {org.role === "owner" ? "Propietario" : org.role === "manager" ? "Encargado" : org.role === "reception" ? "Recepción" : "Profesional"}
                        </span>
                      </div>
                    </div>
                    <ArrowRightIcon size={18} color="var(--km-pink)" />
                  </button>
                </form>
              );
            })}
          </div>
        )}

        <div className={styles.footer}>
          <form action={handleLogout}>
            <button type="submit" className={styles.logoutBtn}>
              <LogOutIcon size={16} color="var(--km-gray)" />
              <span>Cerrar sesión</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
