import { expect as expectCDK, haveResource, SynthUtils } from "@aws-cdk/assert";
import * as iam from "@aws-cdk/aws-iam";
import { HostedZone, PublicHostedZone } from "@aws-cdk/aws-route53";
import { App, Stack, Token } from "@aws-cdk/core";

import { DnsValidatedDomainIdentity } from "../src/dns-validated-domain-identity";

describe(DnsValidatedDomainIdentity.name, () => {
  it("creates CloudFormation Custom Resource", () => {
    const stack = new Stack();

    const exampleDotComZone = new PublicHostedZone(stack, "ExampleDotCom", {
      zoneName: "example.com",
    });

    // tslint:disable-next-line:no-unused-expression
    new DnsValidatedDomainIdentity(stack, "DomainIdentity", {
      domainName: "test.example.com",
      hostedZone: exampleDotComZone,
    });

    expectCDK(stack).to(haveResource("AWS::CloudFormation::CustomResource", {
      DomainName: "test.example.com",
      ServiceToken: {
        "Fn::GetAtt": [
          "DomainIdentityDomainIdentityRequestorFunction700A5CBC",
          "Arn",
        ],
      },
      HostedZoneId: {
        Ref: "ExampleDotCom4D1B83AA",
      },
    }));
    expectCDK(stack).to(haveResource("AWS::Lambda::Function", {
      Handler: "index.identityRequestHandler",
      Runtime: "nodejs12.x",
      MemorySize: 128,
      Timeout: 900,
    }));
    expectCDK(stack).to(haveResource("AWS::IAM::Policy", {
      PolicyName: "DomainIdentityDomainIdentityRequestorFunctionServiceRoleDefaultPolicy9D23D5BE",
      Roles: [
        {
          Ref: "DomainIdentityDomainIdentityRequestorFunctionServiceRoleD8F10EBD",
        },
      ],
      PolicyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: [
              "ses:GetIdentityMailFromDomainAttributes",
              "ses:GetIdentityDkimAttributes",
              "ses:VerifyDomainIdentity",
              "ses:VerifyDomainDkim",
              "ses:ListIdentities",
              "ses:DeleteIdentity",
            ],
            Effect: "Allow",
            Resource: "*",
          },
          {
            Action: "route53:GetChange",
            Effect: "Allow",
            Resource: "*",
          },
          {
            Action: "route53:changeResourceRecordSets",
            Effect: "Allow",
            Resource: {
              "Fn::Join": [
                "",
                [
                  "arn:",
                  { Ref: "AWS::Partition" },
                  ":route53:::hostedzone/",
                  { Ref: "ExampleDotCom4D1B83AA" },
                ],
              ],
            },
          },
        ],
      },
    }));
  });

  it("adds validation error on domain mismatch", () => {
    const stack = new Stack();

    const helloDotComZone = new PublicHostedZone(stack, "HelloDotCom", {
      zoneName: "hello.com",
    });

    // tslint:disable-next-line:no-unused-expression
    new DnsValidatedDomainIdentity(stack, "DomainIdentity", {
      domainName: "example.com",
      hostedZone: helloDotComZone,
    });

    expect(() => SynthUtils.synthesize(stack))
      .toThrow(/DNS zone hello.com is not authoritative for SES identity domain name example.com/);
  });

  it("does not try to validate unresolved tokens", () => {
    const stack = new Stack();

    const helloDotComZone = new PublicHostedZone(stack, "HelloDotCom", {
      zoneName: Token.asString("hello.com"),
    });

    // tslint:disable-next-line:no-unused-expression
    new DnsValidatedDomainIdentity(stack, "DomainIdentity", {
      domainName: "hello.com",
      hostedZone: helloDotComZone,
    });

    expect(() => SynthUtils.synthesize(stack)).not.toThrow();
  });

  it("works with imported zone", () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, "Stack", {
      env: { account: "12345678", region: "us-blue-5" },
    });
    const imported = HostedZone.fromLookup(stack, "ExampleDotCom", {
      domainName: "mydomain.com",
    });

    // WHEN
    // tslint:disable-next-line:no-unused-expression
    new DnsValidatedDomainIdentity(stack, "DomainIdentity", {
      domainName: "mydomain.com",
      hostedZone: imported,
    });

    // THEN
    expectCDK(stack).to(haveResource("AWS::CloudFormation::CustomResource", {
      ServiceToken: {
        "Fn::GetAtt": [
          "DomainIdentityDomainIdentityRequestorFunction700A5CBC",
          "Arn",
        ],
      },
      DomainName: "mydomain.com",
      HostedZoneId: "DUMMY",
    }));
  });

  it("works with imported role", () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, "Stack", {
      env: { account: "12345678", region: "us-blue-5" },
    });
    const helloDotComZone = new PublicHostedZone(stack, "HelloDotCom", {
      zoneName: "hello.com",
    });
    const role = iam.Role.fromRoleArn(stack, "Role", "arn:aws:iam::account-id:role/role-name");

    // WHEN
    // tslint:disable-next-line:no-unused-expression
    new DnsValidatedDomainIdentity(stack, "DomainIdentity", {
      domainName: "hello.com",
      hostedZone: helloDotComZone,
      customResourceRole: role,
    });

    // THEN
    expectCDK(stack).to(haveResource("AWS::Lambda::Function", {
      Role: "arn:aws:iam::account-id:role/role-name",
    }));
  });
});
