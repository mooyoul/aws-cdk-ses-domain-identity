import {
  CloudFormationCustomResourceEvent, CloudFormationCustomResourceEventCommon,
  CloudFormationCustomResourceFailedResponse,
  CloudFormationCustomResourceResponse,
  CloudFormationCustomResourceSuccessResponse,
} from "aws-lambda";
import * as https from "https";

type ConsumeEventResult = {
  physicalResourceId: CloudFormationCustomResourceResponse["PhysicalResourceId"];
  data: CloudFormationCustomResourceResponse["Data"];
};

type EventBase = CloudFormationCustomResourceEventCommon & { PhysicalResourceId?: string };

export abstract class CustomResourceHandler<T extends EventBase = CloudFormationCustomResourceEvent> {
  public constructor(
    protected readonly event: T,
  ) {}

  public async handleEvent() {
    try {
      const { physicalResourceId, data } = await this.consumeEvent();

      console.log(`Notifying success response...`); // tslint:disable-line

      const response: CloudFormationCustomResourceSuccessResponse = {
        Status: "SUCCESS",
        PhysicalResourceId: physicalResourceId,
        StackId: this.event.StackId,
        RequestId: this.event.RequestId,
        LogicalResourceId: this.event.LogicalResourceId,
        Data: data,
      };
      await this.notify(response);

      return response;
    } catch (e) {
      console.error("Failed to provision resource!", e.stack); // tslint:disable-line

      const response: CloudFormationCustomResourceFailedResponse = {
        Status: "FAILED",
        Reason: e.message,
        PhysicalResourceId: this.event.PhysicalResourceId ?? "Unknown",
        StackId: this.event.StackId,
        RequestId: this.event.RequestId,
        LogicalResourceId: this.event.LogicalResourceId,
        Data: {},
      };
      await this.notify(response);

      return response;
    }
  }

  protected abstract consumeEvent(): Promise<ConsumeEventResult>;

  private notify(response: CloudFormationCustomResourceResponse) {
    return new Promise<void>((resolve, reject) => {
      const bufBody = Buffer.from(JSON.stringify(response), "utf8");

      const req = https.request(this.event.ResponseURL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": bufBody.length,
        },
      });

      function onError(e: Error) {
        req.removeListener("response", onResponse);
        reject(e);
      }

      function onResponse() {
        req.removeListener("error", onError)
          .destroy();

        resolve();
      }

      req.once("error", onError)
        .once("response", onResponse)
        .end(bufBody);
    });
  }
}
