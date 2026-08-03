import type React from "react"
import { ProfileProvider } from "@/context/profile-context"
import { PatientInfoCard } from "@/components/profile/patient/patient-info-card"
import TabNavigation from "@/components/profile/tab-navigation"
import { Suspense } from "react"
import { PatientInfoCardSkeleton, TabNavigationSkeleton } from "@/components/ui/loading-skeletons"
import LoadingSpinner from "@/app/loading"
import { getCachedSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { PatientProvider } from "@/context/patient-context"

export default async function ProfileLayout({
  children,
  ki67,
  estrogen,
  progesterone,
  her2,
  reports,
}: {
  children: React.ReactNode
  ki67: React.ReactNode
  estrogen: React.ReactNode
  progesterone: React.ReactNode
  her2: React.ReactNode
  reports: React.ReactNode
}) {
  const session = await getCachedSession()
  if (!session) {
    redirect("/")
  }

  return (
    <PatientProvider> 
      <ProfileProvider> 
        <div className="container mx-auto p-4 max-w-6xl">
          <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>

          <div className="flex gap-6">
        {/* Left Section: Patient Info Card */}
        <div className="w-1/4 min-w-[250px]">
          <Suspense fallback={<PatientInfoCardSkeleton />}>
            <PatientInfoCard />
          </Suspense>
        </div>

        {/* Right Section: Tab Navigation */}
        <div className="w-3/4 flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <Suspense fallback={<TabNavigationSkeleton />}>
            <TabNavigation
          slots={{
            ki67,
            estrogen,
            progesterone,
            her2,
            reports,
          }}
            />
          </Suspense>
        </div>
          </div>
        </div>
      </ProfileProvider>
    </PatientProvider> 
    
  )
}

