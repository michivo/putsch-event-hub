import firestore from './firestore';
import config from 'config';
import { EventDAO } from '../../typings/event';
import { PlayerQuestDAO } from '../../typings/quest';
import { PlayerDAO } from '../../typings/player';
import { AudioSettingsDAO } from '../../typings/audioSettings';

interface DataContext {
    events: FirebaseFirestore.CollectionReference<EventDAO>;
    playerQuests: FirebaseFirestore.CollectionReference<PlayerQuestDAO>;
    players: FirebaseFirestore.CollectionReference<PlayerDAO>;
    audioSettings: FirebaseFirestore.CollectionReference<AudioSettingsDAO>;
}

const names = config.get<{
    events: string;
    playerQuests: string;
    players: string;
    audioSettings: string;
}>('collectionNames');

const database: DataContext = {
    events: firestore.collectionReference<EventDAO>(names.events),
    playerQuests: firestore.collectionReference<PlayerQuestDAO>(names.playerQuests),
    players: firestore.collectionReference<PlayerDAO>(names.players),
    audioSettings: firestore.collectionReference<AudioSettingsDAO>(names.audioSettings),
};

export default DataContext;
export { database, DataContext };
