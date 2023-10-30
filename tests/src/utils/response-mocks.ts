export const RESPONSE_MOCK: Record<string, any> = {
  empty: {
    data: {
      getCluster: {
        cluster: {
          id: "cluster-1",
          name: "Cluster 1",
          namespaceSync: false,
          namespaces: [],
          bindings: []
        }
      }
    }
  },
  emptySync: {
    data: {
      getCluster: {
        cluster: {
          id: "cluster-1",
          name: "Cluster 1",
          namespaceSync: false,
          namespaces: [],
          bindings: []
        }
      }
    }
  },
  dataAllow: {
    data: {
      getCluster: {
        cluster: {
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
            }
          ],
          bindings: [
            {
              id: "cluster-1-binding-1",
              mode: "ALLOW_LIST",
              namespaces: ["my-namespace-0","my-namespace-1"],
              policy: {
                id: "cluster-1-binding-1-policy",
                content: {
                  plugins: {
                    "open-policy-agent": true,
                    "pod-security-standards": true
                  }
                },
                projectId: "cluster-1-binding-1-policy-project"
              }
            },
            {
              id: "cluster-1-binding-2",
              mode: "ALLOW_LIST",
              namespaces: ["my-namespace-2","my-namespace-1"],
              policy: {
                id: "cluster-1-binding-2-policy",
                content: {
                    plugins: {
                      'yaml-syntax': true,
                      'open-policy-agent': true,
                      'resource-links': true,
                    },
                    rules: {
                      'yaml-syntax/no-bad-alias': "warn",
                      'yaml-syntax/no-bad-directive': false,
                      'open-policy-agent/no-last-image': "err",
                      'open-policy-agent/cpu-limit': "err",
                      'open-policy-agent/memory-limit': "err",
                      'open-policy-agent/memory-request': "err",
                    }
                },
                projectId: "cluster-1-binding-2-policy-project"
              }
            }
          ]
        }
      }
    }
  }
}
