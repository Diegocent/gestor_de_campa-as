import type { Organization } from "@/domain/types";

export function BrandHeader({ organization }: { organization: Organization }) {
  const { branding } = organization;

  return (
    <header className="mb-8 flex items-center gap-4">
      {branding.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logoUrl}
          alt={branding.name}
          className="h-12 w-12 rounded-xl object-cover"
        />
      ) : (
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
          style={{ backgroundColor: branding.primaryColor }}
        >
          {branding.name.charAt(0)}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{branding.name}</h1>
        <p className="text-sm text-slate-500">Gestor de campañas WhatsApp</p>
      </div>
    </header>
  );
}
