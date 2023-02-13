import { uuidv4 } from '@firebase/util';
import DataContext from '../../infrastructure/data/dataContext';
import { Event } from '../../typings/event';
import { EventDAO } from '../../typings/eventDAO';

class EventService {
    constructor(private dataContext: DataContext) {

    }

    public upsertEvent = async (event: Event): Promise<EventDAO> => {
        const existingSensorData = await this.getBySensorId(event.sensorId);
        let dao: EventDAO;
        if (existingSensorData) {
            const sensorData = existingSensorData as EventDAO;
            dao = this.mapToDao(event, sensorData.eventId);
            await this.dataContext.events.doc(sensorData.eventId).set(dao);
        }
        else {
            dao = this.mapToDao(event, uuidv4());
            await this.dataContext.events.doc(dao.eventId).create(dao);
        }

        return dao;
    };

    public get = async (): Promise<Event[]> => {
        const querySnapshot = await this.dataContext.events.get();
        const events = querySnapshot.docs.map((doc) => {
            return this.mapToDto(doc.data() as EventDAO);
        });

        return events;
    };

    private async getBySensorId(
        sensorId: string,
    ): Promise<EventDAO | undefined> {
        const querySnapshot = await this.dataContext.events
            .where('sensorId', '==', sensorId)
            .limit(1)
            .get();

        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data() as EventDAO;
        }
    }

    private mapToDao = (event: Event, id = ''): EventDAO => {
        return {
            eventId: id,
            playerId: event.playerId,
            sensorId: event.sensorId,
            value: event.value
        };
    };

    private mapToDto = (event: EventDAO): Event => {
        return {
            playerId: event.playerId,
            sensorId: event.sensorId,
            value: event.value
        };
    };
}

export default EventService;
