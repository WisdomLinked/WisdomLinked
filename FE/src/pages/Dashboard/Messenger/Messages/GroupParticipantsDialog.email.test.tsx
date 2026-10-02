import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import GroupParticipantsDialog from "./GroupParticipantsDialog";

const mockDispatch = vi.fn();
vi.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
  useSelector: () => ({ _id: "me", role: "expert", username: "Me", email: "me@test.com" }),
}));
vi.mock("../../../../api/api", () => ({ removeCommunityMember: vi.fn() }));
vi.mock("../../../../api/chatApi", () => ({ fetchChatUserProfile: vi.fn() }));

const participants = [
  { _id: "u1", username: "Khussal Pradhan", email: "pradhankhu@gmail.com", image: null },
  { _id: "u2", username: "Araavind Subramoniam", email: "araavindsub@gmail.com", image: null },
];

const renderDialog = (type: string) =>
  render(
    <GroupParticipantsDialog
      isDialogOpen
      closeDialogHandler={vi.fn()}
      groupDetails={{ groupName: "Dev Group", type, participants, admin: { _id: "u1" } }}
      currentUserId="me"
      currentUserRole="expert"
    />,
  );

describe("participant emails in the members list", () => {
  it.each(["community", "seminar", "individual"])("hides every email in a %s", (type) => {
    renderDialog(type);

    expect(screen.queryByText("pradhankhu@gmail.com")).not.toBeInTheDocument();
    expect(screen.queryByText("araavindsub@gmail.com")).not.toBeInTheDocument();
  });

  it.each(["community", "seminar"])("still lists every participant by name in a %s", (type) => {
    renderDialog(type);

    expect(screen.getByText("Khussal Pradhan")).toBeInTheDocument();
    expect(screen.getByText("Araavind Subramoniam")).toBeInTheDocument();
  });

  it("keeps the admin badge, which identifies the owner without an email", () => {
    renderDialog("community");

    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("does not show an admin badge on a 1:1, where it has no meaning", () => {
    renderDialog("individual");

    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });
});
