"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { markAllRead } from "./notifications";

export async function readAll() { const u = await requireUser(); markAllRead(u.id); revalidatePath("/", "layout"); }
