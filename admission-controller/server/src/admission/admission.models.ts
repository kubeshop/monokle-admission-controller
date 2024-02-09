import { V1ObjectMeta } from '@kubernetes/client-node';
import { Message, RuleLevel } from '@monokle/validation';

export type ValidationServerOptions = {
  port: number;
  host: string;
};

export type AdmissionRequestObject = {
  apiVersion: string;
  kind: string;
  metadata: V1ObjectMeta;
  spec: any;
  status: any;
};

export type AdmissionRequest = {
  apiVersion: string;
  kind: string;
  request: {
    name: string;
    namespace: string;
    uid: string;
    object: AdmissionRequestObject;
  };
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
