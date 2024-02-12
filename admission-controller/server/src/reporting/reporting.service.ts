import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ResourceService } from '../kubernetes/resource.service';
import { PoliciesService } from '../policies/policies.service';
import { ResourceIdentifier } from './reporting.models';
import { Resource } from '@monokle/validation';
import { V1Namespace } from '@kubernetes/client-node';

type ScannedResourceKind = ResourceIdentifier;

@Injectable()
export class ReportingService implements OnModuleInit {
  private static readonly VALIDATOR_RESOURCE_DEFAULTS = {
    id: '',
    fileId: '',
    filePath: '',
    fileOffset: 0,
    text: '',
  };

  private SCANNED_RESOURCES: ScannedResourceKind[] = [
    { apiVersion: 'apps/v1', kind: 'Deployment' },
    { apiVersion: 'apps/v1', kind: 'StatefulSet' },
    { apiVersion: 'apps/v1', kind: 'DaemonSet' },
    { apiVersion: 'batch/v1', kind: 'CronJob' },
    { apiVersion: 'batch/v1', kind: 'Job' },
    { apiVersion: 'autoscaling/v2', kind: 'HorizontalPodAutoscaler' },
    { apiVersion: 'autoscaling/v1', kind: 'HorizontalPodAutoscaler' },
    { apiVersion: 'v1', kind: 'Pod' },
    { apiVersion: 'v1', kind: 'Service' },
    { apiVersion: 'v1', kind: 'ConfigMap' },
    { apiVersion: 'v1', kind: 'Secret' },
    { apiVersion: 'networking.k8s.io/v1', kind: 'Ingress' },
    { apiVersion: 'networking.k8s.io/v1', kind: 'NetworkPolicy' },
    { apiVersion: 'policy/v1beta1', kind: 'PodSecurityPolicy' },
    { apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'Role' },
    { apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'RoleBinding' },
    { apiVersion: 'v1', kind: 'ServiceAccount' },
    // { apiVersion: 'apiextensions.k8s.io/v1', kind: 'customresourcedefinitions' },
  ];

  private readonly log = new Logger(ReportingService.name);

  constructor(
    private readonly $client: ResourceService,
    private readonly $policies: PoliciesService,
  ) {}

  // todo: replace with correct trigger / entrypoint
  async onModuleInit() {
    this.log.log('Starting cluster report.');
    setTimeout(
      () =>
        this.$client.listNamespaces().then(async (namespaces) => {
          for (const namespace of namespaces) {
            const response = await this.validate(namespace);
            this.log.log(
              `Namespace ${namespace.metadata!.name} has ${
                response!.runs[0].results.length ?? 'no'
              } violations`,
            );
          }
        }),
      5000,
    );
  }

  public async validate(namespace: V1Namespace) {
    this.log.debug(`Running scan on namespace ${namespace.metadata!.name}`);

    const validator = this.$policies
      .getMatchingValidators(namespace as any)
      .at(0);
    if (!validator) {
      this.log.log(
        `No validator found for namespace ${namespace.metadata!.name}`,
      );
      return;
    }

    const resources = await this.buildInventory(namespace.metadata!.name!);
    return await validator.validator.validate({ resources });
  }

  private async buildInventory(namespace: string) {
    const inventory = new Set<Resource>();

    for (const { apiVersion, kind } of this.SCANNED_RESOURCES) {
      const resources = await this.$client
        .list(apiVersion, kind, namespace)
        .catch((err) => {
          // todo: sentry should handle this and report the available API versions for the given kind
          // ie: HPA is not available in v2, but in v2beta2
          this.log.warn(
            `Failed to list resources for ${apiVersion}/${kind} in namespace ${namespace}`,
          );
          return [];
        });
      resources.forEach((resource) => {
        resource.apiVersion ??= apiVersion;
        resource.kind ??= kind;

        inventory.add(
          Object.assign(
            {
              name: resource.metadata!.name ?? '',
              apiVersion: resource.apiVersion,
              kind: resource.kind,
              namespace: resource.metadata?.namespace,
              content: resource,
            },
            ReportingService.VALIDATOR_RESOURCE_DEFAULTS,
          ),
        );
      });
    }

    return [...inventory];
  }
}
