import React from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { formatPhoneNumber } from '../utils/personValidation';

export type ContactDetailRole = 'CLIENTE' | 'PRODUCTOR';

export type ContactDetailData = {
  id?: string | number | null;
  nombre: string;
  roles?: ContactDetailRole[];
  rol?: ContactDetailRole;
  tipoDocumento?: string | null;
  documento?: string | null;
  numeroDocumento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  ubicacion?: string | null;
  observaciones?: string | null;
  createdAt?: string | null;
};

type ContactDetailModalProps = {
  contact: ContactDetailData;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSelect?: () => void;
  allowDelete?: boolean;
  allowSelect?: boolean;
  selectLabel?: string;
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CC: 'Cédula de ciudadanía',
  CEDULA: 'Cédula de ciudadanía',
  NIT: 'NIT',
  TI: 'Tarjeta de identidad',
  CE: 'Cédula de extranjería',
  PASAPORTE: 'Pasaporte',
  PEP: 'PEP',
  OTRO: 'Otro',
};

function getRoles(contact: ContactDetailData): ContactDetailRole[] {
  if (contact.roles?.length) {
    return Array.from(new Set(contact.roles));
  }
  return contact.rol ? [contact.rol] : [];
}

function getRoleLabel(roles: ContactDetailRole[]) {
  const hasCliente = roles.includes('CLIENTE');
  const hasProductor = roles.includes('PRODUCTOR');
  if (hasCliente && hasProductor) return 'Cliente y Productor';
  if (hasCliente) return 'Cliente';
  if (hasProductor) return 'Productor';
  return 'No registrado';
}

function getRoleSummary(roles: ContactDetailRole[]) {
  const hasCliente = roles.includes('CLIENTE');
  const hasProductor = roles.includes('PRODUCTOR');
  if (hasCliente && hasProductor) return 'Multirol · Cliente y productor';
  if (hasCliente) return 'Cliente';
  if (hasProductor) return 'Productor';
  return 'Contacto';
}

function formatContactDate(value?: string | null) {
  if (!value) return 'No registrado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No registrado';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== 'No disponible' ? trimmed : '';
}

function getDocumentValue(contact: ContactDetailData) {
  const documentValue = cleanOptionalText(
    contact.numeroDocumento ?? contact.documento,
  );
  return documentValue && documentValue !== 'Documento pendiente'
    ? documentValue
    : 'Pendiente';
}

export function ContactDetailModal({
  contact,
  onClose,
  onEdit,
  onDelete,
  onSelect,
  allowDelete = false,
  allowSelect = false,
  selectLabel = 'Seleccionar contacto',
}: ContactDetailModalProps) {
  const roles = getRoles(contact);
  const roleLabel = getRoleLabel(roles);
  const roleSummary = getRoleSummary(roles);
  const typeLabel = contact.tipoDocumento
    ? DOCUMENT_TYPE_LABELS[contact.tipoDocumento] ?? contact.tipoDocumento
    : null;
  const additionalInfo = [
    ['Dirección', cleanOptionalText(contact.direccion)],
    ['Ubicación', cleanOptionalText(contact.ubicacion)],
    ['Observaciones', cleanOptionalText(contact.observaciones)],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/45 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-detail-title"
        className="w-full max-w-[410px] rounded-[22px] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)] dark:border dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-[#1f3fa7] dark:text-blue-200">
              Detalle
            </p>
            <h3
              id="contact-detail-title"
              className="mt-1 truncate text-lg font-black text-slate-950 dark:text-slate-100"
            >
              {contact.nombre}
            </h3>
            <p className="mt-1 text-xs font-black text-slate-500 dark:text-slate-300">
              {roleSummary}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500 dark:bg-slate-800 dark:text-slate-200"
            aria-label="Cerrar detalle"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <p>
            Nombre:{' '}
            <span className="font-black text-slate-900 dark:text-slate-100">
              {contact.nombre}
            </span>
          </p>
          <p>
            {roles.length > 1 ? 'Roles' : 'Rol'}:{' '}
            <span className="font-black text-slate-900 dark:text-slate-100">
              {roleLabel}
            </span>
          </p>
          {typeLabel ? (
            <p>
              Tipo de documento:{' '}
              <span className="font-black text-slate-900 dark:text-slate-100">
                {typeLabel}
              </span>
            </p>
          ) : null}
          <p>
            Documento:{' '}
            <span className="font-black text-slate-900 dark:text-slate-100">
              {getDocumentValue(contact)}
            </span>
          </p>
          <p>
            Teléfono:{' '}
            <span className="font-black text-slate-900 dark:text-slate-100">
              {contact.telefono ? formatPhoneNumber(contact.telefono) : 'No registrado'}
            </span>
          </p>
          <p>
            Fecha:{' '}
            <span className="font-black text-slate-900 dark:text-slate-100">
              {formatContactDate(contact.createdAt)}
            </span>
          </p>
        </div>

        {additionalInfo.length ? (
          <div className="mt-4 rounded-[14px] border border-[#e2e8f4] bg-[#fbfcff] px-3 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
              Información adicional
            </p>
            <div className="space-y-2">
              {additionalInfo.map(([label, value]) => (
                <p key={label}>
                  {label}:{' '}
                  <span className="font-black text-slate-900 dark:text-slate-100">
                    {value}
                  </span>
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={`mt-4 grid gap-2 ${
            allowDelete || allowSelect ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {allowSelect && onSelect ? (
            <button
              type="button"
              onClick={onSelect}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white dark:bg-blue-600"
            >
              {selectLabel}
            </button>
          ) : null}
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white dark:bg-blue-600"
            >
              <Pencil size={15} />
              Editar
            </button>
          ) : null}
          {allowDelete && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] bg-rose-50 px-4 text-sm font-black text-rose-700 ring-1 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/30"
            >
              <Trash2 size={15} />
              Eliminar
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
