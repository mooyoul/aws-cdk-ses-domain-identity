import { CloudFormationCustomResourceDeleteEvent } from "aws-lambda";
import { Verifier } from "../verifier";
import { CustomResourceHandler } from "./base";

export class DeleteCustomResourceHandler extends CustomResourceHandler<CloudFormationCustomResourceDeleteEvent> {
  public async consumeEvent() {
    // If the resource didn't create correctly, the physical resource ID won't be
    // the requested domain name. so don't try to delete it in that case.
    if (this.event.PhysicalResourceId === this.event.ResourceProperties.DomainName) {
      const verifier = Verifier.from(this.event.ResourceProperties);

      if (this.event.ResourceProperties.DKIM) {
        await verifier.disableDKIM();
      }

      await verifier.revokeIdentity();
    }

    return {
      // Keep Physical Resource ID
      physicalResourceId: this.event.PhysicalResourceId,
      data: {},
    };
  }
}
