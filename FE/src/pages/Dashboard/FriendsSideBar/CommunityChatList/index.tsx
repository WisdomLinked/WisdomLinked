import { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "../../../../store";
import GeneralChatListItem from "../GeneralChatList/GeneralChatListItem";
import { styled } from "@mui/system";
import AddIcon from "@mui/icons-material/Add";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText, OutlinedInput } from "@mui/material";
import { createCommunityChat, addParticipantsToCommunityChat, doFilterCustomers, getAllCommunityChats, joinCommunityChat } from "../../../../api/api";
import { showAlert } from "../../../../actions/alertActions";
import { updateMe } from "../../../../actions/authActions";

const MainContainer = styled("div")({
    flexGrow: 1,
    width: "100%",
    margin: "20px 0",
});

const SearchInput = styled("input")({
    width: "100%",
    padding: "10px",
    marginBottom: "20px",
    borderRadius: "5px",
    border: "1px solid #444",
    fontSize: "16px",
    backgroundColor: "#222",
    color: "#fff",
    outline: "none",
    caretColor: "#00ffff",
    "::placeholder": {
        color: "#888",
    },
});

const TopBar = styled("div")({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
});

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
    PaperProps: {
        style: {
            maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
            width: 300,
        },
    },
};

const CommunityChatList = () => {
    const {
        auth: { userDetails },
        friends: { friends }
    } = useAppSelector((state) => state);
    const dispatch = useAppDispatch();

    const [communityChats, setCommunityChats] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [openDialog, setOpenDialog] = useState(false);
    const [openAddParticipantsDialog, setOpenAddParticipantsDialog] = useState(false);
    const [selectedChatForAddParticipants, setSelectedChatForAddParticipants] = useState<any>(null);
    const [newChatName, setNewChatName] = useState("");
    const [newChatDescription, setNewChatDescription] = useState("");
    const [isOpenToAll, setIsOpenToAll] = useState(false);
    const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
    const [selectedParticipantsForAdd, setSelectedParticipantsForAdd] = useState<string[]>([]);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isAddingParticipants, setIsAddingParticipants] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingChats, setLoadingChats] = useState(false);
    const [joiningChatId, setJoiningChatId] = useState<string | null>(null);

    const isExpert = userDetails?.role === 'expert';
    const isCustomer = userDetails?.role === 'customer';

    // Fetch available users for participant selection (experts only)
    useEffect(() => {
        if (isExpert && openDialog) {
            fetchAvailableUsers();
        } else if (isExpert && openAddParticipantsDialog) {
            fetchAvailableUsers();
        }
    }, [openDialog, openAddParticipantsDialog, isExpert]);

    const fetchAvailableUsers = async () => {
        setLoadingUsers(true);
        try {
            // For experts, get customers list
            const response = await doFilterCustomers({
                username: '',
                keywords: [],
                services: [],
                sortBy: 'Name in ASC'
            });
            
            if (response && response.result) {
                // Map to user format with id
                const users = response.result.map((customer: any) => ({
                    id: customer._id,
                    username: customer.username || customer.email,
                    email: customer.email,
                    image: customer.image
                }));
                setAvailableUsers(users);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            // Fallback to friends list if available
            if (friends && friends.length > 0) {
                setAvailableUsers(friends);
            }
        } finally {
            setLoadingUsers(false);
        }
    };

    // Fetch all community chats
    useEffect(() => {
        const fetchAllCommunityChats = async () => {
            if (!userDetails?.userId) return;
            
            setLoadingChats(true);
            try {
                const response = await getAllCommunityChats();
                // Handle case where checkForAuthorization returns false
                if (response === false) {
                    console.error('Authorization failed or error occurred');
                    return;
                }
                if (response && response.status === 'SUCCESS' && response.chats) {
                    // Add missedChats from userDetails for chats user has joined
                    const chatsWithMissed = response.chats.map((chat: any) => {
                        const missedChats = userDetails?.missedChats?.[chat._id] || 0;
                        return {
                            ...chat,
                            missedChats,
                            type: 'community'
                        };
                    });
                    
                    setCommunityChats(chatsWithMissed);
                } else {
                    const errorMsg = response?.error || response?.message || "Failed to fetch community chats";
                    console.error('Failed to fetch community chats:', response);
                    dispatch(showAlert(errorMsg));
                }
            } catch (error: any) {
                console.error('Error fetching community chats:', error);
                dispatch(showAlert(error?.message || "Failed to fetch community chats"));
            } finally {
                setLoadingChats(false);
            }
        };

        fetchAllCommunityChats();
    }, [userDetails?.userId, userDetails?.missedChats, dispatch]);

    // Search filter
    const filteredChats = communityChats.filter((chat: any) =>
        chat.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Handle create community chat
    const handleCreateChat = async () => {
        if (!newChatName.trim()) {
            dispatch(showAlert("Community chat name is required"));
            return;
        }

        setIsCreating(true);
        try {
            const response = await createCommunityChat({
                name: newChatName.trim(),
                description: newChatDescription.trim() || undefined,
                participants: isExpert ? selectedParticipants : [], // Only experts can select participants
                isOpenToAll: isOpenToAll
            });

            if (response.status === 'SUCCESS') {
                dispatch(showAlert("Community chat created successfully!"));
                // Update user details to refresh the list
                dispatch(updateMe());
                // Refresh the community chats list
                const refreshResponse = await getAllCommunityChats();
                if (refreshResponse.status === 'SUCCESS' && refreshResponse.chats) {
                    const chatsWithMissed = refreshResponse.chats.map((c: any) => {
                        const missedChats = userDetails?.missedChats?.[c._id] || 0;
                        return {
                            ...c,
                            missedChats,
                            type: 'community'
                        };
                    });
                    setCommunityChats(chatsWithMissed);
                }
                setNewChatName("");
                setNewChatDescription("");
                setIsOpenToAll(false);
                setSelectedParticipants([]);
                setOpenDialog(false);
            } else {
                dispatch(showAlert(response.error || "Failed to create community chat"));
            }
        } catch (error: any) {
            dispatch(showAlert(error?.message || "Failed to create community chat"));
        } finally {
            setIsCreating(false);
        }
    };

    // Handle add participants to existing chat
    const handleAddParticipants = async () => {
        if (!selectedChatForAddParticipants || selectedParticipantsForAdd.length === 0) {
            dispatch(showAlert("Please select at least one participant"));
            return;
        }

        setIsAddingParticipants(true);
        try {
            const response = await addParticipantsToCommunityChat({
                communityChatId: selectedChatForAddParticipants._id,
                participantIds: selectedParticipantsForAdd
            });

            if (response.status === 'SUCCESS') {
                dispatch(showAlert("Participants added successfully!"));
                dispatch(updateMe());
                // Refresh the community chats list
                const refreshResponse = await getAllCommunityChats();
                if (refreshResponse.status === 'SUCCESS' && refreshResponse.chats) {
                    const chatsWithMissed = refreshResponse.chats.map((c: any) => {
                        const missedChats = userDetails?.missedChats?.[c._id] || 0;
                        return {
                            ...c,
                            missedChats,
                            type: 'community'
                        };
                    });
                    setCommunityChats(chatsWithMissed);
                }
                setSelectedParticipantsForAdd([]);
                setSelectedChatForAddParticipants(null);
                setOpenAddParticipantsDialog(false);
            } else {
                dispatch(showAlert(response.error || "Failed to add participants"));
            }
        } catch (error: any) {
            dispatch(showAlert(error?.message || "Failed to add participants"));
        } finally {
            setIsAddingParticipants(false);
        }
    };

    // Handle join community chat
    const handleJoinChat = async (chat: any) => {
        setJoiningChatId(chat._id);
        try {
            const response = await joinCommunityChat(chat._id);
            if (response.status === 'SUCCESS') {
                dispatch(showAlert("Successfully joined the community chat!"));
                // Update user details to refresh the list
                dispatch(updateMe());
                // Refresh the community chats list
                const refreshResponse = await getAllCommunityChats();
                if (refreshResponse.status === 'SUCCESS' && refreshResponse.chats) {
                    const chatsWithMissed = refreshResponse.chats.map((c: any) => {
                        const missedChats = userDetails?.missedChats?.[c._id] || 0;
                        return {
                            ...c,
                            missedChats,
                            type: 'community'
                        };
                    });
                    setCommunityChats(chatsWithMissed);
                }
            } else {
                dispatch(showAlert(response.error || "Failed to join community chat"));
            }
        } catch (error: any) {
            dispatch(showAlert(error?.message || "Failed to join community chat"));
        } finally {
            setJoiningChatId(null);
        }
    };

    const handleOpenAddParticipants = async (chat: any) => {
        setSelectedChatForAddParticipants(chat);
        setSelectedParticipantsForAdd([]);
        
        // Fetch all users first, then filter out existing participants
        setLoadingUsers(true);
        try {
            const response = await doFilterCustomers({
                username: '',
                keywords: [],
                services: [],
                sortBy: 'Name in ASC'
            });
            
            if (response && response.result) {
                const allUsers = response.result.map((customer: any) => ({
                    id: customer._id,
                    username: customer.username || customer.email,
                    email: customer.email,
                    image: customer.image
                }));
                
                // Filter out existing participants
                const existingParticipantIds = ((chat.participants as any[]) || [])
                    .map((p: any) => {
                        if (typeof p === 'string') return p;
                        if (p && p._id) return p._id.toString();
                        if (p && p.toString) return p.toString();
                        return null;
                    })
                    .filter(Boolean) as string[];
                
                const availableForAdd = allUsers.filter((user: any) => 
                    !existingParticipantIds.includes((user.id || "").toString())
                );
                
                setAvailableUsers(availableForAdd);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            if (friends && friends.length > 0) {
                const existingParticipantIds = ((chat.participants as any[]) || [])
                    .map((p: any) => {
                        if (typeof p === 'string') return p;
                        if (p && p._id) return p._id.toString();
                        if (p && p.toString) return p.toString();
                        return null;
                    })
                    .filter(Boolean) as string[];
                
                const availableForAdd = friends.filter((user: any) => 
                    !existingParticipantIds.includes((user.id || "").toString())
                );
                setAvailableUsers(availableForAdd);
            }
        } finally {
            setLoadingUsers(false);
        }
        
        setOpenAddParticipantsDialog(true);
    };

    return (
        <MainContainer>
            {/* Top bar with title and create button (experts only) */}
            {isExpert && (
                <TopBar>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => {
                            setSelectedParticipants([]);
                            setIsOpenToAll(false);
                            setOpenDialog(true);
                        }}
                        sx={{
                            color: "#00ffff",
                            borderColor: "#00ffff",
                            textTransform: "none",
                            fontSize: "12px",
                            padding: "4px 12px",
                            "&:hover": { 
                                borderColor: "#00cccc", 
                                color: "#00cccc",
                                backgroundColor: "rgba(0, 255, 255, 0.1)"
                            },
                        }}
                    >
                        Create Community Chat
                    </Button>
                </TopBar>
            )}

            <SearchInput
                type="text"
                placeholder="Search community chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />

            {loadingChats ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                    Loading community chats...
                </div>
            ) : filteredChats.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                    No community chats found
                </div>
            ) : (
                filteredChats.map((chat: any) => {
                    const isJoined = chat.isJoined || false;
                    // Handle both populated and unpopulated admin field
                    const adminId = typeof chat.admin === 'string' 
                        ? chat.admin 
                        : chat.admin?._id || chat.admin?.id;
                    const isAdmin = adminId && adminId.toString() === userDetails.userId?.toString();
                    const rightOffset = isExpert && isAdmin ? '60px' : '8px';
                    
                    return (
                        <div key={chat._id} className="relative group">
                            <GeneralChatListItem
                                chat={chat}
                                missedChats={chat.missedChats}
                                lastChatDate={chat.updatedAt}
                            />
                            {/* Join button - show for users who haven't joined */}
                            {!isJoined && (
                                <Button
                                    size="small"
                                    startIcon={<GroupAddIcon />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleJoinChat(chat);
                                    }}
                                    disabled={joiningChatId === chat._id}
                                    sx={{
                                        position: 'absolute',
                                        right: rightOffset,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        minWidth: 'auto',
                                        padding: '4px 8px',
                                        fontSize: '10px',
                                        color: '#00ffff',
                                        opacity: 0,
                                        transition: 'opacity 0.2s',
                                        '.group:hover &': {
                                            opacity: 1
                                        },
                                        '&:hover': {
                                            backgroundColor: 'rgba(0, 255, 255, 0.1)'
                                        },
                                        '&:disabled': {
                                            opacity: 0.5
                                        }
                                    }}
                                    title="Join Community Chat"
                                >
                                    {joiningChatId === chat._id ? 'Joining...' : 'Join'}
                                </Button>
                            )}
                            {/* Add Participants button (experts only, and only if they're admin) */}
                            {isExpert && isAdmin && (
                                <Button
                                    size="small"
                                    startIcon={<PersonAddIcon />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenAddParticipants(chat);
                                    }}
                                    sx={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        minWidth: 'auto',
                                        padding: '4px 8px',
                                        fontSize: '10px',
                                        color: '#00ffff',
                                        opacity: 0,
                                        transition: 'opacity 0.2s',
                                        '.group:hover &': {
                                            opacity: 1
                                        },
                                        '&:hover': {
                                            backgroundColor: 'rgba(0, 255, 255, 0.1)'
                                        }
                                    }}
                                    title="Add Participants"
                                >
                                    Add
                                </Button>
                            )}
                        </div>
                    );
                })
            )}

            {/* Dialog for creating new community chat */}
            <Dialog 
                open={openDialog} 
                onClose={() => !isCreating && setOpenDialog(false)} 
                maxWidth="sm" 
                fullWidth
            >
                <DialogTitle>Create New Community Chat</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Chat Name *"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={newChatName}
                        onChange={(e) => setNewChatName(e.target.value)}
                        disabled={isCreating}
                        sx={{ mb: 2 }}
                        helperText="Choose a unique name for your community chat"
                    />
                    <TextField
                        margin="dense"
                        label="Description (Optional)"
                        type="text"
                        fullWidth
                        variant="outlined"
                        multiline
                        rows={3}
                        value={newChatDescription}
                        onChange={(e) => setNewChatDescription(e.target.value)}
                        disabled={isCreating}
                        helperText="Describe what this community chat is about"
                        sx={{ mb: 2 }}
                    />
                    
                    {/* Available to All option (experts only) */}
                    {isExpert && (
                        <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#000' }}>
                                <Checkbox
                                    checked={isOpenToAll}
                                    onChange={(e) => setIsOpenToAll(e.target.checked)}
                                    disabled={isCreating}
                                    sx={{
                                        color: '#00ffff',
                                        '&.Mui-checked': {
                                            color: '#00ffff',
                                        },
                                    }}
                                />
                                <span>Make this chat visible to all members.</span>
                            </label>
                        </FormControl>
                    )}
                    
                    {/* Participant selection (experts only) */}
                    {isExpert && (
                        <FormControl fullWidth sx={{ mt: 2 }}>
                            <InputLabel id="participants-label">Select Participants (Optional)</InputLabel>
                            <Select
                                labelId="participants-label"
                                id="participants-select"
                                multiple
                                value={selectedParticipants}
                                onChange={(e) => {
                                    const value = typeof e.target.value === 'string' 
                                        ? e.target.value.split(',') 
                                        : e.target.value;
                                    setSelectedParticipants(value);
                                }}
                                input={<OutlinedInput label="Select Participants (Optional)" />}
                                renderValue={(selected) => {
                                    const selectedUsers = availableUsers.filter(u => 
                                        selected.includes(u.id)
                                    );
                                    return selectedUsers.map(u => u.username).join(', ');
                                }}
                                MenuProps={MenuProps}
                                disabled={isCreating || loadingUsers}
                            >
                                {loadingUsers ? (
                                    <MenuItem disabled>Loading users...</MenuItem>
                                ) : availableUsers.length === 0 ? (
                                    <MenuItem disabled>No users available</MenuItem>
                                ) : (
                                    <>
                                        <MenuItem
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const allSelected = availableUsers.length > 0 && 
                                                    availableUsers.every(user => selectedParticipants.includes(user.id));
                                                if (allSelected) {
                                                    setSelectedParticipants([]);
                                                } else {
                                                    setSelectedParticipants(availableUsers.map(user => user.id));
                                                }
                                            }}
                                        >
                                            <Checkbox
                                                checked={availableUsers.length > 0 && 
                                                    availableUsers.every(user => selectedParticipants.includes(user.id))}
                                                indeterminate={
                                                    selectedParticipants.length > 0 && 
                                                    selectedParticipants.length < availableUsers.length
                                                }
                                            />
                                            <ListItemText primary="Select All" />
                                        </MenuItem>
                                        {availableUsers.map((user) => {
                                            const isSelected = selectedParticipants.includes(user.id);
                                            return (
                                                <MenuItem 
                                                    key={user.id} 
                                                    value={user.id}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (isSelected) {
                                                            setSelectedParticipants(selectedParticipants.filter(id => id !== user.id));
                                                        } else {
                                                            setSelectedParticipants([...selectedParticipants, user.id]);
                                                        }
                                                    }}
                                                >
                                                    <Checkbox checked={isSelected} />
                                                    <ListItemText primary={user.username || user.email} />
                                                </MenuItem>
                                            );
                                        })}
                                    </>
                                )}
                            </Select>
                        </FormControl>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            if (!isCreating) {
                                setOpenDialog(false);
                                setNewChatName("");
                                setNewChatDescription("");
                                setIsOpenToAll(false);
                                setSelectedParticipants([]);
                            }
                        }}
                        disabled={isCreating}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateChat}
                        variant="contained"
                        disabled={isCreating || !newChatName.trim()}
                        sx={{
                            backgroundColor: "#00ffff",
                            color: "#000",
                            "&:hover": { backgroundColor: "#00cccc" },
                            "&:disabled": { backgroundColor: "#666", color: "#999" },
                        }}
                    >
                        {isCreating ? "Creating..." : "Create Chat"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog for adding participants to existing chat */}
            <Dialog 
                open={openAddParticipantsDialog} 
                onClose={() => !isAddingParticipants && setOpenAddParticipantsDialog(false)} 
                maxWidth="sm" 
                fullWidth
            >
                <DialogTitle>Add Participants to "{selectedChatForAddParticipants?.name}"</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel id="add-participants-label">Select Participants</InputLabel>
                        <Select
                            labelId="add-participants-label"
                            id="add-participants-select"
                            multiple
                            value={selectedParticipantsForAdd}
                            onChange={(e) => {
                                const value = typeof e.target.value === 'string' 
                                    ? e.target.value.split(',') 
                                    : e.target.value;
                                setSelectedParticipantsForAdd(value);
                            }}
                            input={<OutlinedInput label="Select Participants" />}
                            renderValue={(selected) => {
                                const selectedUsers = availableUsers.filter(u => 
                                    selected.includes(u.id)
                                );
                                return selectedUsers.map(u => u.username).join(', ');
                            }}
                            MenuProps={MenuProps}
                            disabled={isAddingParticipants || loadingUsers}
                        >
                            {loadingUsers ? (
                                <MenuItem disabled>Loading users...</MenuItem>
                            ) : availableUsers.length === 0 ? (
                                <MenuItem disabled>No users available to add</MenuItem>
                            ) : (
                                <>
                                    <MenuItem
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const allSelected = availableUsers.length > 0 && 
                                                availableUsers.every(user => selectedParticipantsForAdd.includes(user.id));
                                            if (allSelected) {
                                                setSelectedParticipantsForAdd([]);
                                            } else {
                                                setSelectedParticipantsForAdd(availableUsers.map(user => user.id));
                                            }
                                        }}
                                    >
                                        <Checkbox
                                            checked={availableUsers.length > 0 && 
                                                availableUsers.every(user => selectedParticipantsForAdd.includes(user.id))}
                                            indeterminate={
                                                selectedParticipantsForAdd.length > 0 && 
                                                selectedParticipantsForAdd.length < availableUsers.length
                                            }
                                        />
                                        <ListItemText primary="Select All" />
                                    </MenuItem>
                                    {availableUsers.map((user) => {
                                        const isSelected = selectedParticipantsForAdd.includes(user.id);
                                        return (
                                            <MenuItem 
                                                key={user.id} 
                                                value={user.id}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (isSelected) {
                                                        setSelectedParticipantsForAdd(selectedParticipantsForAdd.filter(id => id !== user.id));
                                                    } else {
                                                        setSelectedParticipantsForAdd([...selectedParticipantsForAdd, user.id]);
                                                    }
                                                }}
                                            >
                                                <Checkbox checked={isSelected} />
                                                <ListItemText primary={user.username || user.email} />
                                            </MenuItem>
                                        );
                                    })}
                                </>
                            )}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            if (!isAddingParticipants) {
                                setOpenAddParticipantsDialog(false);
                                setSelectedParticipantsForAdd([]);
                                setSelectedChatForAddParticipants(null);
                            }
                        }}
                        disabled={isAddingParticipants}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAddParticipants}
                        variant="contained"
                        disabled={isAddingParticipants || selectedParticipantsForAdd.length === 0}
                        sx={{
                            backgroundColor: "#00ffff",
                            color: "#000",
                            "&:hover": { backgroundColor: "#00cccc" },
                            "&:disabled": { backgroundColor: "#666", color: "#999" },
                        }}
                    >
                        {isAddingParticipants ? "Adding..." : "Add Participants"}
                    </Button>
                </DialogActions>
            </Dialog>
        </MainContainer>
    );
};

export default CommunityChatList;
