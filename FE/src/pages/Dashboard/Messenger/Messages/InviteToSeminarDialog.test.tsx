import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import InviteToSeminarDialog, { summarizeOutcomes } from "./InviteToSeminarDialog";
import * as api from "../../../../api/api";

vi.mock("../../../../api/api", () => ({
  getMyFollowers: vi.fn(async () => ({ result: [] })),
  inviteToSeminar: vi.fn(async () => ({ success: true, free: false, results: [] })),
}));
vi.mock("../../../../actions/alertActions", () => ({
  showErrorAlert: (m: string) => ({ type: "err", m }),
  showSuccessAlert: (m: string) => ({ type: "ok", m }),
}));
const mockDispatch = vi.fn();
vi.mock("react-redux", () => ({ useDispatch: () => mockDispatch }));

const followers = [
  { _id: "s1", username: "Mei Chen", email: "mei@x.com" },
  { _id: "s2", username: "Araavind", email: "araavind@x.com" },
];

const seminar = (over: any = {}) => ({
  groupId: "sem-1",
  groupName: "Applying to US Grad Programs",
  price: 49,
  participants: [{ _id: "host-1" }],
  admin: { _id: "host-1" },
  ...over,
});

describe("summarizeOutcomes", () => {
  it("groups a bulk result into one readable line", () => {
    expect(
      summarizeOutcomes([
        { outcome: "invited" },
        { outcome: "invited" },
        { outcome: "already_enrolled" },
      ] as any),
    ).toBe("2 invited · 1 already in this seminar");
  });
});

describe("InviteToSeminarDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getMyFollowers).mockResolvedValue({ result: followers } as any);
  });

  it("lists followers who are not already in the seminar", async () => {
    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);

    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());
    expect(screen.getByText("Araavind")).toBeInTheDocument();
  });

  it("hides a follower who is already enrolled", async () => {
    render(
      <InviteToSeminarDialog
        open
        onClose={() => {}}
        groupDetails={seminar({ participants: [{ _id: "host-1" }, { _id: "s1" }] })}
      />,
    );

    await waitFor(() => expect(screen.getByText("Araavind")).toBeInTheDocument());
    expect(screen.queryByText("Mei Chen")).not.toBeInTheDocument();
  });

  it("says a paid seminar charges nothing yet", async () => {
    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText(/Nothing is charged until they do/i)).toBeInTheDocument());
  });

  it("warns before adding people to a free seminar, and only sends after confirming", async () => {
    vi.mocked(api.inviteToSeminar).mockResolvedValue({
      success: true,
      free: true,
      results: [{ name: "Mei Chen", outcome: "enrolled" }],
    } as any);

    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar({ price: 0 })} />);
    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Add 1" }));

    expect(screen.getByText(/adds/i)).toBeInTheDocument();
    expect(api.inviteToSeminar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Add them/i }));
    await waitFor(() => expect(api.inviteToSeminar).toHaveBeenCalledOnce());
  });

  it("sends a paid invitation without a confirmation step", async () => {
    vi.mocked(api.inviteToSeminar).mockResolvedValue({
      success: true,
      free: false,
      results: [{ name: "Mei Chen", outcome: "invited" }],
    } as any);

    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /^Invite/ }));

    await waitFor(() => expect(api.inviteToSeminar).toHaveBeenCalledOnce());
    expect(vi.mocked(api.inviteToSeminar).mock.calls[0][0]).toEqual({
      groupChatId: "sem-1",
      followerIds: ["s1"],
      emails: [],
    });
  });

  it("reports each outcome rather than claiming everyone was invited", async () => {
    vi.mocked(api.inviteToSeminar).mockResolvedValue({
      success: true,
      free: false,
      results: [
        { name: "Mei Chen", outcome: "invited" },
        { name: "Araavind", outcome: "already_invited" },
      ],
    } as any);

    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /^Invite/ }));

    await waitFor(() =>
      expect(screen.getByText("1 invited · 1 already invited")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Araavind — already invited/)).toBeInTheDocument();
  });

  it("says so when there is nobody left to invite", async () => {
    vi.mocked(api.getMyFollowers).mockResolvedValue({ result: [] } as any);

    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);

    await waitFor(() =>
      expect(screen.getByText(/No followers left to pick/i)).toBeInTheDocument(),
    );
  });

  it("cannot send with nobody selected", async () => {
    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /^Invite/ })).toBeDisabled();
  });

  it("invites by email address for someone who does not follow the host", async () => {
    vi.mocked(api.inviteToSeminar).mockResolvedValue({
      success: true,
      free: false,
      results: [{ name: "new@x.com", outcome: "invited" }],
    } as any);

    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Invite by email address/i), {
      target: { value: "New@X.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));

    expect(screen.getByText("new@x.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Invite/ }));
    await waitFor(() => expect(api.inviteToSeminar).toHaveBeenCalledOnce());
    expect(vi.mocked(api.inviteToSeminar).mock.calls[0][0]).toEqual({
      groupChatId: "sem-1",
      followerIds: [],
      emails: ["new@x.com"],
    });
  });

  it("says when an address has no account rather than failing silently", async () => {
    vi.mocked(api.inviteToSeminar).mockResolvedValue({
      success: true,
      free: false,
      results: [{ name: "nobody@x.com", outcome: "no_account" }],
    } as any);

    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Invite by email address/i), {
      target: { value: "nobody@x.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Invite/ }));

    await waitFor(() =>
      expect(screen.getByText(/nobody@x.com — has no WisdomLinked account/)).toBeInTheDocument(),
    );
  });

  it("does not add the same address twice", async () => {
    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());

    const field = screen.getByLabelText(/Invite by email address/i);
    fireEvent.change(field, { target: { value: "dup@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    fireEvent.change(field, { target: { value: "dup@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));

    expect(screen.getAllByText("dup@x.com")).toHaveLength(1);
  });
});
