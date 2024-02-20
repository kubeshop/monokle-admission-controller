import { Module } from '@nestjs/common';
import { AdmissionModule } from './admission/admission.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ReportingModule } from './reporting/reporting.module';

@Module({
  imports: [EventEmitterModule.forRoot(), AdmissionModule, ReportingModule],
  controllers: [],
  providers: [],
})
export class ServerModule {}
