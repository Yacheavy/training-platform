import { signIn } from "@/auth"

export default function LoginPage() {
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
      </form>
    </div>
  )
}