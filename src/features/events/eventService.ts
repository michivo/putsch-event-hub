import { uuidv4 } from '@firebase/util';
import DataContext from '../../infrastructure/data/dataContext';
import { Event, EventDAO } from '../../typings/event';
import { FieldValue, Timestamp } from '@google-cloud/firestore';
import GameDataService from '../gameData/gameDataService';
import { PlayerQuestDAO, PlayerQuestStage, Quest } from '../../typings/quest';
import { PlayerDAO } from '../../typings/player';

type CoolDown = {
    questId: string,
    cooldownUntil: Date,
};

const coolDowns: CoolDown[] = [];

class EventService {
    constructor(private dataContext: DataContext, private gameData: GameDataService) { }

    public upsertEvent = async (event: Event): Promise<EventDAO> => {
        const existingSensorData = await this.getBySensorId(event.sensorId);
        this.setDateIfEmpty(event);

        let dao: EventDAO;
        if (existingSensorData) {
            const sensorData = existingSensorData as EventDAO;
            dao = this.mapToDao(event, sensorData.eventId);
            await this.dataContext.events.doc(sensorData.eventId).set(dao);
        } else {
            dao = this.mapToDao(event, uuidv4());
            await this.dataContext.events.doc(dao.eventId).create(dao);
        }

        await this.updateGameData(event);

        return dao;
    };

    public feedbackFriend = async (event: Event): Promise<EventDAO> => {
        const playerDoc = await this.dataContext.players.doc(event.playerId).get();
        if (playerDoc.exists) {
            if (playerDoc.data()?.feedbackCount) {
                await this.dataContext.players.doc(event.playerId).update(
                    {
                        feedbackCount: FieldValue.increment(1),
                    }
                );
            }
            else {
                await this.dataContext.players.doc(event.playerId).set({
                    feedbackCount: 1,
                }, { merge: true });
            }
        }
        else {
            await this.dataContext.players.doc(event.playerId).create({
                currentLocation: event.sensorId,
                id: event.playerId,
                questActive: '',
                questsComplete: [],
                feedbackCount: 1,
            });
        }

        return this.upsertEvent(event);
    }

    public upsertEventsBulk = async (events: Event[]): Promise<EventDAO[]> => {
        const existingSensorDataEntries = await this.getBySensorIds(events.map(e => e.sensorId));

        const batch = this.dataContext.events.firestore.batch();
        const daos: EventDAO[] = [];
        for (const event of events) {
            let dao: EventDAO;
            this.setDateIfEmpty(event);
            const existingSensorData = existingSensorDataEntries?.find(e => e.sensorId === event.sensorId);
            if (existingSensorData) {
                const sensorData = existingSensorData as EventDAO;
                dao = this.mapToDao(event, sensorData.eventId);
                await batch.set(this.dataContext.events.doc(sensorData.eventId), dao);
            } else {
                dao = this.mapToDao(event, uuidv4());
                await batch.create(this.dataContext.events.doc(dao.eventId), dao);
            }

            await this.updateGameData(event, batch);
            daos.push(dao);
        }
        await batch.commit();
        return daos;
    };

    public startQuest = async (playerId: string, questId: string): Promise<void> => {
        const quests = await this.gameData.getQuests();
        const quest = quests.find((q) => q.id === questId);
        if (!quest) {
            throw new Error(`Quest with id ${questId} could not be found!`);
        }
        if (!quest.stages || quest.stages.length === 0) {
            throw new Error(`Quest with id ${questId} does not have any stages.`);
        }
        const players = await this.gameData.getPlayers();
        const player = players.find((p) => p.id === playerId);
        if (!player && !playerId.startsWith('R')) {
            throw new Error(`Player with id ${playerId} could not be found!`);
        }

        const firstStage = quest.stages[0];

        const playerQuest: PlayerQuestDAO = {
            backupTextId: firstStage.backupTextId,
            backupTimeSeconds: firstStage.backupTimeSeconds,
            name: firstStage.name,
            text: '',
            triggerIds: firstStage.triggerIds,
            triggerType: firstStage.triggerType,
            playerId: playerId,
            stageIndex: 0,
            questId: questId,
            playlistName: playerId.startsWith('R') ? firstStage.playlistName : '',
            currentLocation: '',
            stageCount: quest.stages.length,
            delaySeconds: firstStage.sleepTime ?? 0,
            homeOffice: player?.homeOffice ?? '',
            npcName: firstStage.npcName,
            homeRadio: player?.homeRadio ?? '',
        };
        console.log(`Creating/Updating quest for player with id ${playerId}`);
        await this.dataContext.playerQuests.doc(playerId).set(playerQuest);
        if (quest.cooldownTimeMinutes && !isNaN(quest.cooldownTimeMinutes)) {
            const existingCooldown = coolDowns.find(q => q.questId === quest.id);
            const now = new Date();
            if (existingCooldown) {
                existingCooldown.cooldownUntil = this.addMinutes(now, quest.cooldownTimeMinutes);
            }
            else {
                coolDowns.push({
                    questId: quest.id,
                    cooldownUntil: this.addMinutes(now, quest.cooldownTimeMinutes),
                });
            }
        }

        await this.dataContext.players.doc(playerQuest.playerId).set({
            id: playerQuest.playerId,
            questActive: questId,
        },
            { merge: true });

        if (firstStage.sleepTime && quest.stages.length > 0) {
            const sleepTimeMs = (firstStage.sleepTime ?? 0) * 1000;
            console.log(`First stage has a sleep time of ${sleepTimeMs}`);
            setTimeout(async () => {
                await this.startStageDelayed(playerQuest.playerId, playerQuest.questId, 0, playerQuest.triggerIds[0]);
            }, sleepTimeMs);
        }
    };

    public resetPlayers = async (playerId: string | undefined) => {
        if (playerId) {
            this.dataContext.playerQuests.doc(playerId).delete();
            this.dataContext.players.doc(playerId).delete();
            console.log(`Deleted quest and player with id ${playerId}`);
            return;
        }

        const querySnapshot = await this.dataContext.playerQuests.get();
        const playerSnapshot = await this.dataContext.players.get();

        console.log(`Deleting ${querySnapshot.docs} player quests`);
        for (const quest of querySnapshot.docs) {
            await quest.ref.delete();
        }
        for (const player of playerSnapshot.docs) {
            await player.ref.delete();
        }

        console.log(`Deleted ${querySnapshot.docs.length} player quests.`);
        console.log(`Deleted ${playerSnapshot.docs.length} players.`);
    };

    public getCurrentStage = async (playerId: string): Promise<PlayerQuestStage | undefined> => {
        const playerQuest = await this.dataContext.playerQuests.doc(playerId).get();
        if (!playerQuest.exists) {
            return undefined;
        }

        const questData = playerQuest.data();
        if (!questData) {
            return undefined;
        }

        return {
            backupTextId: questData.backupTextId,
            backupTimeSeconds: questData.backupTimeSeconds,
            text: questData.text,
            triggerIds: questData.triggerIds,
            triggerType: questData.triggerType,
            stageIndex: questData.stageIndex,
            name: questData.name,
            playlistName: questData.playlistName,
        };
    };

    public dummyUpdateData = async (playerId: string, playlistName: string): Promise<void> => {
        const query = await this.dataContext.playerQuests
            .where('playerId', '==', playerId)
            .limit(1);

        const results = await query.get();
        const playerQuest: PlayerQuestDAO = {
            backupTextId: 'dummy',
            backupTimeSeconds: 1234,
            name: 'bauxi dummy stage',
            text: '',
            triggerIds: [],
            triggerType: 'DUMMY',
            playerId: playerId,
            stageIndex: 0,
            questId: 'DUMMY',
            playlistName: playlistName,
            currentLocation: 'Toilet',
            stageCount: 99,
            delaySeconds: 0,
            homeOffice: 'Toilet',
            npcName: 'NPC1',
            homeRadio: 'R12',
        };
        if (!results.empty) {
            console.log(`Updating dummy quest for player with id ${playerId}`);
            await this.dataContext.playerQuests.doc(playerId).set(playerQuest);
        } else {
            console.log(`Creating dummy quest for player with id ${playerId}`);
            await this.dataContext.playerQuests.doc(playerId).create(playerQuest);
        }
    };

    public getPlayableQuests = async (playerId: string, phaseId: string): Promise<Quest[]> => {
        console.log(`Getting playable quests for ${playerId}, phase ${phaseId}`);
        try {
            const playerQuery = this.dataContext.players.doc(playerId);

            const playerQueryResult = await playerQuery.get();
            let playerDao: PlayerDAO;
            if (!playerQueryResult.exists) {
                console.log(`Could not find active player record for player ${playerId}.`);
                playerDao = {
                    id: playerId,
                    currentLocation: '',
                    questActive: '',
                    questsComplete: [],
                    feedbackCount: 0,
                };
            }
            else {
                playerDao = playerQueryResult.data() ?? {
                    id: playerId,
                    currentLocation: '',
                    questActive: '',
                    questsComplete: [],
                    feedbackCount: 0,
                };
            }

            let allQuests = await this.gameData.getQuests();
            if (phaseId) {
                const phase = parseInt(phaseId, 10);
                if (phase) {
                    allQuests = allQuests.filter(q => q.phases.includes(phase));
                }
            }

            return await this.findQuestsForPlayer(allQuests, playerDao);
        }
        catch (error) {
            console.error(error);
            throw error;
        }
    }

    private updateGameData = async (event: Event, batch: FirebaseFirestore.WriteBatch | undefined = undefined): Promise<void> => {
        let query: FirebaseFirestore.Query<PlayerQuestDAO>;
        if (event.playerId) {
            query = await this.dataContext.playerQuests
                .where('playerId', '==', event.playerId)
                .where('triggerIds', 'array-contains', event.sensorId)
                .limit(1);
        } else {
            query = await this.dataContext.playerQuests
                .where('triggerIds', 'array-contains', event.sensorId);
        }

        const results = await query.get();
        if (!results.empty) {
            const quests = await this.gameData.getQuests();
            for (const questDocument of results.docs) {
                const playerQuest = questDocument.data();
                const quest = quests.find((q) => q.id === playerQuest.questId);
                if (quest) {
                    // if (playerQuest.delaySeconds && playerQuest.stageIndex !== -1) {
                    //     console.log(`Delaying next stage by ${playerQuest.delaySeconds}s`);
                    //     setTimeout(async () => {
                    //         console.log(`Updating quest ${playerQuest.questId} for ${playerQuest.playerId}.`);
                    //         await this.updatePlayerQuest(playerQuest, quest, event);
                    //         await this.dataContext.playerQuests.doc(playerQuest.playerId).set(playerQuest);
                    //     }, 1000 * playerQuest.delaySeconds);
                    // }
                    // else {
                    this.updatePlayerQuest(playerQuest, quest, event);
                    if (batch) {
                        batch.set(this.dataContext.playerQuests.doc(playerQuest.playerId), playerQuest);
                    }
                    else {
                        await this.dataContext.playerQuests.doc(playerQuest.playerId).set(playerQuest);
                    }
                    // }
                } else {
                    console.log(`Could not find quest with id ${playerQuest.questId}`);
                    await this.updatePlayerLocation(event.playerId, event.sensorId);
                }
            }
        } else {
            console.log(
                `Received trigger for player ${event.playerId} and trigger ${event.sensorId}, but couldn't find active game`
            );

            await this.updatePlayerLocation(event.playerId, event.sensorId);

            await this.tryStartQuest(event.sensorId);
        }
    };

    private tryStartQuest = async (sensorId: string) => {
        const quests = await this.gameData.getQuests();
        const questsStartingAtLocation = quests.filter(q => q.stages.length > 0 &&
            q.stages[0].triggerType === 'ORT' &&
            q.stages[0].triggerIds.length > 0 &&
            q.stages[0].triggerIds.includes(sensorId));
        console.log(`Found ${questsStartingAtLocation.length} quests starting at location ${sensorId}`);

        if (questsStartingAtLocation.length === 0) {
            return;
        }

        const inactivePlayersQuery = await this.dataContext.players
            .where('currentLocation', '==', sensorId);

        const inactivePlayers = await inactivePlayersQuery.get();
        for (const player of inactivePlayers.docs) {
            const playerData = player.data();
            if (playerData.questActive) {
                continue;
            }
            const questsNotStarted = this.findQuestsForPlayer(questsStartingAtLocation, playerData);
            if (questsNotStarted.length > 0) {
                const questNotStarted = questsNotStarted[0];
                console.log(`Starting new quest ${questNotStarted.id} for player ${playerData.id}`);
                await this.startQuest(playerData.id, questNotStarted.id);
                const sensorEvent: Event = {
                    playerId: player.id,
                    sensorId,
                    value: '',
                    eventDateUtc: '',
                };
                this.setDateIfEmpty(sensorEvent);
                await this.updateGameData(sensorEvent);
            }
        }
    }

    private logQuestCandidates(prefix: string, candidates: Quest[]) {
        console.log(`${prefix} ${candidates.map(c => c.id).join(', ')}`);
    }

    private findQuestsForPlayer(candidates: Quest[], player: PlayerDAO): Quest[] {
        this.logQuestCandidates(`Initial candidates for player ${JSON.stringify(player)}`, candidates);
        const filteredCandidates = candidates.filter(q =>
            !player.questsComplete ||
            (player.questsComplete as string[]).includes(q.id) === false);
        this.logQuestCandidates(`Unplayed by player ${player.id}`, filteredCandidates);
        const candidatesAfterPlayerPreconditions: Quest[] = [];
        for (const candidate of filteredCandidates) {
            const playerIds = this.getPlayerIds(candidate.preconditionsPlayer);
            if (playerIds.length === 0 || playerIds.includes(player.id)) {
                candidatesAfterPlayerPreconditions.push(candidate);
            }
        }
        this.logQuestCandidates(`Playable by player ${player.id}`, candidatesAfterPlayerPreconditions);

        const candidatesAfterQuestPreconditions: Quest[] = [];
        for (const candidate of candidatesAfterPlayerPreconditions) {
            if (!candidate.preconditionsQuest || !candidate.preconditionsQuest.trim()) {
                candidatesAfterQuestPreconditions.push(candidate);
                continue;
            }
            const preconditionList = candidate.preconditionsQuest.trim().split(',').map(q => q.trim());

            for (const questId of preconditionList) {
                if (questId.endsWith('*')) {
                    const prefix = questId.substring(0, questId.length - 1);
                    if (player.questsComplete && (player.questsComplete as string[]).find(q => q.startsWith(prefix))) {
                        if (candidatesAfterQuestPreconditions.includes(candidate) === false) {
                            candidatesAfterQuestPreconditions.push(candidate);
                        }
                    }
                    continue;
                }
                else if (questId.startsWith('!')) {
                    const negatedQuestId = questId.substring(1);
                    if (player.questsComplete && (player.questsComplete as string[]).includes(negatedQuestId)) {
                        const questIndex = candidatesAfterQuestPreconditions.findIndex(q => q.id === candidate.id);
                        if (questIndex > -1) {
                            candidatesAfterQuestPreconditions.splice(questIndex, 1);
                        }
                    }
                }
                else if (player.questsComplete && (player.questsComplete as string[]).includes(questId)) {
                    if (candidatesAfterQuestPreconditions.includes(candidate) === false) {
                        candidatesAfterQuestPreconditions.push(candidate);
                    }
                }
            }
        }
        // this.logQuestCandidates(`Playable after quest preconditions for ${player.id}`, candidatesAfterQuestPreconditions);

        const candidatesAfterCooldowns: Quest[] = [];
        const now = new Date();
        for(const candidate of candidatesAfterQuestPreconditions) {
            const coolDown = coolDowns.find(cd => cd.questId === candidate.id);
            if(coolDown && now < coolDown.cooldownUntil) {
                console.log(`Skipping quest ${candidate.id}, because it's still cooling down until ${coolDown.cooldownUntil}`);
            }
            else {
                candidatesAfterCooldowns.push(candidate);
            }
        }
        this.logQuestCandidates(`Playable after all preconditions for ${player.id}`, candidatesAfterCooldowns);

        if (candidatesAfterCooldowns.length === 0) {
            return [];
        }

        return candidatesAfterCooldowns;
    }

    private getPlayerIds(preconditions: string): string[] {
        if (!preconditions) {
            return [];
        }
        const trimmedConditions = preconditions.trim();
        if (/^P\d+$/.test(trimmedConditions)) {
            return [trimmedConditions];
        }
        if (/^P\d+-P\d+$/.test(trimmedConditions)) {
            const ids = trimmedConditions.split('-');
            const startId = parseInt(ids[0].substring(1));
            const endId = parseInt(ids[1].substring(2));
            const result: string[] = [];
            for (let id = startId; id <= endId; id++) {
                result.push(`P${id}`);
            }
            return result;
        }
        if (/^(P\d+,\s*)+P\d+$/.test(trimmedConditions)) {
            return trimmedConditions.split(',').map(c => c.trim());
        }
        return [];
    }


    private updatePlayerQuest = async (playerQuest: PlayerQuestDAO, quest: Quest, event: Event) => {
        const nextStageIndex = playerQuest.stageIndex + 1;
        playerQuest.text = quest.stages[playerQuest.stageIndex].text;
        if (nextStageIndex >= quest.stages.length) {
            console.log(
                `Player ${playerQuest.playerId} has reached the final stage of quest ${playerQuest.questId}`
            );
            if (playerQuest.triggerType === 'ORT') {
                playerQuest.currentLocation = event.sensorId;
            }
            playerQuest.stageIndex = -1;
            playerQuest.triggerIds = [];
            playerQuest.triggerType = '';
            playerQuest.name = '---DONE---';
            playerQuest.backupTextId = '';
            playerQuest.backupTimeSeconds = -1;
            playerQuest.playlistName = '';
            playerQuest.playlistName = quest.stages[nextStageIndex - 1].playlistName;
            playerQuest.stageCount = quest.stages.length;
            playerQuest.delaySeconds = quest.stages[nextStageIndex - 1].sleepTime ?? 0;
            playerQuest.npcName = '';

            if (quest.stages[nextStageIndex - 1].sleepTime) {
                const sleepTimeMs = (quest.stages[nextStageIndex - 1].sleepTime ?? 0) * 1000;
                console.log(`Final stage had a sleep time of ${sleepTimeMs}`);
                setTimeout(async () => {
                    console.log(`Checking if we can trigger the next stage for ${playerQuest.playerId}`);
                    await this.dataContext.players.doc(playerQuest.playerId).set({
                        id: playerQuest.playerId,
                        questActive: '',
                        questsComplete: FieldValue.arrayUnion(playerQuest.questId),
                        currentLocation: playerQuest.currentLocation,
                    },
                        { merge: true });
                    await this.checkTriggerNextQuest(event.playerId, playerQuest.questId);
                }, sleepTimeMs);
            }
            else {
                await this.dataContext.players.doc(playerQuest.playerId).set({
                    id: playerQuest.playerId,
                    questActive: '',
                    questsComplete: FieldValue.arrayUnion(playerQuest.questId),
                    currentLocation: playerQuest.currentLocation,
                }, { merge: true });

                await this.checkTriggerNextQuest(event.playerId, playerQuest.questId);
            }
        } else {
            console.log(
                `Player ${playerQuest.playerId} has reached stage ${nextStageIndex + 1
                } of quest ${playerQuest.questId}`
            );
            if (playerQuest.triggerType === 'ORT') {
                playerQuest.currentLocation = event.sensorId;
            }
            playerQuest.stageIndex = nextStageIndex;
            playerQuest.triggerIds = quest.stages[nextStageIndex].triggerIds;
            if (playerQuest.triggerIds.includes('HOME')) {
                playerQuest.triggerIds.push(playerQuest.homeOffice);
            }
            playerQuest.triggerType = quest.stages[nextStageIndex].triggerType;
            playerQuest.name = quest.stages[nextStageIndex].name;
            playerQuest.backupTextId = quest.stages[nextStageIndex].backupTextId;
            playerQuest.backupTimeSeconds = quest.stages[nextStageIndex].backupTimeSeconds;
            playerQuest.playlistName = quest.stages[nextStageIndex - 1].playlistName;
            playerQuest.stageCount = quest.stages.length;
            playerQuest.delaySeconds = quest.stages[nextStageIndex - 1].sleepTime ?? 0;
            playerQuest.npcName = quest.stages[nextStageIndex].npcName;

            await this.dataContext.players.doc(playerQuest.playerId).set({
                id: playerQuest.playerId,
                currentLocation: playerQuest.currentLocation,
            }, { merge: true });

            console.log(`Checking for radio playlist ${quest.stages[nextStageIndex - 1].radioId} and ${quest.stages[nextStageIndex - 1].radioPlaylistName}`);
            if (quest.stages[nextStageIndex - 1].radioId && quest.stages[nextStageIndex - 1].radioPlaylistName) {
                let radioId = quest.stages[nextStageIndex - 1].radioId;
                if (radioId === 'R HOME' && playerQuest.homeRadio) {
                    radioId = playerQuest.homeRadio;
                    console.log(`Using ${playerQuest.homeRadio} instead of 'HOME'`);
                }
                if (radioId !== 'R HOME') {
                    console.log(`Setting playlist ${quest.stages[nextStageIndex - 1].radioPlaylistName} for radio ${radioId}.`)
                    await this.dataContext.playerQuests.doc(radioId).set(
                        { playerId: radioId, playlistName: quest.stages[nextStageIndex - 1].radioPlaylistName }, { merge: true });
                }
                else {
                    console.log('No home radio found.');
                }
            }

            if (quest.stages[nextStageIndex - 1].sleepTime) {
                const sleepTimeMs = (quest.stages[nextStageIndex - 1].sleepTime ?? 0) * 1000;
                console.log(`Current stage has a sleep time of ${sleepTimeMs}`);
                setTimeout(async () => {
                    await this.startStageDelayed(playerQuest.playerId, playerQuest.questId, nextStageIndex, playerQuest.triggerIds[0]);
                }, sleepTimeMs);
            }
        }
    }

    private startStageDelayed = async (playerId: string, questId: string, stageIndex: number, triggerId: string) => {
        console.log(`Not implemented - if we can trigger the next stage for ${playerId}/${questId}/${stageIndex}`);
        if (playerId) {
            return;
        }
        const currentQuestDataQuery = await this.dataContext.playerQuests.doc(playerId).get();
        const quests = await this.gameData.getQuests();
        const quest = quests.find(q => q.id === questId);
        if (!currentQuestDataQuery.exists) {
            console.log(`Could not find quest for player ${playerId}`);
            return;
        }
        if (!quest) {
            console.log(`Quest with id ${questId} was not found. That should not happen.`);
            return;
        }
        const currentQuest = currentQuestDataQuery.data();
        if (currentQuest?.questId !== questId || currentQuest?.stageIndex !== stageIndex) {
            console.log(`Quest has changed in the meantime for ${playerId} to ${currentQuest?.questId}/${currentQuest?.stageIndex}, aborting.`);
            return;
        }
        const event = {
            playerId: playerId,
            sensorId: triggerId,
            value: '',
            eventDateUtc: new Date().toISOString(),
        };

        await this.updatePlayerQuest(currentQuest, quest, event);
        await this.dataContext.playerQuests.doc(playerId).set(currentQuest);
    }

    private checkTriggerNextQuest = async (playerId: string, finishedQuestId: string) => {
        console.log(`Checking if next quest can be triggered for player ${playerId} after finishing ${finishedQuestId}`);
        const allQuests = await this.gameData.getQuests();
        const questTriggeredQuest = allQuests.filter(q => q.stages && q.stages.length > 0 && q.stages[0].triggerType === 'QUEST' &&
            q.stages[0].triggerIds && q.stages[0].triggerIds.includes(finishedQuestId));

        if (questTriggeredQuest.length === 0) {
            console.log('No triggerable next quest.');
            return;
        }

        const playerQuery = this.dataContext.players.doc(playerId);

        const playerQueryResult = await playerQuery.get();
        if (!playerQueryResult.exists) {
            console.log('Player not found.')
            return;
        }
        const playerDao = playerQueryResult.data();
        if (!playerDao) {
            console.log('Player data not found.')
            return;
        }

        const playableQuest = this.findQuestsForPlayer(questTriggeredQuest, playerDao);
        if (playableQuest.length === 0) {
            console.log(`Could not find playable quest for player ${playerId} after finishing quest ${finishedQuestId}`);
        }

        console.log(`Starting next quest ${playableQuest[0].id} for ${playerId}.`);
        await this.startQuest(playerId, playableQuest[0].id);
        await this.updateGameData({
            playerId: playerId,
            sensorId: finishedQuestId,
            value: '',
            eventDateUtc: new Date().toISOString(),
        });
    }

    async updatePlayerLocation(playerId: string, sensorId: string): Promise<void> {
        if (!playerId || !sensorId) {
            return;
        }

        const playerQuery = await this.dataContext.playerQuests
            .where('playerId', '==', playerId)
            .limit(1);

        const results = await playerQuery.get();
        if (!results.empty) {
            const playerQuest = results.docs[0].data();
            playerQuest.currentLocation = sensorId;
            await this.dataContext.playerQuests.doc(playerQuest.playerId).set(playerQuest);
        }

        this.dataContext.players.doc(playerId).set({
            id: playerId,
            currentLocation: sensorId,
        },
            { merge: true });
    }

    public get = async (): Promise<Event[]> => {
        const querySnapshot = await this.dataContext.events.get();
        const events = querySnapshot.docs.map((doc) => {
            return this.mapToDto(doc.data() as EventDAO);
        });

        return events;
    };

    private setDateIfEmpty(event: Event) {
        if (!event.eventDateUtc) {
            const now = new Date();
            event.eventDateUtc = now.toISOString();
        }
    }

    private async getBySensorId(sensorId: string): Promise<EventDAO | undefined> {
        const querySnapshot = await this.dataContext.events
            .where('sensorId', '==', sensorId)
            .limit(1)
            .get();

        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data() as EventDAO;
        }
    }


    private async getBySensorIds(sensorIds: string[]): Promise<EventDAO[] | undefined> {
        const distinctIds = sensorIds.filter(this.onlyUnique);
        const querySnapshot = await this.dataContext.events
            .where('sensorId', 'in', distinctIds)
            .get();

        if (!querySnapshot.empty) {
            const events = querySnapshot.docs.map((doc) => doc.data() as EventDAO);
            return events;
        }
    }

    private onlyUnique<T>(value: T, index: number, array: T[]): boolean {
        return array.indexOf(value) === index;
    }

    private mapToDao = (event: Event, id = ''): EventDAO => {
        return {
            eventId: id,
            playerId: event.playerId,
            sensorId: event.sensorId,
            value: event.value,
            eventDateUtc: Timestamp.fromDate(new Date(event.eventDateUtc)),
        };
    };

    private mapToDto = (event: EventDAO): Event => {
        return {
            playerId: event.playerId,
            sensorId: event.sensorId,
            value: event.value,
            eventDateUtc: event.eventDateUtc.toDate().toISOString(),
        };
    };

    private addMinutes = (date: Date, minutes: number) => {
        return new Date(date.getTime() + minutes * 60000);
    }
}

export default EventService;
