import type { GymSettings } from '../models';
import type { SettingsRepository } from '../repositories/SettingsRepository';
import { Body } from '../util/validate';

export class SettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  get(): GymSettings {
    return this.settings.get();
  }

  update(raw: unknown): GymSettings {
    const body = new Body(raw);
    const current = this.settings.get();
    this.settings.save({
      gymName: body.has('gymName') ? body.string('gymName', 100) : current.gymName,
      contact: body.optionalString('contact', 50) ?? current.contact,
      address: body.optionalString('address', 150) ?? current.address,
    });
    return this.settings.get();
  }
}
