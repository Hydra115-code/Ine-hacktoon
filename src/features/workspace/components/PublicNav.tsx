"use client";

import Link from "next/link";
import { ThemeToggle } from "@/shared/design-system/components/ThemeToggle";
import { CivicBrand } from "./CivicBrand";
import { useOnboardingStore } from "../../onboarding/useOnboardingStore";

export function PublicNav() {
  const openOnboarding = useOnboardingStore((state) => state.openOnboarding);

  return (
    <header className="workspace-header public-nav">
      <div className="workspace-header__identity">
        <Link href="/" className="workspace-header__brand-link" aria-label="Ir al inicio de INE Explora">
          <CivicBrand />
        </Link>
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
