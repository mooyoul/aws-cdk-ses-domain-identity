import * as sinon from "sinon";

import { waitFor } from "../src/util";

describe("Utils", () => {
  describe(waitFor.name, () => {
    let pollerStub: sinon.SinonStub;

    beforeEach(() => {
      pollerStub = sinon.stub();
      pollerStub.rejects(new Error("MOCKED"));
      pollerStub.onCall(3).resolves({ state: 1 });
      pollerStub.onCall(4).resolves({ state: 2, name: "foo" });
    });

    it("should retry", async () => {
      const testerStub = sinon.stub();
      testerStub.returns(false);
      testerStub.onCall(1).returns(true);

      await waitFor(pollerStub, testerStub, {
        maxAttempts: 10,
        delay: 0,
      });

      expect(pollerStub.callCount).toEqual(5);
      expect(testerStub.callCount).toEqual(2);
    });

    it("should throw error when maximum attempts exceeded", async () => {
      await expect(
        waitFor(pollerStub, (value: any) => value.state === 2, {
          maxAttempts: 3,
          delay: 0,
        }),
      ).rejects.toThrow("Maximum attempts exceeded");

      expect(pollerStub.callCount).toEqual(3);
    });

    it("should return state from poller if succeeded", async () => {
      const res = await waitFor(pollerStub, (value: any) => value.state === 2, {
        maxAttempts: 10,
        delay: 0,
      });

      expect(res).toEqual({ state: 2, name: "foo" });
    });
  });
});
