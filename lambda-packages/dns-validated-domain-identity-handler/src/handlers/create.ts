import { CloudFormationCustomResourceCreateEvent } from "aws-lambda";
import { Verifier } from "../verifier";
import { CustomResourceHandler } from "./base";

export class CreateCustomResourceHandler extends CustomResourceHandler<CloudFormationCustomResourceCreateEvent> {
  public async consumeEvent() {
    const verifier = Verifier.from(this.event.ResourceProperties);

    await verifier.verifyIdentity();
    if (this.event.ResourceProperties.DKIM) {
      await verifier.enableDKIM();
    }

    return {
      physicalResourceId: verifier.domainName,
      data: {},
    };
  }
}
