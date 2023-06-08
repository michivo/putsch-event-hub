import DataContext from '../../infrastructure/data/dataContext';
import { AudioSettings, AudioSettingsDAO } from '../../typings/audioSettings';

const defaultVolume = 50;

class EventService {
    constructor(private dataContext: DataContext) { }

    public setVolume = async (settings: AudioSettings): Promise<AudioSettings> => {
        console.log(`Setting volume for ${settings.playerId} to ${settings.volume}`);
        const dao: AudioSettingsDAO = {
            playerId: settings.playerId,
            volume: settings.volume,
        };
        if(dao.volume < 0) {
            dao.volume = 0;
        }
        if(dao.volume > 100) {
            dao.volume = 100;
        }
        if(dao.volume !== settings.volume) {
            console.log(`After limiting: Setting volume for ${settings.playerId} to ${settings.volume}`);
        }
        await this.dataContext.audioSettings.doc(settings.playerId).set(dao);

        return settings;
    }

    public getVolume = async (playerId: string): Promise<AudioSettings> => {
        try {
            const query = this.dataContext.audioSettings.doc(playerId);
            const entry = await query.get();

            if (entry.exists) {
                const result = entry.data();
                if (result) {
                    return {
                        playerId,
                        volume: result.volume,
                    };
                }
            }
        }
        catch(err: unknown) {
            console.log(`Error getting volume settings for ${playerId}`);
            console.log(err);
        }

        return {
            playerId,
            volume: defaultVolume,
        };
    }
}

export default EventService;
