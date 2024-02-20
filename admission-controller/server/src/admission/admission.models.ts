import { V1ObjectMeta } from '@kubernetes/client-node';
import { Message, RuleLevel } from '@monokle/validation';

export interface AdmissionRequest {
  kind: string;
  apiVersion: string;
  request: {
    uid: string;
    kind: ResourceApi;
    resource: Resource;
    requestKind: RequestKind;
    requestResource: Resource;
    name: string;
    namespace: string;
    operation: string;
    userInfo: UserInfo;
    object: any;
    oldObject: any;
    dryRun: boolean;
    options: {
      kind: string;
      apiVersion: string;
    };
  };
}

export interface ResourceVersion {
  group: string;
  version: string;
}

export interface ResourceApi extends ResourceVersion {
  kind: string;
}

export interface Resource extends ResourceVersion {
  resource: string;
}

export interface RequestKind extends ResourceVersion {
  kind: string;
}

export interface UserInfo {
  username: string;
  groups: string[];
}

export type AdmissionRequestObject = {
  apiVersion: string;
  kind: string;
  metadata: V1ObjectMeta;
  spec: any;
  status: any;
};

// See
// https://pkg.go.dev/k8s.io/api/admission/v1#AdmissionResponse
// https://kubernetes.io/docs/reference/config-api/apiserver-admission.v1/#admission-k8s-io-v1-AdmissionReview
export type AdmissionResponse = {
  kind: string;
  apiVersion: string;
  response: {
    uid: string;
    allowed: boolean;
    warnings?: string[];
    status: {
      message: string;
    };
  };
};

export type Violation = {
  ruleId: string;
  message: Message;
  level?: RuleLevel;
  actions: string[];
  name: string;
};
