"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

 return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      richColors
      toastOptions={{
        
        classNames: {
          toast: `
            group 
            toast 
            border 
            border-border 
            bg-background 
            text-foreground 
            shadow-lg 
            rounded-lg 
            p-4 
          `,
          description: "text-muted-foreground",
          actionButton: `
            bg-primary 
            text-primary-foreground 
            hover:opacity-90 
            transition 
            px-3 
            py-1.5 
            rounded-md
          `,
          cancelButton: `
            bg-muted 
            text-muted-foreground 
            hover:opacity-80 
            transition 
            px-3 
            py-1.5 
            rounded-md
          `,
        },
      }}
      {...props}
    />
  )
}


export { Toaster }
