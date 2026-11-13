/**
 * Colores de los gráficos de canvas (Chart.js), que no entienden las variables CSS.
 * Se lee el tema una vez al cargar el módulo en el navegador; al cambiar el tema en Ajustes se recarga la página.
 */
export interface ChartTheme { grid: string; tick: string; legend: string; line: string; dot: string }

const DARK: ChartTheme = { grid: "rgba(255,255,255,.04)", tick: "#5A6673", legend: "#8A97A6", line: "rgba(231,236,242,.55)", dot: "#10151C" };
const LIGHT: ChartTheme = { grid: "rgba(20,32,43,.08)", tick: "#7A8793", legend: "#55636F", line: "rgba(20,32,43,.5)", dot: "#FFFFFF" };

export function isLightTheme(): boolean {
  if (typeof document === "undefined") return false;
  const t = document.documentElement.dataset.theme;
  return t === "light" || (t === "auto" && typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches);
}

export function chartTheme(): ChartTheme {
  return isLightTheme() ? LIGHT : DARK;
}
