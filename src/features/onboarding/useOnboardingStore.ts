"use client";

import { create } from "zustand";
import type { OnboardingProfileId } from "./onboarding-types";

interface OnboardingState {
  isOpen: boolean;
  step: number;
  profileId: OnboardingProfileId | null;
  selectedState: string;
  hasCompleted: boolean;
  hasHydrated: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  hydrateOnboarding: () => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  selectProfile: (id: OnboardingProfileId) => void;
  setSelectedState: (state: string) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const STORAGE_KEY = "ine_explora_onboarding_status_v2";

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  isOpen: false,
  step: 1,
  profileId: "first-voter",
  selectedState: "Ciudad de México",
  hasCompleted: false,
  hasHydrated: false,

  openOnboarding: () => set({ isOpen: true, step: 1 }),
  closeOnboarding: () => {
    try {
      localStorage.setItem(STORAGE_KEY, get().hasCompleted ? "completed" : "dismissed");
    } catch {
      // La experiencia sigue disponible aunque el navegador bloquee storage.
    }
    set({ isOpen: false });
  },
  hydrateOnboarding: () => {
    if (get().hasHydrated) return;
    let savedStatus: string | null = null;
    try {
      savedStatus = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Sin persistencia, Paper se presenta en esta sesión.
    }
    set({
      hasHydrated: true,
      hasCompleted: savedStatus === "completed",
      isOpen: savedStatus === null,
    });
  },

  setStep: (step) => set({ step: Math.max(1, Math.min(5, step)) }),
  nextStep: () => {
    const current = get().step;
    if (current < 5) {
      set({ step: current + 1 });
    } else {
      get().completeOnboarding();
    }
  },
  prevStep: () => set((s) => ({ step: Math.max(1, s.step - 1) })),

  selectProfile: (id) => set({ profileId: id }),
  setSelectedState: (state) => set({ selectedState: state }),

  completeOnboarding: () => {
    try {
      localStorage.setItem(STORAGE_KEY, "completed");
    } catch {
      // ignore
    }
    set({ hasCompleted: true, hasHydrated: true, isOpen: false });
  },

  resetOnboarding: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({ hasCompleted: false, hasHydrated: true, step: 1, isOpen: true });
  },
}));
