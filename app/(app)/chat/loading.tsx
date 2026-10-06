export default function ChatLoading() {
  return (
    <div className="chat-shell" aria-busy="true" aria-label="Cargando el chat">
      <div className="skeleton" style={{ height: "52px", marginTop: "12px" }} />
      <div className="skeleton" style={{ height: "64px", marginTop: "12px" }} />
      <div style={{ flex: 1 }} />
      <div className="skeleton" style={{ height: "52px", marginBottom: "16px" }} />
    </div>
  );
}
