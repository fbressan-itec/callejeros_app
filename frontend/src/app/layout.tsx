import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";

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
          <AppHeader />
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
