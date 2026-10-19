"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { setLabel } from "@/lib/queries/posts";
import { requireAllowedUser } from "@/lib/auth/require";

const Schema = z.object({ postId: z.string().uuid(), label: z.enum(["hit", "miss", "odd", "none"]) });

export async function setLabelAction(formData: FormData) {
  await requireAllowedUser();
  const { postId, label } = Schema.parse(Object.fromEntries(formData));
  await setLabel(getDb(), postId, label === "none" ? null : label);
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}
