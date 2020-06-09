import * as sinon from "sinon";

export const sandbox = sinon.createSandbox();

afterEach(() => {
  sandbox.verifyAndRestore();
});

export function stubAWSAPI<T>(
  Service: new (...args: any[]) => T,
  method: keyof T,
  fake: sinon.SinonSpy,
) {
  const service = new Service();
  const proto = Object.getPrototypeOf(service);

  return sandbox.stub(proto, method)
    .callsFake((...args: any[]) => {
      return {
        promise: () => Promise.resolve(fake(...args)),
      };
    });
}
