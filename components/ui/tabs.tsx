"use client";

import * as React from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
} | null>(null);

export function Tabs({ value, onValueChange, children, className }: any) {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className={cn("inline-flex h-11 items-center justify-center rounded-xl bg-muted/50 p-1 text-muted-foreground glass", className)}>
                {children}
            </div>
        </TabsContext.Provider>
    );
}

export function TabsList({ children, className }: any) {
    return (
        <div className={cn("inline-flex items-center justify-center gap-1", className)}>
            {children}
        </div>
    );
}

export function TabsTrigger({ value, children, className }: any) {
    const context = React.useContext(TabsContext);
    if (!context) return null;

    const isActive = context.value === value;

    return (
        <button
            onClick={() => context.onValueChange(value)}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                , className)}
        >
            {children}
        </button>
    );
}
