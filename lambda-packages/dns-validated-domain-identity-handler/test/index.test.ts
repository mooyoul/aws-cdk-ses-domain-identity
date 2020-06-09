import * as sinon from "sinon";
import { sandbox } from "./helper";

import { identityRequestHandler } from "../src";
import {
  CreateCustomResourceHandler,
  DeleteCustomResourceHandler,
  UpdateCustomResourceHandler,
} from "../src/handlers";

describe("Handler", () => {
  let handleEventFake: sinon.SinonStub;

  describe("when RequestType = Create", () => {
    beforeEach(() => {
      handleEventFake = sandbox.stub(CreateCustomResourceHandler.prototype, "handleEvent");
      handleEventFake.resolves({ value: "create" });
    });

    it("should use CreateCustomResourceHandler", async () => {
      const event = {
        RequestType: "Create",
      } as any;

      const res = await identityRequestHandler(event);

      sinon.assert.calledOnce(handleEventFake);
      expect(res).toEqual({ value: "create" });
    });
  });

  describe("when RequestType = Update", () => {
    beforeEach(() => {
      handleEventFake = sandbox.stub(UpdateCustomResourceHandler.prototype, "handleEvent");
      handleEventFake.resolves({ value: "update" });
    });

    it("should use UpdateCustomResourceHandler", async () => {
      const event = {
        RequestType: "Update",
      } as any;

      const res = await identityRequestHandler(event);

      sinon.assert.calledOnce(handleEventFake);

      expect(res).toEqual({ value: "update" });
    });
  });

  describe("when RequestType = Delete", () => {
    beforeEach(() => {
      handleEventFake = sandbox.stub(DeleteCustomResourceHandler.prototype, "handleEvent");
      handleEventFake.resolves({ value: "delete" });
    });

    it("should use DeleteCustomResourceHandler", async () => {
      const event = {
        RequestType: "Delete",
      } as any;

      const res = await identityRequestHandler(event);

      sinon.assert.calledOnce(handleEventFake);

      expect(res).toEqual({ value: "delete" });
    });
  });
});
