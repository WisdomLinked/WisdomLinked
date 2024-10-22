import React, { useState } from "react";
import { useDispatch } from "react-redux";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { IconButton } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { logoutUser } from "../../actions/authActions";
import { useAppSelector } from "../../store";
import { setAudioOnlyRoom } from "../../actions/roomActions";

export default function DropDownMenu() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const dispatch = useDispatch();
    const { auth: { userDetails }, room: { audioOnly, roomDetails, isUserInRoom, } } = useAppSelector(state => state)

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleClick = () => {
        dispatch(logoutUser());
    }

    return (
        <div>
            <IconButton
                onClick={(e) => setAnchorEl(e.currentTarget)}
                style={{ color: "white"}}
            >
                <MoreVertIcon />
            </IconButton>
            <Menu
                id="basic-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleMenuClose}
                MenuListProps={{
                    "aria-labelledby": "basic-button",
                }}
            >
                <MenuItem onClick={handleClick}>
                    Logout ({userDetails?.username})
                </MenuItem>
            </Menu>
        </div>
    );
}
