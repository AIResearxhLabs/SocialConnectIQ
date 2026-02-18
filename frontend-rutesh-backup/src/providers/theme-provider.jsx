import { ThemeProvider } from 'next-themes'

export function ThemeProviderWrapper({ children }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
        >
            {children}
        </ThemeProvider>
    )
}
