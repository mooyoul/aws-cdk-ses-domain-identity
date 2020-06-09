import * as sinon from "sinon";
import { sandbox } from "../helper";

import { Verifier } from "../../src/verifier";

import { CreateCustomResourceHandler } from "../../src/handlers/create";

describe(CreateCustomResourceHandler.name, () => {
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
        .returns({
          domainName: "example.com",
          verifyIdentity: verifyIdentityFake,
          revokeIdentity: revokeIdentityFake,
          enableDKIM: enableDKIMFake,
          disableDKIM: disableDKIMFake,
        });
    });

    it("should verify identity", async () => {
      const handler = new CreateCustomResourceHandler({
        StackId: "StackId",
        RequestId: "RequestId",
        LogicalResourceId: "LogicalResourceId",
        RequestType: "Create",
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

      sinon.assert.calledOnce(verifyIdentityFake);
      sinon.assert.notCalled(enableDKIMFake);
      sinon.assert.notCalled(revokeIdentityFake);
      sinon.assert.notCalled(disableDKIMFake);
    });

    it("should verify identity", async () => {
      const handler = new CreateCustomResourceHandler({
        StackId: "StackId",
        RequestId: "RequestId",
        LogicalResourceId: "LogicalResourceId",
        RequestType: "Create",
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
        physicalResourceId: "example.com",
        data: {},
      });

      sinon.assert.calledOnce(verifyIdentityFake);
      sinon.assert.calledOnce(enableDKIMFake);
      sinon.assert.notCalled(revokeIdentityFake);
      sinon.assert.notCalled(disableDKIMFake);
    });
  });
});
