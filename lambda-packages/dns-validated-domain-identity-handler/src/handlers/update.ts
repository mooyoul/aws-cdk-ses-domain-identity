import { CloudFormationCustomResourceUpdateEvent } from "aws-lambda";
import { Verifier } from "../verifier";
import { CustomResourceHandler } from "./base";

export class UpdateCustomResourceHandler extends CustomResourceHandler<CloudFormationCustomResourceUpdateEvent> {
  public async consumeEvent() {
    const dnsChanged = this.hasChanged("DomainName") || this.hasChanged("HostedZoneId");
    const dkimChanged = this.hasChanged("DKIM");

    // If DNS is changed, Verify changed domain first and then revoke old one
    if (dnsChanged) {
      const newVerifier = Verifier.from(this.event.ResourceProperties);
      const oldVerifier = Verifier.from(this.event.OldResourceProperties);

      await newVerifier.verifyIdentity(true);
      if (this.event.ResourceProperties.DKIM) {
        await newVerifier.enableDKIM(true);
      }

      if (this.event.OldResourceProperties.DKIM) {
        await oldVerifier.disableDKIM();
      }

      await oldVerifier.revokeIdentity();

      return {
        // Update Physical Resource ID
        physicalResourceId: newVerifier.domainName,
        data: {},
      };
    }

    if (dkimChanged) {
      const verifier = Verifier.from(this.event.ResourceProperties);

      if (this.event.ResourceProperties.DKIM) {
        await verifier.enableDKIM(true);
      } else {
        await verifier.disableDKIM();
      }
    }

    return {
      // Keep Physical Resource ID
      physicalResourceId: this.event.PhysicalResourceId,
      data: {},
    };
  }

  private hasChanged(name: string): boolean {
    return this.event.OldResourceProperties[name] !== this.event.ResourceProperties[name];
  }
}
