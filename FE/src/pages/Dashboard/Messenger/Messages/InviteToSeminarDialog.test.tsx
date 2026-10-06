import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import InviteToSeminarDialog, { summarizeOutcomes } from "./InviteToSeminarDialog";
import * as api from "../../../../api/api";
import { notify } from "../../../../utils/notify";

vi.mock("../../../../api/api", () => ({
  doFilterCustomers: vi.fn(async () => ({ result: [] })),
  inviteToSeminar: vi.fn(async () => ({ success: true, free: false, results: [] })),
  profileImageFetch: vi.fn(async () => null),
}));
vi.mock("../../../../utils/notify", () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));
const mockDispatch = vi.fn();
vi.mock("react-redux", () => ({ useDispatch: () => mockDispatch }));

const students = [
  { _id: "s1", username: "Mei Chen", email: "mei@x.com", image: "mei-photo.jpg" },
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
    vi.mocked(api.doFilterCustomers).mockResolvedValue({ result: students } as any);
    vi.mocked(api.profileImageFetch).mockImplementation(async (ref: string) =>
      ref === "mei-photo.jpg" ? "https://cdn.example/mei.jpg" : null,
    );
  });

  it("lists students who are not already in the seminar", async () => {
    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);

    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());
    expect(screen.getByText("Araavind")).toBeInTheDocument();
  });

  it("resolves storage image refs before rendering Avatar photos", async () => {
    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);

    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());
    expect(api.profileImageFetch).toHaveBeenCalledWith("mei-photo.jpg", "small");
    const photo = screen.getByRole("img");
    expect(photo).toHaveAttribute("src", "https://cdn.example/mei.jpg");
    // No image ref → initials fallback, not a broken img
    expect(screen.getByText("AR")).toBeInTheDocument();
  });

  it("shows resolved photos in the search dropdown too", async () => {
    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Search students by name/i), {
      target: { value: "Mei" },
    });

    await waitFor(() => {
      const imgs = screen.getAllByRole("img");
      expect(imgs.some((img) => img.getAttribute("src") === "https://cdn.example/mei.jpg")).toBe(true);
    });
  });

  it("hides a student who is already enrolled", async () => {
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

  it("shows a name dropdown of matching students when searching", async () => {
    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Search students by name/i), {
      target: { value: "Mei" },
    });

    expect(screen.getByRole("listbox", { name: /Matching students/i })).toBeInTheDocument();
    expect(screen.getAllByText("Mei Chen").length).toBeGreaterThan(0);
    expect(screen.queryByText("Araavind")).not.toBeInTheDocument();
  });

  it("says a paid seminar charges nothing yet", async () => {
    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText(/Nothing is charged until they do/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/Invite by email address/i)).toBeInTheDocument();
  });

  it("uses Add by email placeholder for a free seminar", async () => {
    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar({ price: 0 })} />);
    await waitFor(() => expect(screen.getByLabelText(/Add by email address/i)).toBeInTheDocument());
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
    vi.mocked(api.doFilterCustomers).mockResolvedValue({ result: [] } as any);

    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);

    await waitFor(() =>
      expect(screen.getByText(/No students left to pick/i)).toBeInTheDocument(),
    );
  });

  it("cannot send with nobody selected", async () => {
    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /^Invite/ })).toBeDisabled();
  });

  it("invites by email address for someone who is not in the list", async () => {
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

  it("does not show a second toast when the API already notified failure", async () => {
    vi.mocked(api.inviteToSeminar).mockResolvedValue(false as any);

    render(<InviteToSeminarDialog open onClose={() => {}} groupDetails={seminar()} />);
    await waitFor(() => expect(screen.getByText("Mei Chen")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /^Invite/ }));

    await waitFor(() => expect(api.inviteToSeminar).toHaveBeenCalledOnce());
    expect(notify.error).not.toHaveBeenCalled();
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
