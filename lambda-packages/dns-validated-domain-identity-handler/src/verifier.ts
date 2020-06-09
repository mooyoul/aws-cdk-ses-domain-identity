import * as Route53 from "aws-sdk/clients/route53";
import * as SES from "aws-sdk/clients/ses";
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

    console.log("Creating a TXT record for verifying domain into zone %s", this.hostedZoneId);
    const changeId = await this.changeRecords([
      Record.forIdentity(this.domainName, identityToken).action(upsert ? "UPSERT" : "CREATE"),
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

    console.log("Deleting DNS Records used for domain verification...");
    await this.changeRecords([
      Record.forIdentity(this.domainName, identity.token!).action("DELETE"),
    ]);
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
