import { getCachedSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { BotsHub } from "@/components/bots/bots-hub";
import { BotsApiProvider } from "@/context/bots-api-context";

export default async function BotsPage() {
  const session = await getCachedSession();
  if (!session) {
    redirect("/");
  }

  return (
    <BotsApiProvider>
      <BotsHub />
    </BotsApiProvider>
  );
}
