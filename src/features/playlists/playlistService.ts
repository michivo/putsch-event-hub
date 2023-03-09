import { Playlist, PlaylistEntry } from '../../typings/playlist';

import credentials from '../../keys/sheets-service-account.json';
import { google } from 'googleapis';

const scopes = ['https://www.googleapis.com/auth/drive.metadata.readonly'];

class PlaylistService {
    getPlaylist = async (name: string): Promise<Playlist> => {
        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: scopes,
        });
        const drive = google.drive({ version: 'v3', auth });
        try {
            const res = await drive.files.list({
                pageSize: 1,
                q: `mimeType = 'application/vnd.google-apps.folder' and name='${name}'`,
            });
            if (res.data && res.data.files && res.data.files.length > 0) {
                const parentId = res.data.files[0].id;
                const filesRes = await drive.files.list({
                    pageSize: 100,
                    q: `mimeType = 'audio/mpeg' and '${parentId}' in parents`,
                });

                const ids: PlaylistEntry[] = [];
                filesRes.data.files?.forEach((f) => {
                    if (f.id) {
                        ids.push({ id: f.id, name: f.name ?? '-unknown-' });
                    }
                });
                console.log(ids);
                return {
                    name: name,
                    audioFiles: ids,
                }; // https://drive.google.com/uc?id=12HstEXZVOfKs5OXvTHP5Ndq-EbR-I3e0&export=download
                // alt: <iframe
//   frameborder="0"
//   width="400"
//   height="200"
//   src="https://drive.google.com/file/d/1234xyz/preview">
// </iframe>
            }
        } catch (ex) {
            console.log(ex);
        }
        return {
            name: name,
            audioFiles: [],
        };
    };
}

export default PlaylistService;
