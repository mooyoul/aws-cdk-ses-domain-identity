import { CloudFormationCustomResourceEvent } from "aws-lambda";

import {
  CreateCustomResourceHandler,
  CustomResourceHandler,
  DeleteCustomResourceHandler,
  UpdateCustomResourceHandler,
} from "./handlers";

export async function identityRequestHandler(event: CloudFormationCustomResourceEvent) {
  const handler: CustomResourceHandler = (() => {
    switch (event.RequestType) {
      case "Create":
        return new CreateCustomResourceHandler(event);
      case "Update":
        return new UpdateCustomResourceHandler(event);
      case "Delete":
        return new DeleteCustomResourceHandler(event);
    }
  })();

  return await handler.handleEvent();
}
