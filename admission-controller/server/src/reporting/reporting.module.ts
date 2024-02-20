import { Module } from '@nestjs/common';
import { KubernetesModule } from '../kubernetes/kubernetes.module';
import { ReportingService } from './reporting.service';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [KubernetesModule, PoliciesModule],
  providers: [ReportingService],
})
export class ReportingModule {}
