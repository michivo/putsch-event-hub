import { Timestamp } from '@google-cloud/firestore';

export type Event = {
    sensorId: string,
    playerId: string,
    value: string | number | boolean,
    eventDateUtc: string,
}

export type EventDAO = {
    eventId: string,
    sensorId: string,
    playerId: string,
    value: string | number | boolean,
    eventDateUtc: Timestamp,
}
