import firestore from './firestore';
import config from 'config';
import { EventDAO } from '../../typings/eventDAO';

interface DataContext {
    events: FirebaseFirestore.CollectionReference<EventDAO>;
}

const names = config.get<{
    events: string;
}>('collectionNames');

const database: DataContext = {
    events: firestore.collectionReference<EventDAO>(names.events),
};

export default DataContext;
export { database, DataContext };
