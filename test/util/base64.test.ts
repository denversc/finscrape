import { expect } from "chai";

import {
  base64StringFromObject,
  base64StringFromUint8Array,
  objectFromBase64String,
  uint8ArrayFromBase64String,
} from "../../src/util/base64.ts";
import { loadExampleUnicodeBytes } from "../testing.ts";

describe("base64.test.ts [yvsddr8pgb]", () => {
  for (const testCase of getObjectRoundTripTestCases()) {
    it(`base64StringFromObject round trip: ${testCase.name} [${testCase.id}]`, () => {
      const base64String = base64StringFromObject(testCase.object);
      const reconstitutedObject = objectFromBase64String(base64String);
      expect(reconstitutedObject).to.deep.equal(testCase.object);
    });
  }

  for (const testCase of getObjectRoundTripTestCases()) {
    it(`base64StringFromObject() produces valid base64: ${testCase.name} [${testCase.id}]`, () => {
      const base64String1 = base64StringFromObject(testCase.object);
      const bytes = Buffer.from(base64String1, "base64");
      const base64String2 = bytes.toString("base64");
      expect(base64String1).to.equal(base64String2);
    });
  }

  for (const testCase of getUint8ArrayTestCases()) {
    it(`base64StringFromUint8Array round trip: ${testCase.name} [${testCase.id}]`, () => {
      const base64String = base64StringFromUint8Array(testCase.array);
      const reconstitutedUint8Array = uint8ArrayFromBase64String(base64String);
      expect(reconstitutedUint8Array).to.deep.equal(testCase.array);
    });
  }

  for (const testCase of getUint8ArrayTestCases()) {
    it(`base64StringFromUint8Array() produces correct base64: ${testCase.name} [${testCase.id}]`, () => {
      const base64String = base64StringFromUint8Array(testCase.array);
      const decodedBase64String = Buffer.from(base64String, "base64");
      expect(decodedBase64String).to.deep.equal(testCase.array);
    });
  }
});

interface ObjectRoundTripTestCase {
  id: string;
  name: string;
  object: unknown;
}

function getObjectRoundTripTestCases(): ObjectRoundTripTestCase[] {
  return [
    { id: "tcc8rc4s6f", name: "empty string", object: "" },
    { id: "tccdghvtzg", name: "string length=1", object: "f" },
    { id: "tcx8rqg4me", name: "string length=2", object: "fo" },
    { id: "tcq72xm65k", name: "string length=3", object: "fob" },
    { id: "tckzqv8ntp", name: "string length=4", object: "foba" },
    { id: "tcx9hk6jef", name: "string extended unicode", object: "é🙋“😼”" },
    { id: "tchk4psa72", name: "integer", object: 42 },
    { id: "tcftrwyypx", name: "float", object: 12.345 },
    { id: "tcs6296jym", name: "true", object: true },
    { id: "tcm6tqfn43", name: "false", object: false },
    { id: "tczd2fwzwy", name: "array", object: [42, "heyo", true, false, [99], { a: "b" }] },
    {
      id: "tcz2r87swv",
      name: "object",
      object: { a: 42, b: "heyo", c: true, d: false, e: [99], f: { yyy: "rfd" } },
    },
  ];
}

interface Uint8ArrayTestCase {
  id: string;
  name: string;
  array: Uint8Array;
}

function getUint8ArrayTestCases(): Uint8ArrayTestCase[] {
  const allBytes: number[] = [];
  for (let i = 0; i < 256; i++) {
    allBytes.push(i);
  }
  return [
    { id: "tc84jatqyd", name: "empty array", array: new Uint8Array([]) },
    { id: "tc6nc44hbn", name: "[0]", array: new Uint8Array([0]) },
    { id: "tcn9ny9d47", name: "[1]", array: new Uint8Array([1]) },
    { id: "tcp6vwhay2", name: "[255]", array: new Uint8Array([255]) },
    { id: "tcms4p5hkv", name: "[0, 1]", array: new Uint8Array([0, 1]) },
    { id: "tc3t4ggfhc", name: "[0, 1, 2]", array: new Uint8Array([0, 1, 2]) },
    { id: "tc4qnfcaxm", name: "allBytes", array: new Uint8Array(allBytes) },
    { id: "tcesms43z2", name: "example unicode bytes", array: loadExampleUnicodeBytes() },
  ];
}
