"use server";

import { revalidatePath } from "next/cache";
import { clearDriveRootFolder, setDriveRootFolder } from "@/lib/google-drive";

export async function setDriveRootFolderAction(folderId: string, folderName: string) {
  await setDriveRootFolder(folderId, folderName);
  revalidatePath("/drive");
}

export async function clearDriveRootFolderAction() {
  await clearDriveRootFolder();
  revalidatePath("/drive");
}
