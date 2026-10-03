import { redirect } from "next/navigation";
import { getStaffViewerContext, getAuthenticatedUser } from "@/lib/kmbook/auth";

export default async function RootPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const context = await getStaffViewerContext();
  if (!context || context.organizations.length === 0) {
    redirect("/select-organization");
  }

  if (context.activeOrganization) {
    redirect("/today");
  }

  redirect("/select-organization");
}
