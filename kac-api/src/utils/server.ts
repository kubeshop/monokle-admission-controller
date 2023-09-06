import { MonokleValidator } from "@monokle/validation";

export class Server {
  private _server: any; // fastify instance
  private _shouldValidate: boolean

  constructor(
    private readonly _validator: MonokleValidator,
  ) {
    // init server
    this._shouldValidate = false;
  }

  get shouldValidate() {
    return this._shouldValidate;
  }

  set shouldValidate(value: boolean) {
    this._shouldValidate = value;
  }

  start() {
    this.shouldValidate = true;
  }

  stop() {
    this.shouldValidate = false;
  }

  private async _initServer(resource: any) {

  private async _validateResource(resource: any) {}
}