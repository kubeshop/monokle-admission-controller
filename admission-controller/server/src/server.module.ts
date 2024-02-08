import { Module } from '@nestjs/common';
import {AdmissionModule} from "./admission/admission.module";

@Module({
  imports: [AdmissionModule],
  controllers: [],
  providers: [],
})
export class ServerModule {}
