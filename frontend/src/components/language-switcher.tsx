"use client"

import { useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl" // <--- Importamos esto
import { ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const languages = [
  { code: "en", label: "English", flag: "/assets/flags/gb.svg" },
  { code: "es", label: "Español", flag: "/assets/flags/es.svg" },
  { code: "pt", label: "Português", flag: "/assets/flags/pt.svg" },
]

export default function LanguageSwitcher() {
  const router = useRouter()
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()

  // Find the current language object based on next-intl
  const currentLanguage = languages.find((l) => l.code === locale) || languages[1]

  const changeLanguage = (lang: (typeof languages)[0]) => {
    if (lang.code === locale) return

    // Actualizamos la cookie
    document.cookie = `locale=${lang.code}; path=/; SameSite=Lax`
    
    // Usamos startTransition para que la UI no se congele durante el refresh
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="lg" 
          disabled={isPending} // Deshabilitamos mientras carga
          className="w-[140px] justify-between gap-2 border-muted-foreground/20 mr-4 pr-4"
        >
          <div className="flex items-center gap-1">
            <Image
              src={currentLanguage.flag}
              alt={currentLanguage.label}
              width={16}
              height={16}
              className="rounded-sm object-cover"
            />
            <span className="text-sm font-medium">{currentLanguage.label}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-[140px]">
        <AnimatePresence>
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              className="flex cursor-pointer items-center gap-2"
              onClick={() => changeLanguage(lang)}
            >
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-2"
              >
                <Image
                  src={lang.flag}
                  alt={lang.label}
                  width={16}
                  height={16}
                  className="rounded-sm object-cover"
                />
                <span className={`text-sm font-medium ${lang.code === locale ? "font-bold" : ""}`}>
                    {lang.label}
                </span>
              </motion.div>
            </DropdownMenuItem>
          ))}
        </AnimatePresence>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
