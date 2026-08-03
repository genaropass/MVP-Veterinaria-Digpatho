
import { Card, CardContent } from "@/components/ui/card"
import { PencilIcon } from "lucide-react"
import { Skeleton } from "./skeleton"

export function PatientInfoCardSkeleton() {
  return (
    <Card className="bg-gray-50 border-gray-200">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <Skeleton className="h-5 w-36 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>

          <div>
            <Skeleton className="h-5 w-24 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>

          <div>
            <Skeleton className="h-5 w-40 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>

          <div>
            <Skeleton className="h-5 w-36 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}



export function ReportsFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-primary">
        <PencilIcon className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Marcadores Inmunohistoquímicos</h2>
      </div>

      {/* Ki67 Section Skeleton */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-4">Ki67</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-5 w-20 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-24 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estrogen Section Skeleton */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-4">Estrógeno</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-36 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-24 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-28 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progesterone Section Skeleton */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-4">Progesterona</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-36 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-24 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-28 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HER2 Section Skeleton */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-4">HER2</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-5 w-28 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-28 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conclusion Section Skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <h3 className="font-semibold">Conclusión</h3>
            <Skeleton className="h-[150px] w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Download Button Skeleton */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  )
}



export function StudyTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Image Upload Section Skeleton */}
            <div className="space-y-4">
              <h3 className="font-medium">Upload Images</h3>

              {/* Image Grid Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="relative">
                    <Skeleton className="aspect-square w-full" />
                  </div>
                ))}
              </div>

              {/* Analysis Button Skeleton */}
              <div className="flex justify-end">
                <Skeleton className="h-10 w-40" />
              </div>
            </div>

            {/* Analysis Results Section Skeleton */}
            <div className="space-y-6">
              <h3 className="font-medium">Analysis Results</h3>

              {Array.from({ length: 2 }).map((_, index) => (
                <Card key={index} className="bg-gray-50">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Images Skeleton */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium mb-2">Original Image</p>
                            <Skeleton className="aspect-square w-full" />
                            <Skeleton className="w-full h-8 mt-2" />
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-2">Analyzed Image</p>
                            <Skeleton className="aspect-square w-full" />
                            <Skeleton className="w-full h-8 mt-2" />
                          </div>
                        </div>
                      </div>

                      {/* Analysis Form Skeleton */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i}>
                              <Skeleton className="h-5 w-24 mb-1" />
                              <Skeleton className="h-10 w-full" />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end">
                          <Skeleton className="h-10 w-36" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}



export function TabNavigationSkeleton() {
  return (
    <div>
      <div className="border-b border-gray-200 relative flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
        <nav className="-mb-px flex flex-wrap justify-center sm:flex-nowrap sm:space-x-8">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-24" />
          ))}
        </nav>
        <div className="relative mb-2 sm:mb-0">
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      <div className="mt-4">
        {/* This is a placeholder for the active tab content */}
        <Skeleton className="h-[500px] w-full" />
      </div>
    </div>
  )
}




