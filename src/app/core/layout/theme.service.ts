import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ThemeName = 'light' | 'dark';

const STORAGE_KEY = 'chosenTheme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly theme = signal<ThemeName>(this.readInitialTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  setTheme(theme: ThemeName): void {
    this.storage()?.setItem(STORAGE_KEY, theme);
    this.theme.set(theme);
    this.applyTheme(theme);
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'light' ? 'dark' : 'light');
  }

  private readInitialTheme(): ThemeName {
    const value = this.storage()?.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : 'light';
  }

  private applyTheme(theme: ThemeName): void {
    this.document.documentElement.setAttribute('data-bs-theme', theme);
  }

  private storage(): Storage | null {
    return this.document.defaultView?.localStorage ?? null;
  }
}
