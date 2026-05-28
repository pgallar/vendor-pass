import * as React from 'react'
import { cn } from '@/lib/utils'

// ─── FormField ────────────────────────────────────────────────────────────────

export interface FormFieldProps {
  id: string
  label: React.ReactNode
  /** Makes the label show a required asterisk */
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
  className?: string
}

export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">*</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive flex items-center gap-1">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  leftAddon?: React.ReactNode
  rightAddon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftAddon, rightAddon, ...props }, ref) => {
    if (leftAddon || rightAddon) {
      return (
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3 text-muted-foreground pointer-events-none" aria-hidden="true">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full h-10 rounded-lg border border-input bg-card text-sm text-foreground',
              'placeholder:text-muted-foreground',
              'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
              'disabled:pointer-events-none disabled:opacity-50',
              error && 'border-destructive focus:ring-destructive',
              leftAddon ? 'pl-9' : 'pl-3',
              rightAddon ? 'pr-9' : 'pr-3',
              className,
            )}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 text-muted-foreground pointer-events-none" aria-hidden="true">
              {rightAddon}
            </div>
          )}
        </div>
      )
    }

    return (
      <input
        ref={ref}
        className={cn(
          'w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
          'disabled:pointer-events-none disabled:opacity-50',
          error && 'border-destructive focus:ring-destructive',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

// ─── Textarea ─────────────────────────────────────────────────────────────────

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full min-h-[88px] px-3 py-2.5 rounded-lg border border-input bg-card text-sm text-foreground',
        'placeholder:text-muted-foreground resize-y',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
        'disabled:pointer-events-none disabled:opacity-50',
        error && 'border-destructive focus:ring-destructive',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

// ─── Select ───────────────────────────────────────────────────────────────────

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  placeholder?: string
  options: Array<{ value: string; label: string }>
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, placeholder, options, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
        'disabled:pointer-events-none disabled:opacity-50',
        'appearance-none',
        error && 'border-destructive focus:ring-destructive',
        className,
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
)
Select.displayName = 'Select'

// ─── FileInput ────────────────────────────────────────────────────────────────

export interface FileInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  dropLabel?: string
}

export const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, error, dropLabel = 'Seleccionar archivo o arrastrar aquí', id, ...props }, ref) => (
    <label
      htmlFor={id}
      className={cn(
        'flex flex-col items-center justify-center gap-2 w-full min-h-[100px] rounded-lg border-2 border-dashed',
        'border-border bg-secondary/50 cursor-pointer text-center px-4 py-6',
        'hover:border-primary/50 hover:bg-accent/30 transition-colors',
        error && 'border-destructive',
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">{dropLabel}</span>
      <span className="text-xs text-muted-foreground">PDF, JPG, PNG — máx. 10 MB</span>
      <input ref={ref} id={id} type="file" className="sr-only" {...props} />
    </label>
  ),
)
FileInput.displayName = 'FileInput'
