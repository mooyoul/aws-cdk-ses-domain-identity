import { CustomResource, Duration, Resource, Stack, Token } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import * as path from "path";

/**
 * Properties to create a DNS-validated Domain Identity of AWS SES Service.
 *
 * @experimental
 */
export interface DnsValidatedDomainIdentityProps {
  /**
   * Fully-qualified domain name to request a domain identity for.
   */
  readonly domainName: string;

  /**
   * Whether to configure DKIM on domain identity.
   * @default true
   */
  readonly dkim?: boolean;

  /**
   * Route 53 Hosted Zone used to perform DNS validation of the request.  The zone
   * must be authoritative for the domain name specified in the Domain Identity Request.
   */
  readonly hostedZone: route53.IHostedZone;
  /**
   * AWS region that will validate the domain identity. This is needed especially
   * for domain identity used for AWS SES services, which require the region
   * to be one of SES supported regions.
   *
   * @default the region the stack is deployed in.
   */
  readonly region?: string;

  /**
   * Role to use for the custom resource that creates the validated domain identity
   *
   * @default - A new role will be created
   */
  readonly customResourceRole?: iam.IRole;
}

/**
 * A domain identity managed by AWS SES.  Will be automatically
 * validated using DNS validation against the specified Route 53 hosted zone.
 */
export class DnsValidatedDomainIdentity extends Resource {
  public readonly domainName: string;
  public readonly dkim: boolean;
  public readonly identityArn: string;

  private readonly hostedZoneId: string;
  private readonly normalizedZoneName: string;

  public constructor(scope: Construct, id: string, props: DnsValidatedDomainIdentityProps) {
    super(scope, id);

    const stack = Stack.of(this);

    const region = props.region ?? stack.region;
    const accountId = stack.account;

    this.domainName = props.domainName;
    this.dkim = props.dkim ?? false;
    this.identityArn = `arn:aws:ses:${region}:${accountId}:identity/${this.domainName}`;
    this.normalizedZoneName = props.hostedZone.zoneName;
    // Remove trailing `.` from zone name
    if (this.normalizedZoneName.endsWith(".")) {
      this.normalizedZoneName = this.normalizedZoneName.substring(0, this.normalizedZoneName.length - 1);
    }

    // Remove any `/hostedzone/` prefix from the Hosted Zone ID
    this.hostedZoneId = props.hostedZone.hostedZoneId.replace(/^\/hostedzone\//, "");

    const requestorFunction = new lambda.Function(this, "DomainIdentityRequestorFunction", {
      code: lambda.Code.fromAsset(path.resolve(__dirname, "..", "lambda-packages", "dns-validated-domain-identity-handler", "dist")),
      handler: "index.identityRequestHandler",
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: Duration.minutes(15),
      role: props.customResourceRole,
    });
    requestorFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "ses:GetIdentityVerificationAttributes",
        "ses:GetIdentityDkimAttributes",
        "ses:SetIdentityDkimEnabled",
        "ses:VerifyDomainIdentity",
        "ses:VerifyDomainDkim",
        "ses:ListIdentities",
        "ses:DeleteIdentity",
      ],
      resources: ["*"],
    }));
    requestorFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ["route53:GetChange"],
      resources: ["*"],
    }));
    requestorFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
          "route53:changeResourceRecordSets",
          "route53:ListResourceRecordSets",
      ],
      resources: [`arn:${Stack.of(requestorFunction).partition}:route53:::hostedzone/${this.hostedZoneId}`],
    }));

    const identity = new CustomResource(this, "IdentityRequestorResource", {
      serviceToken: requestorFunction.functionArn,
      properties: {
        DomainName: this.domainName,
        HostedZoneId: this.hostedZoneId,
        Region: region,
        DKIM: props.dkim,
      },
    });

    this.node.addValidation({
      validate: (): string[] => {
        const errors: string[] = [];
        // Ensure the zone name is a parent zone of the certificate domain name
        if (!Token.isUnresolved(this.normalizedZoneName) &&
          this.domainName !== this.normalizedZoneName &&
          !this.domainName.endsWith("." + this.normalizedZoneName)) {
          errors.push(`DNS zone ${this.normalizedZoneName} is not authoritative for SES identity domain name ${this.domainName}`);
        }

        return errors;
      },
    });
  }
}
