import { createClient } from "@supabase/supabase-js";

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

function resolveSupabaseUrl() {
  return readEnv("SUPABASE_URL") || readEnv("VITE_SUPABASE_URL");
}

function resolveServiceRoleKey() {
  return readEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function parseArgs(argv) {
  const emailArg = argv.find((value) => !value.startsWith("--")) || "";
  const roleArg = argv.find((value) => value.startsWith("--role=")) || "";
  const role = roleArg.split("=")[1]?.trim() || "ADMIN";

  return {
    email: emailArg.trim().toLowerCase(),
    role: role.toUpperCase(),
  };
}

function printUsage() {
  console.log("Pemakaian:");
  console.log("  node scripts/promote-admin.mjs <email> [--role=ADMIN]");
  console.log("");
  console.log("Contoh:");
  console.log("  node scripts/promote-admin.mjs naralokanaraloka@gmail.com");
}

async function main() {
  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = resolveServiceRoleKey();
  const { email, role } = parseArgs(process.argv.slice(2));

  if (!email) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (role !== "ADMIN") {
    throw new Error("Script ini hanya diizinkan untuk role ADMIN.");
  }

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL atau VITE_SUPABASE_URL belum tersedia di environment.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum tersedia di environment.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Gagal membaca daftar user: ${listError.message}`);
  }

  const targetUser = listData.users.find(
    (user) => String(user.email || "").trim().toLowerCase() === email
  );

  if (!targetUser) {
    throw new Error(`User dengan email ${email} tidak ditemukan di Supabase Auth.`);
  }

  const nextAppMetadata = {
    ...(targetUser.app_metadata || {}),
    role: "ADMIN",
  };

  const { error: updateError } = await supabase.auth.admin.updateUserById(targetUser.id, {
    app_metadata: nextAppMetadata,
  });

  if (updateError) {
    throw new Error(`Gagal mengubah role user menjadi ADMIN: ${updateError.message}`);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        userId: targetUser.id,
        email,
        role: "ADMIN",
      },
      null,
      2
    )
  );
  console.log("");
  console.log("Akun berhasil dijadikan ADMIN.");
  console.log("Jika user masih login, lakukan logout lalu login ulang agar role baru terbaca.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Terjadi kesalahan.");
  process.exitCode = 1;
});
