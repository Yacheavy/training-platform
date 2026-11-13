import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Overkill Cycling",
  description: "Plataforma de entrenamiento personal",
  appleWebApp: { capable: true, title: "Overkill", statusBarStyle: "black" },
};

/** Tema elegido en Ajustes (cookie "theme"): dark (por defecto), light o auto (sigue al sistema). */
async function currentTheme(): Promise<"dark" | "light" | "auto"> {
  const t = (await cookies()).get("theme")?.value;
  return t === "light" || t === "auto" ? t : "dark";
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: (await currentTheme()) === "light" ? "#F3F5F8" : "#0B0E13" };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await currentTheme();
  return (
    <html
      lang="es"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
