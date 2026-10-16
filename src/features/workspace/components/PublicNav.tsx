"use client";

import Link from "next/link";
import { ThemeToggle } from "@/shared/design-system/components/ThemeToggle";
import { CivicBrand } from "./CivicBrand";
import { useOnboardingStore } from "../../onboarding/useOnboardingStore";

export function PublicNav() {
  const openOnboarding = useOnboardingStore((state) => state.openOnboarding);

  return (
    <header className="workspace-header public-nav" aria-label="Navegación principal de INE Explora">
      <div className="workspace-header__identity">
        <Link href="/" className="workspace-header__brand-link" aria-label="Ir al inicio de INE Explora">
          <CivicBrand />
        </Link>
        <span className="workspace-header__divider" aria-hidden="true" />
        <span className="workspace-header__product">Participación ciudadana</span>
      </div>

      <div className="workspace-header__session">
        <button type="button" className="public-nav__how" onClick={openOnboarding}>
          Recorrido
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
