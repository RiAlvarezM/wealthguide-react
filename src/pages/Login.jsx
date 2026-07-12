import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';

export default function Login() {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ fullName: '', email: '', password: '' });

  const { login, register, authError } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/efectivo';

  const handleLoginChange = (e) => {
    setLoginForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegisterChange = (e) => {
    setRegisterForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await login(loginForm.email, loginForm.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await register(registerForm.fullName, registerForm.email, registerForm.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background min-h-screen flex items-center justify-center p-sm md:p-lg antialiased">
      <main className="w-full max-w-[480px] bg-surface-container-lowest border border-outline-variant rounded-lg shadow-[0px_10px_15px_-3px_rgba(15,23,42,0.08)] flex flex-col overflow-hidden">
        {/* Header / Branding */}
        <header className="p-lg flex flex-col items-center justify-center border-b border-surface-container">
          <div className="h-12 w-12 bg-primary-container rounded-full flex items-center justify-center mb-sm">
            <span className="material-symbols-outlined text-secondary-fixed-dim text-[24px]">
              account_balance
            </span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">
            {activeTab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">
            Secure Institutional Access
          </p>
        </header>

        {/* Form Area */}
        <div className="p-lg flex flex-col gap-lg">
          {/* Tabs */}
          <div className="flex border-b border-outline-variant w-full">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 pb-xs font-label-md text-label-md transition-colors duration-200 ${
                activeTab === 'login'
                  ? 'border-b-2 border-secondary text-black'
                  : 'border-b-2 border-transparent text-outline'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`flex-1 pb-xs font-label-md text-label-md transition-colors duration-200 ${
                activeTab === 'register'
                  ? 'border-b-2 border-secondary text-black'
                  : 'border-b-2 border-transparent text-outline'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {(formError || authError) && (
            <div className="bg-error-container text-on-error-container text-body-sm rounded p-sm">
              {formError || authError}
            </div>
          )}

          {activeTab === 'login' ? (
            <form className="flex flex-col gap-md" onSubmit={handleLoginSubmit}>
              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface" htmlFor="login-email">
                  Correo Electrónico
                </label>
                <div className="relative input-focus-ring border border-outline-variant rounded bg-surface-container-lowest transition-colors">
                  <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline text-[20px]">mail</span>
                  </div>
                  <input
                    className="w-full pl-[44px] pr-sm py-xs bg-transparent border-none text-on-surface font-body-sm focus:ring-0"
                    id="login-email"
                    name="email"
                    placeholder="juan.perez@empresa.com"
                    required
                    type="email"
                    value={loginForm.email}
                    onChange={handleLoginChange}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface" htmlFor="login-password">
                  Contraseña
                </label>
                <div className="relative input-focus-ring border border-outline-variant rounded bg-surface-container-lowest transition-colors">
                  <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline text-[20px]">lock</span>
                  </div>
                  <input
                    className="w-full pl-[44px] pr-[44px] py-xs bg-transparent border-none text-on-surface font-body-sm focus:ring-0"
                    id="login-password"
                    name="password"
                    placeholder="Mínimo 12 caracteres"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={handleLoginChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-sm flex items-center text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-[40px] bg-secondary text-on-secondary font-label-md text-label-md rounded flex items-center justify-center hover:bg-on-secondary-container transition-colors mt-xs disabled:opacity-60"
              >
                {submitting ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>

              <div className="flex items-center justify-center gap-xs text-on-surface-variant font-label-sm text-label-sm mt-sm">
                <span className="material-symbols-outlined text-[16px]">verified_user</span>
                <span>Sesión cifrada de extremo a extremo</span>
              </div>
            </form>
          ) : (
            <form className="flex flex-col gap-md" onSubmit={handleRegisterSubmit}>
              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface" htmlFor="reg-full-name">
                  Nombre Completo
                </label>
                <div className="relative input-focus-ring border border-outline-variant rounded bg-surface-container-lowest transition-colors">
                  <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline text-[20px]">person</span>
                  </div>
                  <input
                    className="w-full pl-[44px] pr-sm py-xs bg-transparent border-none text-on-surface font-body-sm focus:ring-0"
                    id="reg-full-name"
                    name="fullName"
                    placeholder="Juan Pérez"
                    required
                    type="text"
                    value={registerForm.fullName}
                    onChange={handleRegisterChange}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface" htmlFor="reg-email">
                  Correo Electrónico
                </label>
                <div className="relative input-focus-ring border border-outline-variant rounded bg-surface-container-lowest transition-colors">
                  <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline text-[20px]">mail</span>
                  </div>
                  <input
                    className="w-full pl-[44px] pr-sm py-xs bg-transparent border-none text-on-surface font-body-sm focus:ring-0"
                    id="reg-email"
                    name="email"
                    placeholder="juan.perez@empresa.com"
                    required
                    type="email"
                    value={registerForm.email}
                    onChange={handleRegisterChange}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface" htmlFor="reg-password">
                  Contraseña
                </label>
                <div className="relative input-focus-ring border border-outline-variant rounded bg-surface-container-lowest transition-colors">
                  <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline text-[20px]">lock</span>
                  </div>
                  <input
                    className="w-full pl-[44px] pr-[44px] py-xs bg-transparent border-none text-on-surface font-body-sm focus:ring-0"
                    id="reg-password"
                    name="password"
                    placeholder="Mínimo 12 caracteres"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={registerForm.password}
                    onChange={handleRegisterChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-sm flex items-center text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-[40px] bg-secondary text-on-secondary font-label-md text-label-md rounded flex items-center justify-center hover:bg-on-secondary-container transition-colors mt-xs disabled:opacity-60"
              >
                {submitting ? 'Creando cuenta...' : 'Crear Cuenta'}
              </button>

              <div className="flex items-center justify-center gap-xs text-on-surface-variant font-label-sm text-label-sm mt-sm">
                <span className="material-symbols-outlined text-[16px]">verified_user</span>
                <span>Sesión cifrada de extremo a extremo</span>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
