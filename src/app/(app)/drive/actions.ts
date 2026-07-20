"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { clearDriveRootFolder, setDriveRootFolder } from "@/lib/google-drive";

export async function setDriveRootFolderAction(folderId: string, folderName: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("관리자만 드라이브 루트 폴더를 변경할 수 있습니다");
  }
  await setDriveRootFolder(folderId, folderName);
  revalidatePath("/drive");
}

export async function clearDriveRootFolderAction() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("관리자만 드라이브 루트 폴더를 변경할 수 있습니다");
  }
  await clearDriveRootFolder();
  revalidatePath("/drive");
}
