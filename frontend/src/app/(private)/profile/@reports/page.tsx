import { auth } from "@/lib/auth";
import { ReportsForm } from "@/components/profile/reports/reports-form";

export default async function ReportsPage() {
  const session = await auth();
  const email = session?.user?.email || null;

  return <ReportsForm userEmail={email} />;
}

