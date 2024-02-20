import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ResourceService } from '../kubernetes/resource.service';
import { PoliciesService } from '../policies/policies.service';
import { ResourceIdentifier } from './reporting.models';
import {
  V1APIGroup,
  V1CustomResourceDefinition,
  V1Namespace,
} from '@kubernetes/client-node';
import { Resource } from '@monokle/validation';

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

  private SCANNED_NATIVE_RESOURCES: ScannedResourceKind[] = [
    { version: 'v1', kind: 'Service' },
    { version: 'v1', kind: 'ConfigMap' },
    { version: 'v1', kind: 'Secret' },
    { version: 'v1', kind: 'ServiceAccount' },
    { version: 'v1', kind: 'PersistentVolumeClaim' },
    { group: 'apps', kind: 'Deployment' },
    { group: 'apps', kind: 'StatefulSet' },
    { group: 'apps', kind: 'DaemonSet' },
    { group: 'batch', kind: 'CronJob' },
    { group: 'batch', kind: 'Job' },
    { group: 'autoscaling', kind: 'HorizontalPodAutoscaler' },
    { group: 'networking.k8s.io', kind: 'Ingress' },
    { group: 'networking.k8s.io', kind: 'NetworkPolicy' },
    { group: 'rbac.authorization.k8s.io', kind: 'Role' },
    { group: 'rbac.authorization.k8s.io', kind: 'RoleBinding' },
  ];
  private SCANNED_CUSTOM_RESOURCES: Array<ScannedResourceKind> = [];

  private readonly log = new Logger(ReportingService.name);

  constructor(
    private readonly $client: ResourceService,
    private readonly $policies: PoliciesService,
  ) {}

  private static getApiVersion(group: string | undefined, version: string) {
    if (group) {
      return `${group}/${version}`;
    }
    return version;
  }

  // todo: replace with correct trigger / entrypoint
  async onModuleInit() {
    this.log.log('Starting cluster reporting module');

    this.SCANNED_NATIVE_RESOURCES = this.buildNativeApiVersions(
      await this.$client.listAPIs().then((apis) => apis.groups),
    );
    this.SCANNED_CUSTOM_RESOURCES = this.buildCustomApiVersions(
      await this.$client.listCRDs(),
    );

    // todo: replace with correct trigger / entrypoint
    // running in setTimeout so the PoliciesService has time to preload the validators.
    // when running in k8s, this should be removed as will be called trough apicalls / events
    setTimeout(
      () =>
        this.$client.listNamespaces().then(async (namespaces) => {
          for (const namespace of namespaces) {
            const response = await this.validate(namespace);
            if (response?.runs) {
              this.log.log(
                `Namespace ${namespace.metadata!.name} has ${
                  response.runs[0].results.length ?? 'no'
                } violations`,
              );
            }
          }
        }),
      5000,
    );
  }

  public async validate(namespace: V1Namespace) {
    this.log.log(`Running scan on namespace ${namespace.metadata!.name}`);

    const validator = this.$policies
      .getMatchingValidators(namespace as any)
      .at(0);
    if (!validator) {
      this.log.debug(
        `No validator found for namespace ${namespace.metadata!.name}`,
      );
      return;
    }

    const resources = await this.buildInventory(namespace.metadata!.name!);
    return await validator.validator.validate({ resources });
  }

  private buildNativeApiVersions(groups: V1APIGroup[]) {
    return this.SCANNED_NATIVE_RESOURCES.map((resource) => {
      const group = groups.find((group) => group.name === resource.group);
      if (!group) {
        const apiVersion = ReportingService.getApiVersion(
          resource.group,
          resource.version!,
        );

        if (resource.group) {
          // resource had group defined yet could not be inferred from the API
          this.log.warn(
            `Could not find API group for resource ${apiVersion}/${resource.kind}`,
          );
        } else {
          this.log.debug(
            `API Discovery using default ${apiVersion}/${resource.kind}`,
          );
        }
        return {
          ...resource,
          apiVersion,
        };
      }

      return group.versions.map((version) => {
        const res = {
          ...resource,
          version: version.version,
          apiVersion: ReportingService.getApiVersion(
            resource.group!,
            version.version,
          ),
        };
        this.log.debug(
          `API Discovery using found ${res.apiVersion}/${res.kind}`,
        );
        return res;
      });
    }).flat();
  }

  private buildCustomApiVersions(crds: V1CustomResourceDefinition[]) {
    const namespaced = crds.filter((crd) => crd.spec.scope === 'Namespaced');

    return namespaced
      .map((crd) =>
        crd.spec.versions.map((version) => {
          const res = {
            group: crd.spec.group,
            kind: crd.spec.names.kind,
            version: version.name,
            apiVersion: ReportingService.getApiVersion(
              crd.spec.group,
              version.name,
            ),
          };
          this.log.debug(`CRD Discovery found ${res.apiVersion}/${res.kind}`);
          return res;
        }),
      )
      .flat();
  }

  private async buildInventory(namespace: string) {
    const inventory = new Set<Resource>();

    for (const { apiVersion, kind } of [
      ...this.SCANNED_NATIVE_RESOURCES,
      ...this.SCANNED_CUSTOM_RESOURCES,
    ]) {
      const resources = await this.$client
        .list(apiVersion!, kind, namespace)
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
              apiVersion: resource.apiVersion!,
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
