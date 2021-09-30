import type { Change, ResourceRecord, ResourceRecordSet } from "aws-sdk/clients/route53";

const DEFAULT_VERIFICATION_RECORD_TTL = 1800; // 30 minutes

export class Record {
  public static forIdentity(domainName: string, records: string[]) {
    return new this(`_amazonses.${domainName}.`, "TXT", new Set(records));
  }

  public static forDKIM(domainName: string, token: string) {
    return new this(
      `${token}._domainkey.${domainName}.`,
      "CNAME",
      new Set([`${token}.dkim.amazonses.com`]),
    );
  }

  public static fromResourceRecordSet(resource: ResourceRecordSet) {
    switch (resource.Type) {
      case "CNAME":
        return new this(
          resource.Name,
          resource.Type,
          new Set(resource.ResourceRecords!.map((record) => record.Value)),
        );
      case "TXT":
        return new this(
          resource.Name,
          resource.Type,
          new Set(resource.ResourceRecords!.map((record) => JSON.parse(record.Value))),
        );
      default:
        throw new Error("Unsupported ResourceRecord Type");
    }
  }

  public constructor(
    public readonly name: string,
    public readonly type: "CNAME" | "TXT",
    public readonly values: Set<string>,
    public readonly ttl: number = DEFAULT_VERIFICATION_RECORD_TTL,
  ) {}

  public get size() {
    return this.values.size;
  }

  public has(value: string) {
    return this.values.has(value);
  }

  public add(value: string) {
    this.values.add(value);
  }

  public remove(value: string) {
    this.values.delete(value);
  }

  public action(type: "CREATE" | "UPSERT" | "DELETE"): Change {
    return {
      Action: type,
      ResourceRecordSet: {
        Name: this.name,
        Type: this.type,
        ResourceRecords: this.serialize(),
        TTL: this.ttl,
      },
    };
  }

  private serialize(): ResourceRecord[] {
    switch (this.type) {
      case "CNAME":
        return Array.from(this.values).map((value) => ({ Value: value }));
      case "TXT":
        return Array.from(this.values).map((value) => ({ Value: JSON.stringify(value) }));
    }
  }
}
