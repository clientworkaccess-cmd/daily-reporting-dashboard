import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectProps {
    options: { label: string; value: string | number }[]
    value: string | number
    onChange: (value: any) => void
    placeholder?: string
    className?: string
}

export function PremiumSelect({ options, value, onChange, placeholder, className }: SelectProps) {
    const [open, setOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    const selectedOption = options.find(opt => opt.value === value)

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div className={cn("relative w-full md:w-[180px]", className)} ref={containerRef}>
            <button
                onClick={() => setOpen(!open)}
                className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-white/50 px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur-md transition-all hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
                <span className={cn(!selectedOption && "text-muted-foreground")}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-border bg-white p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onChange(option.value)
                                setOpen(false)
                            }}
                            className={cn(
                                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted",
                                value === option.value ? "bg-primary/5 text-primary" : "text-foreground"
                            )}
                        >
                            {option.label}
                            {value === option.value && <Check className="h-4 w-4" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
