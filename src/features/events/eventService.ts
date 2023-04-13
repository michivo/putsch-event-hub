import { uuidv4 } from '@firebase/util';
import DataContext from '../../infrastructure/data/dataContext';
import { Event, EventDAO } from '../../typings/event';
import { FieldValue, Timestamp } from '@google-cloud/firestore';
import GameDataService from '../gameData/gameDataService';
import { PlayerQuestDAO, PlayerQuestStage, Quest } from '../../typings/quest';

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
        if (quest.stages.length === 0) {
            throw new Error(`Quest with id ${questId} does not have any stages.`);
        }
        const players = await this.gameData.getPlayers();
        const player = players.find((p) => p.id === playerId);
        if (!player) {
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
            playlistName: '',
            currentLocation: '',
            stageCount: quest.stages.length,
            delaySeconds: 0,
        };
        console.log(`Creating/Updating quest for player with id ${playerId}`);
        await this.dataContext.playerQuests.doc(playerId).set(playerQuest);

        this.dataContext.players.doc(playerQuest.playerId).set({
            id: playerQuest.playerId,
            questActive: questId,
        },
            { merge: true });
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
        };
        if (!results.empty) {
            console.log(`Updating dummy quest for player with id ${playerId}`);
            await this.dataContext.playerQuests.doc(playerId).set(playerQuest);
        } else {
            console.log(`Creating dummy quest for player with id ${playerId}`);
            await this.dataContext.playerQuests.doc(playerId).create(playerQuest);
        }
    };

    private updateGameData = async (event: Event, batch: FirebaseFirestore.WriteBatch | undefined = undefined): Promise<void> => {
        let query: FirebaseFirestore.Query<PlayerQuestDAO>;
        if (event.playerId) {
            query = await this.dataContext.playerQuests
                .where('playerId', '==', event.playerId)
                .where('triggerIds', 'array-contains', event.sensorId)
                .limit(1);
        } else {
            query = await this.dataContext.playerQuests
                .where('triggerIds', 'array-contains', event.sensorId)
                .limit(1);
        }

        const results = await query.get();
        if (!results.empty) {
            const quests = await this.gameData.getQuests(true);
            for (const questDocument of results.docs) {
                const playerQuest = questDocument.data();
                const quest = quests.find((q) => q.id === playerQuest.questId);
                if (quest) {
                    this.updatePlayerQuest(playerQuest, quest, event);
                    if (batch) {
                        batch.set(this.dataContext.playerQuests.doc(playerQuest.playerId), playerQuest);
                    }
                    else {
                        await this.dataContext.playerQuests.doc(playerQuest.playerId).set(playerQuest);
                    }
                    if (playerQuest.delaySeconds && playerQuest.stageIndex !== -1) {
                        console.log(`Delaying next stage by ${playerQuest.delaySeconds}s`);
                        setTimeout(async () => {
                            console.log(`Updating quest ${playerQuest.questId} for ${playerQuest.playerId}.`);
                            this.updatePlayerQuest(playerQuest, quest, event);
                            await this.dataContext.playerQuests.doc(playerQuest.playerId).set(playerQuest);
                        }, 1000 * playerQuest.delaySeconds);
                    }
                } else {
                    console.log(`Could not find quest with id ${playerQuest.questId}`);
                    this.updatePlayerLocation(event.playerId, event.sensorId);
                }
            }
        } else {
            console.log(
                `Received trigger for player ${event.playerId} and trigger ${event.sensorId}, but couldn't find active game`
            );

            this.updatePlayerLocation(event.playerId, event.sensorId);

            this.tryStartQuest(event.sensorId);
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
            const questNotStarted = questsStartingAtLocation.find(q =>
                !playerData.questsComplete ||
                (playerData.questsComplete as string[]).includes(q.id) === false);
            if (questNotStarted) {
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

            if (quest.stages[nextStageIndex - 1].sleepTime) {
                setTimeout(async () => {
                    await this.dataContext.players.doc(playerQuest.playerId).set({
                        id: playerQuest.playerId,
                        questActive: '',
                        questsComplete: FieldValue.arrayUnion(playerQuest.questId),
                        currentLocation: event.sensorId,
                    },
                        { merge: true });
                    await this.checkTriggerNextQuest(event.playerId);
                }, quest.stages[nextStageIndex - 1].sleepTime ?? 0);
            }
            else {
                await this.dataContext.players.doc(playerQuest.playerId).set({
                    id: playerQuest.playerId,
                    questActive: '',
                    questsComplete: FieldValue.arrayUnion(playerQuest.questId),
                    currentLocation: event.sensorId,
                },
                    { merge: true });

                this.checkTriggerNextQuest(event.playerId);
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
            playerQuest.triggerType = quest.stages[nextStageIndex].triggerType;
            playerQuest.name = quest.stages[nextStageIndex].name;
            playerQuest.backupTextId = quest.stages[nextStageIndex].backupTextId;
            playerQuest.backupTimeSeconds = quest.stages[nextStageIndex].backupTimeSeconds;
            playerQuest.playlistName = quest.stages[nextStageIndex - 1].playlistName;
            playerQuest.currentLocation = event.sensorId;
            playerQuest.stageCount = quest.stages.length;
            playerQuest.delaySeconds = quest.stages[nextStageIndex - 1].sleepTime ?? 0;

            await this.dataContext.players.doc(playerQuest.playerId).set({
                id: playerQuest.playerId,
                currentLocation: event.sensorId,
            }, { merge: true });

            if (quest.stages[nextStageIndex - 1].radioId && quest.stages[nextStageIndex - 1].radioPlaylistName) {
                console.log(`Setting playlist ${quest.stages[nextStageIndex - 1].radioPlaylistName} for radio ${quest.stages[nextStageIndex - 1].radioId}.`)
                await this.dataContext.playerQuests.doc(quest.stages[nextStageIndex - 1].radioId).set(
                    { playerId: quest.stages[nextStageIndex - 1].radioId, playlistName: quest.stages[nextStageIndex - 1].radioPlaylistName }, { merge: true });
            }
        }
    }


    private checkTriggerNextQuest = async (playerId: string) => {
        console.log(`Checking if next quest can be triggered for player ${playerId}`);
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
        const querySnapshot = await this.dataContext.events
            .where('sensorId', 'in', sensorIds)
            .get();

        if (!querySnapshot.empty) {
            const events = querySnapshot.docs.map((doc) => doc.data() as EventDAO);
            return events;
        }
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
}

export default EventService;
