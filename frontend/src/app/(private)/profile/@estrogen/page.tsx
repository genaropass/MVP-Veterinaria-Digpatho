"use client"
/* eslint-disable @typescript-eslint/no-unused-vars */
import { StudyTab } from "@/components/profile/study-tab"


export default function EstrogenPage() {
  const handleUpload = async (file: File) => {


    return new Promise((resolve) => setTimeout(resolve, 1500))
  }

  return <StudyTab studyType="estrogen" onUpload={handleUpload} />
}

