import {ValidationConfig} from "@monokle/types";

export const getClusterQuery = `
  query getCluster() {
    cluster {
      id
      name
      namespaceSync

      namespaces {
        id
        name
      }

      bindings {
        id
        mode
        namespaces
        policy {
          id
          content
          projectId
        }
      }
    }
  }
`;

export type ClusterQueryResponseBindingPolicy = {
  id: string
  content: ValidationConfig
  projectId: string
};

export type ClusterQueryResponseBinding = {
  id: string
  mode: 'ALLOW_LIST' | 'BLOCK_LIST'
  namespaces: string[]
  policy: ClusterQueryResponseBindingPolicy
};

export type ClusterQueryResponse = {
  getCluster: {
    cluster: {
      id: string
      name: string
      namespaceSync: boolean

      namespaces: {
        id: string
        name: string
      }[]

      bindings: ClusterQueryResponseBinding[]
    }
  }
};

export const clusterDiscoveryMutation = `
  mutation clusterDiscovery($version: String!, $namespaces: String[]) {
    clusterDiscovery(
      input: {
        version: $version,
        namespaces: $namespaces
      }
    ) {
      namespaces
    }
  }
`;
