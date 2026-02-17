import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Prevent hydration mismatch by rendering nothing until mounted, 
    // or render a default placeholder if critical for layout.
    // In SPA, it usually renders fast enough.
    if (!mounted) {
        return (
            <button className="rounded-lg p-2 bg-white text-black dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 opacity-50 cursor-default">
                <Moon size={20} />
            </button>
        )
    }

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-lg p-2 bg-white text-black dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle Theme"
        >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
    )
}
