import { FieldValue } from '@google-cloud/firestore';

export type Player = {
    id: string,
    homeOffice: string,
    aisle: string,
    phase: string,
    questsComplete: string[],
    questsActive: string[],
}

export interface PlayerDAO {
    id: string,
    currentLocation: string,
    feedbackCount: number,
    questsComplete: string[] | FieldValue,
    questActive: string,
}
