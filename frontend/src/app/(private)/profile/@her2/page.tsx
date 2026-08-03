/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { StudyTab } from "@/components/profile/study-tab"

export default function Her2Page() {
  const handleUpload = async (file: File) => {
    return new Promise((resolve) => setTimeout(resolve, 1500))
  }

  return <StudyTab studyType="her2" onUpload={handleUpload} />
}

