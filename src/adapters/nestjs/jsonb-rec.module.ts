/**
 * NestJS Dynamic Module for JSONB-REC
 */

import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { IFieldSchemaStorageDriver } from '../../interfaces';
import { JsonbRecService } from './jsonb-rec.service';
import { JSONB_REC_STORAGE_TOKEN } from './tokens';

export interface JsonbRecModuleOptions {
  storageDriver: IFieldSchemaStorageDriver;
}

export interface JsonbRecAsyncModuleOptions {
  useFactory: (
    ...args: any[]
  ) => Promise<JsonbRecModuleOptions> | JsonbRecModuleOptions;
  inject?: any[];
}

@Global()
@Module({})
export class JsonbRecModule {
  public static forRoot(options: JsonbRecModuleOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: JSONB_REC_STORAGE_TOKEN,
        useValue: options.storageDriver,
      },
      JsonbRecService,
    ];

    return {
      module: JsonbRecModule,
      providers,
      exports: [JsonbRecService, JSONB_REC_STORAGE_TOKEN],
    };
  }

  public static forRootAsync(
    options: JsonbRecAsyncModuleOptions
  ): DynamicModule {
    const asyncOptionsProvider: Provider = {
      provide: 'JSONB_REC_ASYNC_OPTIONS',
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    const storageProvider: Provider = {
      provide: JSONB_REC_STORAGE_TOKEN,
      useFactory: (opts: JsonbRecModuleOptions) => opts.storageDriver,
      inject: ['JSONB_REC_ASYNC_OPTIONS'],
    };

    return {
      module: JsonbRecModule,
      imports: [],
      providers: [
        asyncOptionsProvider,
        storageProvider,
        JsonbRecService,
      ],
      exports: [JsonbRecService, JSONB_REC_STORAGE_TOKEN],
    };
  }
}
