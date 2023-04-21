export interface Quest {
    id: string,
    subNumber: number,
    state: string,
    name: string,
    description: string,
    phase: number[],
    repeatable: boolean,
    parallel: boolean,
    cooldownTimeMinutes: number,
    stages: QuestStage[],
    preconditionsPlayer: string,
    preconditionsQuest: string,
}

export interface QuestStage {
    name: string,
    triggerType: string,
    triggerIds: string[],
    text: string,
    backupTimeSeconds: number,
    backupTextId: string,
    playlistName: string,
    radioId: string,
    radioPlaylistName: string,
    preconditions: string,
    sleepTime: number | undefined | null,
}

export interface PlayerQuestDAO {
    playerId: string,
    name: string,
    triggerType: string,
    triggerIds: string[],
    text: string,
    backupTimeSeconds: number,
    backupTextId: string,
    stageIndex: number,
    questId: string,
    playlistName: string,
    currentLocation: string,
    stageCount: number,
    delaySeconds: number,
    homeOffice: string,
}

export interface PlayerQuestStage {
    triggerType: string,
    triggerIds: string[],
    text: string,
    backupTimeSeconds: number,
    backupTextId: string,
    stageIndex: number,
    name: string,
    playlistName: string,
}
