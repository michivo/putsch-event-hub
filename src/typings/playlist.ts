export interface PlaylistEntry {
    id: string,
    name: string,
}

export interface Playlist {
    name: string,
    audioFiles: PlaylistEntry[],
}

export interface Playlists {
    names: string[],
}
