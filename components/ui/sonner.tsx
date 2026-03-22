"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      duration={8000}
      toastOptions={{
        classNames: {
          toast: "!opacity-100 !shadow-2xl !border",
          error: "!bg-red-950 !border-red-600 !text-red-100 [&_[data-icon]]:!text-red-400",
          success: "!bg-green-950 !border-green-600 !text-green-100 [&_[data-icon]]:!text-green-400",
          title: "!font-semibold !text-base",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
