import { Change, ResourceRecord } from "aws-sdk/clients/route53";

const DEFAULT_VERIFICATION_RECORD_TTL = 1800; // 30 minutes

export class Record {
  public static forIdentity(domainName: string, records: ResourceRecord[]) {
    return new this(`_amazonses.${domainName}`, "TXT", records);
  }

  public static forDKIM(domainName: string, token: string) {
    return new this(`${token}._domainkey.${domainName}`, "CNAME", [{Value: `${token}.dkim.amazonses.com`}]);
  }

  public constructor(
    public readonly name: string,
    public readonly type: "CNAME" | "TXT",
    public readonly records: ResourceRecord[],
    public readonly ttl: number = DEFAULT_VERIFICATION_RECORD_TTL,
  ) {}

  public action(type: "CREATE" | "UPSERT" | "DELETE"): Change {
    return {
      Action: type,
      ResourceRecordSet: {
        Name: this.name,
        Type: this.type,
        ResourceRecords: this.records,
        TTL: this.ttl,
      },
    };
  }
}
