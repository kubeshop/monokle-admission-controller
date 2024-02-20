import { Module } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { KubernetesModule } from '../kubernetes/kubernetes.module';

@Module({
  imports: [KubernetesModule],
  controllers: [],
  providers: [PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
