export type ClusterQueryResponseBindingPolicy = {
  id: string
  content: string
  project: {
    id: string
    name: string
  }
};

export type ClusterQueryResponseBinding = {
  id: string
  mode: 'ALLOW_LIST' | 'BLOCK_LIST'
  namespaces: string[]
  policy: ClusterQueryResponseBindingPolicy
};

export type ClusterQueryResponseNamespace = {
  id: string
  name: string
};

export type ClusterQueryResponse = {
  getCluster: {
    id: string
    name: string
    namespaceSync: boolean

    namespaces: ClusterQueryResponseNamespace[]

    bindings: ClusterQueryResponseBinding[]
  }
};

export type ClusterDiscoveryMutationResponse = {
  clusterDiscovery: {
    id: string
    namespaces: string[]
  }
};

export const getClusterQuery = `
  query getCluster($input: ClusterGetInput!) {
    getCluster(input: $input) {
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
          project {
            id
            name
          }
        }
      }
    }
  }
`;

export const clusterDiscoveryMutation = `
  mutation discoverCluster($version: String!, $namespaces: [String!]!) {
    discoverCluster(
      input: {
        version: $version,
        namespaces: $namespaces
      }
    ) {
      id
      namespaces
    }
  }
`;
