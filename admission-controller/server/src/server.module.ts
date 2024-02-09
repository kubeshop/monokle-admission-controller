import { Module } from '@nestjs/common';
import { AdmissionModule } from './admission/admission.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule.forRoot(), AdmissionModule],
  controllers: [],
  providers: [],
})
export class ServerModule {}
