import * as sinon from "sinon";
import { sandbox } from "../helper";

import { Verifier } from "../../src/verifier";

import { UpdateCustomResourceHandler } from "../../src/handlers/update";

describe(UpdateCustomResourceHandler.name, () => {
  describe("#consumeEvent", () => {
    let verifyIdentityFake: sinon.SinonSpy;
    let revokeIdentityFake: sinon.SinonSpy;
    let enableDKIMFake: sinon.SinonSpy;
    let disableDKIMFake: sinon.SinonSpy;

    beforeEach(() => {
      verifyIdentityFake = sinon.fake.resolves(undefined);
      revokeIdentityFake = sinon.fake.resolves(undefined);
      enableDKIMFake = sinon.fake.resolves(undefined);
      disableDKIMFake = sinon.fake.resolves(undefined);

      sandbox.mock(Verifier)
        .expects("from")
        .atLeast(1)
        .atMost(2)
        .callsFake((props) => ({
          domainName: props.DomainName,
          verifyIdentity: verifyIdentityFake,
          revokeIdentity: revokeIdentityFake,
          enableDKIM: enableDKIMFake,
          disableDKIM: disableDKIMFake,
        }));
    });

    it("should re-verify identity on DomainName change", async () => {
      const handler = new UpdateCustomResourceHandler({
        StackId: "StackId",
        RequestId: "RequestId",
        PhysicalResourceId: "example.com",
        LogicalResourceId: "LogicalResourceId",
        RequestType: "Update",
        ResponseURL: "https://s3.amazonaws.com/bucket/key",
        ResourceProperties: {
          DomainName: "example2.com",
          HostedZoneId: "HOSTED_ZONE_ID",
          Region: "us-east-1",
          DKIM: false,
        },
        OldResourceProperties: {
          DomainName: "example.com",
          HostedZoneId: "HOSTED_ZONE_ID",
          Region: "us-east-1",
          DKIM: false,
        },
      } as any);

      const res = await handler.consumeEvent();
      expect(res).toEqual({
        physicalResourceId: "example2.com",
        data: {},
      });

      sinon.assert.calledOnce(verifyIdentityFake);
      sinon.assert.notCalled(enableDKIMFake);
      sinon.assert.calledOnce(revokeIdentityFake);
      sinon.assert.notCalled(disableDKIMFake);
    });

    it("should re-verify identity on HostedZone change", async () => {
      const handler = new UpdateCustomResourceHandler({
        StackId: "StackId",
        RequestId: "RequestId",
        PhysicalResourceId: "example.com",
        LogicalResourceId: "LogicalResourceId",
        RequestType: "Update",
        ResponseURL: "https://s3.amazonaws.com/bucket/key",
        ResourceProperties: {
          DomainName: "example.com",
          HostedZoneId: "HOSTED_ZONE_ID_2",
          Region: "us-east-1",
          DKIM: false,
        },
        OldResourceProperties: {
          DomainName: "example.com",
          HostedZoneId: "HOSTED_ZONE_ID",
          Region: "us-east-1",
          DKIM: false,
        },
      } as any);

      const res = await handler.consumeEvent();
      expect(res).toEqual({
        physicalResourceId: "example.com",
        data: {},
      });

      sinon.assert.calledOnce(verifyIdentityFake);
      sinon.assert.notCalled(enableDKIMFake);
      sinon.assert.calledOnce(revokeIdentityFake);
      sinon.assert.notCalled(disableDKIMFake);
    });

    it("should enable DKIM if enabled", async () => {
      const handler = new UpdateCustomResourceHandler({
        StackId: "StackId",
        RequestId: "RequestId",
        PhysicalResourceId: "example.com",
        LogicalResourceId: "LogicalResourceId",
        RequestType: "Update",
        ResponseURL: "https://s3.amazonaws.com/bucket/key",
        ResourceProperties: {
          DomainName: "example.com",
          HostedZoneId: "HOSTED_ZONE_ID",
          Region: "us-east-1",
          DKIM: true,
        },
        OldResourceProperties: {
          DomainName: "example.com",
          HostedZoneId: "HOSTED_ZONE_ID",
          Region: "us-east-1",
          DKIM: false,
        },
      } as any);

      const res = await handler.consumeEvent();
      expect(res).toEqual({
        physicalResourceId: "example.com",
        data: {},
      });

      sinon.assert.notCalled(verifyIdentityFake);
      sinon.assert.calledOnce(enableDKIMFake);
      sinon.assert.notCalled(revokeIdentityFake);
      sinon.assert.notCalled(disableDKIMFake);
    });

    it("should disable DKIM if disabled", async () => {
      const handler = new UpdateCustomResourceHandler({
        StackId: "StackId",
        RequestId: "RequestId",
        PhysicalResourceId: "example.com",

        LogicalResourceId: "LogicalResourceId",
        RequestType: "Update",
        ResponseURL: "https://s3.amazonaws.com/bucket/key",
        ResourceProperties: {
          DomainName: "example.com",
          HostedZoneId: "HOSTED_ZONE_ID",
          Region: "us-east-1",
          DKIM: false,
        },
        OldResourceProperties: {
          DomainName: "example.com",
          HostedZoneId: "HOSTED_ZONE_ID",
          Region: "us-east-1",
          DKIM: true,
        },
      } as any);

      const res = await handler.consumeEvent();
      expect(res).toEqual({
        physicalResourceId: "example.com",
        data: {},
      });

      sinon.assert.notCalled(verifyIdentityFake);
      sinon.assert.notCalled(enableDKIMFake);
      sinon.assert.notCalled(revokeIdentityFake);
      sinon.assert.calledOnce(disableDKIMFake);
    });

    it("should update everything", async () => {
      const handler = new UpdateCustomResourceHandler({
        StackId: "StackId",
        RequestId: "RequestId",
        LogicalResourceId: "LogicalResourceId",
        RequestType: "Update",
        ResponseURL: "https://s3.amazonaws.com/bucket/key",
        ResourceProperties: {
          DomainName: "example2.com",
          HostedZoneId: "HOSTED_ZONE_ID2",
          Region: "us-east-1",
          DKIM: true,
        },
        OldResourceProperties: {
          DomainName: "example.com",
          HostedZoneId: "HOSTED_ZONE_ID",
          Region: "us-east-1",
          DKIM: false,
        },
      } as any);

      const res = await handler.consumeEvent();
      expect(res).toEqual({
        physicalResourceId: "example2.com",
        data: {},
      });

      sinon.assert.calledOnce(verifyIdentityFake);
      sinon.assert.calledOnce(enableDKIMFake);
      sinon.assert.calledOnce(revokeIdentityFake);
      sinon.assert.notCalled(disableDKIMFake);
    });
  });
});
