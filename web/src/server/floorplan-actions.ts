"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { saveFloorImage, savePins, type Pin } from "./floorplan";

export async function uploadPlan(f: FormData): Promise<{ error?: string }> {
  await requireUser();
  const file = f.get("image");
  if (!(file instanceof File) || !file.size) return { error: "Choose an image." };
  try { saveFloorImage(Buffer.from(await file.arrayBuffer()), file.type); } catch (e) { return { error: (e as Error).message }; }
  revalidatePath("/devices");
  return {};
}

export async function updatePins(pins: Record<string, Pin>) { await requireUser(); savePins(pins); revalidatePath("/devices"); }
