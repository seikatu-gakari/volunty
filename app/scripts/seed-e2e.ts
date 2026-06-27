#!/usr/bin/env tsx

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERSONAS, type Persona } from "@/lib/test-auth/personas";

function buildUserMetadata(persona: Persona): Record<string, string | boolean> {
  const metadata: Record<string, string | boolean> = {
    full_name: `E2E ${persona.key}`,
  };

  if (persona.key !== "participant-fresh") {
    metadata.role = persona.role;
    metadata.onboarding_completed = true;
  }

  return metadata;
}

export async function seedE2eUsers(): Promise<void> {
  const password = process.env.E2E_TEST_USER_PASSWORD;
  if (!password) {
    throw new Error("E2E_TEST_USER_PASSWORD が未設定です");
  }

  const supabase = createAdminClient();
  const { data: listData, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    throw new Error(`[seed] ユーザー一覧取得失敗: ${listError.message}`);
  }

  const usersByEmail = new Map(
    listData.users.flatMap((user) =>
      user.email ? [[user.email, user] as const] : []
    )
  );

  for (const persona of Object.values(PERSONAS)) {
    const existingUser = usersByEmail.get(persona.email);
    const userMetadata = buildUserMetadata(persona);
    let userId: string;

    if (existingUser) {
      const { error } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password, user_metadata: userMetadata }
      );
      if (error) {
        throw new Error(
          `[seed] 更新失敗 ${persona.email}: ${error.message}`
        );
      }

      userId = existingUser.id;
      console.log(`[seed] 更新: ${persona.email} (${persona.key})`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: persona.email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });
      if (error || !data.user) {
        throw new Error(
          `[seed] 作成失敗 ${persona.email}: ${error?.message ?? "user が返されませんでした"}`
        );
      }

      userId = data.user.id;
      usersByEmail.set(persona.email, data.user);
      console.log(`[seed] 作成: ${persona.email} (${persona.key})`);
    }

    await prisma.user.upsert({
      where: { id: userId },
      update: { role: persona.role, email: persona.email },
      create: {
        id: userId,
        email: persona.email,
        name: `E2E ${persona.key}`,
        role: persona.role,
      },
    });
  }

  console.log("[seed] E2E ユーザーの seed 完了");
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  return Boolean(
    entryPoint && resolve(entryPoint) === fileURLToPath(import.meta.url)
  );
}

if (isDirectExecution()) {
  void seedE2eUsers()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
