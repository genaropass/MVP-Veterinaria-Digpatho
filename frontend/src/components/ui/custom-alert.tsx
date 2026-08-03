"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface CustomAlertProps {
    title: string
    description: string
    onConfirm: () => void
    isOpen: boolean
    enableCancel?: boolean
    onCancel?: () => void
}

export default function CustomAlert({ title, description, onConfirm, isOpen, enableCancel = false, onCancel }: CustomAlertProps) {
    return (
        <AlertDialog open={isOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={onConfirm}>OK</AlertDialogAction>
                    {enableCancel && onCancel && <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
