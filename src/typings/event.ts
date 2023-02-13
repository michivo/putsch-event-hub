export type Event = {
    sensorId: string,
    playerId: string,
    value: string | number | boolean
}

export enum ValueType {
    Boolean,
    Number,
    String,
};