# SES Domain Identity Construct for AWS CDK

[![Build Status](https://github.com/mooyoul/aws-cdk-ses-domain-identity/actions/workflows/main.yml/badge.svg)](https://github.com/mooyoul/aws-cdk-ses-domain-identity/actions)
[![Semantic Release enabled](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com/)
[![MIT license](http://img.shields.io/badge/license-MIT-blue.svg)](http://mooyoul.mit-license.org/)

This package provides Constructs for provisioning & validating SES Domain Identity which can be used in SES.

Inspired from [Automatic DNS-validated certificates using Route 53 of `aws-cdk-lib/aws-certificatemanager` package.](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-certificatemanager-readme.html)

This package automatically validates SES Domain Identity like `aws-cdk-lib/aws-certificatemanager` does.

-----

## About CDK Compatibility

Now `aws-cdk-ses-domain-identity` has been migrated to CDK v2.
The major version of `aws-cdk-ses-domain-identity` matches to compatible CDK version.

- For CDK v1 users: Use 1.x.x version
  - `npm i aws-cdk-ses-domain-identity@1 --save` 
- For CDK v2 users: Use 2.x.x version
  - `npm i aws-cdk-ses-domain-identity@latest --save`
  - or `npm i aws-cdk-ses-domain-identity@2 --save`

## Example

```typescript
import * as route53 from "aws-cdk-lib/aws-route53";
import { DnsValidatedDomainIdentity } from "aws-cdk-ses-domain-identity";

// ... (truncated)
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'example.com',
      privateZone: false,
    });

    const identity = new DnsValidatedDomainIdentity(this, 'DomainIdentity', {
      domainName: 'example.com',
      dkim: true,
      region: 'us-east-1',
      hostedZone,
    });
// ... (truncated)
```

## Constructs

### DnsValidatedDomainIdentity

#### Initializer

```typescript
new DnsValidatedDomainIdentity(scope: Construct, id: string, props?: DnsValidatedDomainIdentityProps)
```

#### Construct Props

```typescript
interface DnsValidatedDomainIdentityProps {
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
```

#### Properties

| Name        | Type   | Description                     |
|-------------|--------|---------------------------------|
| identityArn | string | The ARN of the domain identity. |


## License

[MIT](LICENSE)

See full license on [mooyoul.mit-license.org](http://mooyoul.mit-license.org/)
