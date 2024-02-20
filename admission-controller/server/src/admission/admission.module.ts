import { Module } from '@nestjs/common';
import { AdmissionController } from './admission.controller';
import { SharedModule } from '../shared/shared.module';
import { PoliciesModule } from '../policies/policies.module';
import { KubernetesModule } from '../kubernetes/kubernetes.module';

@Module({
  imports: [SharedModule, KubernetesModule, PoliciesModule],
  controllers: [AdmissionController],
  providers: [],
})
export class AdmissionModule {}
