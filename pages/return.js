import { useEffect, useState } from 'react';

export default function ReturnPage() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    fetch(`/api/session-status?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data) => setStatus(data.status));
  }, []);

  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h1>Obrigado pela compra 🐾</h1>
      <p>Status: <strong>{status || 'Carregando...'}</strong></p>
    </div>
  );
}
