import { getPlayers, getQuests } from '../../infrastructure/data/googleSheet';
import { Player } from '../../typings/player';
import { Quest } from '../../typings/quest';

class GameDataService {
    async getPlayers(): Promise<Player[]> {
        const players = await getPlayers();
        return players;
    }

    async getQuests(): Promise<Quest[]> {
        const quests = await getQuests();
        return quests.filter(q => q.state && q.state.toLowerCase().includes('fertig'));
    }
}

export default GameDataService;
