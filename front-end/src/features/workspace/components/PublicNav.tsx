"use client";

import Link from "next/link";
import { ThemeToggle } from "@/shared/design-system/components/ThemeToggle";
import { AccessibilityCenter } from "@/shared/design-system/components/AccessibilityCenter";
import { CivicBrand } from "./CivicBrand";
import { useOnboardingStore } from "../../onboarding/useOnboardingStore";

export function PublicNav() {
  const openOnboarding = useOnboardingStore((state) => state.openOnboarding);

  return (
    <>
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <header className="workspace-header public-nav" aria-label="Navegación principal de INE Explora">
        <div className="workspace-header__identity">
          <Link href="/" className="workspace-header__brand-link" aria-label="Ir al inicio de INE Explora">
            <CivicBrand />
          </Link>
          <span className="workspace-header__divider" aria-hidden="true" />
          <span className="workspace-header__product">Participación ciudadana</span>
        </div>

        <div className="workspace-header__session">
          <Link href="/historias" className="public-nav__how">
            Historia guiada
          </Link>
          <button type="button" className="public-nav__how" onClick={openOnboarding}>
            Cómo funciona
          </button>
          <AccessibilityCenter />
          <ThemeToggle />
        </div>
      </header>
    </>
  );
}
