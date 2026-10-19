import { describe, expect, it } from "vitest";
import { participantsExceptAdmin } from "./enrolledParticipants";

describe("participantsExceptAdmin", () => {
  const host = { _id: "host", username: "Bruce Wang" };
  const student = { _id: "student", username: "Admin" };

  it("drops the host even when the host is not first", () => {
    expect(participantsExceptAdmin([student, host], host)).toEqual([student]);
  });

  it("drops the host when the host is first", () => {
    expect(participantsExceptAdmin([host, student], { _id: "host" })).toEqual([student]);
  });

  it("matches a host stored as an id string", () => {
    expect(participantsExceptAdmin([host, student], "host")).toEqual([student]);
  });

  it("keeps everyone when the host is unknown", () => {
    expect(participantsExceptAdmin([student, host], null)).toEqual([student, host]);
  });
});
