import * as sinon from "sinon";
import { sandbox } from "../helper";

import { Verifier } from "../../src/verifier";

import { DeleteCustomResourceHandler } from "../../src/handlers/delete";

describe(DeleteCustomResourceHandler.name, () => {
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

      sandbox.stub(Verifier, "from")
        .returns({
          verifyIdentity: verifyIdentityFake,
          revokeIdentity: revokeIdentityFake,
          enableDKIM: enableDKIMFake,
          disableDKIM: disableDKIMFake,
        } as any);
    });

    it("should revoke identity", async () => {
      const handler = new DeleteCustomResourceHandler({
        StackId: "StackId",
        RequestId: "RequestId",
        PhysicalResourceId: "example.com",
        LogicalResourceId: "LogicalResourceId",
        RequestType: "Delete",
        ResponseURL: "https://s3.amazonaws.com/bucket/key",
        ResourceProperties: {
          DomainName: "example.com",
          HostedZoneId: "HOSTED_ZONE_ID",
          Region: "us-east-1",
          DKIM: false,
          ServiceToken: "SERVICE_TOKEN",
        },
      } as any);

      const res = await handler.consumeEvent();
      expect(res).toEqual({
        physicalResourceId: "example.com",
        data: {},
      });

      sinon.assert.notCalled(verifyIdentityFake);
      sinon.assert.notCalled(enableDKIMFake);
      sinon.assert.calledOnce(revokeIdentityFake);
      sinon.assert.notCalled(disableDKIMFake);
    });

    it("should revoke identity and DKIM", async () => {
      const handler = new DeleteCustomResourceHandler({
        StackId: "StackId",
        RequestId: "RequestId",
        PhysicalResourceId: "example.com",
        LogicalResourceId: "LogicalResourceId",
        RequestType: "Delete",
        ResponseURL: "https://s3.amazonaws.com/bucket/key",
        ResourceProperties: {
          DomainName: "example.com",
          HostedZoneId: "HOSTED_ZONE_ID",
          Region: "us-east-1",
          DKIM: true,
          ServiceToken: "SERVICE_TOKEN",
        },
      } as any);

      await handler.consumeEvent();

      sinon.assert.notCalled(verifyIdentityFake);
      sinon.assert.notCalled(enableDKIMFake);
      sinon.assert.calledOnce(revokeIdentityFake);
      sinon.assert.calledOnce(disableDKIMFake);
    });

    it("should skip if resource creation was failed before", async () => {
      const handler = new DeleteCustomResourceHandler({
        StackId: "StackId",
        RequestId: "RequestId",
        PhysicalResourceId: "Unknown",
        LogicalResourceId: "LogicalResourceId",
        RequestType: "Delete",
        ResponseURL: "https://s3.amazonaws.com/bucket/key",
        ResourceProperties: {
          DomainName: "example.com",
          HostedZoneId: "HOSTED_ZONE_ID",
          Region: "us-east-1",
          DKIM: true,
          ServiceToken: "SERVICE_TOKEN",
        },
      } as any);


      const res = await handler.consumeEvent();
      expect(res).toEqual({
        physicalResourceId: "Unknown",
        data: {},
      });

      sinon.assert.notCalled(verifyIdentityFake);
      sinon.assert.notCalled(enableDKIMFake);
      sinon.assert.notCalled(revokeIdentityFake);
      sinon.assert.notCalled(disableDKIMFake);
    });
  });
});
