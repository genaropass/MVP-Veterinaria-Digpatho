/* eslint-disable react-hooks/exhaustive-deps */
"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
    "fixed top-4 right-4 z-50 w-full max-w-sm rounded-lg border p-4 shadow-lg transition-all duration-300 ease-in-out",
    {
        variants: {
            variant: {
                default: "bg-background text-foreground",
                destructive: "border-destructive/50 text-destructive dark:border-destructive",
                warning: "border-orange-500/50 text-orange-700 dark:text-orange-400",
                success: "border-green-500/50 text-green-700 dark:text-green-400",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
)

export interface AlertPopupProps extends VariantProps<typeof alertVariants> {
    title: string
    description?: string
    duration?: number
    onClose?: () => void
    className?: string
}

export function AlertPopup({ title, description, variant, duration = 5000, onClose, className }: AlertPopupProps) {
    const [isVisible, setIsVisible] = useState(true)

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                handleClose()
            }, duration)
            return () => clearTimeout(timer)
        }
    }, [duration])

    const handleClose = () => {
        setIsVisible(false)
        if (onClose) {
            setTimeout(() => {
                onClose()
            }, 300)
        }
    }

    if (!isVisible) {
        return null
    }

    return (
        <div
            className={cn(
                alertVariants({ variant }),
                isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                className,
            )}
            role="alert"
        >
            <div className="flex items-start justify-between">
                <div>
                    <h5 className="mb-1 font-medium leading-none tracking-tight">{title}</h5>
                    {description && <div className="text-sm opacity-90">{description}</div>}
                </div>
                <button
                    onClick={handleClose}
                    className="ml-4 inline-flex h-6 w-6 items-center justify-center rounded-md text-foreground/50 hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}

