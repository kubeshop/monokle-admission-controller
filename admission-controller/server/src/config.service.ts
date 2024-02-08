import { ConfigService as BaseConfigService } from '@nestjs/config';
import Configuration from './config';

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType &
    (string | number | boolean)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number | boolean)];

export class ConfigService extends BaseConfigService {
  private readonly config: typeof Configuration;

  constructor() {
    super();
    this.config = Configuration;
  }

  get(key: NestedKeyOf<typeof Configuration>): any {
    const keys = key.split('.');
    let result: any = this.config;
    for (const key of keys) {
      result = result[key];
    }
    return result;
  }
}
