import NextAuth, { customFetch } from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

// El discovery doc de Google (https://accounts.google.com/.well-known/openid-configuration)
// declara `authorization_response_iss_parameter_supported: true` (RFC 9207), pero el
// endpoint de autorización real de Google no siempre devuelve el parámetro `iss` en el
// callback — un mismatch del lado de Google, no nuestro. Auth.js/oauth4webapi valida esto
// estrictamente y tira "response parameter iss (issuer) missing", rompiendo el login.
// Interceptamos únicamente la respuesta del discovery doc y apagamos esa bandera para que
// Auth.js no exija un parámetro que Google en la práctica no envía. El resto de las
// validaciones (state, PKCE, nonce, firma del id_token) quedan intactas.
async function googleDiscoveryFetch(
  ...args: Parameters<typeof fetch>
): ReturnType<typeof fetch> {
  const response = await fetch(...args)
  const url = typeof args[0] === "string" ? args[0] : args[0].toString()
  if (!url.includes("/.well-known/openid-configuration")) return response

  const metadata = await response.json()
  metadata.authorization_response_iss_parameter_supported = false
  return new Response(JSON.stringify(metadata), {
    status: response.status,
    headers: response.headers,
  })
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      [customFetch]: googleDiscoveryFetch,
    }),
  ],
  pages: {
    signIn: "/login",
  },
})