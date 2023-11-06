import pino from 'pino';
import {V1Namespace} from '@kubernetes/client-node';
import {InformerWrapper} from './get-informer.js';

export class NamespaceListener {
  private _isRunning = false;
  private _namespaces = new Map<string, V1Namespace>();

  constructor(
    private readonly _namespaceInformer: InformerWrapper<V1Namespace>,
    private readonly _logger: ReturnType<typeof pino>,
  ) {
    this._namespaceInformer.informer.on('add', this.onNamespace.bind(this));
    this._namespaceInformer.informer.on('update', this.onNamespace.bind(this));
    this._namespaceInformer.informer.on('delete', this.onNamespaceRemoval.bind(this));
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get namespaces(): string[] {
    return Array.from(this._namespaces.keys());
  }

  async start() {
    await this._namespaceInformer.start();
    this._isRunning = true;
  }

  async stop() {
    await this._namespaceInformer.stop();
    this._isRunning = false;
  }

  private onNamespace(namespace: V1Namespace) {
    this._logger.debug({msg: 'Namespace created/updated', namespace});

    this._namespaces.set(namespace.metadata!.name!, namespace);
  }

  private onNamespaceRemoval(namespace: V1Namespace) {
    this._logger.debug({msg: 'Namespace removed', namespace});

    this._namespaces.delete(namespace.metadata!.name!);
  }
}
