import MailIcon from "@mui/icons-material/Mail";
import GroupsIcon from "@mui/icons-material/Groups";
import CastForEducationIcon from '@mui/icons-material/CastForEducation';

const FriendsTitle = ({ title }: { title: string }) => {
    return (
        <div className="w-[250px] uppercase text-grey text-[14px] mt-[4px] flex items-center gap-[10px]">
            {title === "Private Chats" ? (
                <MailIcon />
            ) : title === "Seminars" ? (
                <CastForEducationIcon />
            ) : (
                <GroupsIcon />
            )}
            {title}
        </div>
    );
};

export default FriendsTitle;
