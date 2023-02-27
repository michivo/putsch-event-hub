import { uuidv4 } from '@firebase/util';
import DataContext from '../../infrastructure/data/dataContext';
import { Event, EventDAO } from '../../typings/event';
import { Timestamp } from '@google-cloud/firestore';
import GameDataService from '../gameData/gameDataService';
import { PlayerQuestDAO, PlayerQuestStage } from '../../typings/quest';

class EventService {
    constructor(private dataContext: DataContext, private gameData: GameDataService) {}

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

        const querySnapshot = await this.dataContext.playerQuests
            .where('playerId', '==', playerId)
            .limit(1)
            .get();

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
        };
        if (!querySnapshot.empty) {
            console.log(`Updating quest for player with id ${playerId}`);
            await this.dataContext.playerQuests.doc(playerId).set(playerQuest);
        } else {
            console.log(`Creating quest for player with id ${playerId}`);
            await this.dataContext.playerQuests.doc(playerId).create(playerQuest);
        }
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
        };
        if (!results.empty) {
            console.log(`Updating dummy quest for player with id ${playerId}`);
            await this.dataContext.playerQuests.doc(playerId).set(playerQuest);
        } else {
            console.log(`Creating dummy quest for player with id ${playerId}`);
            await this.dataContext.playerQuests.doc(playerId).create(playerQuest);
        }
    };

    private updateGameData = async (event: Event): Promise<void> => {
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
            const playerQuest = results.docs[0].data();
            const quest = quests.find((q) => q.id === playerQuest.questId);
            if (quest) {
                const nextStageIndex = playerQuest.stageIndex + 1;
                playerQuest.text = quest.stages[playerQuest.stageIndex].text;
                if (nextStageIndex >= quest.stages.length) {
                    console.log(
                        `Player ${playerQuest.playerId} has reached the final stage of quest ${playerQuest.questId}`
                    );
                    playerQuest.stageIndex = -1;
                    playerQuest.triggerIds = [];
                    playerQuest.triggerType = '';
                    playerQuest.name = '---DONE---';
                    playerQuest.backupTextId = '';
                    playerQuest.backupTimeSeconds = -1;
                    playerQuest.playlistName = '';
                    playerQuest.playlistName = quest.stages[nextStageIndex - 1].playlistName;
                    playerQuest.currentLocation = event.sensorId;
                } else {
                    console.log(
                        `Player ${playerQuest.playerId} has reached stage ${
                            nextStageIndex + 1
                        } of quest ${playerQuest.questId}`
                    );
                    playerQuest.stageIndex = nextStageIndex;
                    playerQuest.triggerIds = quest.stages[nextStageIndex].triggerIds;
                    playerQuest.triggerType = quest.stages[nextStageIndex].triggerType;
                    playerQuest.name = quest.stages[nextStageIndex].name;
                    playerQuest.backupTextId = quest.stages[nextStageIndex].backupTextId;
                    playerQuest.backupTimeSeconds = quest.stages[nextStageIndex].backupTimeSeconds;
                    playerQuest.playlistName = quest.stages[nextStageIndex - 1].playlistName;
                    playerQuest.currentLocation = event.sensorId;
                }
                await this.dataContext.playerQuests.doc(playerQuest.playerId).set(playerQuest);
            } else {
                console.log(`Could not find quest with id ${playerQuest.questId}`);
                if (event.playerId) {
                    this.updatePlayerLocation(event.playerId, event.sensorId);
                }
            }
        } else {
            console.log(
                `Received trigger for player ${event.playerId} and trigger ${event.sensorId}, but couldn't find active game`
            );
            if (event.playerId) {
                this.updatePlayerLocation(event.playerId, event.sensorId);
            }
        }
    };

    async updatePlayerLocation(playerId: string, sensorId: string): Promise<void> {
        const playerQuery = await this.dataContext.playerQuests
            .where('playerId', '==', playerId)
            .limit(1);

        const results = await playerQuery.get();
        if (!results.empty) {
            const playerQuest = results.docs[0].data();
            playerQuest.currentLocation = sensorId;
            await this.dataContext.playerQuests.doc(playerQuest.playerId).set(playerQuest);
        }
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
