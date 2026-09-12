'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  return (
    <Sonner
      theme={(resolvedTheme ?? 'light') as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          // Sonner's default light success text falls below 4.5:1 at 13px.
          '--success-text': resolvedTheme === 'dark' ? '#86efac' : '#166534',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
