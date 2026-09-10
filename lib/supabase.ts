import { createBrowserClient } from "@supabase/ssr";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Missing environment variable NEXT_PUBLIC_SUPABASE_URL");
}

if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing environment variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
}

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

async function checkConnection() {
  // Select a dummy value to test the database network connection
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .limit(1);

  if (error) {
    console.error("❌ Connection failed:", error.message);
  } else {
    console.log("✅ Connected successfully! Data fetched:", data);
  }
}

checkConnection();
