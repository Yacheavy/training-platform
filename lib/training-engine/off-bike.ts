/** Claves de sesión que NO son en bici: gimnasio y flexibilidad (no llevan vatios, TSS ni rodillo). */
export const OFF_BIKE_KEYS = ["gym", "flexibility"] as const;
export const isOffBike = (key: string | null | undefined): boolean => key === "gym" || key === "flexibility";
