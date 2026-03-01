import { atom } from "jotai";

export interface VideoRoomInfo {
  roomId: string;
  roomName: string;
  token: string;
  livekitUrl: string;
}

export interface LocalMediaState {
  camera: boolean;
  mic: boolean;
  screen: boolean;
}

export const activeRoomAtom = atom<VideoRoomInfo | null>(null);
export const isInCallAtom = atom<boolean>(false);
export const localMediaAtom = atom<LocalMediaState>({
  camera: true,
  mic: true,
  screen: false,
});
