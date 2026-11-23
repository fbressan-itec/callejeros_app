import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { Suspense } from "react";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { AlertFab } from "@/components/layout/AlertFab";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

import "./globals.css";

// Mismas fuentes y pesos que el maquetado.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Callejeros Río Cuarto",
  description:
    "Plataforma comunitaria de adopción responsable y alertas de animales en la calle en Río Cuarto.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      suppressHydrationWarning
      className={`${inter.variable} ${poppins.variable} scroll-smooth`}
    >
      <body className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800 antialiased transition-colors duration-200 selection:bg-orange-500 selection:text-white dark:bg-slate-900 dark:text-slate-100">
        <ThemeProvider>
          <AuthProvider>
            <Suspense
              fallback={
                <div
                  className="sticky top-0 z-50 h-16 border-b border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95"
                  aria-hidden="true"
                />
              }
            >
              <AppHeader />
            </Suspense>
            {children}
            <Suspense fallback={null}>
              <AlertFab />
            </Suspense>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
