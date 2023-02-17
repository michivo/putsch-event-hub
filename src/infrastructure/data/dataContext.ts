import firestore from './firestore';
import config from 'config';
import { EventDAO } from '../../typings/event';
import { PlayerQuestDAO } from '../../typings/quest';

interface DataContext {
    events: FirebaseFirestore.CollectionReference<EventDAO>;
    playerQuests: FirebaseFirestore.CollectionReference<PlayerQuestDAO>;
}

const names = config.get<{
    events: string;
    playerQuests: string;
}>('collectionNames');

const database: DataContext = {
    events: firestore.collectionReference<EventDAO>(names.events),
    playerQuests: firestore.collectionReference<PlayerQuestDAO>(names.playerQuests),
};

export default DataContext;
export { database, DataContext };
