import { signIn } from "@/auth"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <form
        action={async () => {
          "use server"
          await signIn("google", { redirectTo: "/dashboard" })
        }}
      >
        <button type="submit" style={{ padding: "12px 24px", fontSize: "16px" }}>
          Iniciar sesión con Google
        </button>
        {sp.error && (
          <p style={{ marginTop: "16px", fontSize: "14px", maxWidth: "320px", color: "#E5636A" }}>
            Este email no tiene acceso. Pedile a tu entrenador que te invite con la cuenta de Google que estás usando.
          </p>
        )}
      </form>
    </div>
  )
}