-- Series de la salida (potencia, FC, cadencia…) cada pocos segundos, para el gráfico interactivo
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "seriesJson" JSONB;
