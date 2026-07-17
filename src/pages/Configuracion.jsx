import { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useAuthContext } from '../context/AuthContext';
import { useAccounts } from '../context/AccountsContext';
import { useProperties } from '../context/PropertiesContext';
import { useVehicles, estimateCurrentValue } from '../context/VehiclesContext';
import { useLoyalty, LOYALTY_GROUPS } from '../context/LoyaltyContext';

const TABS = ['Perfil y Acceso', 'Cuentas', 'Tarjetas de Crédito', 'Programas de Lealtad', 'Vehículos', 'Propiedades'];

export default function Configuracion() {
  const { user, logout } = useAuthContext();
  const { accounts, addAccount, updateAccount, toggleAccountActive, deleteAccount } = useAccounts();
  const { properties, addProperty, updateProperty, deleteProperty } = useProperties();
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useVehicles();
  const { programs, addProgram, updateProgram, deleteProgram } = useLoyalty();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profile, setProfile] = useState({
    firstName: user?.displayName?.split(' ')[0] || 'Eleanor',
    lastName: user?.displayName?.split(' ')[1] || 'Vance',
    email: user?.email || 'e.vance@familyoffice.co',
    phone: '+1 (555) 019-2834',
    timezone: 'Hora del Este (EE. UU. y Canadá)',
  });

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    console.warn('Guardar perfil: pendiente de conectar con Firestore', profile);
    setEditingProfile(false);
  };

  // ── Accounts tab state ──────────────────────────────────────────
  const CATEGORY_META = {
    liquidez:    { label: '1. Liquidez (Ahorro y Débito)',        color: 'bg-secondary',                dotColor: '#006a61' },
    inversiones: { label: '2. Inversiones (Bolsa y Temporales)',  color: 'bg-primary-container',        dotColor: '#131b2e' },
    jubilacion:  { label: '3. Jubilación (Fondos de Retiro)',     color: 'bg-on-tertiary-container',    dotColor: '#3980f4' },
    consumo:     { label: '4. Deudas de Consumo (Tarjetas)',      color: 'bg-error',                    dotColor: '#ba1a1a' },
    prestamos:   { label: '5. Préstamos (Autos e Hipotecas)',     color: 'bg-error',                    dotColor: '#ffdad6' },
  };

  const EMPTY_FORM = { name: '', amount: '', category: 'liquidez' };
  const [newAccForm, setNewAccForm] = useState(EMPTY_FORM);
  const [editingAccId, setEditingAccId] = useState(null);
  const [editAccForm, setEditAccForm] = useState({ name: '', amount: '' });
  const [accAlert, setAccAlert] = useState(null);

  const showAccAlert = (msg, type = 'success') => {
    setAccAlert({ msg, type });
    setTimeout(() => setAccAlert(null), 3500);
  };

  const handleAddAccount = (e) => {
    e.preventDefault();
    if (!newAccForm.name.trim()) return;
    addAccount(newAccForm.name.trim(), newAccForm.amount, newAccForm.category);
    setNewAccForm(EMPTY_FORM);
    showAccAlert(`Cuenta "${newAccForm.name.trim()}" agregada correctamente.`);
  };

  const startEditAcc = (acc) => {
    setEditingAccId(acc.id);
    setEditAccForm({ name: acc.name, amount: String(acc.amount) });
  };

  const handleSaveEditAcc = (id) => {
    if (!editAccForm.name.trim()) return;
    updateAccount(id, editAccForm.name.trim(), editAccForm.amount);
    setEditingAccId(null);
    showAccAlert('Cuenta actualizada correctamente.');
  };

  const handleDeleteAcc = (id, name) => {
    deleteAccount(id);
    showAccAlert(`Cuenta "${name}" eliminada.`, 'info');
  };

  // ── Properties tab state ────────────────────────────────────────
  const EMPTY_PROP_FORM = { name: '', value: '', appraisalDate: '' };
  const [newPropForm, setNewPropForm] = useState(EMPTY_PROP_FORM);
  const [editingPropId, setEditingPropId] = useState(null);
  const [editPropForm, setEditPropForm] = useState({ name: '', value: '', appraisalDate: '' });
  const [propAlert, setPropAlert] = useState(null);

  const showPropAlert = (msg, type = 'success') => {
    setPropAlert({ msg, type });
    setTimeout(() => setPropAlert(null), 3500);
  };

  const handleAddProperty = (e) => {
    e.preventDefault();
    if (!newPropForm.name.trim()) return;
    addProperty(newPropForm.name.trim(), newPropForm.value, newPropForm.appraisalDate);
    setNewPropForm(EMPTY_PROP_FORM);
    showPropAlert(`Propiedad "${newPropForm.name.trim()}" agregada correctamente.`);
  };

  const startEditProp = (prop) => {
    setEditingPropId(prop.id);
    setEditPropForm({ name: prop.name, value: String(prop.value), appraisalDate: prop.appraisalDate });
  };

  const handleSaveEditProp = (id) => {
    if (!editPropForm.name.trim()) return;
    updateProperty(id, editPropForm.name.trim(), editPropForm.value, editPropForm.appraisalDate);
    setEditingPropId(null);
    showPropAlert('Propiedad actualizada correctamente.');
  };

  const handleDeleteProp = (id, name) => {
    deleteProperty(id);
    showPropAlert(`Propiedad "${name}" eliminada.`, 'info');
  };

  // ── Vehicles tab state ──────────────────────────────────────────
  const EMPTY_VEHICLE_FORM = { name: '', originalValue: '', purchaseYear: '' };
  const [newVehicleForm, setNewVehicleForm] = useState(EMPTY_VEHICLE_FORM);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editVehicleForm, setEditVehicleForm] = useState({ name: '', originalValue: '', purchaseYear: '' });
  const [vehicleAlert, setVehicleAlert] = useState(null);

  const showVehicleAlert = (msg, type = 'success') => {
    setVehicleAlert({ msg, type });
    setTimeout(() => setVehicleAlert(null), 3500);
  };

  const handleAddVehicle = (e) => {
    e.preventDefault();
    if (!newVehicleForm.name.trim()) return;
    addVehicle(newVehicleForm.name.trim(), newVehicleForm.originalValue, newVehicleForm.purchaseYear);
    setNewVehicleForm(EMPTY_VEHICLE_FORM);
    showVehicleAlert(`Vehículo "${newVehicleForm.name.trim()}" agregado correctamente.`);
  };

  const startEditVehicle = (vehicle) => {
    setEditingVehicleId(vehicle.id);
    setEditVehicleForm({
      name: vehicle.name,
      originalValue: String(vehicle.originalValue),
      purchaseYear: String(vehicle.purchaseYear),
    });
  };

  const handleSaveEditVehicle = (id) => {
    if (!editVehicleForm.name.trim()) return;
    updateVehicle(id, editVehicleForm.name.trim(), editVehicleForm.originalValue, editVehicleForm.purchaseYear);
    setEditingVehicleId(null);
    showVehicleAlert('Vehículo actualizado correctamente.');
  };

  const handleDeleteVehicle = (id, name) => {
    deleteVehicle(id);
    showVehicleAlert(`Vehículo "${name}" eliminado.`, 'info');
  };

  // ── Loyalty programs tab state ──────────────────────────────────
  const EMPTY_PROGRAM_FORM = { name: '', equivalenceUSD: '', group: LOYALTY_GROUPS[0], balance: '' };
  const [newProgramForm, setNewProgramForm] = useState(EMPTY_PROGRAM_FORM);
  const [editingProgramId, setEditingProgramId] = useState(null);
  const [editProgramForm, setEditProgramForm] = useState({ name: '', equivalenceUSD: '', group: LOYALTY_GROUPS[0], balance: '' });
  const [programAlert, setProgramAlert] = useState(null);

  const showProgramAlert = (msg, type = 'success') => {
    setProgramAlert({ msg, type });
    setTimeout(() => setProgramAlert(null), 3500);
  };

  const handleAddProgram = (e) => {
    e.preventDefault();
    if (!newProgramForm.name.trim()) return;
    addProgram(newProgramForm.name.trim(), newProgramForm.equivalenceUSD, newProgramForm.group, newProgramForm.balance);
    setNewProgramForm(EMPTY_PROGRAM_FORM);
    showProgramAlert(`Programa "${newProgramForm.name.trim()}" agregado correctamente.`);
  };

  const startEditProgram = (program) => {
    setEditingProgramId(program.id);
    setEditProgramForm({
      name: program.name,
      equivalenceUSD: String(program.equivalenceUSD),
      group: program.group,
      balance: String(program.balance ?? 0),
    });
  };

  const handleSaveEditProgram = (id) => {
    if (!editProgramForm.name.trim()) return;
    updateProgram(id, editProgramForm.name.trim(), editProgramForm.equivalenceUSD, editProgramForm.group, editProgramForm.balance);
    setEditingProgramId(null);
    showProgramAlert('Programa actualizado correctamente.');
  };

  const handleDeleteProgram = (id, name) => {
    deleteProgram(id);
    showProgramAlert(`Programa "${name}" eliminado.`, 'info');
  };

  return (
    <AppLayout title="Configuración" searchPlaceholder="Buscar configuración...">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-md">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-surface">Configuración de la Plataforma</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-2 max-w-2xl">
            Administre la configuración central, cuentas conectadas y preferencias administrativas para el
            portafolio del family office.
          </p>
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="border-b border-outline-variant mb-lg overflow-x-auto hide-scrollbar">
        <nav aria-label="Tabs" className="flex gap-lg min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 py-sm font-label-md text-label-md transition-all ${
                activeTab === tab
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-on-surface-variant hover:text-primary hover:border-outline'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'Perfil y Acceso' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left Column: Personal Info Form */}
          <div className="col-span-1 lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded p-lg shadow-sm">
            <div className="flex justify-between items-start mb-md">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Perfil del Administrador</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Actualice sus datos personales y de contacto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile((v) => !v)}
                className="text-secondary font-label-md hover:underline"
              >
                {editingProfile ? 'Cancelar' : 'Editar'}
              </button>
            </div>
            <form className="space-y-md" onSubmit={handleSaveProfile}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label className="font-label-sm text-label-sm font-bold text-on-surface">Nombre</label>
                  <input
                    className="w-full h-10 px-sm border border-outline-variant rounded bg-surface-container-lowest focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all text-body-sm disabled:bg-surface-container-low"
                    name="firstName"
                    type="text"
                    value={profile.firstName}
                    onChange={handleProfileChange}
                    readOnly={!editingProfile}
                  />
                </div>
                <div className="space-y-xs">
                  <label className="font-label-sm text-label-sm font-bold text-on-surface">Apellido</label>
                  <input
                    className="w-full h-10 px-sm border border-outline-variant rounded bg-surface-container-lowest focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all text-body-sm"
                    name="lastName"
                    type="text"
                    value={profile.lastName}
                    onChange={handleProfileChange}
                    readOnly={!editingProfile}
                  />
                </div>
              </div>
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm font-bold text-on-surface">Correo Electrónico</label>
                <input
                  className="w-full h-10 px-sm border border-outline-variant rounded bg-surface-container-lowest focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all text-body-sm"
                  name="email"
                  type="email"
                  value={profile.email}
                  onChange={handleProfileChange}
                  readOnly={!editingProfile}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label className="font-label-sm text-label-sm font-bold text-on-surface">Número de Teléfono</label>
                  <input
                    className="w-full h-10 px-sm border border-outline-variant rounded bg-surface-container-lowest focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all text-body-sm"
                    name="phone"
                    type="tel"
                    value={profile.phone}
                    onChange={handleProfileChange}
                    readOnly={!editingProfile}
                  />
                </div>
                <div className="space-y-xs">
                  <label className="font-label-sm text-label-sm font-bold text-on-surface">Zona Horaria</label>
                  <select
                    className="w-full h-10 px-sm border border-outline-variant rounded bg-surface-container-lowest focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all text-body-sm appearance-none cursor-pointer"
                    name="timezone"
                    value={profile.timezone}
                    onChange={handleProfileChange}
                    disabled={!editingProfile}
                  >
                    <option>Hora del Este (EE. UU. y Canadá)</option>
                    <option>Hora del Pacífico (EE. UU. y Canadá)</option>
                  </select>
                </div>
              </div>
              {editingProfile && (
                <button
                  type="submit"
                  className="h-10 px-md rounded font-label-md bg-secondary text-on-secondary hover:bg-secondary/90 transition-colors"
                >
                  Guardar Cambios
                </button>
              )}
            </form>
          </div>

          {/* Right Column: Security & Session */}
          <div className="col-span-1 lg:col-span-4 space-y-gutter">
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-lg shadow-sm">
              <h3 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-sm">Seguridad</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
                Administre su contraseña y métodos de autenticación multifactor.
              </p>
              <div className="space-y-sm">
                <div className="flex items-center justify-between p-sm border border-outline-variant rounded bg-surface">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-outline">password</span>
                    <div>
                      <p className="font-label-md text-on-surface">Contraseña</p>
                      <p className="font-body-sm text-outline text-[12px]">Cambiada hace 3 meses</p>
                    </div>
                  </div>
                  <button type="button" className="text-secondary font-label-md hover:underline">
                    Actualizar
                  </button>
                </div>
                <div className="flex items-center justify-between p-sm border border-outline-variant rounded bg-surface">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-secondary">verified_user</span>
                    <div>
                      <p className="font-label-md text-on-surface">Autenticación de Dos Factores</p>
                      <p className="font-body-sm text-secondary text-[12px]">Habilitado (App)</p>
                    </div>
                  </div>
                  <button type="button" className="text-secondary font-label-md hover:underline">
                    Administrar
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-surface-dim border border-outline-variant rounded p-lg">
              <h4 className="font-label-md text-label-md font-bold text-on-surface mb-xs uppercase tracking-wider">
                Sesión Actual
              </h4>
              <div className="space-y-xs font-body-sm text-body-sm text-on-surface-variant">
                <p>
                  Correo: <span className="text-on-surface">{user?.email || 'e.vance@familyoffice.co'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="mt-md w-full h-10 rounded font-label-md text-error bg-error-container hover:bg-error-container/80 transition-colors border border-error/20"
              >
                Terminar Sesión
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'Cuentas' ? (
        <div className="flex flex-col gap-gutter">

          {/* Alert banner */}
          {accAlert && (
            <div className={`flex items-center gap-sm p-sm rounded border text-body-sm font-body-sm transition-all ${
              accAlert.type === 'success'
                ? 'bg-secondary-container/20 border-secondary text-on-secondary-container'
                : 'bg-surface-container border-outline-variant text-on-surface-variant'
            }`}>
              <span className="material-symbols-outlined text-[18px]">
                {accAlert.type === 'success' ? 'check_circle' : 'info'}
              </span>
              {accAlert.msg}
            </div>
          )}

          {/* Add new account form */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-lg shadow-sm">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">Agregar Nueva Cuenta</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
              Define el nombre, monto inicial y categoría de la cuenta para incluirla en el cálculo de Patrimonio Neto.
            </p>
            <form onSubmit={handleAddAccount} className="grid grid-cols-1 md:grid-cols-4 gap-md items-end">
              <div className="md:col-span-1 flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Nombre de la Cuenta</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Santander Ahorro"
                  value={newAccForm.name}
                  onChange={e => setNewAccForm(p => ({ ...p, name: e.target.value }))}
                  className="h-10 px-sm border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                />
              </div>
              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Monto Inicial ($)</label>
                <div className="relative">
                  <span className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant font-label-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newAccForm.amount}
                    onChange={e => setNewAccForm(p => ({ ...p, amount: e.target.value }))}
                    className="w-full h-10 pl-8 pr-sm border border-outline-variant rounded bg-surface text-body-sm text-right font-label-md outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Categoría</label>
                <select
                  value={newAccForm.category}
                  onChange={e => setNewAccForm(p => ({ ...p, category: e.target.value }))}
                  className="h-10 px-sm border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-secondary transition-colors cursor-pointer"
                >
                  {Object.entries(CATEGORY_META).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="h-10 px-md bg-secondary text-on-secondary rounded font-label-md text-label-md hover:bg-secondary/90 transition-colors flex items-center justify-center gap-xs"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Agregar
              </button>
            </form>
          </div>

          {/* Accounts grouped by category */}
          {Object.entries(CATEGORY_META).map(([catKey, catMeta]) => {
            const catAccounts = accounts.filter(a => a.category === catKey);
            const catTotal = catAccounts.reduce((s, a) => s + a.amount, 0);
            const isLiability = catKey === 'consumo' || catKey === 'prestamos';
            return (
              <div key={catKey} className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-lg py-sm bg-surface border-b border-outline-variant">
                  <div className="flex items-center gap-sm">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: catMeta.dotColor }} />
                    <h4 className="font-label-md text-label-md text-on-surface uppercase tracking-wider">{catMeta.label}</h4>
                    <span className="text-xs font-label-sm text-on-surface-variant bg-surface-container px-xs py-base rounded-full">
                      {catAccounts.length} cuenta{catAccounts.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className={`font-headline-md text-headline-md font-bold ${ isLiability ? 'text-error' : 'text-secondary' }`}>
                    ${catTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {catAccounts.length === 0 ? (
                  <div className="px-lg py-md text-on-surface-variant font-body-sm text-body-sm italic">
                    Sin cuentas en esta categoría. Agrega una arriba.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/40">
                        <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase">Nombre</th>
                        <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right">Monto Actual</th>
                        <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-center w-40">Patrimonio Neto</th>
                        <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right w-32">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catAccounts.map(acc => (
                        <tr key={acc.id} className={`border-b border-outline-variant/30 hover:bg-surface-container-low/40 transition-colors ${acc.active === false ? 'opacity-50' : ''}`}>
                          <td className="py-sm px-lg">
                            {editingAccId === acc.id ? (
                              <input
                                autoFocus
                                type="text"
                                value={editAccForm.name}
                                onChange={e => setEditAccForm(p => ({ ...p, name: e.target.value }))}
                                className="h-8 px-sm border border-secondary rounded bg-surface text-body-sm w-full outline-none"
                              />
                            ) : (
                              <span className="font-body-sm text-body-sm text-on-surface">{acc.name}</span>
                            )}
                          </td>
                          <td className="py-sm px-lg text-right">
                            {editingAccId === acc.id ? (
                              <div className="relative inline-block">
                                <span className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant font-label-sm">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editAccForm.amount}
                                  onChange={e => setEditAccForm(p => ({ ...p, amount: e.target.value }))}
                                  className="h-8 pl-7 pr-sm border border-secondary rounded bg-surface text-body-sm text-right font-label-md w-36 outline-none"
                                />
                              </div>
                            ) : (
                              <span className={`font-label-md text-label-md ${ isLiability ? 'text-error' : 'text-on-surface' }`}>
                                ${acc.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </td>
                          <td className="py-sm px-lg text-center">
                            <button
                              type="button"
                              onClick={() => toggleAccountActive(acc.id)}
                              title={acc.active === false ? 'Activar en Patrimonio Neto' : 'Ocultar de Patrimonio Neto'}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold transition-colors ${
                                acc.active === false
                                  ? 'bg-surface-container text-on-surface-variant hover:bg-surface-container-low'
                                  : 'bg-secondary-container/30 text-secondary hover:bg-secondary-container/50'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${acc.active === false ? 'bg-on-surface-variant' : 'bg-secondary'}`} />
                              {acc.active === false ? 'Desactivada' : 'Activa'}
                            </button>
                          </td>
                          <td className="py-sm px-lg text-right">
                            <div className="flex items-center justify-end gap-xs">
                              {editingAccId === acc.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditAcc(acc.id)}
                                    className="h-7 px-sm bg-secondary text-on-secondary rounded font-label-sm text-label-sm hover:bg-secondary/90 transition-colors flex items-center gap-base"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                    Guardar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingAccId(null)}
                                    className="h-7 px-sm border border-outline-variant text-on-surface rounded font-label-sm text-label-sm hover:bg-surface-container-low transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEditAcc(acc)}
                                    title="Editar"
                                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container-low text-on-surface-variant hover:text-secondary transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAcc(acc.id, acc.name)}
                                    title="Eliminar"
                                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      ) : activeTab === 'Propiedades' ? (
        <div className="flex flex-col gap-gutter">

          {/* Alert banner */}
          {propAlert && (
            <div className={`flex items-center gap-sm p-sm rounded border text-body-sm font-body-sm transition-all ${
              propAlert.type === 'success'
                ? 'bg-secondary-container/20 border-secondary text-on-secondary-container'
                : 'bg-surface-container border-outline-variant text-on-surface-variant'
            }`}>
              <span className="material-symbols-outlined text-[18px]">
                {propAlert.type === 'success' ? 'check_circle' : 'info'}
              </span>
              {propAlert.msg}
            </div>
          )}

          {/* Add new property form */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-lg shadow-sm">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">Agregar Nueva Propiedad</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
              Define el nombre, valor de avalúo y fecha de avalúo para incluirla en Patrimonio Neto.
            </p>
            <form onSubmit={handleAddProperty} className="grid grid-cols-1 md:grid-cols-4 gap-md items-end">
              <div className="md:col-span-2 flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Nombre de la Propiedad</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Casa de Playa"
                  value={newPropForm.name}
                  onChange={e => setNewPropForm(p => ({ ...p, name: e.target.value }))}
                  className="h-10 px-sm border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                />
              </div>
              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Valor de Avalúo ($)</label>
                <div className="relative">
                  <span className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant font-label-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newPropForm.value}
                    onChange={e => setNewPropForm(p => ({ ...p, value: e.target.value }))}
                    className="w-full h-10 pl-8 pr-sm border border-outline-variant rounded bg-surface text-body-sm text-right font-label-md outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Fecha de Avalúo</label>
                <input
                  type="date"
                  value={newPropForm.appraisalDate}
                  onChange={e => setNewPropForm(p => ({ ...p, appraisalDate: e.target.value }))}
                  className="h-10 px-sm border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                />
              </div>
              <button
                type="submit"
                className="h-10 px-md bg-secondary text-on-secondary rounded font-label-md text-label-md hover:bg-secondary/90 transition-colors flex items-center justify-center gap-xs md:col-start-4"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Agregar
              </button>
            </form>
          </div>

          {/* Properties table */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-lg py-sm bg-surface border-b border-outline-variant">
              <div className="flex items-center gap-sm">
                <h4 className="font-label-md text-label-md text-on-surface uppercase tracking-wider">Propiedades</h4>
                <span className="text-xs font-label-sm text-on-surface-variant bg-surface-container px-xs py-base rounded-full">
                  {properties.length} propiedad{properties.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <span className="font-headline-md text-headline-md font-bold text-secondary">
                ${properties.reduce((s, p) => s + p.value, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {properties.length === 0 ? (
              <div className="px-lg py-md text-on-surface-variant font-body-sm text-body-sm italic">
                Sin propiedades registradas. Agrega una arriba.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/40">
                    <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase">Nombre</th>
                    <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right">Valor de Avalúo</th>
                    <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase">Fecha de Avalúo</th>
                    <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map(prop => (
                    <tr key={prop.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-sm px-lg">
                        {editingPropId === prop.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={editPropForm.name}
                            onChange={e => setEditPropForm(p => ({ ...p, name: e.target.value }))}
                            className="h-8 px-sm border border-secondary rounded bg-surface text-body-sm w-full outline-none"
                          />
                        ) : (
                          <span className="font-body-sm text-body-sm text-on-surface">{prop.name}</span>
                        )}
                      </td>
                      <td className="py-sm px-lg text-right">
                        {editingPropId === prop.id ? (
                          <div className="relative inline-block">
                            <span className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant font-label-sm">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editPropForm.value}
                              onChange={e => setEditPropForm(p => ({ ...p, value: e.target.value }))}
                              className="h-8 pl-7 pr-sm border border-secondary rounded bg-surface text-body-sm text-right font-label-md w-36 outline-none"
                            />
                          </div>
                        ) : (
                          <span className="font-label-md text-label-md text-on-surface">
                            ${prop.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="py-sm px-lg">
                        {editingPropId === prop.id ? (
                          <input
                            type="date"
                            value={editPropForm.appraisalDate}
                            onChange={e => setEditPropForm(p => ({ ...p, appraisalDate: e.target.value }))}
                            className="h-8 px-sm border border-secondary rounded bg-surface text-body-sm outline-none"
                          />
                        ) : (
                          <span className="font-body-sm text-body-sm text-on-surface-variant">{prop.appraisalDate}</span>
                        )}
                      </td>
                      <td className="py-sm px-lg text-right">
                        <div className="flex items-center justify-end gap-xs">
                          {editingPropId === prop.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEditProp(prop.id)}
                                className="h-7 px-sm bg-secondary text-on-secondary rounded font-label-sm text-label-sm hover:bg-secondary/90 transition-colors flex items-center gap-base"
                              >
                                <span className="material-symbols-outlined text-[14px]">check</span>
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPropId(null)}
                                className="h-7 px-sm border border-outline-variant text-on-surface rounded font-label-sm text-label-sm hover:bg-surface-container-low transition-colors"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditProp(prop)}
                                title="Editar"
                                className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container-low text-on-surface-variant hover:text-secondary transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProp(prop.id, prop.name)}
                                title="Eliminar"
                                className="w-7 h-7 flex items-center justify-center rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : activeTab === 'Vehículos' ? (
        <div className="flex flex-col gap-gutter">

          {/* Alert banner */}
          {vehicleAlert && (
            <div className={`flex items-center gap-sm p-sm rounded border text-body-sm font-body-sm transition-all ${
              vehicleAlert.type === 'success'
                ? 'bg-secondary-container/20 border-secondary text-on-secondary-container'
                : 'bg-surface-container border-outline-variant text-on-surface-variant'
            }`}>
              <span className="material-symbols-outlined text-[18px]">
                {vehicleAlert.type === 'success' ? 'check_circle' : 'info'}
              </span>
              {vehicleAlert.msg}
            </div>
          )}

          {/* Add new vehicle form */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-lg shadow-sm">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">Agregar Nuevo Vehículo</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
              Define el nombre, valor original y año de compra para incluirlo en Patrimonio Neto.
            </p>
            <form onSubmit={handleAddVehicle} className="grid grid-cols-1 md:grid-cols-4 gap-md items-end">
              <div className="md:col-span-2 flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Nombre del Vehículo</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Toyota RAV4"
                  value={newVehicleForm.name}
                  onChange={e => setNewVehicleForm(p => ({ ...p, name: e.target.value }))}
                  className="h-10 px-sm border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                />
              </div>
              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Valor Original ($)</label>
                <div className="relative">
                  <span className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant font-label-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newVehicleForm.originalValue}
                    onChange={e => setNewVehicleForm(p => ({ ...p, originalValue: e.target.value }))}
                    className="w-full h-10 pl-8 pr-sm border border-outline-variant rounded bg-surface text-body-sm text-right font-label-md outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Año de Compra</label>
                <input
                  type="number"
                  min="1900"
                  step="1"
                  placeholder="2020"
                  value={newVehicleForm.purchaseYear}
                  onChange={e => setNewVehicleForm(p => ({ ...p, purchaseYear: e.target.value }))}
                  className="h-10 px-sm border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                />
              </div>
              <button
                type="submit"
                className="h-10 px-md bg-secondary text-on-secondary rounded font-label-md text-label-md hover:bg-secondary/90 transition-colors flex items-center justify-center gap-xs md:col-start-4"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Agregar
              </button>
            </form>
          </div>

          {/* Vehicles table */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-lg py-sm bg-surface border-b border-outline-variant">
              <div className="flex items-center gap-sm">
                <h4 className="font-label-md text-label-md text-on-surface uppercase tracking-wider">Vehículos</h4>
                <span className="text-xs font-label-sm text-on-surface-variant bg-surface-container px-xs py-base rounded-full">
                  {vehicles.length} vehículo{vehicles.length !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="font-headline-md text-headline-md font-bold text-secondary">
                ${vehicles.reduce((s, v) => s + estimateCurrentValue(v), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {vehicles.length === 0 ? (
              <div className="px-lg py-md text-on-surface-variant font-body-sm text-body-sm italic">
                Sin vehículos registrados. Agrega uno arriba.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/40">
                    <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase">Nombre</th>
                    <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right">Valor Original</th>
                    <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right">Año de Compra</th>
                    <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right">Valor Estimado</th>
                    <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(vehicle => (
                    <tr key={vehicle.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-sm px-lg">
                        {editingVehicleId === vehicle.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={editVehicleForm.name}
                            onChange={e => setEditVehicleForm(p => ({ ...p, name: e.target.value }))}
                            className="h-8 px-sm border border-secondary rounded bg-surface text-body-sm w-full outline-none"
                          />
                        ) : (
                          <span className="font-body-sm text-body-sm text-on-surface">{vehicle.name}</span>
                        )}
                      </td>
                      <td className="py-sm px-lg text-right">
                        {editingVehicleId === vehicle.id ? (
                          <div className="relative inline-block">
                            <span className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant font-label-sm">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editVehicleForm.originalValue}
                              onChange={e => setEditVehicleForm(p => ({ ...p, originalValue: e.target.value }))}
                              className="h-8 pl-7 pr-sm border border-secondary rounded bg-surface text-body-sm text-right font-label-md w-36 outline-none"
                            />
                          </div>
                        ) : (
                          <span className="font-label-md text-label-md text-on-surface">
                            ${vehicle.originalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="py-sm px-lg text-right">
                        {editingVehicleId === vehicle.id ? (
                          <input
                            type="number"
                            min="1900"
                            step="1"
                            value={editVehicleForm.purchaseYear}
                            onChange={e => setEditVehicleForm(p => ({ ...p, purchaseYear: e.target.value }))}
                            className="h-8 px-sm border border-secondary rounded bg-surface text-body-sm text-right w-24 outline-none"
                          />
                        ) : (
                          <span className="font-body-sm text-body-sm text-on-surface-variant">{vehicle.purchaseYear}</span>
                        )}
                      </td>
                      <td className="py-sm px-lg text-right">
                        <span className="font-label-md text-label-md text-on-surface">
                          ${estimateCurrentValue(vehicle).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-sm px-lg text-right">
                        <div className="flex items-center justify-end gap-xs">
                          {editingVehicleId === vehicle.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEditVehicle(vehicle.id)}
                                className="h-7 px-sm bg-secondary text-on-secondary rounded font-label-sm text-label-sm hover:bg-secondary/90 transition-colors flex items-center gap-base"
                              >
                                <span className="material-symbols-outlined text-[14px]">check</span>
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingVehicleId(null)}
                                className="h-7 px-sm border border-outline-variant text-on-surface rounded font-label-sm text-label-sm hover:bg-surface-container-low transition-colors"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditVehicle(vehicle)}
                                title="Editar"
                                className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container-low text-on-surface-variant hover:text-secondary transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVehicle(vehicle.id, vehicle.name)}
                                title="Eliminar"
                                className="w-7 h-7 flex items-center justify-center rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : activeTab === 'Programas de Lealtad' ? (
        <div className="flex flex-col gap-gutter">

          {/* Alert banner */}
          {programAlert && (
            <div className={`flex items-center gap-sm p-sm rounded border text-body-sm font-body-sm transition-all ${
              programAlert.type === 'success'
                ? 'bg-secondary-container/20 border-secondary text-on-secondary-container'
                : 'bg-surface-container border-outline-variant text-on-surface-variant'
            }`}>
              <span className="material-symbols-outlined text-[18px]">
                {programAlert.type === 'success' ? 'check_circle' : 'info'}
              </span>
              {programAlert.msg}
            </div>
          )}

          {/* Add new program form */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-lg shadow-sm">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">Agregar Nuevo Programa</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
              Define el nombre, el balance de puntos, la equivalencia a USD por punto y el grupo del programa.
            </p>
            <form onSubmit={handleAddProgram} className="grid grid-cols-1 md:grid-cols-5 gap-md items-end">
              <div className="md:col-span-2 flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Nombre de la Cuenta</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: American Express MR"
                  value={newProgramForm.name}
                  onChange={e => setNewProgramForm(p => ({ ...p, name: e.target.value }))}
                  className="h-10 px-sm border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                />
              </div>
              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Balance (puntos)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={newProgramForm.balance}
                  onChange={e => setNewProgramForm(p => ({ ...p, balance: e.target.value }))}
                  className="h-10 px-sm border border-outline-variant rounded bg-surface text-body-sm text-right font-label-md outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                />
              </div>
              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Equivalencia (USD / punto)</label>
                <div className="relative">
                  <span className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant font-label-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="0.01"
                    value={newProgramForm.equivalenceUSD}
                    onChange={e => setNewProgramForm(p => ({ ...p, equivalenceUSD: e.target.value }))}
                    className="w-full h-10 pl-8 pr-sm border border-outline-variant rounded bg-surface text-body-sm text-right font-label-md outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-base">
                <label className="font-label-sm text-label-sm text-on-surface">Grupo</label>
                <select
                  value={newProgramForm.group}
                  onChange={e => setNewProgramForm(p => ({ ...p, group: e.target.value }))}
                  className="h-10 px-sm border border-outline-variant rounded bg-surface text-body-sm outline-none focus:border-secondary transition-colors cursor-pointer"
                >
                  {LOYALTY_GROUPS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="h-10 px-md bg-secondary text-on-secondary rounded font-label-md text-label-md hover:bg-secondary/90 transition-colors flex items-center justify-center gap-xs md:col-start-5"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Agregar
              </button>
            </form>
          </div>

          {/* Programs grouped */}
          {LOYALTY_GROUPS.map((group) => {
            const groupPrograms = programs.filter((p) => p.group === group);
            if (groupPrograms.length === 0) return null;
            return (
              <div key={group} className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-lg py-sm bg-surface border-b border-outline-variant">
                  <div className="flex items-center gap-sm">
                    <h4 className="font-label-md text-label-md text-on-surface uppercase tracking-wider">{group}</h4>
                    <span className="text-xs font-label-sm text-on-surface-variant bg-surface-container px-xs py-base rounded-full">
                      {groupPrograms.length} cuenta{groupPrograms.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/40">
                      <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase">Nombre de la Cuenta</th>
                      <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right">Balance</th>
                      <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right">Equivalencia a USD</th>
                      <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right">Valor Estimado</th>
                      <th className="py-xs px-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right w-32">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupPrograms.map(program => (
                      <tr key={program.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low/40 transition-colors">
                        <td className="py-sm px-lg">
                          {editingProgramId === program.id ? (
                            <input
                              autoFocus
                              type="text"
                              value={editProgramForm.name}
                              onChange={e => setEditProgramForm(p => ({ ...p, name: e.target.value }))}
                              className="h-8 px-sm border border-secondary rounded bg-surface text-body-sm w-full outline-none"
                            />
                          ) : (
                            <span className="flex items-center gap-sm font-body-sm text-body-sm text-on-surface">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: program.color }} />
                              {program.name}
                            </span>
                          )}
                        </td>
                        <td className="py-sm px-lg text-right">
                          {editingProgramId === program.id ? (
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editProgramForm.balance}
                              onChange={e => setEditProgramForm(p => ({ ...p, balance: e.target.value }))}
                              className="h-8 px-sm border border-secondary rounded bg-surface text-body-sm text-right font-label-md w-28 outline-none"
                            />
                          ) : (
                            <span className="font-label-md text-label-md text-on-surface">
                              {(program.balance ?? 0).toLocaleString('en-US')}
                            </span>
                          )}
                        </td>
                        <td className="py-sm px-lg text-right">
                          {editingProgramId === program.id ? (
                            <div className="relative inline-block">
                              <span className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant font-label-sm">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={editProgramForm.equivalenceUSD}
                                onChange={e => setEditProgramForm(p => ({ ...p, equivalenceUSD: e.target.value }))}
                                className="h-8 pl-7 pr-sm border border-secondary rounded bg-surface text-body-sm text-right font-label-md w-28 outline-none"
                              />
                            </div>
                          ) : (
                            <span className="font-label-md text-label-md text-on-surface">
                              ${program.equivalenceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                            </span>
                          )}
                        </td>
                        <td className="py-sm px-lg text-right">
                          <span className="font-label-md text-label-md text-secondary">
                            ${((program.balance ?? 0) * program.equivalenceUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="py-sm px-lg text-right">
                          <div className="flex items-center justify-end gap-xs">
                            {editingProgramId === program.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditProgram(program.id)}
                                  className="h-7 px-sm bg-secondary text-on-secondary rounded font-label-sm text-label-sm hover:bg-secondary/90 transition-colors flex items-center gap-base"
                                >
                                  <span className="material-symbols-outlined text-[14px]">check</span>
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingProgramId(null)}
                                  className="h-7 px-sm border border-outline-variant text-on-surface rounded font-label-sm text-label-sm hover:bg-surface-container-low transition-colors"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditProgram(program)}
                                  title="Editar"
                                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container-low text-on-surface-variant hover:text-secondary transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProgram(program.id, program.name)}
                                  title="Eliminar"
                                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded p-lg text-on-surface-variant font-body-md">
          La sección "{activeTab}" está pendiente de implementación.
        </div>
      )}
    </AppLayout>
  );
}
