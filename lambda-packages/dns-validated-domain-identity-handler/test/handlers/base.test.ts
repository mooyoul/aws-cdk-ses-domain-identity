import { CloudFormationCustomResourceEvent } from "aws-lambda";
import * as nock from "nock";

import { sandbox } from "../helper";

import { CustomResourceHandler } from "../../src/handlers/base";

class SuccessfulCustomResourceHandler extends CustomResourceHandler {
  protected async consumeEvent() {
    return {
      physicalResourceId: "id",
      data: {
        Name: "Value",
      },
    };
  }
}

// tslint:disable-next-line:max-classes-per-file
class FailureCustomResourceHandler extends CustomResourceHandler {
  protected async consumeEvent(): Promise<never> {
    throw new Error("MOCKED ERROR");
  }
}


describe(CustomResourceHandler.name, () => {
  let event: CloudFormationCustomResourceEvent;
  beforeEach(() => {
    event = {
      StackId: "StackId",
      RequestId: "RequestId",
      LogicalResourceId: "LogicalResourceId",
      RequestType: "Fake",
      ResponseURL: "https://s3.amazonaws.com/bucket/key",
    } as any;
  });

  describe("#handleEvent", () => {
    it("should report success if consumeEvent was resolved", async () => {
      const request = nock("https://s3.amazonaws.com")
        .put("/bucket/key", (body) => body.Status === "SUCCESS")
        .reply(200);

      const handler = new SuccessfulCustomResourceHandler(event);
      const res = await handler.handleEvent();
      expect(request.isDone()).toBeTruthy();
      expect(res).toEqual({
        Status: "SUCCESS",
        PhysicalResourceId: "id",
        StackId: "StackId",
        RequestId: "RequestId",
        LogicalResourceId: "LogicalResourceId",
        Data: { Name: "Value" },
      });
    });

    it("should report failure if consumeEvent thrown an error", async () => {
      const request = nock("https://s3.amazonaws.com")
        .put("/bucket/key", (body) => body.Status === "FAILED")
        .reply(200);

      const handler = new FailureCustomResourceHandler(event);
      const res = await handler.handleEvent();
      expect(request.isDone()).toBeTruthy();
      expect(res).toEqual({
        Status: "FAILED",
        Reason: "MOCKED ERROR",
        PhysicalResourceId: "Unknown",
        StackId: "StackId",
        RequestId: "RequestId",
        LogicalResourceId: "LogicalResourceId",
        Data: {},
      });
    });
  });
});
