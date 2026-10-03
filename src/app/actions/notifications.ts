"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getHumanErrorMessage } from "@/lib/kmbook/errors";

export async function markNotificationReadAction(
  organizationId: string,
  deliveryId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("mark_notification_read", {
      p_organization_id: organizationId,
      p_delivery_id: deliveryId,
    });

    if (error) {
      return { success: false, message: getHumanErrorMessage(error) };
    }

    revalidatePath("/notifications");
    revalidatePath("/today");
    return { success: true };
  } catch (err) {
    return { success: false, message: getHumanErrorMessage(err) };
  }
}

export async function markAllNotificationsReadAction(
  organizationId: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("mark_all_notifications_read", {
      p_organization_id: organizationId,
    });

    if (error) {
      return { success: false, message: getHumanErrorMessage(error) };
    }

    revalidatePath("/notifications");
    revalidatePath("/today");
    return { success: true };
  } catch (err) {
    return { success: false, message: getHumanErrorMessage(err) };
  }
}
