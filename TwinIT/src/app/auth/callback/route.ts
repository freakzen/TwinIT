import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/onboarding";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (!userError && user) {
        const fullName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "";

        // The database trigger in supabase/schema.sql creates the profile.
        // This upsert also fills missing name/email for existing accounts.
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email ?? null,
            full_name: fullName,
          },
          { onConflict: "id", ignoreDuplicates: false }
        );
      }

      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/?error=confirmation_failed", url.origin)
  );
}
