import type { GymSettings } from '../models';
import { Repository } from './Repository';

export class SettingsRepository extends Repository {
  get(): GymSettings {
    const r = this.db.prepare('SELECT gym_name, contact, address FROM settings WHERE id = 1').get() as {
      gym_name: string;
      contact: string;
      address: string;
    };
    return { gymName: r.gym_name, contact: r.contact, address: r.address };
  }

  save(s: GymSettings): void {
    this.db
      .prepare('UPDATE settings SET gym_name = @gymName, contact = @contact, address = @address WHERE id = 1')
      .run(s);
  }
}
