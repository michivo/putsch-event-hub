import firestore from './firestore';
import config from 'config';
import { EventDAO } from '../../typings/event';
import { PlayerQuestDAO } from '../../typings/quest';
import { PlayerDAO } from '../../typings/player';

interface DataContext {
    events: FirebaseFirestore.CollectionReference<EventDAO>;
    playerQuests: FirebaseFirestore.CollectionReference<PlayerQuestDAO>;
    players: FirebaseFirestore.CollectionReference<PlayerDAO>;
}

const names = config.get<{
    events: string;
    playerQuests: string;
    players: string;
}>('collectionNames');

const database: DataContext = {
    events: firestore.collectionReference<EventDAO>(names.events),
    playerQuests: firestore.collectionReference<PlayerQuestDAO>(names.playerQuests),
    players: firestore.collectionReference<PlayerDAO>(names.players),
};

export default DataContext;
export { database, DataContext };
