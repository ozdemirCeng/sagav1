import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// RegisterPage artık LoginPage'deki "Kayıt Ol" sekmesine yönlendiriyor
export default function RegisterPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // LoginPage'e yönlendir, kayıt sekmesi URL parametresiyle açılabilir
    navigate('/giris?tab=register', { replace: true });
  }, [navigate]);

  return null;
}
