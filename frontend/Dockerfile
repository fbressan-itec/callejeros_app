# Imagen de desarrollo del front (Next.js).
# Para producción (deploy), CR-04 agrega una versión con `next build` + `next start`.
FROM node:22-slim

WORKDIR /app

# Primero las dependencias (capa que Docker reusa si solo cambia el código)...
COPY package.json package-lock.json ./
RUN npm ci

# ...después el código.
COPY . .

EXPOSE 3000

# `next dev` escucha en 0.0.0.0 por defecto: acepta conexiones de afuera del contenedor.
CMD ["npm", "run", "dev"]
