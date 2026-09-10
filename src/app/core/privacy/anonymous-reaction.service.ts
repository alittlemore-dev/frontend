import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

const CLIENT_TOKEN_KEY = 'articleReactionClientToken';
const REACTION_SELECTIONS_KEY = 'articleReactionSelections';

@Injectable({ providedIn: 'root' })
export class AnonymousReactionService {
  private readonly document = inject(DOCUMENT);

  getOrCreateClientToken(): string | null {
    const storage = this.storage();
    if (storage === null) {
      return null;
    }
    const existingToken = storage.getItem(CLIENT_TOKEN_KEY);
    if (existingToken) {
      return existingToken;
    }
    const browserCrypto = this.crypto();
    if (browserCrypto === null) {
      return null;
    }
    const token = browserCrypto.randomUUID();
    storage.setItem(CLIENT_TOKEN_KEY, token);
    return token;
  }

  getReaction(slug: string): string | null {
    return this.readSelections()[slug] ?? null;
  }

  setReaction(slug: string, reactionKind: string | null): void {
    const selections = this.readSelections();
    if (reactionKind === null) {
      delete selections[slug];
    } else {
      selections[slug] = reactionKind;
    }
    this.storage()?.setItem(REACTION_SELECTIONS_KEY, JSON.stringify(selections));
  }

  private readSelections(): Record<string, string> {
    const rawValue = this.storage()?.getItem(REACTION_SELECTIONS_KEY);
    if (!rawValue) {
      return {};
    }
    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(rawValue);
    } catch {
      return {};
    }
    if (!isStringRecord(parsedValue)) {
      return {};
    }
    return parsedValue;
  }

  private storage(): Storage | null {
    return this.document.defaultView?.localStorage ?? null;
  }

  private crypto(): Crypto | null {
    return this.document.defaultView?.crypto ?? null;
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}
