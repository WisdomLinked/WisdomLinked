import React, { Fragment } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "../../../../components/Avatar";

interface Props {
    isDialogOpen: boolean;
    closeDialogHandler: () => void;
    groupDetails: any;
    currentUserId: string;
    theme?: "light" | "dark";
}

const GroupParticipantsDialog = ({
    isDialogOpen,
    closeDialogHandler,
    groupDetails,
    currentUserId,
    theme = "light",
}: Props) => {
    const handleCloseDialog = () => {
        closeDialogHandler();
    };

    const paperClass =
        theme === "light" ? "rounded-2xl border border-slate-200 bg-white shadow-xl" : "";

    return (
        <div>
            <Dialog
                open={isDialogOpen}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
                PaperProps={{ className: paperClass }}
            >
                <div className="border-b border-slate-100 px-5 pt-5 pb-3">
                    <h2 className="text-base font-semibold text-slate-900">{groupDetails.groupName}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        {groupDetails.participants.length}{" "}
                        {groupDetails.participants.length > 1 ? "participants" : "participant"}
                    </p>
                </div>
                <DialogContent className="px-2 pb-4 pt-2">
                    <List sx={{ width: "100%", pt: 0 }}>
                        {groupDetails.participants.map((participant: any) => {
                            return (
                                <Fragment key={participant._id}>
                                    <ListItem alignItems="flex-start" className="rounded-xl">
                                        <ListItemAvatar>
                                            <Avatar
                                                username={participant.username}
                                                image={participant.image}
                                            />
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={`${participant.username} ${
                                                participant._id === currentUserId ? "(You)" : ""
                                            }`}
                                            secondary={
                                                <span className="text-sm text-slate-600">
                                                    {participant.email}
                                                    {participant._id === groupDetails.admin?._id
                                                        ? " — Group admin"
                                                        : ""}
                                                </span>
                                            }
                                        />
                                    </ListItem>
                                </Fragment>
                            );
                        })}
                    </List>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GroupParticipantsDialog;
