import { Record } from "../src/record";

describe(Record.name, () => {
  describe("static #forIdentity", () => {
    it("should return a new instance of Record", () => {
      const value = Record.forIdentity("example.com", ["token"]);
      expect(value).toBeInstanceOf(Record);
      expect(value).toMatchObject({
        name: "_amazonses.example.com.",
        type: "TXT",
        values: new Set(["token"]),
        ttl: 1800,
      });
    });
  });

  describe("static #forDKIM", () => {
    it("should return a new instance of Record", () => {
      const value = Record.forDKIM("example.com", "token");
      expect(value).toBeInstanceOf(Record);
      expect(value).toMatchObject({
        name: "token._domainkey.example.com.",
        type: "CNAME",
        values: new Set(["token.dkim.amazonses.com"]),
        ttl: 1800,
      });
    });
  });

  describe("#action", () => {
    let record: Record;

    beforeEach(() => {
      record = new Record(
        "example.com",
        "CNAME",
        new Set(["target.example.com"]),
        1234,
      );
    });

    it("should return Route53 Change for CREATE type", () => {
      expect(record.action("CREATE")).toEqual({
        Action: "CREATE",
        ResourceRecordSet: {
          Name: "example.com",
          Type: "CNAME",
          ResourceRecords: [{ Value: "target.example.com" }],
          TTL: 1234,
        },
      });
    });

    it("should return Route53 Change for UPSERT type", () => {
      expect(record.action("UPSERT")).toEqual({
        Action: "UPSERT",
        ResourceRecordSet: {
          Name: "example.com",
          Type: "CNAME",
          ResourceRecords: [{ Value: "target.example.com" }],
          TTL: 1234,
        },
      });
    });

    it("should return Route53 Change for DELETE type", () => {
      expect(record.action("DELETE")).toEqual({
        Action: "DELETE",
        ResourceRecordSet: {
          Name: "example.com",
          Type: "CNAME",
          TTL: 1234,
          ResourceRecords: [
            { Value: "target.example.com" },
          ],
        },
      });
    });
  });
});
