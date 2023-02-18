export interface Quest {
    id: number,
    subNumber: number,
    state: string,
    name: string,
    description: string,
    phase: number[],
    repeatable: boolean,
    parallel: boolean,
    cooldownTimeMinutes: number,
    stages: QuestStage[]
}

export interface QuestStage {
    triggerType: string,
    triggerIds: string[],
    text: string,
    backupTimeSeconds: number,
    backupTextId: string,
}
