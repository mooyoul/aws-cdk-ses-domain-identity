import * as sinon from "sinon";

import * as Route53 from "aws-sdk/clients/route53";
import * as SES from "aws-sdk/clients/ses";
import { sandbox, stubAWSAPI } from "./helper";

import { Verifier } from "../src/verifier";

describe(Verifier.name, () => {
  describe("static #from", () => {
    it("should return instance of Verifier", () => {
      const value = Verifier.from({
        DomainName: "example.com",
        HostedZoneId: "FAKE",
        Region: "us-east-1",
      } as any);

      expect(value).toBeInstanceOf(Verifier);
      expect(value).toMatchObject({
        domainName: "example.com",
        hostedZoneId: "FAKE",
        region: "us-east-1",
      });
    });
  });

  let verifier: Verifier;
  beforeEach(() => {
    verifier = new Verifier("example.com", "HOSTED_ZONE_ID", "us-east-1");
  });

  describe("#verifyIdentity", () => {
    let verifyDomainIdentityFake: sinon.SinonSpy;
    let changeResourceRecordSetsFake: sinon.SinonSpy;
    let listResourceRecordSetsFake: sinon.SinonSpy;
    let waitForResourceRecordSetsChangedFake: sinon.SinonSpy;
    let waitForIdentityExistsFake: sinon.SinonSpy;

    beforeEach(() => {
      verifyDomainIdentityFake = sinon.fake.resolves({
        VerificationToken: "token",
      });

      changeResourceRecordSetsFake = sinon.fake.resolves({
        ChangeInfo: {
          Id: "fake-id",
        },
      });

      listResourceRecordSetsFake = sinon.fake.resolves({
        ResourceRecordSets: [], // No records found
        IsTruncated: false,
        MaxItems: "100",
      });

      waitForResourceRecordSetsChangedFake = sinon.fake.resolves({
        ChangeInfo: {
          Id: "fake-id",
          Status: "INSYNC",
        },
      });

      waitForIdentityExistsFake = sinon.fake.resolves({
        VerificationAttributes: {
          ["example.com"]: {
            VerificationStatus: "Success",
            VerificationToken: "token",
          },
        },
      });

      stubAWSAPI(SES, "verifyDomainIdentity", verifyDomainIdentityFake);
      stubAWSAPI(Route53, "changeResourceRecordSets", changeResourceRecordSetsFake);
      stubAWSAPI(Route53, "listResourceRecordSets", listResourceRecordSetsFake);
      stubAWSAPI(Route53, "waitFor", waitForResourceRecordSetsChangedFake);
      stubAWSAPI(SES, "waitFor", waitForIdentityExistsFake);
    });

    it("should verify identity", async () => {
      await verifier.verifyIdentity();

      sinon.assert.calledOnce(verifyDomainIdentityFake);
      sinon.assert.calledWith(verifyDomainIdentityFake, sinon.match({
        Domain: "example.com",
      }));


      sinon.assert.calledOnce(changeResourceRecordSetsFake);
      sinon.assert.calledWith(changeResourceRecordSetsFake, sinon.match({
        HostedZoneId: "HOSTED_ZONE_ID",
        ChangeBatch: {
          Changes: [{
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "_amazonses.example.com.",
              Type: "TXT",
              ResourceRecords: [{
                Value: `"token"`,
              }],
              TTL: 1800,
            },
          }],
        },
      }));

      sinon.assert.calledOnce(waitForResourceRecordSetsChangedFake);
      sinon.assert.calledWith(waitForResourceRecordSetsChangedFake, "resourceRecordSetsChanged", sinon.match({
        Id: "fake-id",
      }));

      sinon.assert.calledOnce(waitForIdentityExistsFake);
      sinon.assert.calledWith(waitForIdentityExistsFake, "identityExists", sinon.match({
        Identities: ["example.com"],
      }));
    });

    it("should upsert Route53 Record if upsert = true", async () => {
      await verifier.verifyIdentity(true);

      sinon.assert.calledOnce(changeResourceRecordSetsFake);
      sinon.assert.calledWith(changeResourceRecordSetsFake, sinon.match({
        ChangeBatch: {
          Changes: [{
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: "_amazonses.example.com.",
              Type: "TXT",
              ResourceRecords: [{
                Value: `"token"`,
              }],
              TTL: 1800,
            },
          }],
        },
      }));
    });
  });

  describe("#revokeIdentity", () => {
    let getIdentityVerificationAttributesFake: sinon.SinonStub;
    let deleteIdentityFake: sinon.SinonSpy;
    let changeResourceRecordSetsFake: sinon.SinonSpy;
    let listResourceRecordSetsFake: sinon.SinonSpy;

    beforeEach(() => {
      getIdentityVerificationAttributesFake = sinon.stub();
      getIdentityVerificationAttributesFake.resolves({
        VerificationAttributes: {
          ["example.com"]: {
            VerificationStatus: "Success",
            VerificationToken: "token",
          },
        },
      });

      deleteIdentityFake = sinon.fake.resolves({});

      changeResourceRecordSetsFake = sinon.fake.resolves({
        ChangeInfo: {
          Id: "fake-id",
        },
      });

      listResourceRecordSetsFake = sinon.fake.resolves({
        ResourceRecordSets: [{
          Name: "_amazonses.example.com.",
          Type: "TXT",
          ResourceRecords: [{
            Value: "\"token\"",
          }],
        }],
        IsTruncated: false,
        MaxItems: "100",
      });

      stubAWSAPI(SES, "getIdentityVerificationAttributes", getIdentityVerificationAttributesFake);
      stubAWSAPI(SES, "deleteIdentity", deleteIdentityFake);
      stubAWSAPI(Route53, "changeResourceRecordSets", changeResourceRecordSetsFake);
      stubAWSAPI(Route53, "listResourceRecordSets", listResourceRecordSetsFake);
    });

    it("should delete identity and delete route53 record", async () => {
      await verifier.revokeIdentity();

      sinon.assert.calledOnce(getIdentityVerificationAttributesFake);
      sinon.assert.calledWith(getIdentityVerificationAttributesFake, sinon.match({
        Identities: ["example.com"],
      }));

      sinon.assert.calledOnce(deleteIdentityFake);
      sinon.assert.calledWith(deleteIdentityFake, sinon.match({
        Identity: "example.com",
      }));

      sinon.assert.calledOnce(changeResourceRecordSetsFake);
      sinon.assert.calledWith(changeResourceRecordSetsFake, sinon.match({
        HostedZoneId: "HOSTED_ZONE_ID",
        ChangeBatch: {
          Changes: [{
            Action: "DELETE",
            ResourceRecordSet: {
              Name: "_amazonses.example.com.",
              Type: "TXT",
              TTL: 1800,
              ResourceRecords: [],
            },
          }],
        },
      }));
    });

    it("should throw Error if given domain hasn't been verified", async () => {
      getIdentityVerificationAttributesFake.onFirstCall().resolves({
        VerificationAttributes: {},
      });

      await expect(() => verifier.revokeIdentity()).rejects.toThrow("There are no identity for given domain");
    });
  });

  describe("#enableDKIM", () => {
    let verifyDomainDkimFake: sinon.SinonSpy;
    let changeResourceRecordSetsFake: sinon.SinonSpy;
    let waitForResourceRecordSetsChangedFake: sinon.SinonSpy;
    let getIdentityDkimAttributesFake: sinon.SinonStub;

    beforeEach(() => {
      verifyDomainDkimFake = sinon.fake.resolves({
        DkimTokens: ["foo", "bar", "baz"],
      });

      changeResourceRecordSetsFake = sinon.fake.resolves({
        ChangeInfo: {
          Id: "fake-id",
        },
      });

      waitForResourceRecordSetsChangedFake = sinon.fake.resolves({
        ChangeInfo: {
          Id: "fake-id",
          Status: "INSYNC",
        },
      });

      getIdentityDkimAttributesFake = sinon.stub();
      getIdentityDkimAttributesFake.resolves({
        DkimAttributes: {
          ["example.com"]: {
            DkimEnabled: true,
            DkimVerificationStatus: "Success",
            DkimTokens: ["foo", "bar", "baz"],
          },
        },
      });

      stubAWSAPI(SES, "verifyDomainDkim", verifyDomainDkimFake);
      stubAWSAPI(Route53, "changeResourceRecordSets", changeResourceRecordSetsFake);
      stubAWSAPI(Route53, "waitFor", waitForResourceRecordSetsChangedFake);
      stubAWSAPI(SES, "getIdentityDkimAttributes", getIdentityDkimAttributesFake);
    });

    it("should enable DKIM and create Route53 Records", async () => {
      await verifier.enableDKIM();

      sinon.assert.calledOnce(verifyDomainDkimFake);
      sinon.assert.calledWith(verifyDomainDkimFake, sinon.match({
        Domain: "example.com",
      }));


      sinon.assert.calledOnce(changeResourceRecordSetsFake);
      sinon.assert.calledWith(changeResourceRecordSetsFake, sinon.match({
        HostedZoneId: "HOSTED_ZONE_ID",
        ChangeBatch: {
          Changes: [{
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "foo._domainkey.example.com.",
              Type: "CNAME",
              ResourceRecords: [{
                Value: "foo.dkim.amazonses.com",
              }],
              TTL: 1800,
            },
          }, {
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "bar._domainkey.example.com.",
              Type: "CNAME",
              ResourceRecords: [{
                Value: "bar.dkim.amazonses.com",
              }],
              TTL: 1800,
            },
          }, {
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "baz._domainkey.example.com.",
              Type: "CNAME",
              ResourceRecords: [{
                Value: "baz.dkim.amazonses.com",
              }],
              TTL: 1800,
            },
          }],
        },
      }));

      sinon.assert.calledOnce(waitForResourceRecordSetsChangedFake);
      sinon.assert.calledWith(waitForResourceRecordSetsChangedFake, "resourceRecordSetsChanged", sinon.match({
        Id: "fake-id",
      }));

      sinon.assert.calledOnce(getIdentityDkimAttributesFake);
      sinon.assert.calledWith(getIdentityDkimAttributesFake, sinon.match({
        Identities: ["example.com"],
      }));
    });

    it("should upsert Route53 Records if upsert = true", async () => {
      await verifier.enableDKIM(true);

      sinon.assert.calledOnce(changeResourceRecordSetsFake);
      sinon.assert.calledWith(changeResourceRecordSetsFake, sinon.match({
        ChangeBatch: {
          Changes: [{
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: "foo._domainkey.example.com.",
              Type: "CNAME",
              ResourceRecords: [{
                Value: "foo.dkim.amazonses.com",
              }],
              TTL: 1800,
            },
          }, {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: "bar._domainkey.example.com.",
              Type: "CNAME",
              ResourceRecords: [{
                Value: "bar.dkim.amazonses.com",
              }],
              TTL: 1800,
            },
          }, {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: "baz._domainkey.example.com.",
              Type: "CNAME",
              ResourceRecords: [{
                Value: "baz.dkim.amazonses.com",
              }],
              TTL: 1800,
            },
          }],
        },
      }));
    });

    it("should throw Error if given domain hasn't been verified", async () => {
      getIdentityDkimAttributesFake.onFirstCall().resolves({
        DkimAttributes: {},
      });

      await expect(() => verifier.disableDKIM()).rejects.toThrow("DKIM is not configured for given domain");
    });
  });

  describe("#disableDKIM", () => {
    let getIdentityDkimAttributesFake: sinon.SinonStub;
    let setIdentityDkimEnabledFake: sinon.SinonSpy;
    let changeResourceRecordSetsFake: sinon.SinonSpy;

    beforeEach(() => {
      getIdentityDkimAttributesFake = sinon.stub();
      getIdentityDkimAttributesFake.resolves({
        DkimAttributes: {
          ["example.com"]: {
            DkimEnabled: true,
            DkimVerificationStatus: "Success",
            DkimTokens: ["foo", "bar", "baz"],
          },
        },
      });

      setIdentityDkimEnabledFake = sinon.fake.resolves({});
      changeResourceRecordSetsFake = sinon.fake.resolves({
        ChangeInfo: {
          Id: "fake-id",
        },
      });

      stubAWSAPI(SES, "getIdentityDkimAttributes", getIdentityDkimAttributesFake);
      stubAWSAPI(SES, "setIdentityDkimEnabled", setIdentityDkimEnabledFake);
      stubAWSAPI(Route53, "changeResourceRecordSets", changeResourceRecordSetsFake);
    });

    it("should disable DKIM and delete Route53 Records", async () => {
      await verifier.disableDKIM();

      sinon.assert.calledOnce(getIdentityDkimAttributesFake);
      sinon.assert.calledWith(getIdentityDkimAttributesFake, sinon.match({
        Identities: ["example.com"],
      }));

      sinon.assert.calledOnce(setIdentityDkimEnabledFake);
      sinon.assert.calledWith(setIdentityDkimEnabledFake, sinon.match({
        Identity: "example.com",
        DkimEnabled: false,
      }));

      sinon.assert.calledOnce(changeResourceRecordSetsFake);
      sinon.assert.calledWith(changeResourceRecordSetsFake, sinon.match({
        HostedZoneId: "HOSTED_ZONE_ID",
        ChangeBatch: {
          Changes: [{
            Action: "DELETE",
            ResourceRecordSet: {
              Name: "foo._domainkey.example.com.",
              Type: "CNAME",
              TTL: 1800,
              ResourceRecords: [
                { Value: "foo.dkim.amazonses.com"},
              ],
            },
          }, {
            Action: "DELETE",
            ResourceRecordSet: {
              Name: "bar._domainkey.example.com.",
              Type: "CNAME",
              TTL: 1800,
              ResourceRecords: [
                { Value: "bar.dkim.amazonses.com"},
              ],
            },
          }, {
            Action: "DELETE",
            ResourceRecordSet: {
              Name: "baz._domainkey.example.com.",
              Type: "CNAME",
              TTL: 1800,
              ResourceRecords: [
                { Value: "baz.dkim.amazonses.com"},
              ],
            },
          }],
        },
      }));
    });

    it("should throw Error if given domain hasn't been verified", async () => {
      getIdentityDkimAttributesFake.onFirstCall().resolves({
        DkimAttributes: {},
      });

      await expect(() => verifier.disableDKIM()).rejects.toThrow("DKIM is not configured for given domain");
    });
  });
});
