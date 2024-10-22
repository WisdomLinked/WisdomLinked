import React, { Fragment } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Divider from "@mui/material/Divider";
import ListItemText from "@mui/material/ListItemText";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Typography from "@mui/material/Typography";
import Avatar from "../../../../components/Avatar";

interface Props {
    isDialogOpen: boolean;
    closeDialogHandler: () => void;
    groupDetails: any;
    currentUserId: string;
}

const GroupParticipantsDialog = ({
    isDialogOpen,
    closeDialogHandler,
    groupDetails,
    currentUserId
}: Props) => {
    const handleCloseDialog = () => {
        closeDialogHandler();
    };

    return (
        <div>
            <Dialog open={isDialogOpen} onClose={handleCloseDialog}>
                <DialogTitle>
                    <Typography>{groupDetails.groupName}</Typography>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <Typography>
                            {groupDetails.participants.length}{" "}
                            {groupDetails.participants.length > 1
                                ? "Participants"
                                : "Participant"}
                        </Typography>
                    </DialogContentText>
                    <List
                        sx={{
                            width: "100%",
                            maxWidth: 300,
                            bgcolor: "background.paper",
                        }}
                    >
                        {groupDetails.participants.map((participant:any) => {
                            return (
                                <Fragment key={participant._id}>
                                    <ListItem alignItems="flex-start">
                                        <ListItemAvatar>
                                            <Avatar
                                                username={participant.username}
                                                image={participant.image}
                                            />
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={`${participant.username} ${
                                                participant._id ===
                                                currentUserId
                                                    ? "(You)"
                                                    : ""
                                            }`}
                                            secondary={
                                                <React.Fragment>
                                                    <Typography
                                                        sx={{
                                                            display: "inline",
                                                        }}
                                                        component="span"
                                                        variant="body2"
                                                        color="text.primary"
                                                    >
                                                        {participant.email}
                                                    </Typography>
                                                    {` ${
                                                        participant._id ===
                                                        groupDetails.admin?._id
                                                            ? " — Group Admin"
                                                            : ""
                                                    }`}
                                                </React.Fragment>
                                            }
                                        />
                                    </ListItem>
                                    <Divider variant="inset" component="li" />
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
