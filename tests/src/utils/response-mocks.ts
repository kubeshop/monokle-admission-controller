export const RESPONSE_MOCK: Record<string, any> = {
  empty: {
    data: {
      getCluster: {
        id: "cluster-1",
        name: "Cluster 1",
        namespaceSync: false,
        namespaces: [],
        bindings: []
      }
    }
  },
  emptySync: {
    data: {
      getCluster: {
        id: "cluster-1",
        name: "Cluster 1",
        namespaceSync: false,
        namespaces: [],
        bindings: []
      }
    }
  },
  dataAllow: {
    data: {
      getCluster: {
        id: "cluster-1",
        name: "Cluster 1",
        namespaceSync: true,
        namespaces: [
          {
            id: "ns-0",
            name: "my-namespace-0"
          },
          {
            id: "ns-1",
            name: "my-namespace-1"
          },
          {
            id: "ns-2",
            name: "my-namespace-2"
          }
        ],
        bindings: [
          {
            id: "cluster-1-binding-1",
            mode: "ALLOW_LIST",
            namespaces: ["ns-0","ns-1"],
            policy: {
              id: "cluster-1-binding-1-policy",
              content: "plugins:\n  open-policy-agent: true\n  pod-security-standards: true\n",
              project: {
                id: "cluster-1-binding-1-policy-project",
                name: "cluster-1-binding-1-policy-project"
              }
            }
          },
          {
            id: "cluster-1-binding-2",
            mode: "ALLOW_LIST",
            namespaces: ["ns-2","ns-1"],
            policy: {
              id: "cluster-1-binding-2-policy",
              content: "plugins:\n  pod-security-standards: true\n  yaml-syntax: false\n  resource-links: false\n",
              project: {
                id: "cluster-1-binding-2-policy-project",
                name: "cluster-1-binding-2-policy-project"
              }
            }
          }
        ]
      }
    }
  }
}
