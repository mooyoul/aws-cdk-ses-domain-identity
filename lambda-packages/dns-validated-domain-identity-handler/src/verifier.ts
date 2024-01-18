import Route53 from "aws-sdk/clients/route53";
import SES from "aws-sdk/clients/ses";
import { Record } from "./record";
import { waitFor } from "./util";

type CFNCustomResourceProps = {
  [key: string]: any;
};

type Wait = {
  delay: number;
  maxAttempts: number;
};

const DEFAULT_WAIT: Wait = { delay: 30, maxAttempts: 30 };

// tslint:disable:no-console
export class Verifier {
  public static from(props: CFNCustomResourceProps) {
    return new this(props.DomainName, props.HostedZoneId, props.Region);
  }

  private readonly route53 = new Route53({ region: this.region });
  private readonly ses = new SES({ region: this.region });

  public constructor(
    public readonly domainName: string,
    public readonly hostedZoneId: string,
    public readonly region: string,
  ) {}

  public async verifyIdentity(upsert: boolean = false) {
    console.log("Verifying Domain for %s", this.domainName);
    const identityToken = await this.requestIdentityToken();

    console.log("Getting current identity record");
    const currentIdentityRecord = await this.getCurrentIdentityRecord();

    if (currentIdentityRecord) {
      console.log("Found existing TXT record, adding value to verify domain in zone %s", this.hostedZoneId);
    } else {
      console.log("Creating a TXT record for verifying domain into zone %s", this.hostedZoneId);
    }

    const shouldUpsert = currentIdentityRecord || upsert;
    const record = currentIdentityRecord ?? Record.forIdentity(this.domainName, []);
    record.add(identityToken);

    const changeId = await this.changeRecords([
      record.action(shouldUpsert ? "UPSERT" : "CREATE"),
    ]);

    console.log("Waiting for DNS records to commit...");
    await this.waitForRecordChange(changeId);

    console.log("Waiting for domain verification...");
    await this.waitForIdentityVerified();
  }

  public async enableDKIM(upsert: boolean = false) {
    console.log("Enabling DKIM for %s", this.domainName);
    const tokens = await this.requestDKIMTokens();

    console.log("Creating %d DNS records for verifying DKIM into zone %s", tokens.length, this.hostedZoneId);
    const changeId = await this.changeRecords(tokens.map((token) =>
      Record.forDKIM(this.domainName, token).action(upsert ? "UPSERT" : "CREATE"),
    ));

    console.log("Waiting for DNS records to commit...");
    await this.waitForRecordChange(changeId);

    console.log("Waiting for DKIM verification...");
    await this.waitForDKIMVerified();
  }

  public async revokeIdentity() {
    console.log("Getting current verification state for domain %s", this.domainName);
    const identity = await this.describeIdentity();

    console.log("Revoking verification for domain %s", this.domainName);
    await this.ses.deleteIdentity({
      Identity: this.domainName,
    }).promise();

    const identityRecord = await this.getCurrentIdentityRecord();
    if (!identityRecord) {
      console.log("Identity Record does not exist (Maybe drifted?). skipping identity record unprovisioning...");
      return;
    }

    identityRecord.remove(identity.token);

    // If the record contained only the validation value, delete the record.
    // Otherwise just update the record with the value removed.
    if (identityRecord.size === 0) {
      console.log("Deleting DNS Records used for domain verification...");
      await this.changeRecords([
        identityRecord.action("DELETE"),
      ]);
    } else {
      console.log("Updating DNS Records to remove the value used for domain verification...");
      await this.changeRecords([
        identityRecord.action("UPSERT"),
      ]);
    }

  }

  public async disableDKIM() {
    console.log("Getting current DKIM state for domain %s", this.domainName);
    const dkim = await this.describeDKIM();

    console.log("Disabling DKIM for domain %s", this.domainName);
    await this.ses.setIdentityDkimEnabled({
      Identity: this.domainName,
      DkimEnabled: false,
    }).promise();

    console.log("Deleting DNS Records used for DKIM verification...");
    await this.changeRecords(dkim.tokens.map((token) =>
      Record.forDKIM(this.domainName, token).action("DELETE"),
    ));
  }

  private async changeRecords(
    changes: Route53.Change[],
    wait: Wait = DEFAULT_WAIT,
  ) {
    const change = await this.route53.changeResourceRecordSets({
      HostedZoneId: this.hostedZoneId,
      ChangeBatch: {
        Changes: changes,
      },
    }).promise();

    return change.ChangeInfo.Id;
  }

  private async requestIdentityToken() {
    const res = await this.ses.verifyDomainIdentity({
      Domain: this.domainName,
    }).promise();

    return res.VerificationToken;
  }

  private async requestDKIMTokens() {
    const res = await this.ses.verifyDomainDkim({
      Domain: this.domainName,
    }).promise();

    return res.DkimTokens;
  }

  private async describeIdentity() {
    const res = await this.ses.getIdentityVerificationAttributes({
      Identities: [this.domainName],
    }).promise();

    const attr = res.VerificationAttributes[this.domainName];

    if (!attr?.VerificationToken) {
      throw new Error("There are no identity for given domain");
    }

    return {
      status: attr.VerificationStatus,
      token: attr.VerificationToken,
    };
  }

  private async describeDKIM() {
    const res = await this.ses.getIdentityDkimAttributes({
      Identities: [this.domainName],
    }).promise();

    const attr = res.DkimAttributes[this.domainName];
    if (!attr?.DkimEnabled) {
      throw new Error("DKIM is not configured for given domain");
    }

    return {
      status: attr.DkimVerificationStatus,
      tokens: attr.DkimTokens || [],
    };
  }

  private async getCurrentIdentityRecord(): Promise<Record | null> {
    const identity = Record.forIdentity(this.domainName, []);

    const res = await this.route53.listResourceRecordSets({
      HostedZoneId: this.hostedZoneId,
      StartRecordType: identity.type,
      StartRecordName: identity.name,
    }).promise();

    const first = res.ResourceRecordSets[0];
    return first?.Name === identity.name && first?.Type === identity.type
      ? Record.fromResourceRecordSet(first)
      : null;
  }

  private async waitForRecordChange(
    changeId: string,
    wait: Wait = DEFAULT_WAIT,
  ) {
    await this.route53.waitFor("resourceRecordSetsChanged", {
      Id: changeId,
      // Wait up to 5 minutes
      $waiter: wait,
    }).promise();
  }

  private async waitForIdentityVerified(
    wait: Wait = DEFAULT_WAIT,
  ) {
    await this.ses.waitFor("identityExists", {
      Identities: [this.domainName],
      // Wait up to 5 minutes
      $waiter: wait,
    }).promise();
  }

  private async waitForDKIMVerified(
    wait: Wait = DEFAULT_WAIT,
  ) {
    await waitFor(
      () => this.describeDKIM(),
      (state) => state.status === "Success",
      {
        ...wait,
        failureMessage: "Failed to verify DKIM status",
      },
    );
  }
}
// tslint:enable:no-console
