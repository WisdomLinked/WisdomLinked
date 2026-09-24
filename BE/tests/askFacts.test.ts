import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterPublicExperts,
  filterPublicSeminars,
  filterOwnRecords,
  filterExpertsByArgs,
  filterSeminarsByArgs,
  filterOwnRecordsByKind,
  publicFactTemplate,
} from "../utils/askFacts";

const civilProfessor = (name: string, hourlyRate: unknown, extra: Record<string, unknown> = {}) => ({
  name,
  title: "Professor",
  bio: "Structures faculty",
  hourlyRate,
  keywords: ["Civil Engineering"],
  ...extra,
});

describe("filterPublicExperts", () => {
  it("keeps only the lower civil professor rate and every tie at that rate", () => {
    const cards = [
      civilProfessor("Ada", 40),
      civilProfessor("Grace", 25),
      civilProfessor("Alan", 25),
      civilProfessor("Edsger", 10, { keywords: ["Computer Science"] }),
      civilProfessor("Ivy", 1, { keywords: ["History"], bio: "civil engineering outreach" }),
    ];
    const names = filterPublicExperts(cards, "who is the cheapest civil professor").map((card) => card.name);
    assert.deepEqual(names, ["Grace", "Alan"]);
  });

  it("keeps a missing rate unless the question sorts by price", () => {
    const cards = [
      civilProfessor("Ada", 30),
      civilProfessor("Grace", null),
      civilProfessor("Alan", undefined),
      civilProfessor("Lin", Number.NaN),
    ];
    const names = filterPublicExperts(cards, "civil professor").map((card) => card.name);
    assert.deepEqual(names, ["Ada", "Grace", "Alan", "Lin"]);
    const cheapest = filterPublicExperts(cards, "cheapest civil professor").map((card) => card.name);
    assert.deepEqual(cheapest, ["Ada"]);
  });

  it("keeps hourlyRate 0 as free", () => {
    const cards = [
      civilProfessor("Ada", 0),
      civilProfessor("Grace", 20),
      civilProfessor("Lin", null),
    ];
    const result = filterPublicExperts(cards, "cheapest civil professor");
    assert.deepEqual(result.map((card) => card.name), ["Ada"]);
    assert.equal(result[0].hourlyRate, 0);
  });

  it("omits a card whose name contains @", () => {
    const cards = [
      civilProfessor("ada@university.edu", 5),
      civilProfessor("Grace", 20),
    ];
    const names = filterPublicExperts(cards, "cheapest civil professor").map((card) => card.name);
    assert.deepEqual(names, ["Grace"]);
  });

  it("matches 土木工程 and 土木 only to Civil Engineering professors", () => {
    const cards = [
      civilProfessor("Ada", 30),
      civilProfessor("Grace", 10, {
        keywords: ["Mechanical Engineering"],
        bio: "土木工程 background",
      }),
      civilProfessor("Lin", 5, { title: "Lecturer", bio: "structures lab" }),
    ];
    const cheapest = filterPublicExperts(cards, "最便宜的土木工程教授").map((card) => card.name);
    assert.deepEqual(cheapest, ["Ada"]);
    const alias = filterPublicExperts(cards, "土木").map((card) => card.name);
    assert.deepEqual(alias, ["Ada", "Lin"]);
  });

  it("keeps under strictly below the number and over strictly above it", () => {
    const cards = [
      civilProfessor("Ada", 25),
      civilProfessor("Grace", 24),
      civilProfessor("Alan", 50),
      civilProfessor("Lin", 51),
    ];
    assert.deepEqual(
      filterPublicExperts(cards, "civil professor under 25").map((card) => card.name),
      ["Grace"],
    );
    assert.deepEqual(
      filterPublicExperts(cards, "civil professor over 50").map((card) => card.name),
      ["Lin"],
    );
  });

  it("matches Study Abroad on the services array", () => {
    const cards = [
      civilProfessor("Ada", 40, { services: ["Study Abroad"] }),
      civilProfessor("Grace", 10, { services: ["Research Guidance"], bio: "Study Abroad mentoring" }),
    ];
    const names = filterPublicExperts(cards, "Study Abroad professor").map((card) => card.name);
    assert.deepEqual(names, ["Ada"]);
  });

  it("keeps every card tied at the highest rate", () => {
    const cards = [
      civilProfessor("Ada", 40),
      civilProfessor("Grace", 40),
      civilProfessor("Alan", 15),
    ];
    const names = filterPublicExperts(cards, "highest civil professor").map((card) => card.name);
    assert.deepEqual(names, ["Ada", "Grace"]);
  });
});

describe("filterExpertsByArgs", () => {
  const cards = [
    civilProfessor("Ada", 30),
    civilProfessor("Grace", null),
    civilProfessor("Alan", undefined),
    civilProfessor("Lin", Number.NaN),
    civilProfessor("Zero", 0),
    civilProfessor("ada@school.edu", 1),
    civilProfessor("Ivy", 5, { keywords: ["History"], bio: "civil engineering outreach" }),
  ];

  it("keeps a missing rate for Civil Engineering when no price args are set", () => {
    const names = filterExpertsByArgs(cards, { subject: "Civil Engineering" }).map((card) => card.name);
    assert.deepEqual(names, ["Ada", "Grace", "Alan", "Lin", "Zero"]);
  });

  it("drops a missing rate for sort cheapest and keeps hourlyRate 0", () => {
    const cheapest = filterExpertsByArgs(cards, { subject: "Civil Engineering", sort: "cheapest" });
    assert.deepEqual(cheapest.map((card) => card.name), ["Zero"]);
    assert.equal(cheapest[0].hourlyRate, 0);
  });

  it("treats civil, 土木, and 土木工程 as Civil Engineering", () => {
    const names = (subject: string) =>
      filterExpertsByArgs(cards, { subject }).map((card) => card.name);
    assert.deepEqual(names("civil"), ["Ada", "Grace", "Alan", "Lin", "Zero"]);
    assert.deepEqual(names("土木"), ["Ada", "Grace", "Alan", "Lin", "Zero"]);
    assert.deepEqual(names("土木工程"), ["Ada", "Grace", "Alan", "Lin", "Zero"]);
  });

  it("keeps a professor only when professor is true and a canonical service", () => {
    const pool = [
      civilProfessor("Ada", 40, { services: ["Study Abroad"] }),
      civilProfessor("Grace", 10, { title: "Lecturer", bio: "structures lab", services: ["Study Abroad"] }),
      civilProfessor("Alan", 12, { services: ["Research Guidance"] }),
    ];
    assert.deepEqual(
      filterExpertsByArgs(pool, { professor: true, service: "Study Abroad" }).map((card) => card.name),
      ["Ada"],
    );
    assert.deepEqual(
      filterExpertsByArgs(pool, { service: "Tutoring" }).map((card) => card.name),
      ["Ada", "Grace", "Alan"],
    );
  });

  it("keeps rates strictly under or over and drops a missing rate", () => {
    const pool = [
      civilProfessor("Ada", 25),
      civilProfessor("Grace", 24),
      civilProfessor("Alan", 50),
      civilProfessor("Lin", 51),
      civilProfessor("NoRate", null),
    ];
    assert.deepEqual(
      filterExpertsByArgs(pool, { priceUnder: 25 }).map((card) => card.name),
      ["Grace"],
    );
    assert.deepEqual(
      filterExpertsByArgs(pool, { priceOver: 50 }).map((card) => card.name),
      ["Lin"],
    );
  });
});

describe("publicFactTemplate", () => {
  it("does not invent a person when no card has a public rate", () => {
    const text = publicFactTemplate([]);
    assert.equal(text, "No active professor in Civil Engineering has a public hourly rate.");
    assert.equal(/\b(Jane Doe|John Smith|Ada Lovelace|Bob)\b/.test(text), false);
  });

  it("names each winner and hourly rate", () => {
    const text = publicFactTemplate([
      { name: "Grace", hourlyRate: 25 },
      { name: "Alan", hourlyRate: 25 },
    ]);
    assert.equal(text, "Grace has a public hourly rate of 25 and Alan has a public hourly rate of 25.");
    assert.equal(text.includes("Jane"), false);
  });

  it("states a seminar price and seats and skips an email-shaped host", () => {
    const text = publicFactTemplate([
      {
        name: "Bridge Design Studio",
        price: 15,
        seats: "3 of 20",
        hostName: "ada@school.edu",
      },
    ]);
    assert.equal(text, "Bridge Design Studio costs $15. Seats: 3 of 20.");
    assert.equal(text.includes("@"), false);
  });
});

describe("filterPublicSeminars", () => {
  it("keeps a seminar whose name includes a question token, with price and seats", () => {
    const cards = [
      {
        name: "Bridge Design Studio",
        description: "Weekly review",
        price: 15,
        seats: "3 of 20",
        hostName: "Ada",
      },
      {
        name: "Poetry Night",
        description: "Open mic",
        price: 0,
        seats: "1 of 10",
        hostName: "host@university.edu",
      },
    ];
    const result = filterPublicSeminars(cards, "bridge seminar");
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Bridge Design Studio");
    assert.equal(result[0].price, 15);
    assert.equal(result[0].seats, "3 of 20");
    assert.equal(result[0].hostName, "Ada");
  });

  it("keeps a seminar when the host name contains @ and omits that name", () => {
    const result = filterPublicSeminars([
      {
        name: "Bridge Design Studio",
        price: 15,
        seats: "3 of 20",
        hostName: "ada@school.edu",
        image: "https://example.com/photo.png",
      },
    ], "bridge seminar price");
    assert.equal(result.length, 1);
    assert.equal(result[0].price, 15);
    assert.equal(result[0].seats, "3 of 20");
    assert.equal(result[0].hostName, undefined);
    assert.equal(result[0].image, undefined);
  });
});

describe("filterSeminarsByArgs", () => {
  it("keeps a seminar whose host name contains @ and omits that name", () => {
    const result = filterSeminarsByArgs([
      {
        name: "Bridge Design Studio",
        description: "Weekly review",
        price: 15,
        hostName: "ada@school.edu",
        host: { username: "ada@school.edu" },
      },
    ], {});
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Bridge Design Studio");
    assert.equal(JSON.stringify(result).includes("@"), false);
  });

  it("matches query on name or description and sorts by price", () => {
    const cards = [
      { name: "Bridge Design Studio", description: "Weekly review", price: 15, hostName: "Ada" },
      { name: "Poetry Night", description: "bridge poems", price: 0, hostName: "Lin" },
      { name: "Lab", description: "structures", price: null, hostName: "Grace" },
    ];
    const named = filterSeminarsByArgs(cards, { query: "bridge" });
    assert.deepEqual(named.map((card) => card.name), ["Bridge Design Studio", "Poetry Night"]);
    const cheapest = filterSeminarsByArgs(cards, { query: "bridge", sort: "cheapest" });
    assert.deepEqual(cheapest.map((card) => card.name), ["Poetry Night"]);
    assert.equal(cheapest[0].price, 0);
    assert.deepEqual(
      filterSeminarsByArgs(cards, { priceUnder: 15 }).map((card) => card.name),
      ["Poetry Night"],
    );
  });
});

describe("filterOwnRecords", () => {
  const futureEnd = "2099-01-01T00:00:00.000Z";
  const pastEnd = "2000-01-01T00:00:00.000Z";

  const rows = [
    {
      name: "Ada session",
      description: "Review",
      start: "2098-01-01T00:00:00.000Z",
      end: futureEnd,
      price: 20,
      status: "active",
      type: "individual",
      adminId: "caller-a",
      participantIds: ["caller-a"],
      hostName: "Ada",
      participantNames: ["Ada"],
      email: "ada@university.edu",
      phone: "555-0100",
      gpa: 3.9,
      resume: "secret",
      messages: ["hello"],
      stripeId: "ch_123",
      cardLast4: "4242",
    },
    {
      name: "Grace session",
      description: "Lab",
      start: "2098-02-01T00:00:00.000Z",
      end: futureEnd,
      price: 30,
      status: "pending",
      type: "seminar",
      adminId: "caller-b",
      participantIds: ["caller-b"],
      hostName: "Grace",
      participantNames: ["Grace"],
      email: "grace@university.edu",
      phone: "555-0199",
    },
    {
      name: "Cancelled session",
      status: "cancelled",
      type: "individual",
      adminId: "caller-a",
      participantIds: ["caller-a"],
      end: futureEnd,
      email: "ada@university.edu",
    },
    {
      name: "Past session",
      status: "active",
      type: "individual",
      adminId: "caller-a",
      participantIds: ["caller-a"],
      end: pastEnd,
    },
    {
      name: "Community as admin only",
      status: "active",
      type: "community",
      adminId: "caller-a",
      participantIds: ["someone-else"],
      end: futureEnd,
    },
    {
      name: "Community as participant",
      status: "active",
      type: "community",
      adminId: "someone-else",
      participantIds: ["caller-a"],
      end: futureEnd,
    },
  ];

  it("does not let two callers see each other's rows", () => {
    const ada = filterOwnRecords(rows, { id: "caller-a", role: "customer" });
    const grace = filterOwnRecords(rows, { id: "caller-b", role: "expert" });
    assert.deepEqual(ada.map((row) => row.name), ["Ada session", "Past session", "Community as participant"]);
    assert.deepEqual(grace.map((row) => row.name), ["Grace session"]);
    assert.equal(ada.some((row) => row.name === "Grace session"), false);
    assert.equal(grace.some((row) => row.name === "Ada session"), false);
    assert.equal(ada[0].email, undefined);
    assert.equal(ada[0].phone, undefined);
    assert.equal(ada[0].gpa, undefined);
    assert.equal(ada[0].resume, undefined);
    assert.equal(ada[0].messages, undefined);
    assert.equal(ada[0].stripeId, undefined);
    assert.equal(ada[0].cardLast4, undefined);
    assert.equal(ada[0].price, 20);
    assert.equal(ada[0].hostName, "Ada");
  });

  it("treats upcoming as pending or active with a future end", () => {
    const upcoming = filterOwnRecords(rows, { id: "caller-a", role: "customer" }, "upcoming sessions");
    assert.deepEqual(upcoming.map((row) => row.name), ["Ada session", "Community as participant"]);
  });

  it("returns a legacy event and seat request only for that caller", () => {
    const extra = [
      {
        kind: "legacyEvent",
        name: "Old tutoring",
        status: "accepted",
        expertId: "caller-a",
        customerId: "student-1",
        decisionNote: "bring notes",
        end: futureEnd,
        stripeId: "ch_secret",
      },
      {
        kind: "legacyEvent",
        name: "Other tutoring",
        status: "accepted",
        expertId: "other",
        customerId: "caller-a",
        end: futureEnd,
      },
      {
        kind: "seatRequest",
        name: "Seat",
        status: "pending",
        expertId: "caller-a",
        customerId: "student-1",
      },
      {
        kind: "legacyEvent",
        name: "Declined",
        status: "declined",
        expertId: "caller-a",
        customerId: "student-1",
      },
    ];
    const expert = filterOwnRecords(extra, { id: "caller-a", role: "expert" });
    assert.deepEqual(expert.map((row) => row.name), ["Old tutoring", "Seat"]);
    assert.equal(expert[0].decisionNote, "bring notes");
    assert.equal(expert[0].stripeId, undefined);
    const student = filterOwnRecords(extra, { id: "caller-a", role: "customer" });
    assert.deepEqual(student.map((row) => row.name), ["Other tutoring"]);
  });

  it("answers my next seminar from that caller's seminar only", () => {
    const next = filterOwnRecords(rows, { id: "caller-a", role: "expert" }, "what is my next seminar?");
    assert.deepEqual(next.map((row) => row.name), []);
    const withSeminar = [
      ...rows,
      {
        name: "Structures studio",
        status: "active",
        type: "seminar",
        adminId: "caller-a",
        participantIds: ["caller-a"],
        end: futureEnd,
        price: 12,
      },
    ];
    const seminar = filterOwnRecords(withSeminar, { id: "caller-a", role: "expert" }, "what is my next seminar?");
    assert.deepEqual(seminar.map((row) => row.name), ["Structures studio"]);
  });
});

describe("filterOwnRecordsByKind", () => {
  const futureEnd = "2099-01-01T00:00:00.000Z";

  const rows = [
    {
      name: "Ada session",
      status: "active",
      type: "individual",
      adminId: "caller-a",
      participantIds: ["caller-a"],
      end: futureEnd,
      messages: ["hello"],
      body: "secret note",
      chat: "thread",
    },
    {
      name: "Grace session",
      status: "active",
      type: "individual",
      adminId: "caller-b",
      participantIds: ["caller-b"],
      end: futureEnd,
      messages: ["other"],
    },
    {
      name: "Ada seminar",
      status: "active",
      type: "seminar",
      adminId: "caller-a",
      participantIds: ["caller-a"],
      end: futureEnd,
    },
    {
      name: "Cancelled session",
      status: "cancelled",
      type: "individual",
      adminId: "caller-a",
      participantIds: ["caller-a"],
      end: futureEnd,
    },
    {
      kind: "legacyEvent",
      name: "Old tutoring",
      status: "accepted",
      expertId: "caller-a",
      customerId: "student-1",
      end: futureEnd,
    },
  ];

  it("hides another caller and does not return messages", () => {
    const ada = filterOwnRecordsByKind(rows, { id: "caller-a", role: "customer" }, "individual");
    assert.deepEqual(ada.map((row) => row.name), ["Ada session"]);
    assert.equal(ada.some((row) => row.name === "Grace session"), false);
    assert.equal(ada[0].messages, undefined);
    assert.equal(ada[0].body, undefined);
    assert.equal(ada[0].chat, undefined);
    assert.equal(JSON.stringify(ada).includes("hello"), false);
  });

  it("returns the caller rows when kind is omitted and only legacy events for event", () => {
    const caller = { id: "caller-a", role: "expert" };
    const all = filterOwnRecordsByKind(rows, caller);
    assert.deepEqual(all.map((row) => row.name), ["Ada session", "Ada seminar", "Old tutoring"]);
    assert.equal(all.some((row) => row.name === "Grace session"), false);
    const events = filterOwnRecordsByKind(rows, caller, "event");
    assert.deepEqual(events.map((row) => row.name), ["Old tutoring"]);
  });
});
