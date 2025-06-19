import React from "react";
import { styled } from "@mui/system";
import IconButton from "@mui/material/IconButton";
import PersonAddIcon from "@mui/icons-material/PersonAdd";

const MainContainer = styled("div")({
    // position: "absolute",
    // top: "20px",
    // right: "20px",
});

const AddPersonButton: React.FC<{
    onAddPerson: () => void;
}> = ({ onAddPerson }) => {
    return (
        <MainContainer>
            <IconButton style={{ color: "white" }} onClick={onAddPerson}>
                <PersonAddIcon />
            </IconButton>
        </MainContainer>
    );
};

export default AddPersonButton;