import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class SharedModule {}
